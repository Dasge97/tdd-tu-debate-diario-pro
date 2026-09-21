/**
 * Datos de prueba del motor V2: feeds ficticios, un backend en memoria que
 * imita al real y un modelo falso. Nada de esto sale a la red.
 */
import { createHash } from 'node:crypto';

export const NOW = new Date('2026-09-21T09:00:00Z');

const rssItem = (title, link, description, pubDate, author = '') => `
  <item>
    <title><![CDATA[${title}]]></title>
    <link>${link}</link>
    <description><![CDATA[<p>${description}</p><script>alert(1)</script>]]></description>
    <pubDate>${pubDate}</pubDate>
    ${author ? `<dc:creator>${author}</dc:creator>` : ''}
  </item>`;

const rss = (items) => `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>Feed</title>${items.join('')}</channel></rss>`;

const D = (h) => new Date(Date.UTC(2026, 8, 21, h, 0)).toUTCString();

/** Acontecimientos del día, contados por uno o varios medios. */
export const FEEDS = {
  'https://medio-a.example/rss': rss([
    rssItem('El Parlamento de Aragón aprueba la ley de transparencia municipal', 'https://medio-a.example/aragon-transparencia?utm_source=rss', 'Las Cortes de Aragón aprobaron la ley de transparencia municipal con el apoyo de la mayoría. La norma obliga a los ayuntamientos a publicar sus contratos.', D(6)),
    rssItem('El Banco Central Europeo mantiene los tipos de interés en el 2%', 'https://medio-a.example/bce-tipos', 'El Banco Central Europeo decidió mantener los tipos de interés en el 2% por la inflación. Lagarde explicó que la inflación sigue por encima del objetivo.', D(7)),
    rssItem('Investigadores del CSIC descubren una nueva especie de coral en Canarias', 'https://medio-a.example/csic-coral', 'Un equipo del CSIC ha descrito una nueva especie de coral en aguas de Canarias. El estudio se publica en una revista científica.', D(6)),
    rssItem('Los embalses del Segura bajan al 18% por la sequía', 'https://medio-a.example/segura-embalses', 'La cuenca del Segura tiene sus embalses al 18% por la sequía. La Confederación Hidrográfica del Segura estudia restricciones de agua.', D(8)),
    rssItem('Renfe suspende los trenes de Cercanías en Málaga por obras durante un mes', 'https://medio-a.example/renfe-malaga', 'Renfe suspende los trenes de Cercanías en Málaga durante un mes por obras. Habrá autobuses alternativos para los viajeros.', D(7)),
    rssItem('El Ayuntamiento de Valencia limita los pisos turísticos en el centro histórico', 'https://medio-a.example/valencia-pisos', 'El Ayuntamiento de Valencia aprobó limitar los pisos turísticos en Ciutat Vella. La vivienda y el alquiler preocupan a los vecinos.', D(8)),
    rssItem('Un incendio forestal en Ourense quema 500 hectáreas', 'https://medio-a.example/ourense-incendio', 'OURENSE, 21 Sep. (EFE) - Un incendio forestal en Ourense ha quemado 500 hectáreas según la Xunta de Galicia.', D(6), 'EFE'),
    rssItem('Noticia sin fecha', 'https://medio-a.example/sin-fecha', 'Un texto sin fecha conocida.', ''),
  ]),
  'https://medio-b.example/rss': rss([
    rssItem('Las Cortes de Aragón dan luz verde a la ley de transparencia municipal', 'https://medio-b.example/cortes-aragon-transparencia', 'Aragón aprueba la ley de transparencia municipal: los ayuntamientos deberán publicar contratos y subvenciones.', D(7)),
    rssItem('El BCE deja sin cambios los tipos de interés en el 2% por la inflación', 'https://medio-b.example/bce-tipos-2', 'El Banco Central Europeo mantiene los tipos de interés en el 2%. Lagarde advierte de la inflación.', D(8)),
    rssItem('La Comisión Europea multa a una plataforma de vídeo por incumplir la ley de servicios digitales', 'https://medio-b.example/multa-plataforma', 'La Comisión Europea impone una multa a una plataforma de vídeo por incumplir la ley de servicios digitales sobre algoritmos y privacidad de menores.', D(7)),
    rssItem('Los embalses de la cuenca del Segura caen al 18% por la sequía', 'https://medio-b.example/sequia-segura', 'Sequía: los embalses del Segura están al 18%. La Confederación Hidrográfica del Segura prepara restricciones de agua.', D(7)),
    rssItem('Renfe cortará un mes los Cercanías de Málaga por obras', 'https://medio-b.example/cercanias-malaga', 'Renfe suspende un mes los Cercanías de Málaga por obras con autobuses alternativos.', D(8)),
    rssItem('Bilbao aprueba ayudas al alquiler para menores de 35 años', 'https://medio-b.example/bilbao-alquiler', 'El Ayuntamiento de Bilbao aprobó ayudas al alquiler de vivienda para jóvenes menores de 35 años.', D(7)),
    rssItem('Un incendio forestal en Ourense quema 500 hectáreas', 'https://medio-b.example/incendio-ourense', 'OURENSE, 21 Sep. (EFE) - Un incendio forestal en Ourense ha quemado 500 hectáreas según la Xunta de Galicia.', D(7), 'EFE'),
  ]),
  'https://agencia-c.example/atom': `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"><title>Agencia C</title>
  <entry><title>El CSIC describe una nueva especie de coral en Canarias</title><link href="https://agencia-c.example/coral-canarias"/><id>c1</id>
    <published>2026-09-21T07:30:00Z</published><summary>Investigadores del CSIC describen una especie de coral nueva en Canarias en un estudio científico.</summary></entry>
  <entry><title>Bruselas multa a una plataforma de vídeo por la ley de servicios digitales</title><link href="https://agencia-c.example/multa-dsa"/><id>c2</id>
    <published>2026-09-21T08:00:00Z</published><summary>La Comisión Europea multa a una plataforma de vídeo por la ley de servicios digitales y la privacidad de menores.</summary></entry>
</feed>`,
};

