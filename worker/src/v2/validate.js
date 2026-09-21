/**
 * Validación determinista de un borrador. Son las mismas reglas que aplica el
 * backend antes de publicar (backend/src/Service/Editorial/DebateDraftValidator.php).
 * Si cambian aquí, hay que cambiarlas allí.
 */

export const LIMITS = {
  title: [60, 120],
  question: [80, 160],
  card_summary: [100, 220],
  contextWords: [200, 420],
};

/** Bloques obligatorios del contexto, cada uno en su propia línea. */
export const CONTEXT_SECTIONS = ['Qué ha pasado', 'Qué se discute', 'A favor', 'En contra'];

/** Parte el contexto en bloques por sus títulos. Devuelve {título: [líneas]}. */
export function contextSections(context) {
  const out = {};
  let current = null;
  for (const raw of String(context ?? '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const heading = [...CONTEXT_SECTIONS, 'Lo que no se sabe'].find((h) => line.replace(/:$/, '') === h);
    if (heading) { current = heading; out[current] = []; continue; }
    if (current) out[current].push(line);
  }
  return out;
}

const wordCount = (s) => String(s ?? '').trim().split(/\s+/).filter(Boolean).length;

/**
 * @param {object} draft
 * @param {string[]} evidenceUrls URLs de la evidencia recuperada de ese acontecimiento
 * @returns {string[]} errores; vacío si es válido
 */
export function validateDraft(draft, evidenceUrls) {
  const errors = [];
  for (const field of ['title', 'question', 'card_summary', 'context', 'source_url', 'source_name']) {
    if (typeof draft?.[field] !== 'string' || !draft[field].trim()) errors.push(`falta el campo ${field}`);
  }
  if (errors.length) return errors;

  const title = draft.title.trim();
  const question = draft.question.trim();
  const len = (s) => [...s].length;
  const [tMin, tMax] = LIMITS.title;
  const [qMin, qMax] = LIMITS.question;
  const [sMin, sMax] = LIMITS.card_summary;
  const [wMin, wMax] = LIMITS.contextWords;

  if (len(title) < tMin || len(title) > tMax) errors.push(`title tiene ${len(title)} caracteres (${tMin}-${tMax})`);
  if (!title.endsWith('?')) errors.push('title debe terminar en "?"');
  if (len(question) < qMin || len(question) > qMax) errors.push(`question tiene ${len(question)} caracteres (${qMin}-${qMax})`);
  if (!question.endsWith('?')) errors.push('question debe terminar en "?"');
  if (question.toLowerCase() === title.toLowerCase()) errors.push('question no puede repetir el title');
  if ((question.match(/\?/g) ?? []).length > 1) errors.push('question contiene más de una pregunta');

  const summary = draft.card_summary.trim();
  if (len(summary) < sMin || len(summary) > sMax) errors.push(`card_summary tiene ${len(summary)} caracteres (${sMin}-${sMax})`);

  const words = wordCount(draft.context);
  if (words < wMin || words > wMax) errors.push(`context tiene ${words} palabras (${wMin}-${wMax})`);

  // Un debate, no una noticia: bloques obligatorios y los dos lados con los mismos argumentos.
  const sections = contextSections(draft.context);
  const missing = CONTEXT_SECTIONS.filter((h) => !sections[h]?.length);
  if (missing.length) errors.push(`context sin los bloques: ${missing.join(', ')} (cada título en su propia línea)`);
  const bullets = (h) => (sections[h] ?? []).filter((l) => l.startsWith('•')).length;
  if (!missing.includes('A favor') && !missing.includes('En contra')) {
    const pro = bullets('A favor');
    const con = bullets('En contra');
    if (pro < 2 || con < 2) errors.push(`A favor y En contra necesitan al menos 2 argumentos con "• " (hay ${pro} y ${con})`);
    else if (pro !== con) errors.push(`A favor tiene ${pro} argumentos y En contra ${con}: tienen que ser los mismos`);
  }

  // Vocabulario interno del motor que el lector no debe ver.
  const internal = /\b(dossier|fragmentos?|extractos?)\b/i;
  for (const field of ['title', 'question', 'card_summary', 'context']) {
    const found = internal.exec(draft[field]);
    if (found) {
      // Se cita la frase para que la reparación sepa exactamente qué cambiar.
      const sentence = draft[field].split(/(?<=[.!?])\s+/).find((s) => internal.test(s)) ?? found[0];
      errors.push(`${field} usa vocabulario interno ("${found[0]}"): reescribe sin esa palabra la frase «${sentence.trim()}»`);
    }
  }

  const allowed = new Set(evidenceUrls);
  if (!allowed.has(draft.source_url)) errors.push('source_url no pertenece a la evidencia recuperada');
  if ((draft.sources ?? []).some((s) => !allowed.has(s?.url))) errors.push('una de las fuentes no pertenece a la evidencia recuperada');

  return errors;
}
