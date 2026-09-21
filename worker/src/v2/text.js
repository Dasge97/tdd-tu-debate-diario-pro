import { createHash } from 'node:crypto';

/** Utilidades de texto del motor V2: limpieza de HTML, hashes y palabras clave. */

export const sha256 = (value) => createHash('sha256').update(value).digest('hex');

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', laquo: '«', raquo: '»',
  ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', hellip: '…', ndash: '–', mdash: '—',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', uuml: 'ü',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Ntilde: 'Ñ', iquest: '¿', iexcl: '¡',
  euro: '€', ordf: 'ª', ordm: 'º', deg: '°',
};

export function decodeEntities(text) {
  return String(text ?? '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : match;
    }
    return NAMED_ENTITIES[code] ?? match;
  });
}

/**
 * Deja solo el texto legible de un fragmento HTML. Quita scripts, estilos,
 * figuras y comentarios enteros; el resto de etiquetas se sustituyen por espacios.
 */
export function cleanHtml(html) {
  let text = String(html ?? '');
  text = text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  text = text.replace(/<!--[\s\S]*?-->/g, ' ');
  text = text.replace(/<(script|style|iframe|figure|figcaption|noscript|svg)\b[\s\S]*?<\/\1>/gi, ' ');
  text = text.replace(/<br\s*\/?>/gi, ' ').replace(/<\/p>/gi, ' ');
  text = text.replace(/<[^>]+>/g, ' ');
  // Algunos feeds escapan el HTML dos veces.
  text = decodeEntities(text);
  if (/<[a-z][^>]*>/i.test(text)) text = text.replace(/<[^>]+>/g, ' ');
  return text.replace(/\s+/g, ' ').trim();
}

export function truncate(text, max) {
  const s = String(text ?? '');
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + '…';
}

export const foldAccents = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');

// Palabras vacías en español e inglés, ya sin tildes.
const STOPWORDS = new Set(`
a al algo algun alguna algunas alguno algunos ante antes aqui asi aun aunque bajo bien cada casi como con contra cual cuales
cuando cuanto de del desde donde dos durante e el ella ellas ello ellos en entre era eran es esa esas ese eso esos esta estaba
estado estan estar estas este esto estos fue fueron ha habia han hasta hay haya he la las le les lo los mas me mientras mismo
muy nada ni no nos nosotros o os otra otras otro otros para pero poco por porque que quien quienes se sea segun ser si sido
sin sino sobre solo son su sus tambien tan tanto te tiene tienen todo todos tras tu tus un una uno unos usted y ya yo
dice dijo afirma asegura segun hoy ayer manana semana ano anos dia dias nuevo nueva nuevos nuevas primer primera tres cuatro
cinco millones mil ultima ultimo ultimas ultimos gran grandes puede pueden podria sera seran hace hacer va van vez veces
the of and to in for on with at by from is are was were be this that it as an or its has have will after over new
`.split(/\s+/).filter(Boolean));

/** Palabras significativas, sin tildes ni mayúsculas. */
export function tokens(text) {
  return foldAccents(String(text ?? '').toLowerCase())
    .replace(/[^a-z0-9ñ\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w) && !/^\d{1,2}$/.test(w));
}

const SENTENCE_START_WORDS = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'en', 'de', 'por', 'para', 'con', 'sin', 'tras', 'segun', 'este', 'esta', 'the', 'a']);

/**
 * Nombres propios aproximados: secuencias de palabras con mayúscula inicial
 * que no están al principio de la frase. Devuelve formas plegadas en minúscula.
 */
export function properNouns(text) {
  const out = new Set();
  const words = String(text ?? '').split(/\s+/);
  let current = [];
  let currentAtStart = false;
  const flush = () => {
    // Una sola palabra con mayúscula al principio de frase ("Consulte", "Leer") no es un nombre propio.
    if (current.length && !(currentAtStart && current.length === 1)) {
      const phrase = foldAccents(current.join(' ').toLowerCase()).replace(/[^a-z0-9ñ ]/g, '').trim();
      if (phrase.length >= 3 && !SENTENCE_START_WORDS.has(phrase)) out.add(phrase);
    }
    current = [];
    currentAtStart = false;
  };
  words.forEach((raw, i) => {
    const word = raw.replace(/^[«"“'(¿¡]+|[»"”'),.:;!?]+$/g, '');
    const startsSentence = i === 0 || /[.!?:]$/.test(words[i - 1] ?? '');
    const isCapitalized = /^[A-ZÁÉÍÓÚÑ][\p{L}\d]+/u.test(word) || /^[A-ZÁÉÍÓÚÑ]{2,}$/.test(word);
    if (isCapitalized && !(startsSentence && current.length === 0 && SENTENCE_START_WORDS.has(foldAccents(word.toLowerCase())))) {
      if (current.length === 0) currentAtStart = startsSentence;
      current.push(word);
      if (/[,.:;!?»")]$/.test(raw)) flush();
    } else {
      flush();
    }
  });
  flush();
  return [...out];
}

/**
 * Titulares que no son un acontecimiento sobre el que debatir: piezas de
 * servicio, directos, pasatiempos.
 */
export const LOW_VALUE_TITLE = /^(consulte|consulta aquí|directo|horóscopo|sorteo|lotería|resultados? de la|comprobar|el tiempo|previsión del tiempo|crucigrama|sudoku|receta)\b|\b(en directo|minuto a minuto|última hora)\b/i;

/** Cifras con unidad o porcentaje: suelen identificar un suceso concreto. */
export function figures(text) {
  const m = String(text ?? '').match(/\d+(?:[.,]\d+)?\s?(?:%|por ciento|millones|euros|€)/gi) ?? [];
  return [...new Set(m.map((f) => f.replace(/\s+/g, '').toLowerCase()))];
}
