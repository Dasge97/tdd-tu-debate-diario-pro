import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFeed } from '../src/v2/feeds.js';
import { toArticle } from '../src/v2/ingest.js';
import { clusterArticles } from '../src/v2/cluster.js';
import { preselect } from '../src/v2/preselect.js';
import { assign, sameArea } from '../src/v2/assign.js';
import { parseDossier, selectEvidence } from '../src/v2/dossier.js';
import { parseReview, toDraft } from '../src/v2/generate.js';
import { FEEDS, LIMITS, NOW, PERSONAS, SOURCES } from './fixtures.js';

/** Noticias del fixture como las devolvería /articles/window. */
function windowArticles() {
  let id = 1;
  const out = [];
  for (const source of SOURCES.filter((s) => FEEDS[s.url])) {
    for (const item of parseFeed(FEEDS[source.url])) {
      const converted = toArticle(item, source, LIMITS, NOW);
      if (!converted || converted.skip) continue;
      out.push({
        ...converted.article, id: id++, source_slug: source.slug, source_name: source.name, origin_type: source.origin_type,
        scope: source.scope, source_topics: source.topics, fetched_at: NOW.toISOString(), event_id: null,
      });
    }
  }
  return out;
}

const titlesOf = (cluster, articles) => cluster.article_ids.map((id) => articles.find((a) => a.id === id).title);

test('agrupa el mismo suceso de varios medios y separa sucesos distintos del mismo tema', () => {
  const articles = windowArticles();
  const clusters = clusterArticles(articles);
  const find = (re) => clusters.find((c) => titlesOf(c, articles).some((t) => re.test(t)));

  assert.equal(find(/Aragón/).article_ids.length, 2, 'Aragón: dos medios, un acontecimiento');
  assert.equal(find(/BCE|Banco Central/).article_ids.length, 2);
  assert.equal(find(/coral/).article_ids.length, 2);
  assert.equal(find(/multa/).article_ids.length, 2);
  assert.equal(find(/Segura/).article_ids.length, 2);
  assert.equal(find(/Málaga/).article_ids.length, 2);
  assert.equal(find(/Ourense/).article_ids.length, 2);

  // Vivienda en Valencia y alquiler en Bilbao: mismo tema, sucesos distintos.
  assert.notEqual(find(/Valencia/), find(/Bilbao/));
  assert.equal(find(/Valencia/).article_ids.length, 1);
  assert.equal(find(/Bilbao/).article_ids.length, 1);
});

test('las noticias nuevas se suman al acontecimiento que ya existía', () => {
  const articles = windowArticles();
  const aragon = articles.filter((a) => /Aragón/.test(a.title));
  aragon[0].event_id = 99;
  const clusters = clusterArticles(articles);
  const withAragon = clusters.find((c) => c.article_ids.includes(aragon[1].id));
  assert.equal(withAragon.event_id, 99);
  assert.equal(withAragon.changed, true);
});

function eventsFrom(clusters, articles) {
  const byEvent = new Map();
  const events = clusters.map((c, i) => {
    const members = articles.filter((a) => c.article_ids.includes(a.id));
    const keys = new Set(members.map((a) => (a.agency ? `agencia:${a.agency}` : `fuente:${a.source_slug}`)));
    byEvent.set(i + 1, members);
    return { event_id: i + 1, title: c.title, topics: c.topics, version: 1, evidence_hash: `h${i}`, independent_sources: keys.size, last_published_at: null, last_published_version: null };
  });
  return { events, byEvent };
}

test('la preselección descarta fechas desconocidas y repeticiones recientes', () => {
  const articles = windowArticles();
  const { events, byEvent } = eventsFrom(clusterArticles(articles), articles);

  const recent = [{ debate_id: 1, title: 'El Banco Central Europeo mantiene los tipos de interés en el 2%', question: '', day_date: '2026-09-20', event_id: null }];
  const { candidates, discarded } = preselect({ events, articlesByEvent: byEvent, recentDebates: recent, limits: LIMITS, dedupDays: 14, now: NOW });

  assert.ok(discarded.some((d) => /fecha desconocida/.test(d.reason)), 'la noticia sin fecha no pasa');
  assert.ok(discarded.some((d) => /Banco Central|BCE/.test(d.title) && /parecido a un debate/.test(d.reason)), 'el BCE ya se trató ayer');
  assert.ok(!candidates.some((c) => /Banco Central|BCE/.test(c.title)));
  assert.ok(candidates.length >= 5);

  // El incendio lo cuentan dos medios con el mismo teletipo de EFE: una sola fuente independiente.
  assert.equal(candidates.find((c) => /Ourense/.test(c.title)).independent_sources, 1);
});

