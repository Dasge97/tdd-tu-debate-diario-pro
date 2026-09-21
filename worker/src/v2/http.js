import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * Descarga HTTP del motor V2.
 *
 * - Solo http/https y puertos 80/443.
 * - Rechaza destinos privados o locales, también después de cada redirección.
 * - Tiempo máximo y tamaño máximo de respuesta.
 * - Descarga condicional con ETag / Last-Modified.
 *
 * Límite conocido: la comprobación de DNS y la conexión resuelven el nombre
 * por separado. Un DNS malicioso podría cambiar la respuesta entre medias. Las
 * fuentes las da de alta un administrador, así que se acepta ese riesgo.
 */

export class FetchError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

function ipv4ToInt(ip) {
  return ip.split('.').reduce((acc, p) => (acc << 8) + Number(p), 0) >>> 0;
}

const PRIVATE_V4 = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 4], ['240.0.0.0', 4],
];

export function isPrivateAddress(ip) {
  const version = isIP(ip);
  if (version === 4) {
    const n = ipv4ToInt(ip);
    return PRIVATE_V4.some(([base, bits]) => (n >>> (32 - bits)) === (ipv4ToInt(base) >>> (32 - bits)));
  }
  if (version === 6) {
    const s = ip.toLowerCase();
    if (s === '::' || s === '::1') return true;
    if (s.startsWith('::ffff:')) return isPrivateAddress(s.slice(7));
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(s);
  }
  return true;
}

/** Comprueba que una URL apunta a un destino público. Lanza FetchError si no. */
export async function assertPublicUrl(rawUrl, { resolve = lookup } = {}) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new FetchError(`URL no válida: ${rawUrl}`, 'invalid_url');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new FetchError(`protocolo no permitido: ${url.protocol}`, 'blocked');
  }
  if (url.port && url.port !== '80' && url.port !== '443') {
    throw new FetchError(`puerto no permitido: ${url.port}`, 'blocked');
  }
  if (url.username || url.password) {
    throw new FetchError('URL con credenciales', 'blocked');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host) ? [{ address: host }] : await resolve(host, { all: true });
  if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) {
    throw new FetchError(`destino privado o local: ${host}`, 'blocked');
  }
  return url;
}

/**
 * Decodifica la respuesta con su juego de caracteres: el de la cabecera
 * Content-Type o, si no viene, el de la declaración XML. Algunos feeds (el
 * BOE, por ejemplo) van en ISO-8859-1.
 */
export function decodeBody(buffer, contentType = '') {
  const fromHeader = /charset=["']?([\w-]+)/i.exec(contentType ?? '')?.[1];
  const fromXml = /<\?xml[^>]*encoding=["']([\w-]+)["']/i.exec(buffer.subarray(0, 200).toString('latin1'))?.[1];
  const label = (fromHeader || fromXml || 'utf-8').toLowerCase();
  try {
    return new TextDecoder(label).decode(buffer);
  } catch {
    return buffer.toString('utf8');
  }
}

/**
 * @returns {Promise<{status: number, notModified: boolean, body: string, finalUrl: string, etag: ?string, lastModified: ?string}>}
 */
export async function safeFetch(rawUrl, {
  timeoutMs = 15000,
  maxBytes = 3_000_000,
  maxRedirects = 5,
  etag = null,
  lastModified = null,
  userAgent = 'TuDebateDiarioBot/2.0 (+https://tudebatediario.com)',
  guard = assertPublicUrl,
  fetchImpl = fetch,
} = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let current = rawUrl;

  try {
    for (let hop = 0; hop <= maxRedirects; hop++) {
      await guard(current);
      const headers = { 'User-Agent': userAgent, Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5' };
      if (hop === 0 && etag) headers['If-None-Match'] = etag;
      if (hop === 0 && lastModified) headers['If-Modified-Since'] = lastModified;

      let res;
      try {
        res = await fetchImpl(current, { redirect: 'manual', signal: controller.signal, headers });
      } catch (err) {
        if (controller.signal.aborted) throw new FetchError(`tiempo agotado (${timeoutMs} ms)`, 'timeout');
        throw new FetchError(`error de red: ${err.message}`, 'network');
      }

      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const location = res.headers.get('location');
        if (!location) throw new FetchError('redirección sin destino', 'http');
        current = new URL(location, current).toString();
        continue;
      }
      if (res.status === 304) {
        return { status: 304, notModified: true, body: '', finalUrl: current, etag, lastModified };
      }
      if (res.status < 200 || res.status >= 300) {
        throw new FetchError(`HTTP ${res.status}`, 'http');
      }

      const declared = Number(res.headers.get('content-length') ?? 0);
      if (declared > maxBytes) throw new FetchError(`respuesta demasiado grande (${declared} bytes)`, 'too_large');

      const chunks = [];
      let total = 0;
      for await (const chunk of res.body) {
        total += chunk.length;
        if (total > maxBytes) {
          controller.abort();
          throw new FetchError(`respuesta demasiado grande (más de ${maxBytes} bytes)`, 'too_large');
        }
        chunks.push(chunk);
      }
      return {
        status: res.status,
        notModified: false,
        body: decodeBody(Buffer.concat(chunks), res.headers.get('content-type')),
        finalUrl: current,
        etag: res.headers.get('etag'),
        lastModified: res.headers.get('last-modified'),
      };
    }
    throw new FetchError(`demasiadas redirecciones (${maxRedirects})`, 'http');
  } catch (err) {
    if (err instanceof FetchError) throw err;
    if (controller.signal.aborted) throw new FetchError(`tiempo agotado (${timeoutMs} ms)`, 'timeout');
    throw new FetchError(err.message, 'network');
  } finally {
    clearTimeout(timer);
  }
}
