import { isIP } from 'node:net';
export function publicLink(value) {
  try {
    const u = new URL(value);
    return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password && !u.port
      && !isIP(u.hostname) && !/[\[\]:]/.test(u.hostname) && u.hostname.includes('.') && !/(^|\.)(localhost|local|internal)$/.test(u.hostname) ? u.href : '';
  } catch { return ''; }
}
const decode = text => text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&#(x[\da-f]+|\d+);/gi, (_, code) => { const n = code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : +code; return n <= 0x10ffff ? String.fromCodePoint(n) : ''; })
  .replace(/&(amp|lt|gt|quot|apos);/g, (_, key) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" })[key]);
const clean = text => decode(text).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
export function parseSearch(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 6).flatMap(match => {
    const field = name => clean(match[1].match(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`))?.[1] ?? '');
    const url = publicLink(field('link')), title = field('title').slice(0, 160), snippet = field('description').slice(0, 420);
    return url && title ? [{ title, url, snippet }] : [];
  });
}
export async function searchPrices(query, signal) {
  const url = new URL('https://www.bing.com/search');
  url.searchParams.set('format', 'rss'); url.searchParams.set('q', query); url.searchParams.set('setlang', 'zh-hans');
  try {
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(7000)]) });
    if (!response.ok) return { state: 'unavailable', sources: [] };
    const reader = response.body.getReader(); let text = '', bytes = 0; const decoder = new TextDecoder();
    try { for (;;) { const { value, done } = await reader.read(); if (done) break; bytes += value.length; if (bytes > 150000) break; text += decoder.decode(value, { stream: true }); } }
    finally { await reader.cancel(); }
    const sources = parseSearch(text);
    return { state: sources.length ? 'searched' : 'empty', sources };
  } catch (error) { if (signal.aborted) throw error; return { state: 'unavailable', sources: [] }; }
}
export function cnyPrices(text) {
  return [...text.matchAll(/(?:[¥￥]\s*([\d,]+(?:\.\d{1,2})?)|([\d,]+(?:\.\d{1,2})?)\s*(?:元|人民币))/g)]
    .map(m => Math.round(Number((m[1] || m[2]).replaceAll(',', '')) * 100)).filter(n => Number.isSafeInteger(n) && n > 0);
}
