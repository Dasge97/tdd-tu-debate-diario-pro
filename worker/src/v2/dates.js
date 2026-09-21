/** Fechas del motor V2. Todo se guarda en UTC; el día editorial se calcula en Europe/Madrid. */

/**
 * Convierte una fecha de feed (RFC 822, ISO 8601...) a ISO UTC.
 * Si no se entiende devuelve null: nunca se sustituye por la fecha de descarga.
 */
export function parseFeedDate(value) {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  if (!s) return null;
  const ms = Date.parse(s);
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms);
  // Fechas absurdas (año 1970 por un 0, o muy en el futuro) se tratan como desconocidas.
  if (d.getUTCFullYear() < 2000 || ms > Date.now() + 2 * 24 * 3600 * 1000) return null;
  return d.toISOString();
}

/** Día editorial (aaaa-mm-dd) de un instante en la zona indicada. Respeta el horario de verano. */
export function editorialDay(date = new Date(), timeZone = 'Europe/Madrid') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export const hoursBetween = (a, b) => Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 3_600_000;