test('un acontecimiento ya publicado solo vuelve si tiene evidencia nueva', () => {
  const articles = windowArticles();
  const { events, byEvent } = eventsFrom(clusterArticles(articles), articles);
  const aragon = events.find((e) => /Aragón/.test(e.title));
  const recent = [{ debate_id: 9, title: 'otra cosa', day_date: '2026-09-19', event_id: aragon.event_id, event_version: 1 }];

  let r = preselect({ events, articlesByEvent: byEvent, recentDebates: recent, limits: LIMITS, dedupDays: 14, now: NOW });
  assert.ok(r.discarded.some((d) => d.event_id === aragon.event_id && /sin novedades/.test(d.reason)));

  aragon.version = 2;
  r = preselect({ events, articlesByEvent: byEvent, recentDebates: recent, limits: LIMITS, dedupDays: 14, now: NOW });
  assert.equal(r.candidates.find((c) => c.event_id === aragon.event_id).parts.evolution, true);
});

test('la misma historia contada como dos acontecimientos solo entra una vez', () => {
  const mk = (id, title, score) => ({ event_id: id, title, topics: ['política'], version: 1, evidence_hash: `h${id}`, independent_sources: score });
  const art = (id, title, eventId, source) => ({ id, title, excerpt: '', published_at: '2026-09-21T08:00:00Z', fetched_at: '2026-09-21T08:00:00Z', scope: 'es', source_slug: source, event_id: eventId });
  const events = [
    mk(1, 'El juez Peinado envía a juicio a Begoña Gómez por malversación', 5),
    mk(2, 'Moncloa denuncia que el juez Peinado persigue a Begoña Gómez con el juicio', 3),
    mk(3, 'Consulte el auto del juez sobre el caso', 1),
  ];
  const byEvent = new Map([
    [1, [art(1, events[0].title, 1, 'a'), art(2, 'Begoña Gómez irá a juicio con jurado, decide el juez Peinado', 1, 'b')]],
    [2, [art(3, events[1].title, 2, 'c')]],
    [3, [art(4, events[2].title, 3, 'd')]],
  ]);
  const { candidates, discarded } = preselect({ events, articlesByEvent: byEvent, recentDebates: [], limits: LIMITS, dedupDays: 14, now: NOW });

  assert.deepEqual(candidates.map((c) => c.event_id), [1]);
  assert.match(discarded.find((d) => d.event_id === 2).reason, /misma historia/);
  assert.match(discarded.find((d) => d.event_id === 3).reason, /servicio/);
});

test('un titular de servicio no invalida el acontecimiento ni se usa como título', () => {
  const articles = [
    { id: 1, title: 'Consulte el auto del juez Peinado con el que abre juicio oral a Begoña Gómez', excerpt: '', published_at: '2026-09-21T08:00:00Z' },
    { id: 2, title: 'El juez Peinado abre juicio oral a Begoña Gómez con jurado popular', excerpt: '', published_at: '2026-09-21T08:10:00Z' },
  ];
  const [cluster] = clusterArticles(articles);
  assert.equal(cluster.article_ids.length, 2);
  assert.match(cluster.title, /^El juez Peinado/);
});

test('los candidatos se reparten entre temas aunque domine uno', () => {
  const events = [];
  const byEvent = new Map();
  const add = (id, topic, score) => {
    events.push({ event_id: id, title: `Suceso ${id} ${topic}`, topics: [topic], version: 1, evidence_hash: `h${id}`, independent_sources: score });
    byEvent.set(id, [{ id, title: `Suceso ${id}`, excerpt: '', published_at: '2026-09-21T08:00:00Z', scope: 'es', source_slug: `s${id}` }]);
  };
  for (let i = 1; i <= 12; i++) add(i, 'política', 8);
  add(20, 'ciencia', 1);
  add(21, 'medioambiente', 1);
  const { candidates } = preselect({ events, articlesByEvent: byEvent, recentDebates: [], limits: { ...LIMITS, maxCandidates: 6 }, dedupDays: 14, now: NOW });
  const ids = candidates.map((c) => c.event_id);
  assert.ok(ids.includes(20) && ids.includes(21), 'ciencia y medioambiente entran aunque tengan menos cobertura');
  assert.equal(ids.length, 6);
});

