import { XMLParser } from 'fast-xml-parser';
import { cleanHtml } from './text.js';

/**
 * Lee RSS 2.0, RSS 1.0 (RDF) y Atom. Devuelve las noticias con los campos que
 * trae el propio feed; no descarga las páginas enlazadas.
 */

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  processEntities: false,
  htmlEntities: false,
  trimValues: true,
  // Los feeds no deben traer declaraciones DOCTYPE con entidades: se ignoran.
  allowBooleanAttributes: true,
});

const asArray = (v) => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);

function text(node) {
  if (node === undefined || node === null) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return text(node[0]);
  if (typeof node === 'object') return String(node['#text'] ?? node['@_href'] ?? '');
  return '';
}

function atomLink(links) {
  const list = asArray(links);
  const alternate = list.find((l) => typeof l === 'object' && (!l['@_rel'] || l['@_rel'] === 'alternate'));
  return text(alternate ?? list[0]);
}

export class FeedParseError extends Error {}

/**
 * @returns {Array<{title: string, link: string, guid: string, summary: string, published: string, updated: string, author: string, categories: string[]}>}
 */
export function parseFeed(xml) {
  let doc;
  try {
    doc = parser.parse(String(xml ?? ''));
  } catch (err) {
    throw new FeedParseError(`XML no válido: ${err.message}`);
  }

  if (doc.rss?.channel) {
    return asArray(doc.rss.channel.item).map((item) => ({
      title: cleanHtml(text(item.title)),
      link: text(item.link).trim(),
      guid: text(item.guid).trim(),
      summary: cleanHtml(text(item.description) || text(item['content:encoded'])),
      published: text(item.pubDate) || text(item['dc:date']),
      updated: '',
      author: cleanHtml(text(item['dc:creator']) || text(item.author)),
      categories: asArray(item.category).map((c) => cleanHtml(text(c))).filter(Boolean),
    }));
  }

  const rdf = doc['rdf:RDF'];
  if (rdf) {
    return asArray(rdf.item).map((item) => ({
      title: cleanHtml(text(item.title)),
      link: text(item.link).trim(),
      guid: text(item['@_rdf:about']),
      summary: cleanHtml(text(item.description)),
      published: text(item['dc:date']),
      updated: '',
      author: cleanHtml(text(item['dc:creator'])),
      categories: asArray(item['dc:subject']).map((c) => cleanHtml(text(c))).filter(Boolean),
    }));
  }

  if (doc.feed) {
    return asArray(doc.feed.entry).map((entry) => ({
      title: cleanHtml(text(entry.title)),
      link: atomLink(entry.link).trim(),
      guid: text(entry.id).trim(),
      summary: cleanHtml(text(entry.summary) || text(entry.content)),
      published: text(entry.published),
      updated: text(entry.updated),
      author: cleanHtml(text(asArray(entry.author)[0]?.name)),
      categories: asArray(entry.category).map((c) => cleanHtml(c?.['@_term'] ?? text(c))).filter(Boolean),
    }));
  }

  throw new FeedParseError('no es RSS ni Atom');
}
