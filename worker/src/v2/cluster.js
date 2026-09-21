import { LOW_VALUE_TITLE, figures, properNouns, tokens } from './text.js';
import { hoursBetween } from './dates.js';
import { topicScores } from './topics.js';

/**
 * Agrupa noticias en acontecimientos con reglas y similitud de texto, sin modelo.
 *
 * Dos noticias son el mismo suceso si están cerca en el tiempo y comparten
 * vocabulario y nombres propios. No basta con el tema: dos noticias de
 * vivienda de ciudades distintas quedan separadas porque no comparten
 * nombres propios ni suficientes palabras.
 *
 * Una noticia nueva se une al grupo con el que más se parece. Se compara con
 * cada miembro y tiene que parecerse al menos a un tercio de ellos, para no
 * encadenar noticias cada vez menos parecidas.
 */

export const CLUSTER_RULES = {
  maxHoursApart: 48,
  // Parecido de palabras (Jaccard) suficiente por sí solo.
  strongTokenSimilarity: 0.45,
  // Parecido de palabras exigido cuando además comparten nombres propios.
  weakTokenSimilarity: 0.18,
  minSharedEntities: 1,
};

/**
 * Nombres propios que aparecen en muchos sucesos sin distinguirlos: dos
 * noticias no son el mismo suceso por hablar las dos de "el Ayuntamiento".
 */
const GENERIC_ENTITIES = new Set([
  'ayuntamiento', 'gobierno', 'congreso', 'senado', 'ministerio', 'comunidad', 'junta', 'generalitat', 'xunta',
  'tribunal', 'tribunal supremo', 'policia', 'policia nacional', 'guardia civil', 'estado', 'espana', 'europa',
  'union europea', 'comision europea', 'parlamento', 'consejo', 'ejecutivo', 'oposicion', 'hacienda',
]);

export function signature(article) {
  const text = `${article.title} ${article.excerpt ?? ''}`;
  const entities = properNouns(article.title).concat(properNouns(String(article.excerpt ?? '').slice(0, 300)))
    .filter((e) => !GENERIC_ENTITIES.has(e));
  return {
    tokens: new Set(tokens(text)),
    titleTokens: new Set(tokens(article.title)),
    entities: new Set(entities),
    figures: new Set(figures(text)),
    time: article.published_at ?? article.fetched_at,
  };
}

const jaccard = (a, b) => {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
};
const overlap = (a, b) => {
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n;
};

/** ¿Son la misma noticia? Devuelve una puntuación de 0 a 1, o 0 si no. */
export function similarity(sa, sb, rules = CLUSTER_RULES) {
  if (sa.time && sb.time && hoursBetween(sa.time, sb.time) > rules.maxHoursApart) return 0;
  const tokenSim = Math.max(jaccard(sa.tokens, sb.tokens), jaccard(sa.titleTokens, sb.titleTokens));
  const sharedEntities = overlap(sa.entities, sb.entities);
  const sharedFigures = overlap(sa.figures, sb.figures);

  if (tokenSim >= rules.strongTokenSimilarity) return tokenSim;
  if (sharedEntities >= rules.minSharedEntities && tokenSim >= rules.weakTokenSimilarity) {
    return Math.min(1, tokenSim + 0.1 * sharedEntities + 0.1 * sharedFigures);
  }
  return 0;
}

/** Filtro rápido: sin ninguna palabra de título ni nombre propio en común, ni se compara. */
function sharesAnything(sig, groupSig) {
  for (const t of sig.titleTokens) if (groupSig.tokens.has(t)) return true;
  for (const e of sig.entities) if (groupSig.entities.has(e)) return true;
  return false;
}

/** Firma del grupo: une las de sus noticias. */
function mergeSignatures(sigs) {
  const out = { tokens: new Set(), titleTokens: new Set(), entities: new Set(), figures: new Set(), time: null };
  const entityCounts = new Map();
  for (const s of sigs) {
    s.tokens.forEach((t) => out.tokens.add(t));
    s.titleTokens.forEach((t) => out.titleTokens.add(t));
    s.figures.forEach((f) => out.figures.add(f));
    s.entities.forEach((e) => entityCounts.set(e, (entityCounts.get(e) ?? 0) + 1));
    if (s.time && (!out.time || s.time > out.time)) out.time = s.time;
  }
  entityCounts.forEach((_, e) => out.entities.add(e));
  return out;
}

