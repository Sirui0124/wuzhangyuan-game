import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream, realpathSync } from 'node:fs';
import { dirname, resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), '.build');
const port = Number(process.env.DEMO_PORT || 8811);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.webm': 'video/webm', '.ogv': 'video/ogg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.woff2': 'font/woff2' };
export function createStaticServer({ root = defaultRoot, onRequest } = {}) {
return createServer(async (req, res) => {
  try {
    if (onRequest && await onRequest(req, res)) return;
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const path = resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!path.startsWith(root + sep)) { res.writeHead(404); return res.end('Not found'); }
    const info = await stat(path);
    if (!info.isFile()) { res.writeHead(404); return res.end('Not found'); }
    const headers = { 'Content-Type': mime[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' };
    if (['.mp4', '.webm', '.ogv'].includes(extname(path))) {
      headers['Accept-Ranges'] = 'bytes';
      let start = 0, end = info.size - 1;
      if (req.headers.range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
        if (!match || !(match[1] || match[2])) { res.writeHead(416, { ...headers, 'Content-Range': `bytes */${info.size}` }); return res.end(); }
        if (!match[1]) start = Math.max(0, info.size - Number(match[2]));
        else { start = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2])); }
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= info.size) { res.writeHead(416, { ...headers, 'Content-Range': `bytes */${info.size}` }); return res.end(); }
        headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`;
      }
      headers['Content-Length'] = String(end - start + 1);
      res.writeHead(req.headers.range ? 206 : 200, headers);
      if (req.method === 'HEAD' || info.size === 0) return res.end();
      const stream = createReadStream(path, { start, end });
      res.on('close', () => stream.destroy()); stream.on('error', () => res.destroy()); stream.pipe(res); return;
    }
    res.writeHead(200, headers);
    if (req.method === 'HEAD') return res.end();
    res.end(await readFile(path));
  } catch { res.writeHead(404); res.end('Not found'); }
});
}
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createStaticServer().listen(port, '127.0.0.1', () => console.log(`五丈原 HTML 试玩：http://127.0.0.1:${port}`));
}

