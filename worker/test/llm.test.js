import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Budget, BudgetExceeded, LlmError, createLlmClient } from '../src/v2/llm.js';

const ok = (content = '{"ok":true}') => ({ model: 'm', choices: [{ message: { content } }], usage: { prompt_tokens: 10, completion_tokens: 5 } });

function client(transport, extra = {}) {
  const calls = [];
  const budget = new Budget({ maxCalls: 10, maxTotalTokens: 10_000 });
  const llm = createLlmClient({
    baseUrl: 'https://llm.example/v1', apiKey: 'sk-x', model: 'm', timeoutMs: 200, maxInputChars: 1000,
    maxOutputTokens: 500, budget, transport, onCall: (c) => calls.push(c), ...extra,
  });
  return { llm, calls, budget };
}

const ask = (llm, user = 'hola') => llm.complete({ system: 's', user, stage: 'x', purpose: 'p', promptVersion: 'v1' });

test('un fallo del proveedor se reintenta una sola vez', async () => {
  let n = 0;
  const { llm, calls } = client(async () => {
    n++;
    if (n === 1) throw new LlmError('HTTP 502', { retryable: true });
    return ok();
  });
  const res = await ask(llm);
  assert.equal(res.text, '{"ok":true}');
  assert.deepEqual(calls.map((c) => c.status), ['error', 'ok'], 'los dos intentos quedan registrados');
});

test('un error que no es del proveedor no se reintenta', async () => {
  let n = 0;
  const { llm, calls } = client(async () => { n++; throw new LlmError('HTTP 400 modelo no permitido', { retryable: false }); });
  await assert.rejects(ask(llm), /HTTP 400/);
  assert.equal(n, 1);
  assert.equal(calls[0].status, 'error');
});

test('tras dos fallos seguidos se rinde', async () => {
  let n = 0;
  const { llm } = client(async () => { n++; throw new LlmError('HTTP 503', { retryable: true }); });
  await assert.rejects(ask(llm), /HTTP 503/);
  assert.equal(n, 2);
});

test('una entrada demasiado larga no se envía', async () => {
  let n = 0;
  const { llm } = client(async () => { n++; return ok(); });
  await assert.rejects(ask(llm, 'x'.repeat(2000)), /por encima del límite/);
  assert.equal(n, 0);
});

test('manda el límite de salida y guarda los tokens del proveedor', async () => {
  let sent;
  const { llm, calls, budget } = client(async (body) => { sent = body; return ok(); });
  await ask(llm);
  assert.equal(sent.max_completion_tokens, 500);
  assert.equal(sent.messages.length, 2, 'sistema + usuario, sin conversación previa');
  assert.equal(calls[0].input_tokens, 10);
  assert.equal(budget.snapshot().tokens, 15);
});

test('el presupuesto se comprueba antes de cada llamada', async () => {
  const budget = new Budget({ maxCalls: 1, maxTotalTokens: 10_000 });
  const llm = createLlmClient({ baseUrl: 'https://llm.example', apiKey: 'k', model: 'm', timeoutMs: 200, maxInputChars: 1000, budget, transport: async () => ok() });
  await ask(llm);
  await assert.rejects(ask(llm), BudgetExceeded);
});

test('el tiempo agotado se detecta con el transporte real', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (url, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))));
  try {
    const { llm, calls } = client(undefined);
    await assert.rejects(ask(llm), /tiempo agotado/);
    assert.equal(calls.length, 2, 'se reintentó una vez por ser un fallo de red');
  } finally {
    globalThis.fetch = realFetch;
  }
});