export const SOURCES = [
  { id: 1, slug: 'medio-a', name: 'Medio A', type: 'rss', url: 'https://medio-a.example/rss', language: 'es', scope: 'es', topics: ['política', 'economía'], origin_type: 'medio' },
  { id: 2, slug: 'medio-b', name: 'Medio B', type: 'rss', url: 'https://medio-b.example/rss', language: 'es', scope: 'es', topics: ['sociedad'], origin_type: 'medio' },
  { id: 3, slug: 'agencia-c', name: 'Agencia C', type: 'atom', url: 'https://agencia-c.example/atom', language: 'es', scope: 'es', topics: ['ciencia', 'tecnología'], origin_type: 'agencia' },
  { id: 4, slug: 'rota', name: 'Fuente rota', type: 'rss', url: 'https://rota.example/rss', language: 'es', scope: 'es', topics: ['medioambiente'], origin_type: 'medio' },
];

export const PERSONAS = [
  { id: 11, username: 'raul', display_name: 'Raúl', specialty: 'política', traits: ['directo'], days_since: 1 },
  { id: 12, username: 'a-23', display_name: 'A-23', specialty: 'economía', traits: ['preciso'], days_since: 5 },
  { id: 13, username: 'axion', display_name: 'Axion', specialty: 'ciencia', traits: ['sereno'], days_since: 2 },
  { id: 14, username: 'pixie', display_name: 'Pixie', specialty: 'tecnología', traits: ['visionaria'], days_since: null },
  { id: 15, username: 'artemisa', display_name: 'Artemisa', specialty: 'medioambiente', traits: ['serena'], days_since: 4 },
  { id: 16, username: 'marcos', display_name: 'Marcos', specialty: 'sociedad', traits: ['curioso'], days_since: 1 },
  { id: 17, username: 'nyx', display_name: 'Nyx', specialty: 'ética', traits: ['astuta'], days_since: 2 },
  { id: 18, username: 'nodo', display_name: 'Nodo', specialty: 'filosofía', traits: ['preciso'], days_since: 1 },
];

