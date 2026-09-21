import { safeFetch } from './http.js';
import { parseFeed } from './feeds.js';
import { detectAgency } from './agency.js';
import { parseFeedDate } from './dates.js';
import { normalizeUrl, urlHash } from './urls.js';
import { sha256, truncate } from './text.js';

/** Ejecuta tareas con un máximo de N a la vez. */
export async function pool(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return results;
}

/**
 * Convierte un elemento del feed en la noticia que se guarda.
 * Devuelve null si no tiene URL válida o título.
 */
export function toArticle(item, source, limits, now = new Date()) {
  const normalized = normalizeUrl(item.link || item.guid);
  if (!normalized || !item.title) return null;

  const published = parseFeedDate(item.published) ?? parseFeedDate(item.updated);
  const excerpt = truncate(item.summary ?? '', limits.maxExcerptChars);
  const tooOld = published && (now.getTime() - Date.parse(published)) > limits.maxArticleAgeHours * 3_600_000;

  return {
    skip: tooOld ? 'antigua' : null,
    article: {
      url: item.link || normalized,
      canonical_url: normalized,
      url_hash: urlHash(normalized),
      title: truncate(item.title, 480),
      excerpt: excerpt || null,
      content_hash: sha256(`${item.title}\n${excerpt}`),
      published_at: published,
      source_updated_at: parseFeedDate(item.updated),
      language: source.language,
      agency: detectAgency(item, { originType: source.origin_type, name: source.name }),
    },
  };
}

/**
 * Descarga todas las fuentes activas y guarda sus noticias.
 *
 * @returns {Promise<{sources: object[], totals: object}>} cobertura por fuente y totales
 */
export async function ingestAll({ api, limits, logger, fetcher = safeFetch, now = new Date() }) {
  const sources = await api.sources();
  const reports = await pool(sources, limits.fetchConcurrency, async (source) => {
    const started = Date.now();
    const report = { source_id: source.id, slug: source.slug, topics: source.topics, scope: source.scope };
    try {
      const res = await fetcher(source.url, {
        timeoutMs: limits.fetchTimeoutMs,
        maxBytes: limits.maxFeedBytes,
        etag: source.etag,
        lastModified: source.last_modified,
      });
      if (res.notModified) {
        return { ...report, status: 'not_modified', item_count: 0, created: 0, changed: 0, ms: Date.now() - started };
      }

      const items = parseFeed(res.body).slice(0, limits.maxItemsPerSource);
      const counters = { invalid: 0, too_old: 0, unknown_date: 0 };
      const articles = [];
      for (const item of items) {
        const converted = toArticle(item, source, limits, now);
        if (!converted) { counters.invalid++; continue; }
        if (converted.skip) { counters.too_old++; continue; }
        if (!converted.article.published_at) counters.unknown_date++;
        articles.push(converted.article);
      }

      const saved = articles.length ? await api.upsertArticles(source.id, articles) : [];
      return {
        ...report,
        status: 'ok',
        item_count: items.length,
        created: saved.filter((a) => a.status === 'created').length,
        changed: saved.filter((a) => a.status === 'changed').length,
        ...counters,
        etag: res.etag,
        last_modified: res.lastModified,
        ms: Date.now() - started,
      };
    } catch (err) {
      logger?.warn(`Fuente ${source.slug}: ${err.message}`);
      return { ...report, status: 'error', error: `${err.code ?? 'error'}: ${err.message}`, ms: Date.now() - started };
    }
  });

  await api.reportSources(reports);

  const totals = {
    sources: reports.length,
    sources_ok: reports.filter((r) => r.status !== 'error').length,
    sources_failed: reports.filter((r) => r.status === 'error').length,
    items: sum(reports, 'item_count'),
    created: sum(reports, 'created'),
    changed: sum(reports, 'changed'),
    too_old: sum(reports, 'too_old'),
    unknown_date: sum(reports, 'unknown_date'),
    invalid: sum(reports, 'invalid'),
    coverage_by_topic: coverageByTopic(reports),
  };
  return { sources: reports, totals };
}

const sum = (list, key) => list.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);

/** Cuántas fuentes han respondido bien por cada especialidad. */
function coverageByTopic(reports) {
  const out = {};
  for (const r of reports) {
    for (const topic of r.topics ?? []) {
      out[topic] ??= { sources_ok: 0, sources_failed: 0 };
      out[topic][r.status === 'error' ? 'sources_failed' : 'sources_ok']++;
    }
  }
  return out;
}
