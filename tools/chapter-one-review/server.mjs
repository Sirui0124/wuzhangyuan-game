import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, '../..');
export const storyFile = path.join(root, 'docs/design/chapter-one-branches-20261117/v3/chapter-one.design.v3.json');
export function build() {
  const result = spawnSync(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), '-p', path.join(dir, 'tsconfig.json')], { encoding: 'utf8' });
  if (result.status !== 0) throw Error(result.stdout + result.stderr);
}
export function createServer({ aiService, statusProvider } = {}) {
  let service;
  const getService = async () => service ??= aiService ? Promise.resolve(aiService) : import('./ai.mjs').then(m => m.makeLocalAiService(async()=>JSON.parse(await readFile(storyFile,'utf8'))));
  const files = new Map([
    ['/', ['index.html', 'text/html; charset=utf-8']],
    ['/style.css', ['style.css', 'text/css; charset=utf-8']],
    ['/app.js', ['dist/app.js', 'text/javascript; charset=utf-8']],
    ['/engine.js', ['dist/engine.js', 'text/javascript; charset=utf-8']],
    ['/story.json', [storyFile, 'application/json; charset=utf-8']],
  ]);
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const json = (status,data) => { if(res.destroyed||res.writableEnded)return;res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data)); };
    if(url.pathname==='/api/ai/status'&&req.method==='GET') {
      try { json(200,await (statusProvider ? statusProvider() : import('./ai.mjs').then(m=>m.aiStatus()))); } catch {json(200,{configured:false});}return;
    }
    if(url.pathname==='/api/ai/turn'&&req.method==='POST') {
      if(req.headers.origin && req.headers.origin!==`http://${req.headers.host}`) {json(403,{error:'只接受本页的对话请求。'});return;}
      const controller=new AbortController();
      res.once('close',()=>{if(!res.writableEnded)controller.abort();});
      const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(55000)]);
      try {
        if(!req.headers['content-type']?.startsWith('application/json'))throw Error('需要JSON请求。');
        let body='',size=0;for await(const chunk of req){size+=chunk.length;if(size>512000)throw Error('阅读记录过大，请从头阅读。');body+=chunk;}
        const result=await (await getService())(JSON.parse(body),signal);json(200,result);
      } catch(e) {json(signal.aborted?504:502,{error:signal.aborted?'AI回应超时，原话已保留，请重试。':e.message.startsWith('模型接口')?'AI服务暂时不可用，原话已保留。':e.message});}return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
    if (url.pathname === '/health') { json(200,{app:'chapter-one-review',version:'v3.3-ai'});return; }
    const file = files.get(url.pathname);
    if (!file) { res.writeHead(404); res.end('Not found'); return; }
    try {
      const body = await readFile(path.resolve(dir, file[0]));
      res.writeHead(200, {
        'Content-Type': file[1], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'",
      }); res.end(req.method === 'HEAD' ? undefined : body);
    } catch { res.writeHead(500); res.end('Unable to read review file'); }
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  build();
  const port = Number(process.env.CHAPTER_REVIEW_PORT || 8941);
  const server = createServer();
  server.on('error', e => { console.error(e.message); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`第一章独立审阅 http://127.0.0.1:${port}/`));
}