export const LIMITS = {
  timezone: 'Europe/Madrid', maxItemsPerSource: 40, maxArticleAgeHours: 48, maxExcerptChars: 1200, fetchTimeoutMs: 1000,
  maxFeedBytes: 1_000_000, fetchConcurrency: 2, clusterWindowHours: 72, maxCandidates: 10, maxDossiers: 20, maxEvidencePerDossier: 6,
  maxEvidenceChars: 900, maxInputChars: 14000, maxOutputTokens: 2500, llmTimeoutMs: 5000, llmConcurrency: 2,
  maxLlmCalls: 40, maxTotalTokens: 250000, maxRepairAttempts: 1, maxReplacements: 3,
};

/** Descarga falsa: devuelve el XML del fixture o falla como una fuente caída. */
export async function fakeFetcher(url) {
  if (!FEEDS[url]) {
    const err = new Error('HTTP 503');
    err.code = 'http';
    throw err;
  }
  return { status: 200, notModified: false, body: FEEDS[url], finalUrl: url, etag: '"v1"', lastModified: null };
}

const sha = (s) => createHash('sha256').update(s).digest('hex');

/**
 * Backend en memoria con la misma semántica que el real en lo que el
 * pipeline necesita: versiones de acontecimiento, caché de dossiers,
 * bloqueo de ejecución, lote atómico e idempotente.
 */
