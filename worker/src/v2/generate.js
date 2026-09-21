import { extractJson } from './llm.js';
import { LIMITS, validateDraft } from './validate.js';

export const GENERATE_PROMPT_VERSION = 'generate-v10';
export const REVIEW_PROMPT_VERSION = 'review-v9';

/** Instrucciones añadidas cuando el personaje no tiene hoy actualidad con una medida concreta. */
const FONDO_RULES = `DEBATE DE FONDO
- Hoy no hay una medida concreta: la pregunta trata una de las cuestiones generales de la lista.
- El contexto parte de la noticia (qué ha pasado, con sus fuentes) y explica por qué plantea esa cuestión.
- No presentes la cuestión como si alguien la hubiera propuesto, anunciado o aprobado si no consta en los hechos.
- Mismas reglas de neutralidad: la pregunta no presupone la respuesta.
`;

/** El dossier en el formato que ve el modelo: solo hechos, declaraciones y lo que falta por saber. */
function dossierForPrompt(dossier, kind = 'actualidad') {
  const d = dossier.data;
  const lines = [];
  lines.push(`Titular neutral: ${d.headline}`);
  lines.push(`Resumen: ${d.summary}`);
  lines.push('HECHOS RESPALDADOS:');
  d.facts.forEach((f) => lines.push(`- ${f.text} [${f.refs.join(',')}]`));
  if (d.claims?.length) {
    lines.push('DECLARACIONES (atribuir siempre a quien las hace, no son hechos):');
    d.claims.forEach((c) => lines.push(`- ${c.actor}: «${c.statement}» [${c.refs.join(',')}]`));
  }
  if (d.figures?.length) {
    lines.push('CIFRAS:');
    d.figures.forEach((f) => lines.push(`- ${f.value}: ${f.meaning ?? ''} [${f.refs.join(',')}]`));
  }
  if (d.discrepancies?.length) {
    lines.push('DISCREPANCIAS ENTRE FUENTES:');
    d.discrepancies.forEach((x) => lines.push(`- ${x.topic}: ${x.versions.map((v) => `${v.text} [${v.refs.join(',')}]`).join(' / ')}`));
  }
  if (d.unknowns?.length) {
    lines.push('AÚN NO SE SABE:');
    d.unknowns.forEach((u) => lines.push(`- ${u}`));
  }
  if (kind === 'fondo') {
    lines.push('CUESTIONES GENERALES QUE PLANTEA LA NOTICIA (debate de fondo, no son medidas anunciadas):');
    (d.background_proposals ?? []).forEach((p, i) => lines.push(`${i + 1}. ${p.proposal} [${p.refs.join(',')}]`));
  } else {
    lines.push('PROPUESTAS O DECISIONES SOBRE LAS QUE SE PUEDE VOTAR:');
    d.debatable_proposals.forEach((p, i) => lines.push(`${i + 1}. ${p.proposal}${p.who_decides ? ` (decide: ${p.who_decides})` : ''} [${p.refs.join(',')}]`));
  }
  lines.push('FUENTES:');
  dossier.evidence.forEach((e) => lines.push(`[${e.id}] ${e.source} — ${e.title}`));
  return lines.join('\n');
}

/**
 * Prompt de redacción. El personaje solo cambia la forma: vocabulario, ritmo y
 * manera de plantear la pregunta. Los hechos y la neutralidad no se tocan.
 * De la ficha del personaje solo se usan nombre, especialidad y rasgos de
 * estilo; ni bio ni "qué representa", que llevan postura.
 */
