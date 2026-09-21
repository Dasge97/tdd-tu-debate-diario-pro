import { LOW_VALUE_TITLE, properNouns, tokens } from './text.js';
import { TOPIC_LEXICON } from './topics.js';

/**
 * ¿Son del mismo asunto? Comparten al menos dos nombres propios (por ejemplo
 * "Ceuta" y "Feijóo"). No se descartan por eso, pero no deben ir juntos en el
 * lote del día.
 */
export function sameTopicArea(a, b) {
  if (!a?.entities || !b?.entities) return false;
  let shared = 0;
  for (const e of a.entities) if (b.entities.has(e)) shared++;
  return shared >= 2;
}

/** ¿Cuentan la misma historia? Comparten al menos dos nombres propios y bastante vocabulario. */
function sameStory(a, b) {
  let sharedEntities = 0;
  for (const e of a.entities) if (b.entities.has(e)) sharedEntities++;
  return sharedEntities >= 2 && jaccard(a.tokens, b.tokens) >= 0.2;
}

/**
 * Preselección barata de acontecimientos, sin modelo.
 *
 * Solo los candidatos que pasan de aquí llegan al dossier (llamada al modelo),
 * así que es donde se controla el consumo.
 */

const jaccard = (a, b) => {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
};

/** Parecido de título a partir del cual un acontecimiento cuenta como ya tratado. */
export const REPEAT_TITLE_SIMILARITY = 0.4;

/**
 * @param {object} p
 * @param {object[]} p.events           resumen de acontecimientos (del backend) con topics
 * @param {Map<number, object[]>} p.articlesByEvent
 * @param {object[]} p.recentDebates    debates publicados en los últimos dedup_days
 * @param {object} p.limits
 * @param {number} p.dedupDays
 * @param {Date} p.now
 */