export function fakeApi({ mode = 'dry_run', target = 5, limits = LIMITS, personas = PERSONAS, recent = [] } = {}) {
  const db = { articles: [], events: new Map(), dossiers: [], runs: new Map(), published: [], calls: [], reports: [] };
  let nextArticle = 1;
  let nextEvent = 1;
  let nextDossier = 1;

  const independenceKey = (a) => (a.agency ? `agencia:${a.agency.toLowerCase()}` : `fuente:${a.source_slug}`);
  const summary = (e) => ({ ...e, articles: undefined });

  const api = {
    db,
    config: async () => ({ engine: 'v2', mode, target_debates: target, dedup_days: 14, rotation_limit_days: 3, limits, llm: { provider: 'openai-compatible', base_url: 'https://llm.example', model: 'modelo-falso', api_key: 'sk-falsa' } }),
    personas: async () => personas,
    sources: async () => SOURCES,
    reportSources: async (reports) => { db.reports.push(...reports); return { updated: reports.length }; },
    upsertArticles: async (sourceId, items) => items.map((item) => {
      const existing = db.articles.find((a) => a.url_hash === item.url_hash);
      if (existing) {
        const changed = existing.content_hash !== item.content_hash;
        Object.assign(existing, item);
        return { url_hash: item.url_hash, id: existing.id, status: changed ? 'changed' : 'unchanged' };
      }
      const src = SOURCES.find((s) => s.id === sourceId);
      const a = { ...item, id: nextArticle++, source_id: sourceId, source_slug: src.slug, source_name: src.name, origin_type: src.origin_type, scope: src.scope, source_topics: src.topics, fetched_at: NOW.toISOString(), event_id: null };
      db.articles.push(a);
      return { url_hash: item.url_hash, id: a.id, status: 'created' };
    }),
    windowArticles: async () => db.articles.map((a) => ({ ...a })),
    saveClusters: async (clusters) => clusters.map((c) => {
      let event = c.event_id ? db.events.get(c.event_id) : null;
      const isNew = !event;
      if (!event) {
        event = { event_id: nextEvent++, version: 1, evidence_hash: '', last_published_at: null, last_published_version: null };
        db.events.set(event.event_id, event);
      }
      db.articles.filter((a) => c.article_ids.includes(a.id)).forEach((a) => { a.event_id = event.event_id; });
      const members = db.articles.filter((a) => a.event_id === event.event_id);
      const hash = sha(members.map((a) => `${a.id}:${a.content_hash}`).join('|'));
      if (!isNew && event.evidence_hash && event.evidence_hash !== hash) event.version++;
      Object.assign(event, {
        title: c.title, topics: c.topics, keywords: c.keywords, evidence_hash: hash,
        article_count: members.length, independent_sources: new Set(members.map(independenceKey)).size,
      });
      return summary(event);
    }),
    events: async (ids) => ids.map((id) => summary(db.events.get(id))),
    recent: async () => recent,
    findDossier: async (eventId, hash, promptVersion, model) =>
      db.dossiers.find((d) => d.event_id === eventId && d.evidence_hash === hash && d.prompt_version === promptVersion && d.model === model) ?? null,
    saveDossier: async (d) => { const saved = { ...d, id: nextDossier++ }; db.dossiers.push(saved); return saved; },
    startRun: async ({ mode: m, editorial_day: day, resume }) => {
      if ([...db.runs.values()].some((r) => r.status === 'running')) throw Object.assign(new Error('409'), { status: 409 });
      if (resume) {
        const prev = [...db.runs.values()].reverse().find((r) => r.day === day && r.mode === m && ['failed', 'aborted', 'incomplete'].includes(r.status));
        if (prev) { prev.status = 'running'; return { run: { id: prev.id }, stages: prev.stages, assignments: prev.assignments, resumed: true }; }
      }
      const run = { id: `run-${db.runs.size + 1}`, day, mode: m, status: 'running', stages: [], assignments: [] };
      db.runs.set(run.id, run);
      return { run: { id: run.id }, stages: [], assignments: [], resumed: false };
    },
    run: async (id) => ({ run: db.runs.get(id), stages: db.runs.get(id).stages, assignments: db.runs.get(id).assignments.map((a) => ({ ...a })) }),
    heartbeat: async () => ({ ok: true }),
    stage: async (id, s) => {
      const run = db.runs.get(id);
      const existing = run.stages.find((x) => x.name === s.name);
      if (existing) Object.assign(existing, s); else run.stages.push({ ...s });
      return { ok: true };
    },
    llmCalls: async (id, calls) => { db.calls.push(...calls.map((c) => ({ run: id, ...c }))); return { recorded: calls.length }; },
    saveAssignments: async (id, items) => {
      const run = db.runs.get(id);
      return items.map((item) => {
        let a = run.assignments.find((x) => x.slot === item.slot);
        if (!a) {
          const dossier = db.dossiers.find((d) => d.id === item.dossier_id);
          if (!dossier || dossier.status !== 'ok') throw new Error('evidencia insuficiente');
          a = { slot: item.slot, persona_id: item.persona_id, persona_username: personas.find((p) => p.id === item.persona_id).username, event_id: item.event_id, dossier_id: item.dossier_id, status: 'planned' };
          run.assignments.push(a);
        }
        for (const k of ['status', 'draft', 'review', 'rejection_reason', 'scores', 'reasons']) if (k in item) a[k] = item[k];
        return { ...a };
      });
    },
    publish: async (id) => {
      const run = db.runs.get(id);
      if (run.mode !== 'live') throw new Error('una ejecución de prueba no publica');
      if (run.status === 'published') return { status: 'published', created: 0, debate_ids: run.debateIds, already_published: true };
      const validated = run.assignments.filter((a) => a.status === 'validated').slice(0, target);
      if (validated.length < target) throw Object.assign(new Error('CONFLICT: lote incompleto'), { status: 409 });
      run.debateIds = validated.map((a, i) => { db.published.push({ ...a.draft, persona_id: a.persona_id, event_id: a.event_id }); return i + 1; });
      validated.forEach((a) => { a.status = 'published'; });
      run.status = 'published';
      return { status: 'published', created: validated.length, debate_ids: run.debateIds, already_published: false };
    },
    finish: async (id, { status, error, metrics }) => {
      const run = db.runs.get(id);
      if (run.status !== 'published') { run.status = status; run.error = error; }
      run.metrics = metrics;
      return { id, status: run.status };
    },
  };
  return api;
}