export function buildGenerationPrompt(dossier, persona, kind = 'actualidad') {
  const [tMin, tMax] = LIMITS.title;
  const [qMin, qMax] = LIMITS.question;
  const [sMin, sMax] = LIMITS.card_summary;
  const [wMin, wMax] = LIMITS.contextWords;

  const system = `Escribes como un personaje de TuDebateDiario. Cada día el personaje publica una intervención suya, en primera persona, a partir de un tema de actualidad. No es una noticia ni un resumen: es el personaje hablando, con su carácter, para que la gente piense, vote y comente.

CÓMO ES LA INTERVENCIÓN
- Habla el personaje, en primera persona, con su tono y su forma de pensar. Tiene que notarse quién escribe.
- No cuenta la noticia. Como mucho la menciona en una o dos frases para situar el tema; lo importante es lo que el tema plantea.
- Interpreta: qué hay de fondo, qué está en juego, por qué importa a la gente, qué preguntas abre.
- Es neutral: el personaje no da su opinión ni deja ver qué votaría. Pone sobre la mesa lo que empuja hacia un lado y lo que empuja hacia el otro, con el mismo peso, y deja la pregunta abierta.
- Termina invitando al lector a posicionarse y a comentar, con una frase propia del personaje, no una fórmula.

LÍMITES (obligatorio)
- Datos, cifras, fechas, nombres y citas: SOLO los del dossier. Nunca inventes un dato, un estudio ni una declaración.
- Los razonamientos generales sí valen, sin datos nuevos.
- El carácter del personaje es tono, no postura: nada de burlas ni ironía sobre personas o grupos concretos, ni adjetivos que juzguen a los implicados.
- En casos judiciales nunca se plantea la culpabilidad de una persona concreta ni si debe ser juzgada: se habla de la cuestión pública que abre el caso.
- El lector no sabe que existe un dossier: no escribas "dossier", "fragmento", "extracto" ni "evidencia".

FORMATO
- Español. Responde solo con JSON válido.
- title: de ${tMin} a ${tMax} caracteres, termina en "?". La pregunta que el personaje lanza, con su voz.
- question: de ${qMin} a ${qMax} caracteres, termina en "?", distinta del title. La medida o idea concreta que se vota, dicha de forma llana y sin presuponer la respuesta.
- card_summary: de ${sMin} a ${sMax} caracteres. La primera frase del personaje, la que engancha: en primera persona y sin tomar partido.
- context: de ${wMin} a ${wMax} palabras. La intervención del personaje a partir del card_summary, sin repetirlo: el lector ya lo ha leído justo antes. Párrafos cortos separados por una línea en blanco. Sin títulos, sin listas y sin viñetas.
- used_refs: ids de las fuentes que has usado. primary_ref: la fuente principal.`;

  const user = `PERSONAJE: ${persona.display_name} (especialidad: ${persona.specialty})
Carácter: ${persona.voice || (persona.traits ?? []).join(', ') || 'sobrio'}
Rasgos: ${(persona.traits ?? []).join(', ')}

DOSSIER
${dossierForPrompt(dossier, kind)}
${kind === 'fondo' ? FONDO_RULES : ''}
Devuelve:
{"title": "¿...?", "question": "¿...?", "card_summary": "...", "context": "...", "used_refs": ["E1"], "primary_ref": "E1"}`;

  return { system, user };
}

export function buildReviewPrompt(dossier, draft, kind = 'actualidad') {
  const system = `Eres el editor de verificación de un medio neutral. Compruebas un borrador contra el dossier de hechos del que sale. No reescribes: decides si se puede publicar.

Es la intervención de un personaje en primera persona. Suspéndela si:
- afirma un dato, cifra, suceso o cita que no está en el dossier o lo contradice (unsupported_fact);
- presenta como hecho lo que en el dossier es una declaración de parte (attribution);
- el personaje da su opinión, deja ver qué votaría o solo presenta razones de un lado (bias);
- se burla o usa adjetivos que juzgan a personas o grupos concretos (bias);
- la pregunta de voto no trata una única medida votable a favor/en contra/neutral, presupone la respuesta, acusa, es doble o menciona quién apoya o rechaza la medida (question);
- la pregunta pide votar sobre una persona concreta en un caso judicial (question);
- es sobre todo un resumen de la noticia y no una intervención que interpreta el tema (format).

NO suspendas por esto:
- Las interpretaciones y los razonamientos del personaje no son hechos: valen aunque no estén en el dossier, siempre que no metan datos, cifras, sucesos o citas nuevos.
- El tono del personaje (seco, sereno, directo, preguntón...) no es sesgo mientras no tome partido ni juzgue a nadie.

Responde solo con JSON válido.`;

  const user = `DOSSIER
${dossierForPrompt(dossier, kind)}
${kind === 'fondo' ? 'Es un debate de fondo: la pregunta trata una cuestión general que plantea la noticia, no una medida anunciada. No la suspendas por eso, pero sí si presenta la cuestión como si alguien la hubiera propuesto o aprobado.\n' : ''}
BORRADOR
title: ${draft.title}
question: ${draft.question}
card_summary: ${draft.card_summary}
context: ${draft.context}

Devuelve:
{"verdict": "pass" | "fail", "issues": [{"type": "unsupported_fact" | "attribution" | "bias" | "question" | "format" | "other", "detail": "..."}]}`;

  return { system, user };
}

