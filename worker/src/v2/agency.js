/**
 * Detecta si una noticia es un teletipo de agencia. Varias copias del mismo
 * teletipo en medios distintos cuentan como una sola fuente, no como varias
 * confirmaciones.
 *
 * Es conservador: solo marca menciones explícitas de autoría (firma, "(EFE)",
 * "Europa Press" como autor...), no cualquier aparición del nombre.
 */

const AGENCIES = [
  ['EFE', [/\(EFE\)/, /^EFE\b/, /\bEFE\s*[.|-]\s/, /agencia efe/i]],
  ['Europa Press', [/europa press/i, /\(EP\)/]],
  ['Reuters', [/\breuters\b/i]],
  ['AFP', [/\(AFP\)/, /\bAFP\s*[.|-]\s/, /agence france-presse/i]],
  ['AP', [/\(AP\)/, /associated press/i]],
  ['Servimedia', [/servimedia/i]],
];

/**
 * @param {{title?: string, summary?: string, author?: string}} item
 * @param {{originType: string, name: string}} source
 * @returns {?string} nombre de la agencia o null
 */
export function detectAgency(item, source) {
  if (source?.originType === 'agencia') return source.name;

  const author = String(item.author ?? '');
  const lead = String(item.summary ?? '').slice(0, 160);
  for (const [name, patterns] of AGENCIES) {
    if (patterns.some((p) => p.test(author))) return name;
    // Las agencias suelen firmar al principio del texto: "MADRID, 21 Sep. (EUROPA PRESS) -".
    if (patterns.some((p) => p.test(lead)) && /^[A-ZÁÉÍÓÚÑ\s.,]{3,40}[,(]/.test(lead)) return name;
    if (/\((EFE|EP|AFP|AP|EUROPA PRESS)\)/i.test(lead) && patterns.some((p) => p.test(lead))) return name;
  }
  return null;
}
