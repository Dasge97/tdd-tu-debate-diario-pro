import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { cleanHtml, properNouns } from '../src/v2/text.js';
import { normalizeUrl } from '../src/v2/urls.js';
import { editorialDay, parseFeedDate } from '../src/v2/dates.js';
import { assertPublicUrl, decodeBody, isPrivateAddress, safeFetch } from '../src/v2/http.js';
import { parseFeed } from '../src/v2/feeds.js';
import { detectAgency } from '../src/v2/agency.js';
import { validateDraft } from '../src/v2/validate.js';
import { FEEDS, debateContext } from './fixtures.js';

test('limpia HTML, scripts y entidades', () => {
  assert.equal(cleanHtml('<p>Hola &amp; <b>adiós</b></p><script>alert(1)</script> &#8220;x&#8221;'), 'Hola & adiós “x”');
  assert.equal(cleanHtml('&lt;p&gt;doble escape&lt;/p&gt;'), 'doble escape');
});

test('nombres propios que no están al principio de la frase', () => {
  const found = properNouns('El Banco Central Europeo mantiene los tipos según Christine Lagarde');
  assert.ok(found.includes('banco central europeo'));
  assert.ok(found.includes('christine lagarde'));
});

test('normaliza URLs para deduplicar', () => {
  assert.equal(
    normalizeUrl('http://www.Medio.example/noticia/?utm_source=rss&id=3&fbclid=x#comentarios'),
    'https://medio.example/noticia?id=3'
  );
  assert.equal(normalizeUrl('javascript:alert(1)'), null);
  assert.equal(normalizeUrl('no es una url'), null);
});

test('una fecha que no se entiende queda desconocida', () => {
  assert.equal(parseFeedDate(''), null);
  assert.equal(parseFeedDate('ayer por la tarde'), null);
  assert.equal(parseFeedDate('Thu, 01 Jan 1970 00:00:00 GMT'), null);
  assert.equal(parseFeedDate('Mon, 21 Sep 2026 06:00:00 GMT'), '2026-09-21T06:00:00.000Z');
});

test('día editorial en Madrid: medianoche y cambios de hora', () => {
  // Verano (UTC+2): las 22:30 UTC ya son el día siguiente en Madrid.
  assert.equal(editorialDay(new Date('2026-09-21T21:59:00Z')), '2026-09-21');
  assert.equal(editorialDay(new Date('2026-09-21T22:30:00Z')), '2026-09-22');
  // Invierno (UTC+1).
  assert.equal(editorialDay(new Date('2026-12-31T22:59:00Z')), '2026-12-31');
  assert.equal(editorialDay(new Date('2026-12-31T23:00:00Z')), '2027-01-01');
  // Noche del cambio a horario de verano (29 de marzo de 2026, 02:00 → 03:00).
  assert.equal(editorialDay(new Date('2026-03-28T22:59:00Z')), '2026-03-28');
  assert.equal(editorialDay(new Date('2026-03-28T23:00:00Z')), '2026-03-29');
  assert.equal(editorialDay(new Date('2026-03-29T21:59:00Z')), '2026-03-29');
  assert.equal(editorialDay(new Date('2026-03-29T22:00:00Z')), '2026-03-30');
  // Noche del cambio a horario de invierno (25 de octubre de 2026, 03:00 → 02:00).
  assert.equal(editorialDay(new Date('2026-10-24T21:59:00Z')), '2026-10-24');
  assert.equal(editorialDay(new Date('2026-10-24T22:00:00Z')), '2026-10-25');
  assert.equal(editorialDay(new Date('2026-10-25T22:59:00Z')), '2026-10-25');
  assert.equal(editorialDay(new Date('2026-10-25T23:00:00Z')), '2026-10-26');
});

test('rechaza destinos privados, locales y puertos raros', async () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.20.0.5', '192.168.1.1', '169.254.169.254', '::1', 'fd00::1', '::ffff:127.0.0.1', '0.0.0.0']) {
    assert.equal(isPrivateAddress(ip), true, ip);
  }
  assert.equal(isPrivateAddress('8.8.8.8'), false);

  await assert.rejects(assertPublicUrl('http://127.0.0.1/rss'), /privado/);
  await assert.rejects(assertPublicUrl('http://localhost/rss', { resolve: async () => [{ address: '127.0.0.1' }] }), /privado/);
  await assert.rejects(assertPublicUrl('https://medio.example:8080/rss', { resolve: async () => [{ address: '8.8.8.8' }] }), /puerto/);
  await assert.rejects(assertPublicUrl('file:///etc/passwd'), /protocolo/);
  await assert.doesNotReject(assertPublicUrl('https://medio.example/rss', { resolve: async () => [{ address: '8.8.8.8' }] }));
});

test('una redirección hacia un destino privado se bloquea', async () => {
  const fetchImpl = async (url) => new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data' } });
  const guard = (url) => assertPublicUrl(url, { resolve: async (host) => [{ address: host === 'medio.example' ? '8.8.8.8' : host }] });
  await assert.rejects(safeFetch('https://medio.example/rss', { fetchImpl, guard }), /privado/);
});

