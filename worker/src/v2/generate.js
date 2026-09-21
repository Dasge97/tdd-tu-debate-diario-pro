import { extractJson } from './llm.js';
import { LIMITS, validateDraft } from './validate.js';

export const GENERATE_PROMPT_VERSION = 'generate-v4';
export const REVIEW_PROMPT_VERSION = 'review-v4';

/** El dossier en el formato que ve el modelo: solo hechos, declaraciones y lo que falta por saber. */
function dossierForPrompt(dossier) {
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
  lines.push('PROPUESTAS O DECISIONES SOBRE LAS QUE SE PUEDE VOTAR:');
  d.debatable_proposals.forEach((p, i) => lines.push(`${i + 1}. ${p.proposal}${p.who_decides ? ` (decide: ${p.who_decides})` : ''} [${p.refs.join(',')}]`));
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
export function buildGenerationPrompt(dossier, persona) {
  const [tMin, tMax] = LIMITS.title;
  const [qMin, qMax] = LIMITS.question;
  const [sMin, sMax] = LIMITS.card_summary;
  const [wMin, wMax] = LIMITS.contextWords;

  const system = `Redactas debates para TuDebateDiario, una plataforma cuyo principio es la neutralidad: los lectores deben entender qué ha pasado y votar a favor, en contra o neutral sin que el texto les empuje hacia una respuesta.

NEUTRALIDAD (obligatorio, por encima del estilo)
- Usa solo los hechos, declaraciones y cifras del dossier. No añadas nada de tu memoria.
- Separa lo ocurrido de las declaraciones: toda afirmación de parte se atribuye ("según el Gobierno...", "la oposición sostiene...").
- Nada de adjetivos valorativos ni juicios presentados como hechos. Menciona lo que aún no se sabe.
- Si las fuentes discrepan, dilo. No iguales un dato respaldado con una afirmación sin respaldo.
- La pregunta trata UNA sola propuesta o decisión del dossier, se puede responder a favor/en contra/neutral, no presupone la respuesta, no acusa, no plantea una falsa dicotomía y no mete dos preguntas en una.
- La pregunta no menciona quién está a favor o en contra de la medida: eso va en el contexto, no en lo que se vota.
- En casos judiciales nunca se vota sobre una persona concreta: ni su culpabilidad, ni si debe ser juzgada o condenada, ni las actuaciones procesales de su caso (citaciones, pruebas, tasaciones, plazos). La pregunta trata una cuestión pública que plantea el caso (una norma, una práctica institucional, una reforma).
- No busques indignar ni provocar.
- El lector no sabe que existe un dossier: no escribas "dossier", "fragmento", "extracto" ni "evidencia". Si algo no se sabe, di que no se ha informado o que aún no se conoce.

ESTILO DEL PERSONAJE
- El personaje solo influye en la forma: vocabulario, ritmo de las frases y manera de presentar la pregunta.
- El estilo no puede añadir opinión, ironía sobre los implicados ni una postura.

FORMATO
- Español. Responde solo con JSON válido.
- title: pregunta de ${tMin} a ${tMax} caracteres, termina en "?".
- question: la pregunta de votación, de ${qMin} a ${qMax} caracteres, termina en "?", distinta del title.
- card_summary: de ${sMin} a ${sMax} caracteres, qué ha pasado en una o dos frases.
- context: de ${wMin} a ${wMax} palabras, explicación factual accesible: qué ha pasado, quién decide, qué dicen las partes, qué se sabe y qué no.
- used_refs: ids de las fuentes que has usado. primary_ref: la fuente principal.`;

  const user = `PERSONAJE: ${persona.display_name} (especialidad: ${persona.specialty})
Rasgos de estilo: ${(persona.traits ?? []).join(', ') || 'sobrio'}

DOSSIER
${dossierForPrompt(dossier)}

Devuelve:
{"title": "¿...?", "question": "¿...?", "card_summary": "...", "context": "...", "used_refs": ["E1"], "primary_ref": "E1"}`;

  return { system, user };
}

export function buildReviewPrompt(dossier, draft) {
  const system = `Eres el editor de verificación de un medio neutral. Compruebas un borrador contra el dossier de hechos del que sale. No reescribes: decides si se puede publicar.

Suspende el borrador si:
- afirma algo que no está en el dossier o lo contradice (unsupported_fact);
- presenta como hecho lo que en el dossier es una declaración de parte (attribution);
- toma partido, usa adjetivos valorativos o empuja al lector hacia una respuesta (bias);
- la pregunta no trata una única propuesta votable a favor/en contra/neutral, presupone la respuesta, acusa, es doble o menciona quién apoya o rechaza la medida (question);
- la pregunta pide votar sobre una persona concreta en un caso judicial: su culpabilidad, si debe ser juzgada o condenada, o una actuación procesal de su caso (question).

Responde solo con JSON válido.`;

  const user = `DOSSIER
${dossierForPrompt(dossier)}

BORRADOR
title: ${draft.title}
question: ${draft.question}
card_summary: ${draft.card_summary}
context: ${draft.context}

Devuelve:
{"verdict": "pass" | "fail", "issues": [{"type": "unsupported_fact" | "attribution" | "bias" | "question" | "other", "detail": "..."}]}`;

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

  return {
    title: String(data.title ?? '').trim(),
    question: String(data.question ?? '').trim(),
    card_summary: String(data.card_summary ?? '').trim(),
    context: String(data.context ?? '').trim(),
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
export async function generateDebate({ assignment, dossier, persona, llm, limits, stage = 'generate' }) {
  const prompt = buildGenerationPrompt(dossier, persona);
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

    const review = buildReviewPrompt(dossier, draft);
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
