import { foldAccents, tokens } from './text.js';

/**
 * Vocabulario por especialidad de personaje. Sirve para una primera
 * clasificación barata, sin modelo. El encaje final lo decide el dossier.
 * Las palabras van sin tildes y en minúscula.
 */
export const TOPIC_LEXICON = {
  'política': ['gobierno', 'congreso', 'senado', 'ministro', 'ministra', 'presidente', 'partido', 'pp', 'psoe', 'vox', 'sumar', 'podemos', 'elecciones', 'electoral', 'diputado', 'parlamento', 'ley', 'decreto', 'moncloa', 'oposicion', 'votacion', 'investidura', 'comunidad', 'autonomica', 'alcalde', 'ayuntamiento', 'tribunal', 'constitucional', 'corrupcion', 'juez', 'fiscal', 'ue', 'bruselas', 'otan'],
  'economía': ['economia', 'empleo', 'paro', 'salario', 'salarios', 'inflacion', 'ipc', 'precios', 'bce', 'tipos', 'interes', 'hipoteca', 'vivienda', 'alquiler', 'impuesto', 'impuestos', 'hacienda', 'presupuestos', 'deuda', 'pib', 'bolsa', 'ibex', 'empresa', 'empresas', 'banco', 'pensiones', 'trabajo', 'laboral', 'productividad', 'aranceles', 'comercio', 'autonomos', 'huelga', 'sindicatos'],
  'ciencia': ['ciencia', 'cientificos', 'investigacion', 'investigadores', 'estudio', 'universidad', 'csic', 'nasa', 'esa', 'espacio', 'telescopio', 'salud', 'medicina', 'vacuna', 'virus', 'enfermedad', 'cancer', 'hospital', 'sanidad', 'genetica', 'fisica', 'quimica', 'descubrimiento', 'nature', 'science', 'ensayo', 'clinico', 'epidemia'],
  'tecnología': ['tecnologia', 'inteligencia', 'artificial', 'algoritmo', 'algoritmos', 'datos', 'privacidad', 'ciberseguridad', 'ciberataque', 'hackeo', 'internet', 'redes', 'google', 'apple', 'meta', 'microsoft', 'openai', 'chatgpt', 'movil', 'app', 'digital', 'software', 'chip', 'chips', 'semiconductores', 'robot', 'tiktok', 'plataforma', 'plataformas'],
  'sociedad': ['sociedad', 'educacion', 'colegio', 'colegios', 'alumnos', 'profesores', 'familia', 'familias', 'jovenes', 'juventud', 'mayores', 'inmigracion', 'migrantes', 'violencia', 'mujeres', 'igualdad', 'cultura', 'festival', 'deporte', 'futbol', 'salud', 'mental', 'consumo', 'turismo', 'transporte', 'tren', 'renfe', 'trafico', 'barrio', 'vecinos'],
  'ética': ['etica', 'moral', 'derechos', 'humanos', 'justicia', 'eutanasia', 'aborto', 'libertad', 'expresion', 'censura', 'discriminacion', 'responsabilidad', 'dilema', 'consentimiento', 'privacidad', 'vigilancia', 'animales', 'maltrato', 'condena', 'indulto', 'amnistia'],
  'filosofía': ['filosofia', 'verdad', 'identidad', 'libertad', 'conciencia', 'sentido', 'felicidad', 'muerte', 'soledad', 'tiempo', 'progreso', 'naturaleza', 'humano', 'humanidad', 'democracia', 'poder', 'desinformacion', 'polarizacion'],
  'medioambiente': ['clima', 'climatico', 'calentamiento', 'emisiones', 'co2', 'contaminacion', 'incendio', 'incendios', 'sequia', 'agua', 'embalses', 'dana', 'lluvias', 'temperaturas', 'calor', 'ola', 'biodiversidad', 'especies', 'energia', 'renovables', 'solar', 'eolica', 'nuclear', 'residuos', 'plasticos', 'medioambiente', 'ambiental', 'parque', 'litoral', 'costa', 'agricultura'],
};

const LEXICON_SETS = Object.fromEntries(
  Object.entries(TOPIC_LEXICON).map(([topic, words]) => [topic, new Set(words)])
);

/** Normaliza la especialidad de un personaje a una clave del vocabulario ("economia" → "economía"). */
export function topicKey(specialty) {
  const folded = foldAccents(String(specialty ?? '').toLowerCase().trim());
  return Object.keys(TOPIC_LEXICON).find((k) => foldAccents(k) === folded) ?? String(specialty ?? '');
}

/**
 * Puntuación por especialidad de un conjunto de textos, más un pequeño peso
 * por las especialidades que declaran sus fuentes.
 * @returns {Array<[string, number]>} ordenado de mayor a menor
 */
export function topicScores(texts, sourceTopics = []) {
  const counts = Object.fromEntries(Object.keys(TOPIC_LEXICON).map((k) => [k, 0]));
  for (const t of texts) {
    for (const word of tokens(t)) {
      for (const [topic, set] of Object.entries(LEXICON_SETS)) {
        if (set.has(word)) counts[topic] += 1;
      }
    }
  }
  for (const topic of sourceTopics) {
    const key = topicKey(topic);
    if (key in counts) counts[key] += 0.5;
  }
  return Object.entries(counts).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
}
