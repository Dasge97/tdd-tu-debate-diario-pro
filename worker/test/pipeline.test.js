import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runEditorial } from '../src/v2/pipeline.js';
import { NOW, LIMITS, fakeApi, fakeFetcher, fakeLlmTransport, silentLogger } from './fixtures.js';

const run = (api, llm, extra = {}) => runEditorial({
  api, logger: silentLogger, now: NOW, fetcher: fakeFetcher, llmTransport: llm.transport, resume: false, ...extra,
});

test('una prueba (dry-run) genera y valida cinco debates sin publicar nada', async () => {
  const api = fakeApi({ mode: 'dry_run' });
  const llm = fakeLlmTransport();
  const report = await run(api, llm);

  assert.equal(report.status, 'completed');
  assert.equal(api.db.published.length, 0, 'no se publica nada');
  const assignments = [...api.db.runs.values()][0].assignments;
  assert.equal(assignments.filter((a) => a.status === 'validated').length, 5);

  // La fuente caída no tumba la ingesta; queda registrada.
  assert.equal(report.stages.ingest.sources_failed, 1);
  assert.ok(api.db.reports.some((r) => r.slug === 'rota' && r.status === 'error'));

  // Cada llamada al modelo queda registrada con sus tokens.
  assert.ok(api.db.calls.length > 0);
  assert.ok(api.db.calls.every((c) => Number.isInteger(c.input_tokens) && c.status === 'ok'));
  // Ninguna llamada arrastra conversación: siempre sistema + un mensaje.
  assert.ok(llm.log.every((l) => typeof l.user === 'string'));
});

test('las fuentes de los borradores son siempre evidencia recuperada', async () => {
  const api = fakeApi({ mode: 'dry_run' });
  await run(api, fakeLlmTransport());
  const urls = new Set(api.db.articles.map((a) => a.url));
  for (const a of [...api.db.runs.values()][0].assignments.filter((x) => x.draft)) {
    assert.ok(urls.has(a.draft.source_url));
    assert.ok(a.draft.sources.every((s) => urls.has(s.url)), 'la fuente E77 que inventó el modelo no aparece');
  }
});

test('en vivo publica el lote una vez, con personajes y acontecimientos distintos', async () => {
  const api = fakeApi({ mode: 'live' });
  const report = await run(api, fakeLlmTransport());

  assert.equal(report.status, 'published');
  assert.equal(api.db.published.length, 5);
  assert.equal(new Set(api.db.published.map((d) => d.persona_id)).size, 5);
  assert.equal(new Set(api.db.published.map((d) => d.event_id)).size, 5);

  // Repetir la publicación (por ejemplo tras un timeout) no duplica.
  const runId = report.run_id;
  const again = await api.publish(runId);
  assert.equal(again.already_published, true);
  assert.equal(api.db.published.length, 5);
});

test('un debate que no supera la validación se reemplaza por otra pareja respaldada', async () => {
  const api = fakeApi({ mode: 'dry_run' });
  const report = await run(api, fakeLlmTransport({ failGenerateFor: 'Pixie' }));

  assert.equal(report.status, 'completed');
  const assignments = [...api.db.runs.values()][0].assignments;
  const rejected = assignments.filter((a) => a.status === 'rejected');
  assert.ok(rejected.length >= 1);
  assert.match(rejected[0].rejection_reason, /title/);
  assert.equal(assignments.filter((a) => a.status === 'validated').length, 5);
  assert.ok(report.stages.generate.replacements >= 1);
  // El intento fallido tuvo exactamente una reparación.
  const pixieCalls = api.db.calls.filter((c) => c.purpose.startsWith('generate') && c.reference === `slot:${rejected[0].slot}`);
  assert.equal(pixieCalls.length, 2);
});

test('si se agota el presupuesto la ejecución queda incompleta y no publica', async () => {
  const api = fakeApi({ mode: 'live', limits: { ...LIMITS, maxLlmCalls: 6 } });
  const report = await run(api, fakeLlmTransport());

  assert.equal(report.status, 'incomplete');
  assert.match(report.error, /presupuesto agotado|solo \d+/);
  assert.equal(api.db.published.length, 0);
  assert.ok(api.db.calls.length <= 6);
});