export function preselect({ events, articlesByEvent, recentDebates, limits, dedupDays, now = new Date() }) {
  const discarded = [];
  const scored = [];
  const recentTitles = recentDebates.map((d) => ({ ...d, tokens: new Set(tokens(`${d.title} ${d.question ?? ''}`)) }));
  const recentEventVersions = new Map(recentDebates.filter((d) => d.event_id).map((d) => [d.event_id, d.event_version]));
  const maxAgeMs = limits.maxArticleAgeHours * 3_600_000;

  for (const event of events) {
    const articles = articlesByEvent.get(event.event_id) ?? [];
    const discard = (reason) => discarded.push({ event_id: event.event_id, title: event.title, reason });

    // Solo si todas sus noticias son piezas de servicio: una sola no invalida el acontecimiento.
    const titles = articles.length ? articles.map((a) => a.title) : [event.title];
    if (titles.every((t) => LOW_VALUE_TITLE.test(t.trim()))) { discard('pieza sin valor de debate (servicio, directo, pasatiempo)'); continue; }

    // Una resolución del BOE sin ningún medio que la cuente no es actualidad para
    // debatir. Sigue sirviendo como fuente primaria cuando un medio sí la cubre.
    if (articles.length && articles.every((a) => a.origin_type === 'institucional')) {
      discard('solo fuentes institucionales, sin cobertura de medios');
      continue;
    }

    const dated = articles.filter((a) => a.published_at);
    if (!dated.length) { discard('fecha desconocida en todas sus noticias'); continue; }
    const newest = Math.max(...dated.map((a) => Date.parse(a.published_at)));
    const ageMs = now.getTime() - newest;
    if (ageMs > maxAgeMs) { discard(`sin noticias de las últimas ${limits.maxArticleAgeHours} h`); continue; }

    // Repetición: el mismo acontecimiento ya publicado en esta versión, o uno muy parecido.
    const publishedVersion = recentEventVersions.get(event.event_id) ?? event.last_published_version;
    const publishedRecently = recentEventVersions.has(event.event_id)
      || (event.last_published_at && (now - Date.parse(event.last_published_at)) < dedupDays * 86_400_000);
    let evolution = false;
    if (publishedRecently) {
      if (publishedVersion !== null && publishedVersion !== undefined && event.version > publishedVersion) {
        evolution = true;
      } else {
        discard('ya publicado y sin novedades desde entonces');
        continue;
      }
    }
    const eventTokens = new Set(tokens(`${event.title} ${articles.map((a) => a.title).join(' ')}`));
    const similar = recentTitles.find((d) => d.event_id !== event.event_id && jaccard(eventTokens, d.tokens) >= REPEAT_TITLE_SIMILARITY);
    if (similar) { discard(`parecido a un debate del ${similar.day_date}: "${similar.title}"`); continue; }

    const recency = 1 - ageMs / maxAgeMs;
    const coverage = Math.min(1, Math.log2(1 + event.independent_sources) / 3);
    const spanish = articles.filter((a) => a.scope === 'es').length / Math.max(1, articles.length);
    const topical = (event.topics ?? []).length ? 1 : 0.3;
    const score = 0.4 * recency + 0.35 * coverage + 0.15 * spanish + 0.1 * topical - (evolution ? 0.1 : 0);

    scored.push({
      event_id: event.event_id,
      title: event.title,
      topics: event.topics ?? [],
      version: event.version,
      evidence_hash: event.evidence_hash,
      independent_sources: event.independent_sources,
      score: round(score),
      parts: { recency: round(recency), coverage: round(coverage), spanish: round(spanish), topical, evolution },
      story: { tokens: eventTokens, entities: new Set(articles.flatMap((a) => properNouns(a.title))) },
    });
  }

  scored.sort((a, b) => b.score - a.score);

  // La misma historia contada como dos acontecimientos (la noticia y una reacción) solo entra una vez.
  const unique = [];
  for (const c of scored) {
    const dup = unique.find((u) => sameStory(c.story, u.story));
    if (dup) {
      discarded.push({ event_id: c.event_id, title: c.title, reason: `misma historia que "${dup.title}"` });
    } else {
      unique.push(c);
    }
  }

  // Variedad: por turnos entre especialidades, el mejor acontecimiento de cada
  // una; luego se completa por puntuación. Así no se llenan los candidatos con
  // un solo tema aunque ese día domine la portada.
  const candidates = [];
  const taken = new Set();
  const topics = Object.keys(TOPIC_LEXICON);
  // Primera vuelta: el mejor acontecimiento cuyo tema principal es cada especialidad.
  // Segunda: el mejor que la toque como tema secundario.
  for (const matches of [(c, t) => c.topics[0] === t, (c, t) => c.topics.includes(t)]) {
    for (const topic of topics) {
      if (candidates.length >= limits.maxCandidates) break;
      if (candidates.some((c) => c.topics.includes(topic))) continue;
      const pick = unique.find((c) => !taken.has(c.event_id) && matches(c, topic));
      if (pick) {
        taken.add(pick.event_id);
        candidates.push(pick);
      }
    }
  }
  // El resto, por puntuación.
  for (const c of unique) {
    if (candidates.length >= limits.maxCandidates) break;
    if (!taken.has(c.event_id)) {
      taken.add(c.event_id);
      candidates.push(c);
    }
  }
  // Reserva: los siguientes mejores, por si muchos candidatos resultan sin
  // evidencia suficiente en el dossier. Solo se usan si hacen falta.
  const reserve = [];
  for (const c of unique) {
    if (taken.has(c.event_id)) continue;
    if (reserve.length < 2 * limits.maxCandidates) {
      reserve.push(c);
    } else {
      discarded.push({ event_id: c.event_id, title: c.title, reason: 'fuera del cupo de candidatos' });
    }
  }

  // La firma (palabras y nombres propios) se queda en memoria: la asignación
  // la usa para no juntar en el lote dos acontecimientos del mismo asunto.
  return { candidates, reserve, discarded };
}

const round = (n) => Math.round(n * 1000) / 1000;
