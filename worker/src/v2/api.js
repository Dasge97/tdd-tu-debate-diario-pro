/**
 * Cliente de los endpoints internos del motor V2 (/api/v1/worker/editorial).
 * El backend es el único que escribe en la base de datos.
 */

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function createApi({ baseUrl, workerKey, timeoutMs = 30_000, fetchImpl = fetch }) {
  if (!baseUrl || !workerKey) throw new Error('Faltan BACKEND_API_BASE_URL o WORKER_API_KEY');
  const root = `${baseUrl.replace(/\/+$/, '')}/api/v1/worker/editorial`;

  async function call(method, path, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res;
    try {
      res = await fetchImpl(`${root}${path}`, {
        method,
        headers: { 'X-Worker-Key': workerKey, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      throw new ApiError(controller.signal.aborted ? `timeout en ${method} ${path}` : `${method} ${path}: ${err.message}`, 0, 'network');
    } finally {
      clearTimeout(timer);
    }
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { /* respuesta no JSON */ }
    if (!res.ok) {
      throw new ApiError(`${method} ${path}: HTTP ${res.status} ${data?.error ?? text.slice(0, 200)}`, res.status, data?.code);
    }
    return data;
  }

  const q = (params) => new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null)).toString();

  return {
    config: () => call('GET', '/config'),
    personas: () => call('GET', '/personas'),
    sources: () => call('GET', '/sources'),
    reportSources: (reports) => call('POST', '/sources/report', { reports }),
    upsertArticles: async (sourceId, items) => (await call('POST', '/articles', { source_id: sourceId, items })).articles,
    windowArticles: async (hours) => (await call('GET', `/articles/window?${q({ hours })}`)).articles,
    saveClusters: async (clusters) => (await call('POST', '/events', { clusters })).events,
    events: async (ids, withArticles = true) => (await call('GET', `/events?${q({ ids: ids.join(','), articles: withArticles ? 1 : 0 })}`)).events,
    recent: async (days) => (await call('GET', `/recent?${q({ days })}`)).debates,
    findDossier: async (eventId, evidenceHash, promptVersion, model) =>
      (await call('GET', `/dossiers/lookup?${q({ event_id: eventId, evidence_hash: evidenceHash, prompt_version: promptVersion, model })}`)).dossier,
    saveDossier: async (dossier) => (await call('POST', '/dossiers', dossier)).dossier,
    startRun: (body) => call('POST', '/runs', body),
    run: (id) => call('GET', `/runs/${id}`),
    heartbeat: (id) => call('POST', `/runs/${id}/heartbeat`, {}),
    stage: (id, stage) => call('POST', `/runs/${id}/stages`, stage),
    llmCalls: (id, calls) => call('POST', `/runs/${id}/llm-calls`, { calls }),
    saveAssignments: async (id, assignments) => (await call('POST', `/runs/${id}/assignments`, { assignments })).assignments,
    publish: (id) => call('POST', `/runs/${id}/publish`, {}),
    finish: (id, body) => call('POST', `/runs/${id}/finish`, body),
  };
}
