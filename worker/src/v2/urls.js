import { sha256 } from './text.js';

/** Parámetros de seguimiento que no cambian la noticia. */
const TRACKING = /^(utm_[a-z]+|fbclid|gclid|mc_cid|mc_eid|ocid|ns_[a-z]+|cmpid|int|ref|rss|origin|seccion)$/i;

/**
 * URL normalizada para deduplicar: https, host en minúscula sin www, sin
 * fragmento, sin parámetros de seguimiento y sin barra final.
 * Devuelve null si no es una URL http(s) válida.
 */
export function normalizeUrl(raw) {
  let url;
  try {
    url = new URL(String(raw ?? '').trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  url.protocol = 'https:';
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  url.hash = '';
  url.port = '';
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING.test(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  if (url.pathname.length > 1 && url.pathname.endsWith('/')) url.pathname = url.pathname.slice(0, -1);
  return url.toString();
}

export const urlHash = (normalized) => sha256(normalized);
