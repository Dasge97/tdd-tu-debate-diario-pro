import { extractJson } from './llm.js';
import { LIMITS, validateDraft } from './validate.js';

export const GENERATE_PROMPT_VERSION = 'generate-v6';
export const REVIEW_PROMPT_VERSION = 'review-v6';

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

  const system = `Redactas debates para TuDebateDiario. Un debate NO es una noticia: el lector tiene que entender qué choca, ver los mejores argumentos de cada lado y decidir. La plataforma es neutral: presenta el conflicto con justicia y no empuja hacia ninguna respuesta.

QUÉ HACE BUENO UN DEBATE
- Un dilema real: una medida o idea sobre la que personas razonables están en desacuerdo porque chocan valores o intereses (libertad y seguridad, igualdad e incentivos, coste y beneficio, corto y largo plazo...).
- Los dos lados defendidos en su mejor versión, con la misma extensión y el mismo cuidado. Si solo uno aparece en las noticias, construye el otro con los argumentos que razonablemente se le oponen.
- Una pregunta clara que se pueda votar a favor, en contra o neutral.

HECHOS Y NEUTRALIDAD (obligatorio)
- Los hechos, cifras, fechas y citas salen SOLO del dossier. Nunca inventes un dato, un estudio, una cifra ni una declaración.
- Los argumentos pueden ser razonamientos generales ("quienes lo defienden sostienen que...", "sus críticos advierten de que..."), pero sin datos nuevos. Si un argumento lo defiende alguien concreto del dossier, atribúyeselo.
- Toda afirmación de parte se atribuye. Nada de adjetivos valorativos. El texto no da la razón a nadie.
- La pregunta trata UNA sola medida, no presupone la respuesta, no acusa, no mete dos preguntas en una y no menciona quién está a favor o en contra.
- En casos judiciales nunca se vota sobre una persona concreta (culpabilidad, juicio, diligencias de su causa): el debate es una cuestión pública que plantea el caso.
- El lector no sabe que existe un dossier: no escribas "dossier", "fragmento", "extracto" ni "evidencia".

PERSONAJE
- El personaje presenta el debate con su voz en el title y el card_summary: su vocabulario, su ritmo y su manera de ver el dilema desde su especialidad. Que se note quién lo firma.
- Su voz nunca toma partido: plantea la tensión, no la resuelve. Nada de ironía sobre los implicados.

FORMATO
- Español. Responde solo con JSON válido.
- title: de ${tMin} a ${tMax} caracteres, termina en "?". La pregunta de fondo con la voz del personaje, que dé ganas de entrar. No es el titular de la noticia.
- question: de ${qMin} a ${qMax} caracteres, termina en "?", distinta del title. La medida concreta que se vota, dicha de forma llana.
- card_summary: de ${sMin} a ${sMax} caracteres. Qué se propone y por qué divide, en una o dos frases. No es un resumen de la noticia.
- context: de ${wMin} a ${wMax} palabras, con estos bloques en este orden, cada título en su propia línea y exactamente así:
Qué ha pasado
(2 o 3 frases con los hechos y quién los cuenta)
Qué se discute
(1 o 2 frases: qué valores o intereses chocan)
A favor
• (argumento)
• (argumento)
En contra
• (argumento)
• (argumento)
Lo que no se sabe
(1 o 2 frases)
- A favor y En contra llevan cada uno 2 o 3 viñetas, el mismo número en los dos, y cada viñeta empieza por "• ".
- used_refs: ids de las fuentes que has usado. primary_ref: la fuente principal.`;

  const user = `PERSONAJE: ${persona.display_name} (especialidad: ${persona.specialty})
Rasgos de estilo: ${(persona.traits ?? []).join(', ') || 'sobrio'}

DOSSIER
${dossierForPrompt(dossier, kind)}
${kind === 'fondo' ? FONDO_RULES : ''}
Devuelve:
{"title": "¿...?", "question": "¿...?", "card_summary": "...", "context": "...", "used_refs": ["E1"], "primary_ref": "E1"}`;

  return { system, user };
}

export function buildReviewPrompt(dossier, draft, kind = 'actualidad') {
  const system = `Eres el editor de verificación de un medio neutral. Compruebas un borrador contra el dossier de hechos del que sale. No reescribes: decides si se puede publicar.

Suspende el borrador si:
- afirma algo que no está en el dossier o lo contradice (unsupported_fact);
- presenta como hecho lo que en el dossier es una declaración de parte (attribution);
- toma partido, usa adjetivos valorativos o empuja al lector hacia una respuesta (bias);
- la pregunta no trata una única propuesta votable a favor/en contra/neutral, presupone la respuesta, acusa, es doble o menciona quién apoya o rechaza la medida (question);
- la pregunta pide votar sobre una persona concreta en un caso judicial: su culpabilidad, si debe ser juzgada o condenada, o una actuación procesal de su caso (question);
- los bloques A favor y En contra no están equilibrados: uno tiene argumentos más fuertes, más largos o más cuidados que el otro, o alguno es un argumento de paja (balance);
- un argumento introduce un dato, cifra, estudio o cita que no está en el dossier (unsupported_fact). Un razonamiento general sin datos nuevos sí vale;
- el title o el card_summary dan la razón a un lado (bias).

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
{"verdict": "pass" | "fail", "issues": [{"type": "unsupported_fact" | "attribution" | "bias" | "question" | "balance" | "other", "detail": "..."}]}`;

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