const TOPIC_WORDS = [
  ['política', /parlamento|cortes|ley de transparencia/i],
  ['economía', /banco central|tipos de interés|bce/i],
  ['ciencia', /csic|coral|especie/i],
  ['tecnología', /plataforma|servicios digitales/i],
  ['medioambiente', /embalses|sequía|incendio/i],
  ['sociedad', /renfe|cercanías|alquiler|pisos turísticos/i],
];

const words = (n, w = 'dato') => Array.from({ length: n }, (_, i) => `${w}${i % 7}`).join(' ');

/**
 * Modelo falso. Reconoce el tipo de llamada por el prompt de sistema.
 * `failGenerateFor` hace que el borrador de un personaje salga siempre mal.
 */
export function fakeLlmTransport({ failGenerateFor = null, usage = true, insufficientFor = null } = {}) {
  const log = [];
  const transport = async (body) => {
    const system = body.messages[0].content;
    const user = body.messages[1].content;
    log.push({ system: system.slice(0, 40), user });
    const reply = (obj) => ({
      model: body.model,
      choices: [{ message: { content: JSON.stringify(obj) } }],
      usage: usage ? { prompt_tokens: Math.ceil(user.length / 4), completion_tokens: 300, prompt_tokens_details: { cached_tokens: 0 } } : undefined,
    });

    if (system.includes('documentalista')) {
      const ids = [...user.matchAll(/^\[(E\d+)\]/gm)].map((m) => m[1]);
      const topic = TOPIC_WORDS.find(([, re]) => re.test(user))?.[0] ?? 'sociedad';
      const fit = Object.fromEntries(['política', 'economía', 'ciencia', 'tecnología', 'sociedad', 'ética', 'filosofía', 'medioambiente'].map((s) => [s, s === topic ? 0.9 : 0.1]));
      if (topic === 'tecnología') fit['ética'] = 0.7;
      if (topic === 'ciencia') fit['filosofía'] = 0.6;
      if (insufficientFor && new RegExp(insufficientFor, 'i').test(user)) {
        return reply({ status: 'insufficient', insufficient_reason: 'solo titulares', facts: [], debatable_proposals: [], specialty_fit: fit });
      }
      return reply({
        status: 'ok', headline: 'Titular neutral', summary: 'Resumen neutral.',
        facts: [{ text: 'Hecho uno', refs: [ids[0]] }, { text: 'Hecho dos', refs: ids.slice(0, 2) }, { text: 'Hecho tres', refs: [ids[0], 'E99'] }],
        claims: [{ actor: 'Portavoz', statement: 'Es una buena medida', refs: [ids[0]] }],
        debatable_proposals: [{ proposal: 'Aplicar la medida anunciada', who_decides: 'la institución', refs: [ids[0]] }],
        specialty_fit: fit, spain_relevance: 0.9, public_interest: 0.7,
      });
    }
    if (system.includes('Redactas debates')) {
      const persona = /PERSONAJE: (\S+)/.exec(user)[1];
      if (failGenerateFor && persona === failGenerateFor) {
        return reply({ title: 'Corto?', question: 'x', card_summary: 'y', context: 'z', used_refs: ['E1'], primary_ref: 'E1' });
      }
      return reply({
        title: `¿Debería aplicarse la medida anunciada que ahora analiza ${persona} con los datos?`,
        question: '¿Estás a favor de que la institución aplique la medida anunciada tal y como se ha presentado hoy?',
        card_summary: 'La institución ha anunciado una medida. Estos son los hechos conocidos, lo que dicen las partes y lo que aún falta por saber.',
        context: words(210),
        used_refs: ['E1', 'E2', 'E77'],
        primary_ref: 'E1',
      });
    }
    if (system.includes('editor de verificación')) {
      return reply({ verdict: 'pass', issues: [] });
    }
    throw new Error('llamada no reconocida');
  };
  return { transport, log };
}

export const silentLogger = { info: () => {}, warn: () => {}, error: () => {} };
