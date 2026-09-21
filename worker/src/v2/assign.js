import { topicKey } from './topics.js';
import { sameTopicArea } from './preselect.js';
import { foldAccents } from './text.js';

/**
 * Asignación determinista de acontecimientos a personajes.
 *
 * Se decide a la vez qué acontecimientos y qué personajes, con la cobertura
 * que de verdad hay, en lugar de elegir personajes al azar antes de saber
 * qué noticias hay.
 *
 * Puntuación de una pareja (personaje, acontecimiento):
 *   encaje con la especialidad (del dossier) + calidad del acontecimiento + rotación.
 * Un personaje con muchos días sin publicar tiene prioridad, pero nunca se le
 * asigna algo que no encaja: si no hay nada para él, se registra la excepción.
 */

export const ASSIGN_WEIGHTS = { fit: 0.5, quality: 0.3, rotation: 0.2 };
/** Encaje mínimo de la especialidad para que una pareja sea posible. */
export const MIN_FIT = 0.45;

/**
 * Calidad del acontecimiento: la puntuación barata de la preselección
 * (actualidad, cobertura) más el interés público y la relevancia para España
 * que estima el dossier.
 */
export function eventQuality(candidate) {
  const d = candidate.dossier?.data ?? {};
  const interest = Number.isFinite(d.public_interest) ? d.public_interest : 0.5;
  const spain = Number.isFinite(d.spain_relevance) ? d.spain_relevance : 0.5;
  return 0.5 * candidate.score + 0.25 * interest + 0.25 * spain;
}

/** Actores que salen en casi todas las noticias políticas y no distinguen un asunto de otro. */
const GENERIC_ACTOR = /^(el |la |los |las )?(gobierno|ejecutivo|partido popular|pp|psoe|vox|sumar|podemos|union europea|ue|bruselas|comision europea|congreso|senado|ministerio)\b/;

function specificActors(candidate) {
  return new Set((candidate.dossier?.data?.actors ?? [])
    .map((a) => foldAccents(String(a).toLowerCase()).trim())
    .filter((a) => a && !GENERIC_ACTOR.test(a)));
}

/**
 * ¿Son del mismo asunto? Por ejemplo, dos acontecimientos sobre la crisis de
 * Ceuta: comparten dos nombres propios en sus titulares, o uno en los
 * titulares y un actor concreto en sus dossiers (Feijóo, no "el Gobierno").
 */
export function sameArea(a, b) {
  if (sameTopicArea(a.story, b.story)) return true;
  const sharedEntity = [...(a.story?.entities ?? [])].some((e) => b.story?.entities?.has(e));
  if (!sharedEntity) return false;
  const actorsB = specificActors(b);
  return [...specificActors(a)].some((x) => actorsB.has(x));
}

function rotationScore(persona, rotationLimitDays) {
  if (persona.days_since === null || persona.days_since === undefined) return 1;
  return Math.min(1, persona.days_since / rotationLimitDays);
}

/**
 * @param {object} p
 * @param {object[]} p.personas     {id, username, specialty, days_since}
 * @param {object[]} p.candidates   {event_id, score, dossier: {id, status, data: {specialty_fit, ...}}}
 * @param {number} p.target
 * @param {number} p.rotationLimitDays
 * @param {Set<number>} [p.excludePersonas]
 * @param {Set<number>} [p.excludeEvents]
 * @returns {{assignments: object[], exceptions: string[], alternatives: object[]}}
 */