/** Convierte la respuesta del modelo en borrador: las fuentes las pone el sistema, no el modelo. */
export function toDraft(raw, dossier, model) {
  const data = extractJson(raw);
  const byId = new Map(dossier.evidence.map((e) => [e.id, e]));
  const used = (Array.isArray(data.used_refs) ? data.used_refs : []).map(String).filter((r) => byId.has(r));
  const primary = byId.get(String(data.primary_ref)) ?? byId.get(used[0]) ?? dossier.evidence[0];
  const sources = [...new Set([primary.id, ...used])].map((id) => byId.get(id))
    .map((e) => ({ name: e.source, url: e.url, published_at: e.published_at }));

  // El resumen se muestra justo antes del texto: si el texto empieza repitiéndolo, se quita.
  const summary = String(data.card_summary ?? '').trim();
  let context = String(data.context ?? '').trim();
  if (summary && context.startsWith(summary)) context = context.slice(summary.length).trim();

  return {
    title: String(data.title ?? '').trim(),
    question: String(data.question ?? '').trim(),
    card_summary: String(data.card_summary ?? '').trim(),
    context,
    source_name: primary.source,
    source_url: primary.url,
    sources,
    generation_model: model,
    used_refs: used,
  };
}

export function parseReview(raw) {
  const data = extractJson(raw);
  const issues = (Array.isArray(data.issues) ? data.issues : [])
    .filter((i) => i && typeof i.detail === 'string')
    .map((i) => ({ type: String(i.type ?? 'other'), detail: i.detail }));
  // Un "pass" con problemas señalados no se da por bueno.
  const verdict = data.verdict === 'pass' && issues.length === 0 ? 'pass' : 'fail';
  return { verdict, issues };
}

/**
 * Redacta y revisa un debate. Un intento más como mucho si falla la validación
 * o la revisión, con los problemas encontrados. Devuelve el borrador aprobado
 * o el motivo del rechazo.
 */
export async function generateDebate({ assignment, dossier, persona, llm, limits, stage = 'generate', kind = 'actualidad' }) {
  const prompt = buildGenerationPrompt(dossier, persona, kind);
  const evidenceUrls = dossier.evidence.map((e) => e.url);
  let feedback = [];
  let lastDraft = null;
  let lastReview = null;

  for (let attempt = 1; attempt <= 1 + limits.maxRepairAttempts; attempt++) {
    const user = attempt === 1 ? prompt.user
      : `${prompt.user}\n\nEl borrador anterior se rechazó por esto:\n- ${feedback.join('\n- ')}\nCorrígelo manteniendo las mismas reglas.`;
    const ref = `slot:${assignment.slot}`;
    const { text } = await llm.complete({
      system: prompt.system, user, stage, purpose: attempt === 1 ? 'generate' : 'generate-repair',
      reference: ref, promptVersion: GENERATE_PROMPT_VERSION, attempt,
    });

    let draft;
    try {
      draft = toDraft(text, dossier, llm.model);
    } catch (err) {
      feedback = [`respuesta no válida: ${err.message}`];
      continue;
    }
    lastDraft = draft;

    const errors = validateDraft(draft, evidenceUrls);
    if (errors.length) {
      feedback = errors;
      continue;
    }

    const review = buildReviewPrompt(dossier, draft, kind);
    const reviewed = await llm.complete({
      system: review.system, user: review.user, stage, purpose: 'review',
      reference: ref, promptVersion: REVIEW_PROMPT_VERSION, attempt,
    });
    try {
      lastReview = parseReview(reviewed.text);
    } catch (err) {
      lastReview = { verdict: 'fail', issues: [{ type: 'other', detail: `revisión ilegible: ${err.message}` }] };
    }
    if (lastReview.verdict === 'pass') {
      return { status: 'validated', draft, review: lastReview };
    }
    feedback = lastReview.issues.map((i) => `${i.type}: ${i.detail}`);
  }

  return {
    status: 'rejected',
    draft: lastDraft,
    review: lastReview,
    reason: feedback.join('; ') || 'sin detalle',
  };
}