test('descarga con límite de tamaño, tiempo y caché condicional', async () => {
  const server = createServer((req, res) => {
    if (req.url === '/grande') { res.end('x'.repeat(5000)); return; }
    if (req.url === '/lento') { setTimeout(() => res.end('tarde'), 2000); return; }
    if (req.headers['if-none-match'] === '"v1"') { res.statusCode = 304; res.end(); return; }
    res.setHeader('ETag', '"v1"');
    res.end('<rss/>');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const noGuard = async () => {};
  try {
    await assert.rejects(safeFetch(`${base}/grande`, { maxBytes: 1000, guard: noGuard }), /demasiado grande/);
    await assert.rejects(safeFetch(`${base}/lento`, { timeoutMs: 200, guard: noGuard }), /tiempo agotado/);
    const first = await safeFetch(`${base}/feed`, { guard: noGuard });
    assert.equal(first.etag, '"v1"');
    const second = await safeFetch(`${base}/feed`, { guard: noGuard, etag: first.etag });
    assert.equal(second.notModified, true);
    // Sin quitar la protección, el servidor local se rechaza (por el puerto o por la dirección).
    await assert.rejects(safeFetch(`${base}/feed`), /privado|puerto/);
  } finally {
    server.close();
  }
});

test('respeta el juego de caracteres del feed', () => {
  const latin1 = Buffer.from('<?xml version="1.0" encoding="ISO-8859-1"?><rss><channel><item><title>Resolución</title></item></channel></rss>', 'latin1');
  assert.match(decodeBody(latin1, 'application/xml'), /Resolución/);
  assert.match(decodeBody(latin1, 'text/xml; charset=iso-8859-1'), /Resolución/);
  assert.match(decodeBody(Buffer.from('<rss>Acción</rss>', 'utf8'), 'text/xml'), /Acción/);
});

test('lee RSS y Atom', () => {
  const rss = parseFeed(FEEDS['https://medio-a.example/rss']);
  assert.equal(rss.length, 8);
  assert.equal(rss[0].title, 'El Parlamento de Aragón aprueba la ley de transparencia municipal');
  assert.ok(!rss[0].summary.includes('alert'), 'el script del extracto se elimina');
  assert.equal(rss[6].author, 'EFE');

  const atom = parseFeed(FEEDS['https://agencia-c.example/atom']);
  assert.equal(atom.length, 2);
  assert.equal(atom[0].link, 'https://agencia-c.example/coral-canarias');
  assert.equal(atom[0].published, '2026-09-21T07:30:00Z');

  assert.throws(() => parseFeed('<html><body>no</body></html>'), /no es RSS ni Atom/);
});

test('detecta teletipos de agencia sin confundir menciones', () => {
  const medio = { originType: 'medio', name: 'Medio' };
  assert.equal(detectAgency({ author: 'EFE' }, medio), 'EFE');
  assert.equal(detectAgency({ summary: 'MADRID, 21 Sep. (EUROPA PRESS) - El Gobierno...' }, medio), 'Europa Press');
  assert.equal(detectAgency({ summary: 'El periodista contó a Reuters que...', author: 'Ana Pérez' }, medio), null);
  assert.equal(detectAgency({}, { originType: 'agencia', name: 'Agencia C' }), 'Agencia C');
});

test('validación de borradores igual que en el backend', () => {
  const draft = {
    title: '¿Debería el ayuntamiento limitar el acceso de vehículos al centro de la ciudad?',
    question: '¿Estás a favor de que el ayuntamiento limite el acceso de vehículos privados al centro desde enero?',
    card_summary: 'El ayuntamiento ha presentado un plan para limitar el tráfico en el centro. La medida entraría en vigor en enero.',
    context: debateContext(),
    source_name: 'Medio', source_url: 'https://medio.example/a', sources: [{ url: 'https://medio.example/a' }],
  };
  assert.deepEqual(validateDraft(draft, ['https://medio.example/a']), []);

  // Es una intervención en párrafos, no una lista.
  const conVinetas = `${debateContext()}\n• un argumento suelto`;
  assert.match(validateDraft({ ...draft, context: conVinetas }, ['https://medio.example/a']).join(' '), /viñetas/);
  const bad = { ...draft, question: '¿A favor? ¿O en contra de todo lo que propone el ayuntamiento para el centro de la ciudad?', source_url: 'https://otra.example' };
  const errors = validateDraft(bad, ['https://medio.example/a']).join(' | ');
  assert.match(errors, /más de una pregunta/);
  assert.match(errors, /source_url no pertenece/);

  const meta = { ...draft, card_summary: draft.card_summary.replace('La medida', 'Según el dossier, la medida') };
  assert.match(validateDraft(meta, ['https://medio.example/a']).join(' '), /vocabulario interno/);
});