export function assign({ personas, candidates, target, rotationLimitDays, excludePersonas = new Set(), excludeEvents = new Set() }) {
  const usable = candidates.filter((c) => c.dossier?.status === 'ok' && !excludeEvents.has(c.event_id));
  const people = personas.filter((p) => !excludePersonas.has(p.id));

  const pairs = [];
  for (const persona of people) {
    const key = topicKey(persona.specialty);
    for (const c of usable) {
      const fit = Number(c.dossier.data?.specialty_fit?.[key] ?? 0);
      if (fit < MIN_FIT) continue;
      const rotation = rotationScore(persona, rotationLimitDays);
      const quality = eventQuality(c);
      const score = ASSIGN_WEIGHTS.fit * fit + ASSIGN_WEIGHTS.quality * quality + ASSIGN_WEIGHTS.rotation * rotation;
      pairs.push({ persona, candidate: c, fit, rotation, quality, score });
    }
  }

  const overdue = people.filter((p) => p.days_since === null || p.days_since === undefined || p.days_since >= rotationLimitDays);
  // Parejas de acontecimientos del mismo asunto: no pueden ir juntos en el lote.
  const conflicts = new Set();
  for (const a of usable) {
    for (const b of usable) {
      if (a.event_id < b.event_id && sameArea(a, b)) {
        conflicts.add(`${a.event_id}:${b.event_id}`);
        conflicts.add(`${b.event_id}:${a.event_id}`);
      }
    }
  }
  const best = searchBest(pairs, target, overdue, conflicts);

  const exceptions = [];
  const chosenPersonas = new Set(best.map((b) => b.persona.id));
  for (const p of overdue) {
    if (!chosenPersonas.has(p.id)) {
      const hasAny = pairs.some((x) => x.persona.id === p.id);
      exceptions.push(hasAny
        ? `@${p.username} lleva ${p.days_since ?? 'siempre'} días sin publicar, pero otros acontecimientos encajaban mejor con el resto del lote`
        : `@${p.username} lleva ${p.days_since ?? 'siempre'} días sin publicar y hoy no hay ningún acontecimiento con evidencia que encaje con ${p.specialty}`);
    }
  }

  const assignments = best.map((b) => ({
    persona_id: b.persona.id,
    persona_username: b.persona.username,
    event_id: b.candidate.event_id,
    dossier_id: b.candidate.dossier.id,
    scores: { total: round(b.score), fit: round(b.fit), quality: round(b.quality), rotation: round(b.rotation) },
    reasons: [
      `encaje con ${b.persona.specialty}: ${round(b.fit)}`,
      `calidad del acontecimiento: ${round(b.quality)}`,
      b.persona.days_since === null ? 'nunca ha publicado' : `${b.persona.days_since} días desde su último debate`,
    ],
  }));

  // Parejas de reserva para sustituir un debate que falle, en orden de puntuación.
  const alternatives = pairs
    .filter((x) => !best.some((b) => b.persona.id === x.persona.id && b.candidate.event_id === x.candidate.event_id))
    .sort((a, b) => b.score - a.score)
    .map((x) => ({ persona_id: x.persona.id, event_id: x.candidate.event_id, score: round(x.score) }));

  return { assignments, exceptions, alternatives };
}

/**
 * Busca el conjunto de `target` parejas con personajes y acontecimientos
 * distintos que más puntúa, dando prioridad a cubrir personajes atrasados.
 * El tamaño es pequeño (8 personajes x ~10 candidatos), así que se explora
 * entero con poda.
 */
function searchBest(pairs, target, overdue, conflicts = new Set()) {
  const overdueIds = new Set(overdue.map((p) => p.id));
  const value = (set) => set.reduce((acc, x) => acc + x.score, 0) + set.filter((x) => overdueIds.has(x.persona.id)).length * 10;
  const sorted = [...pairs].sort((a, b) => b.score - a.score);

  let best = [];
  let bestValue = -1;
  const upperBound = (chosen, from) => {
    let v = value(chosen);
    let slots = target - chosen.length;
    for (let i = from; i < sorted.length && slots > 0; i++) {
      v += sorted[i].score + (overdueIds.has(sorted[i].persona.id) ? 10 : 0);
      slots--;
    }
    return v;
  };

  // Tope de nodos: con las parejas ordenadas de mejor a peor, la primera
  // solución completa ya es buena; el tope evita casos patológicos.
  let nodes = 0;
  const MAX_NODES = 500_000;

  const walk = (from, chosen, personas, events) => {
    if (++nodes > MAX_NODES) return;
    if (chosen.length === target || from >= sorted.length) {
      const size = chosen.length;
      const v = value(chosen);
      if (size > best.length || (size === best.length && v > bestValue)) {
        best = [...chosen];
        bestValue = v;
      }
      return;
    }
    if (chosen.length + (sorted.length - from) < best.length) return;
    if (chosen.length + (sorted.length - from) >= target && best.length === target && upperBound(chosen, from) <= bestValue) return;

    const pair = sorted[from];
    const clashes = [...events].some((e) => conflicts.has(`${e}:${pair.candidate.event_id}`));
    if (!personas.has(pair.persona.id) && !events.has(pair.candidate.event_id) && !clashes) {
      personas.add(pair.persona.id);
      events.add(pair.candidate.event_id);
      chosen.push(pair);
      walk(from + 1, chosen, personas, events);
      chosen.pop();
      personas.delete(pair.persona.id);
      events.delete(pair.candidate.event_id);
    }
    walk(from + 1, chosen, personas, events);
  };

  walk(0, [], new Set(), new Set());
  return best;
}

const round = (n) => Math.round(n * 1000) / 1000;