test('la segunda ejecución reutiliza los dossiers de acontecimientos sin cambios', async () => {
  const api = fakeApi({ mode: 'dry_run' });
  await run(api, fakeLlmTransport());
  const dossierCallsFirst = api.db.calls.filter((c) => c.purpose === 'dossier').length;
  assert.ok(dossierCallsFirst > 0);

  const report = await run(api, fakeLlmTransport());
  const dossierCallsSecond = api.db.calls.filter((c) => c.purpose === 'dossier').length - dossierCallsFirst;
  assert.equal(dossierCallsSecond, 0, 'no se vuelve a llamar al modelo para dossiers ya hechos');
  assert.ok(report.stages.dossier.cached > 0);
});

test('los acontecimientos con evidencia insuficiente no se asignan', async () => {
  const api = fakeApi({ mode: 'dry_run' });
  const report = await run(api, fakeLlmTransport({ insufficientFor: 'Málaga' }));
  const malaga = [...api.db.events.values()].find((e) => /Málaga/.test(e.title));
  const assignments = [...api.db.runs.values()][0].assignments;
  assert.ok(!assignments.some((a) => a.event_id === malaga.event_id));
  assert.ok(report.stages.dossier.insufficient >= 1);
});

test('si muchos dossiers salen sin propuesta votable, se tira de la reserva', async () => {
  const api = fakeApi({ mode: 'dry_run', limits: { ...LIMITS, maxCandidates: 5 } });
  // Los cinco primeros candidatos salen insuficientes; hay que buscar más.
  const report = await run(api, fakeLlmTransport({ insufficientFor: 'Aragón|BCE|Banco Central|coral|multa|Segura' }));
  assert.ok(report.stages.dossier.from_reserve > 0, 'se usó la reserva');
  assert.ok(report.stages.dossier.built <= LIMITS.maxDossiers);
});

test('reanudar una ejecución incompleta completa las asignaciones que faltan', async () => {
  const api = fakeApi({ mode: 'dry_run' });
  // Primera vez: el modelo da insuficiente casi todo y la ejecución queda incompleta.
  const first = await run(api, fakeLlmTransport({ insufficientFor: 'Aragón|BCE|Banco Central|coral|Segura|Málaga|Valencia|Bilbao' }));
  assert.equal(first.status, 'incomplete');
  const before = [...api.db.runs.values()][0].assignments.length;

  // Se reanuda con los mismos dossiers en caché; se cambia el modelo para que sí haya propuestas nuevas.
  api.db.dossiers.length = 0;
  const second = await runEditorial({ api, logger: silentLogger, now: NOW, fetcher: fakeFetcher, llmTransport: fakeLlmTransport().transport, resume: true, skipIngest: true });
  assert.equal(second.resumed, true);
  assert.equal(second.status, 'completed');
  const assignments = [...api.db.runs.values()][0].assignments;
  assert.ok(assignments.length > before, 'se añadieron asignaciones');
  assert.equal(assignments.filter((a) => a.status === 'validated').length, 5);
});

test('sin modelo configurado la ejecución falla con un motivo claro y sin motor antiguo', async () => {
  const api = fakeApi({ mode: 'live' });
  const original = api.config;
  api.config = async () => ({ ...(await original()), llm: { base_url: null, model: null, api_key: null } });
  const report = await runEditorial({ api, logger: silentLogger, now: NOW, fetcher: fakeFetcher, resume: false });

  assert.equal(report.status, 'failed');
  assert.match(report.error, /Falta configurar el modelo/);
  assert.equal(api.db.published.length, 0);
});

test('sin tokens del proveedor el uso queda como desconocido', async () => {
  const api = fakeApi({ mode: 'dry_run' });
  const report = await run(api, fakeLlmTransport({ usage: false }));
  assert.ok(api.db.calls.every((c) => c.input_tokens === null && c.output_tokens === null));
  assert.equal(report.llm.tokens, 0);
  assert.equal(report.llm.unknown_token_calls, report.llm.calls);
});