const dossierWith = (fit) => ({ id: Math.random(), status: 'ok', data: { specialty_fit: fit } });
const fitFor = (topic, extra = {}) => ({ política: 0, economía: 0, ciencia: 0, tecnología: 0, sociedad: 0, ética: 0, filosofía: 0, medioambiente: 0, [topic]: 0.9, ...extra });

test('asigna personajes distintos a acontecimientos distintos, priorizando a los atrasados', () => {
  const candidates = [
    { event_id: 1, score: 0.9, dossier: dossierWith(fitFor('política')) },
    { event_id: 2, score: 0.8, dossier: dossierWith(fitFor('economía')) },
    { event_id: 3, score: 0.7, dossier: dossierWith(fitFor('ciencia', { filosofía: 0.6 })) },
    { event_id: 4, score: 0.7, dossier: dossierWith(fitFor('tecnología', { ética: 0.7 })) },
    { event_id: 5, score: 0.6, dossier: dossierWith(fitFor('medioambiente')) },
    { event_id: 6, score: 0.6, dossier: dossierWith(fitFor('sociedad')) },
    { event_id: 7, score: 0.2, dossier: { id: 7, status: 'insufficient', data: { specialty_fit: fitFor('política') } } },
  ];
  const { assignments, exceptions, alternatives } = assign({ personas: PERSONAS, candidates, target: 5, rotationLimitDays: 3 });

  assert.equal(assignments.length, 5);
  assert.equal(new Set(assignments.map((a) => a.persona_id)).size, 5);
  assert.equal(new Set(assignments.map((a) => a.event_id)).size, 5);
  assert.ok(!assignments.some((a) => a.event_id === 7), 'nunca un acontecimiento con evidencia insuficiente');
  // Pixie nunca ha publicado, A-23 lleva 5 días y Artemisa 4: tienen que estar.
  for (const username of ['pixie', 'a-23', 'artemisa']) {
    assert.ok(assignments.some((a) => a.persona_username === username), username);
  }
  assert.ok(assignments.every((a) => a.scores.fit >= 0.45), 'nadie trata algo que no encaja con su especialidad');
  assert.ok(alternatives.length > 0);
  assert.deepEqual(exceptions, []);
});

test('dos acontecimientos del mismo asunto no van juntos en el lote', () => {
  const story = (...entities) => ({ tokens: new Set(), entities: new Set(entities) });
  const candidates = [
    { event_id: 1, score: 0.9, dossier: dossierWith(fitFor('política')), story: story('ceuta', 'feijoo', 'vivas') },
    { event_id: 2, score: 0.9, dossier: dossierWith(fitFor('sociedad')), story: story('ceuta', 'feijoo', 'marlaska') },
    { event_id: 3, score: 0.5, dossier: dossierWith(fitFor('economía')), story: story('bce') },
    { event_id: 4, score: 0.5, dossier: dossierWith(fitFor('tecnología')), story: story('google') },
    { event_id: 5, score: 0.5, dossier: dossierWith(fitFor('medioambiente')), story: story('aemet') },
    { event_id: 6, score: 0.4, dossier: dossierWith(fitFor('sociedad')), story: story('renfe', 'malaga') },
  ];
  const { assignments } = assign({ personas: PERSONAS, candidates, target: 5, rotationLimitDays: 3 });
  const events = assignments.map((a) => a.event_id);
  assert.equal(assignments.length, 5);
  assert.ok(!(events.includes(1) && events.includes(2)), 'Ceuta solo una vez');

  // Caso real: solo comparten "Ceuta" en los titulares, pero sus dossiers
  // comparten un actor concreto (Feijóo). "Gobierno" no cuenta.
  const withActors = (fit, actors) => ({ ...dossierWith(fit), data: { specialty_fit: fit, actors } });
  const real = [
    { event_id: 1, score: 0.9, dossier: withActors(fitFor('política'), ['Alberto Núñez Feijóo', 'Gobierno de Pedro Sánchez']), story: story('ceuta', 'vivas') },
    { event_id: 2, score: 0.9, dossier: withActors(fitFor('sociedad'), ['Fernando Grande-Marlaska', 'Alberto Núñez Feijóo']), story: story('ceuta', 'marlaska') },
    { event_id: 7, score: 0.9, dossier: withActors(fitFor('ética'), ['Gobierno de Pedro Sánchez']), story: story('madrid', 'begona gomez') },
    { event_id: 8, score: 0.9, dossier: withActors(fitFor('filosofía'), ['Gobierno de Pedro Sánchez']), story: story('madrid', 'zapatero') },
    ...candidates.slice(2),
  ];
  const second = assign({ personas: PERSONAS, candidates: real, target: 5, rotationLimitDays: 3 }).assignments.map((a) => a.event_id);
  assert.ok(!(second.includes(1) && second.includes(2)), 'Ceuta solo una vez aunque solo compartan un nombre');
  assert.equal(sameArea(real[2], real[3]), false, 'compartir "Madrid" y "el Gobierno" no los hace del mismo asunto');
  assert.equal(sameArea(real[0], real[1]), true);
});