/**
 * @param {object[]} articles noticias de la ventana (con event_id si ya tenían acontecimiento)
 * @returns {Array<{event_id: ?number, article_ids: number[], title: string, keywords: string[], topics: string[], changed: boolean}>}
 */
export function clusterArticles(articles, rules = CLUSTER_RULES) {
  const sigs = new Map(articles.map((a) => [a.id, signature(a)]));
  const clusters = [];

  // 1. Los acontecimientos que ya existen se respetan: sus noticias siguen juntas.
  const byEvent = new Map();
  for (const a of articles) {
    if (a.event_id) {
      if (!byEvent.has(a.event_id)) byEvent.set(a.event_id, []);
      byEvent.get(a.event_id).push(a);
    }
  }
  for (const [eventId, members] of byEvent) {
    clusters.push({ event_id: eventId, members, changed: false, sig: mergeSignatures(members.map((m) => sigs.get(m.id))) });
  }

  // 2. Las noticias nuevas se unen al grupo más parecido o abren uno.
  const fresh = articles.filter((a) => !a.event_id)
    .sort((x, y) => String(x.published_at ?? x.fetched_at).localeCompare(String(y.published_at ?? y.fetched_at)));
  for (const article of fresh) {
    const sig = sigs.get(article.id);
    let best = null;
    let bestScore = 0;
    for (const cluster of clusters) {
      // Se compara con cada miembro, no con la suma de sus palabras: la suma
      // crece con el grupo y diluye el parecido. Tiene que parecerse al menos
      // a un tercio de los miembros, para no encadenar noticias cada vez más lejanas.
      if (!sharesAnything(sig, cluster.sig)) continue;
      let agreeing = 0;
      let sum = 0;
      for (const m of cluster.members) {
        const s = similarity(sig, sigs.get(m.id), rules);
        if (s > 0) { agreeing++; sum += s; }
      }
      if (agreeing === 0 || agreeing * 3 < cluster.members.length) continue;
      const score = sum / agreeing;
      if (score > bestScore) {
        best = cluster;
        bestScore = score;
      }
    }
    if (best) {
      best.members.push(article);
      best.sig = mergeSignatures([best.sig, sig]);
      best.changed = true;
    } else {
      clusters.push({ event_id: null, members: [article], changed: true, sig: mergeSignatures([sig]) });
    }
  }

  return clusters.map((c) => describeCluster(c, sigs));
}

function describeCluster(cluster, sigs) {
  const members = cluster.members;
  const merged = mergeSignatures(members.map((m) => sigs.get(m.id)));
  // Título representativo: el del miembro que más se parece al resto, sin
  // contar piezas de servicio ("Consulte el auto...") si hay otras.
  const eligible = members.filter((m) => !LOW_VALUE_TITLE.test(m.title.trim()));
  const pool = eligible.length ? eligible : members;
  let representative = pool[0];
  let bestCentral = -1;
  for (const m of pool) {
    const score = members.reduce((acc, o) => acc + (o === m ? 0 : jaccard(sigs.get(m.id).tokens, sigs.get(o.id).tokens)), 0);
    if (score > bestCentral) { bestCentral = score; representative = m; }
  }

  const frequency = new Map();
  for (const m of members) sigs.get(m.id).tokens.forEach((t) => frequency.set(t, (frequency.get(t) ?? 0) + 1));
  const keywords = [...merged.entities].slice(0, 12)
    .concat([...frequency.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t).slice(0, 15));

  const topics = topicScores(
    members.map((m) => `${m.title} ${m.excerpt ?? ''}`),
    members.flatMap((m) => m.source_topics ?? [])
  ).slice(0, 3).map(([t]) => t);

  return {
    event_id: cluster.event_id,
    article_ids: members.map((m) => m.id),
    title: representative.title,
    keywords: [...new Set(keywords)].slice(0, 25),
    topics,
    changed: cluster.changed,
  };
}
