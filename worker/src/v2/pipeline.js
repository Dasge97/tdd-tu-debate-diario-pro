import { ingestAll, pool } from './ingest.js';
import { clusterArticles } from './cluster.js';
import { preselect } from './preselect.js';
import { buildDossier } from './dossier.js';
import { assign, sameArea } from './assign.js';
import { generateDebate } from './generate.js';
import { Budget, BudgetExceeded, createLlmClient } from './llm.js';
import { editorialDay } from './dates.js';

/**
 * Motor editorial V2.
 *
 *   ingesta → agrupación → preselección → dossier → asignación → redacción y revisión → publicación
 *
 * Cada etapa guarda su estado y sus métricas en el backend. No hay
 * conversación global con el modelo: cada llamada recibe solo lo que necesita.
 * Si algo falla o se acaba el presupuesto, la ejecución termina con un estado
 * explícito; nunca se recurre al motor V1.
 */

const chunk = (list, size) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size));

export async function runEditorial({
  api,
  logger = console,
  mode: modeOverride = null,
  triggeredBy = 'manual',
  resume = true,
  now = new Date(),
  fetcher,
  llmTransport,
  skipIngest = false,
}) {
  const config = await api.config();
  const limits = config.limits;
  const mode = modeOverride ?? config.mode;
  const target = config.target_debates;
  const day = editorialDay(now, limits.timezone);

  const started = await api.startRun({ mode, editorial_day: day, triggered_by: triggeredBy, resume });
  const runId = started.run.id;
  const doneStages = new Set(started.stages.filter((s) => s.status === 'done').map((s) => s.name));
  logger.info(`Motor V2: ejecución ${runId} (${mode}, día ${day}${started.resumed ? ', reanudada' : ''})`);

  const calls = [];
  const flushCalls = async () => {
    if (!calls.length) return;
    const batch = calls.splice(0, calls.length);
    await api.llmCalls(runId, batch);
  };
  const heartbeat = setInterval(() => api.heartbeat(runId).catch(() => {}), 60_000);
  heartbeat.unref?.();

  const budget = new Budget({ maxCalls: limits.maxLlmCalls, maxTotalTokens: limits.maxTotalTokens });
  const report = { run_id: runId, mode, editorial_day: day, resumed: started.resumed, stages: {} };

  const stage = async (name, fn) => {
    const t0 = Date.now();
    await api.stage(runId, { name, status: 'running' });
    try {
      const metrics = await fn();
      await flushCalls();
      const final = { ...metrics, duration_ms: Date.now() - t0, llm: budget.snapshot() };
      await api.stage(runId, { name, status: 'done', metrics: final });
      report.stages[name] = final;
      return metrics;
    } catch (err) {
      await flushCalls().catch(() => {});
      await api.stage(runId, { name, status: 'failed', error: err.message, metrics: { duration_ms: Date.now() - t0, llm: budget.snapshot() } }).catch(() => {});
      report.stages[name] = { error: err.message };
      throw err;
    }
  };

  const finish = async (status, error = null) => {
    report.status = status;
    report.error = error;
    report.llm = budget.snapshot();
    await flushCalls().catch(() => {});
    await api.finish(runId, { status, error, metrics: report });
    return report;
  };

  try {
    const llm = createLlmClient({
      baseUrl: config.llm.base_url,
      apiKey: config.llm.api_key,
      model: config.llm.model,
      timeoutMs: limits.llmTimeoutMs,
      maxInputChars: limits.maxInputChars,
      maxOutputTokens: limits.maxOutputTokens,
      concurrency: limits.llmConcurrency,
      budget,
      transport: llmTransport,
      onCall: (call) => calls.push({ provider: config.llm.provider, ...call }),
    });

    // 1. Ingesta
    if (!skipIngest && !(resume && doneStages.has('ingest'))) {
      await stage('ingest', async () => (await ingestAll({ api, limits, logger, fetcher, now })).totals);
    }

    // 2. Agrupación
    let windowArticles = [];
    let events = [];
    await stage('cluster', async () => {
      windowArticles = await api.windowArticles(limits.clusterWindowHours);
      const clusters = clusterArticles(windowArticles);
      const changed = clusters.filter((c) => c.changed);
      let saved = [];
      for (const part of chunk(changed, 100)) saved = saved.concat(await api.saveClusters(part));
      changed.forEach((cluster, i) => {
        cluster.event_id = saved[i]?.event_id ?? cluster.event_id;
        const ids = new Set(cluster.article_ids);
        windowArticles.forEach((a) => { if (ids.has(a.id)) a.event_id = cluster.event_id; });
      });
      const ids = [...new Set(clusters.map((c) => c.event_id).filter(Boolean))];
      for (const part of chunk(ids, 150)) events = events.concat(await api.events(part, false));
      return {
        articles: windowArticles.length,
        events: events.length,
        events_changed: changed.length,
        events_multi_source: events.filter((e) => e.independent_sources > 1).length,
      };
    });

    const articlesByEvent = new Map();
    for (const a of windowArticles) {
      if (!a.event_id) continue;
      if (!articlesByEvent.has(a.event_id)) articlesByEvent.set(a.event_id, []);
      articlesByEvent.get(a.event_id).push(a);
    }

    // 3. Preselección (sin modelo)
    let candidates = [];
    let reserve = [];
    await stage('preselect', async () => {
      const recent = await api.recent(config.dedup_days);
      const result = preselect({ events, articlesByEvent, recentDebates: recent, limits, dedupDays: config.dedup_days, now });
      candidates = result.candidates;
      reserve = result.reserve ?? [];
      const reasons = {};
      result.discarded.forEach((d) => { const k = d.reason.split(/[:"]/)[0].trim(); reasons[k] = (reasons[k] ?? 0) + 1; });
      return { candidates: candidates.length, reserve: reserve.length, discarded: result.discarded.length, discard_reasons: reasons, candidate_titles: candidates.map((c) => c.title) };
    });
    if (candidates.length < target) {
      return await finish('incomplete', `solo ${candidates.length} acontecimientos candidatos para ${target} debates`);
    }

    // 4. Dossier: una llamada por candidato como mucho, o caché. Si no salen
    // bastantes con evidencia suficiente, se tira de la reserva, con tope.
    let budgetNote = null;
    await stage('dossier', async () => {
      const counters = { cached: 0, built: 0, ok: 0, insufficient: 0, failed: 0, from_reserve: 0 };
      const insufficient = [];
      const process = (batch) => pool(batch, limits.llmConcurrency, async (c) => {
        if (budgetNote) return;
        try {
          const { dossier, cached } = await buildDossier({ event: c, articles: articlesByEvent.get(c.event_id) ?? [], limits, llm, api });
          c.dossier = dossier;
          counters[cached ? 'cached' : 'built']++;
          counters[dossier.status === 'ok' ? 'ok' : 'insufficient']++;
          if (dossier.status !== 'ok') insufficient.push({ title: c.title, reason: dossier.data?.insufficient_reason });
        } catch (err) {
          if (err instanceof BudgetExceeded) { budgetNote = err.message; return; }
          counters.failed++;
          logger.warn(`Dossier del acontecimiento ${c.event_id}: ${err.message}`);
        }
      });

      await process(candidates);
      // Se sigue con la reserva mientras no haya objetivo + 1 dossiers válidos o
      // mientras con ellos no salgan `target` parejas asignables (el encaje por
      // especialidad y la regla de un asunto por día descartan algunos).
      const personasNow = await api.personas();
      const assignable = () => assign({ personas: personasNow, candidates, target, rotationLimitDays: config.rotation_limit_days }).assignments.length;
      while ((counters.ok < target + 1 || assignable() < target) && reserve.length && counters.built < limits.maxDossiers && !budgetNote) {
        const batch = reserve.splice(0, Math.min(4, limits.maxDossiers - counters.built));
        candidates.push(...batch);
        counters.from_reserve += batch.length;
        await process(batch);
      }
      return { ...counters, insufficient_events: insufficient, budget_stop: budgetNote };
    });

    // 5. Asignación
    const personas = await api.personas();
    const personaById = new Map(personas.map((p) => [p.id, p]));
    let plan;
    await stage('assign', async () => {
      const existing = (await api.run(runId)).assignments;
      if (existing.length) {
        // Reanudación: se conservan las asignaciones vivas y se completan las que falten.
        const active = existing.filter((a) => a.status !== 'rejected');
        const fresh = assign({
          personas, candidates, target: Math.max(0, target - active.length), rotationLimitDays: config.rotation_limit_days,
          excludePersonas: new Set(active.map((a) => a.persona_id)), excludeEvents: new Set(active.map((a) => a.event_id)),
        });
        let nextSlot = Math.max(...existing.map((a) => a.slot)) + 1;
        const added = fresh.assignments.length
          ? await api.saveAssignments(runId, fresh.assignments.map((a) => ({ ...a, slot: nextSlot++, status: 'planned' })))
          : [];
        plan = { assignments: [...active, ...added], exceptions: fresh.exceptions, alternatives: fresh.alternatives };
        return { reused: active.length, added: added.length, exceptions: plan.exceptions };
      }
      plan = assign({ personas, candidates, target, rotationLimitDays: config.rotation_limit_days });
      const saved = await api.saveAssignments(runId, plan.assignments.map((a, slot) => ({ ...a, slot, status: 'planned' })));
      plan.assignments = saved;
      return {
        assignments: saved.map((a) => ({ slot: a.slot, persona: a.persona_username, event_id: a.event_id, scores: a.scores })),
        exceptions: plan.exceptions,
        alternatives: plan.alternatives.length,
      };
    });
    if (plan.assignments.length < target) {
      return await finish('incomplete', `solo ${plan.assignments.length} asignaciones posibles para ${target} debates. ${plan.exceptions.join(' ')}`.trim());
    }

    // 6. Redacción y revisión, con reemplazos acotados
    const candidateByEvent = new Map(candidates.map((c) => [c.event_id, c]));
    await stage('generate', async () => {
      const slots = [...plan.assignments];
      const counters = { validated: 0, rejected: 0, replacements: 0 };
      const rejections = [];
      const usedPairs = new Set(slots.map((a) => `${a.persona_id}:${a.event_id}`));
      let nextSlot = Math.max(...slots.map((a) => a.slot)) + 1;

      const liveSlots = () => slots.filter((a) => a.status !== 'rejected');
      const validatedCount = () => slots.filter((a) => a.status === 'validated' || a.status === 'published').length;

      const work = async (a) => {
        if (a.status === 'validated' || a.status === 'published') return;
        const candidate = candidateByEvent.get(a.event_id);
        const dossier = candidate?.dossier;
        if (!dossier || dossier.status !== 'ok') {
          a.status = 'rejected';
          a.rejection_reason = 'dossier no disponible en esta ejecución';
          await api.saveAssignments(runId, [{ slot: a.slot, status: 'rejected', rejection_reason: a.rejection_reason }]);
        } else {
          const result = await generateDebate({ assignment: a, dossier, persona: personaById.get(a.persona_id), llm, limits });
          a.status = result.status;
          a.rejection_reason = result.reason ?? null;
          await api.saveAssignments(runId, [{ slot: a.slot, status: result.status, draft: result.draft, review: result.review, rejection_reason: result.reason ?? null }]);
        }
        if (a.status === 'validated') counters.validated++;
        if (a.status === 'rejected') {
          counters.rejected++;
          rejections.push({ slot: a.slot, persona: personaById.get(a.persona_id)?.username, event_id: a.event_id, reason: a.rejection_reason });
        }
      };

      try {
        await pool(slots.slice(), limits.llmConcurrency, work);

        // Reemplazos: una pareja de reserva que no repita personaje ni acontecimiento del lote.
        while (validatedCount() < target && counters.replacements < limits.maxReplacements) {
          const active = liveSlots();
          const personasInUse = new Set(active.map((a) => a.persona_id));
          const eventsInUse = new Set(active.map((a) => a.event_id));
          const clashes = (x) => active.some((a) => {
            const ca = candidateByEvent.get(a.event_id);
            const cx = candidateByEvent.get(x.event_id);
            return ca && cx && sameArea(ca, cx);
          });
          const alt = plan.alternatives.find((x) => !personasInUse.has(x.persona_id) && !eventsInUse.has(x.event_id) && !usedPairs.has(`${x.persona_id}:${x.event_id}`) && !clashes(x));
          if (!alt) break;
          usedPairs.add(`${alt.persona_id}:${alt.event_id}`);
          const candidate = candidateByEvent.get(alt.event_id);
          const [saved] = await api.saveAssignments(runId, [{
            slot: nextSlot++, persona_id: alt.persona_id, event_id: alt.event_id, dossier_id: candidate.dossier.id,
            status: 'planned', scores: { total: alt.score }, reasons: ['reemplazo de un debate rechazado'],
          }]);
          slots.push(saved);
          counters.replacements++;
          await work(saved);
        }
      } catch (err) {
        if (!(err instanceof BudgetExceeded)) throw err;
        budgetNote = err.message;
      }
      return { ...counters, rejections, budget_stop: budgetNote };
    });

    const run = await api.run(runId);
    const validated = run.assignments.filter((a) => a.status === 'validated');
    if (validated.length < target) {
      const reason = budgetNote ?? `solo ${validated.length} debates superaron validación y revisión de ${target}`;
      return await finish('incomplete', reason);
    }

    // 7. Publicación (solo en vivo)
    if (mode !== 'live') {
      logger.info(`Prueba terminada: ${validated.length} debates válidos, no se publica nada.`);
      return await finish('completed');
    }
    const published = await api.publish(runId);
    if (published.status !== 'published') {
      return await finish('failed', `el backend no confirmó la publicación: ${JSON.stringify(published)}`);
    }
    report.published = published;
    logger.info(`Publicados ${published.debate_ids.length} debates${published.already_published ? ' (ya estaban publicados)' : ''}.`);
    // El backend ya marcó la ejecución como publicada; esto solo guarda las métricas.
    await finish('completed');
    report.status = 'published';
    return report;
  } catch (err) {
    logger.error(`Motor V2: ${err.message}`);
    const status = err instanceof BudgetExceeded ? 'incomplete' : 'failed';
    return await finish(status, err.message).catch(() => ({ ...report, status, error: err.message }));
  } finally {
    clearInterval(heartbeat);
  }
}