test('si un personaje atrasado no tiene nada que encaje, se registra la excepción', () => {
  const candidates = [1, 2, 3, 4, 5].map((i) => ({ event_id: i, score: 0.5, dossier: dossierWith(fitFor(['política', 'economía', 'ciencia', 'tecnología', 'sociedad'][i - 1])) }));
  const personas = PERSONAS.map((p) => (p.username === 'artemisa' ? { ...p, days_since: 9 } : p));
  const { exceptions } = assign({ personas, candidates, target: 5, rotationLimitDays: 3 });
  assert.ok(exceptions.some((e) => /@artemisa.*no hay ningún acontecimiento/.test(e)));
});

test('el dossier descarta citas inventadas y marca la evidencia insuficiente', () => {
  const evidence = selectEvidence([
    { id: 1, source_slug: 'a', source_name: 'A', origin_type: 'medio', scope: 'es', url: 'https://a/1', title: 't1', excerpt: 'x', agency: 'EFE' },
    { id: 2, source_slug: 'b', source_name: 'B', origin_type: 'medio', scope: 'es', url: 'https://b/1', title: 't2', excerpt: 'y', agency: 'EFE' },
    { id: 3, source_slug: 'c', source_name: 'C', origin_type: 'institucional', scope: 'es', url: 'https://c/1', title: 't3', excerpt: 'z' },
  ], LIMITS);
  assert.equal(evidence[0].source, 'C', 'la fuente institucional va primero');

  const raw = JSON.stringify({
    status: 'ok',
    facts: [
      { text: 'Hecho con dos copias de EFE', refs: ['E2', 'E3'] },
      { text: 'Hecho con fuente institucional y EFE', refs: ['E1', 'E2'] },
      { text: 'Hecho con cita inventada', refs: ['E9'] },
    ],
    debatable_proposals: [{ proposal: 'x', refs: ['E1'] }],
    specialty_fit: { política: 2 },
  });
  const parsed = parseDossier(raw, evidence);
  assert.equal(parsed.dossier.data.facts.length, 2, 'el hecho con cita inventada se elimina');
  assert.equal(parsed.dossier.data.facts[0].independent_sources, 1, 'dos copias de EFE son una sola fuente');
  assert.equal(parsed.dossier.data.facts[1].independent_sources, 2);
  assert.equal(parsed.dossier.data.specialty_fit['política'], 1, 'el encaje se recorta a 0-1');
  assert.equal(parsed.dossier.status, 'insufficient', 'con menos de tres hechos respaldados no hay debate');
});

test('las fuentes del borrador las pone el sistema, no el modelo', () => {
  const dossier = { evidence: [{ id: 'E1', source: 'A', url: 'https://a/1', published_at: null }, { id: 'E2', source: 'B', url: 'https://b/1', published_at: null }] };
  const draft = toDraft(JSON.stringify({ title: 't', question: 'q', card_summary: 's', context: 'c', used_refs: ['E2', 'E7'], primary_ref: 'E7', source_url: 'https://inventada' }), dossier, 'm');
  assert.equal(draft.source_url, 'https://b/1');
  assert.deepEqual(draft.sources.map((s) => s.url), ['https://b/1']);
});

test('una revisión que aprueba pero señala problemas no se da por buena', () => {
  assert.equal(parseReview('{"verdict":"pass","issues":[]}').verdict, 'pass');
  assert.equal(parseReview('{"verdict":"pass","issues":[{"type":"bias","detail":"adjetivo valorativo"}]}').verdict, 'fail');
});
