/**
 * Adaptador del modelo para el motor V2.
 *
 * Cada llamada es independiente: sistema + usuario, sin conversación previa y
 * sin herramientas ni navegación. Los tokens salen de la respuesta del
 * proveedor; si no vienen, se registran como desconocidos (null).
 */

export class BudgetExceeded extends Error {
  constructor(message) {
    super(message);
    this.code = 'budget_exceeded';
  }
}

export class LlmError extends Error {
  constructor(message, { retryable = false } = {}) {
    super(message);
    this.retryable = retryable;
  }
}

/** Presupuesto por ejecución: llamadas y tokens. Se comprueba antes de cada llamada. */
export class Budget {
  constructor({ maxCalls, maxTotalTokens }) {
    this.maxCalls = maxCalls;
    this.maxTotalTokens = maxTotalTokens;
    this.calls = 0;
    this.tokens = 0;
    this.unknownTokenCalls = 0;
  }

  check(purpose) {
    if (this.calls >= this.maxCalls) {
      throw new BudgetExceeded(`presupuesto agotado: ${this.calls} llamadas de ${this.maxCalls} (al pedir ${purpose})`);
    }
    if (this.tokens >= this.maxTotalTokens) {
      throw new BudgetExceeded(`presupuesto agotado: ${this.tokens} tokens de ${this.maxTotalTokens} (al pedir ${purpose})`);
    }
  }

  add(usage) {
    this.calls++;
    if (usage && Number.isFinite(usage.input_tokens) && Number.isFinite(usage.output_tokens)) {
      this.tokens += usage.input_tokens + usage.output_tokens;
    } else {
      this.unknownTokenCalls++;
    }
  }

  snapshot() {
    return { calls: this.calls, tokens: this.tokens, unknown_token_calls: this.unknownTokenCalls, max_calls: this.maxCalls, max_total_tokens: this.maxTotalTokens };
  }
}

/** Semáforo para limitar llamadas simultáneas. */
function semaphore(limit) {
  let active = 0;
  const queue = [];
  const release = () => {
    active--;
    if (queue.length) queue.shift()();
  };
  return async (fn) => {
    if (active >= limit) await new Promise((resolve) => queue.push(resolve));
    active++;
    try {
      return await fn();
    } finally {
      release();
    }
  };
}

/**
 * Cliente para una API compatible con OpenAI (/v1/chat/completions).
 * `transport` se puede sustituir en pruebas.
 */
export function createLlmClient({ baseUrl, apiKey, model, timeoutMs, maxInputChars, maxOutputTokens = null, concurrency = 2, budget, onCall, transport }) {
  if (!baseUrl || !apiKey || !model) {
    throw new Error('Falta configurar el modelo del motor V2 (dirección, modelo o clave) en el panel.');
  }
  const run = semaphore(concurrency);
  const endpoint = `${baseUrl.replace(/\/+$/, '').replace(/\/v1$/, '')}/v1/chat/completions`;

  const send = transport ?? (async (body, signal) => {
    let res;
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      });
    } catch (err) {
      throw new LlmError(signal.aborted ? `tiempo agotado (${timeoutMs} ms)` : `error de red: ${err.message}`, { retryable: true });
    }
    const text = await res.text();
    if (!res.ok) {
      // No se copia la respuesta entera: puede ser larga. Nunca incluye la clave.
      throw new LlmError(`HTTP ${res.status}: ${text.slice(0, 300)}`, { retryable: res.status === 429 || res.status >= 500 });
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new LlmError('respuesta del proveedor que no es JSON', { retryable: true });
    }
  });

  /**
   * @returns {Promise<{text: string, usage: ?object, durationMs: number}>}
   */
  async function complete({ system, user, stage, purpose, reference = null, promptVersion, attempt = 1 }) {
    const inputChars = system.length + user.length;
    if (inputChars > maxInputChars) {
      throw new LlmError(`entrada de ${inputChars} caracteres, por encima del límite de ${maxInputChars}`);
    }

    return run(async () => {
      let lastError;
      // Un reintento como mucho, y solo por fallo de red o del proveedor.
      for (let transportTry = 1; transportTry <= 2; transportTry++) {
        budget.check(purpose);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const started = Date.now();
        try {
          // max_completion_tokens lo respeta la API de OpenAI; auth2api con cuenta de
          // ChatGPT lo acepta pero lo ignora (comprobado 2026-09-21). El tope que
          // sí funciona siempre es el presupuesto de tokens por ejecución.
          const body = { model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] };
          if (maxOutputTokens) body.max_completion_tokens = maxOutputTokens;
          const data = await send(body, controller.signal);
          const usage = readUsage(data.usage);
          budget.add(usage);
          const text = data.choices?.[0]?.message?.content ?? '';
          onCall?.({ stage, purpose, reference, model: data.model ?? model, prompt_version: promptVersion, attempt, ...usageFields(usage), input_chars: inputChars, duration_ms: Date.now() - started, status: 'ok' });
          return { text, usage, durationMs: Date.now() - started };
        } catch (err) {
          const e = err instanceof LlmError ? err : new LlmError(err.message, { retryable: false });
          budget.add(null);
          onCall?.({ stage, purpose, reference, model, prompt_version: promptVersion, attempt, input_tokens: null, output_tokens: null, cached_tokens: null, input_chars: inputChars, duration_ms: Date.now() - started, status: 'error', error: e.message });
          lastError = e;
          if (!e.retryable || transportTry === 2) break;
          await new Promise((r) => setTimeout(r, 2000));
        } finally {
          clearTimeout(timer);
        }
      }
      throw lastError;
    });
  }

  return { complete, model, provider: 'openai-compatible' };
}

function readUsage(u) {
  if (!u || typeof u !== 'object') return null;
  const input = u.prompt_tokens ?? u.input_tokens;
  const output = u.completion_tokens ?? u.output_tokens;
  if (!Number.isFinite(input) || !Number.isFinite(output)) return null;
  const cached = u.prompt_tokens_details?.cached_tokens ?? u.input_tokens_details?.cached_tokens ?? null;
  return { input_tokens: input, output_tokens: output, cached_tokens: Number.isFinite(cached) ? cached : null };
}

const usageFields = (usage) => ({
  input_tokens: usage?.input_tokens ?? null,
  output_tokens: usage?.output_tokens ?? null,
  cached_tokens: usage?.cached_tokens ?? null,
});

/** Saca el primer objeto JSON de una respuesta que puede traer texto o bloques de código alrededor. */
export function extractJson(raw) {
  const s = String(raw ?? '').replace(/```(?:json)?/gi, '').trim();
  try {
    return JSON.parse(s);
  } catch { /* se intenta recortar */ }
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('la respuesta no contiene un objeto JSON');
  try {
    return JSON.parse(s.slice(start, end + 1));
  } catch (err) {
    throw new Error(`JSON malformado: ${err.message}`);
  }
}
