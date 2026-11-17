import { readFile, writeFile, readdir, stat, mkdir } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';
import { LocalBuilds } from './builds.mjs';
import { root, cache, origin, port, workspace, identity } from './config.mjs';

await mkdir(cache, { recursive: true });
const buildLog = createWriteStream(resolve(cache, 'build.log'), { flags: 'a' });
const serviceLog = createWriteStream(resolve(cache, 'api.log'), { flags: 'a' });
const token = randomBytes(24).toString('hex');
let buildProcess, apiProcess, stopping = false, pollTimer;
let api = { state: 'checking', configured: false };
let observed = '';

async function sourceSignature() {
  const inputs = [
    'GameStarter/web-demo/src', 'GameStarter/web-demo/public',
    'GameStarter/web-demo/build.mjs', 'GameStarter/web-demo/tsconfig.json', 'GameStarter/web-demo/visual-assets.json',
    'tools/video/media.mjs', 'tools/video/subtitles.mjs', 'tools/video/vtt.mjs', 'video/subtitles/catalog.json', 'video/subtitles/empty-tracks.json',
    'demos/yiling-rescue/src', 'demos/yiling-rescue/public', 'demos/yiling-rescue/build.mjs',
    'docs/design/personality', 'tools/personality/prepare-playtest.mjs', 'tools/personality/preview-witness.json',
    'GameStarter/scripts/run-tsc.mjs', 'GameStarter/scripts/chapter-access-manifest.mjs', 'GameStarter/assets/scripts/narrative', 'GameStarter/assets/scripts/GameApi.ts',
    'content/schema', 'content/chapters/wuzhang', 'content/chapters/grain', 'content/chapters/jieting', 'content/chapters/yiling', 'content/chapters/jingzhou', 'content/chapters/luofengpo', 'video/current',
  ];
  try {
    const visuals = JSON.parse(await readFile(resolve(root, 'GameStarter/web-demo/visual-assets.json'), 'utf8'));
    for (const kind of ['characters', 'scenes', 'cinematics', 'ui']) {
      inputs.push(...Object.values(visuals[kind] || {}).map(file => resolve(root, 'GameStarter/web-demo', visuals.sourceRoot, file)));
    }
  } catch { /* A config being edited is still tracked and will report a build error. */ }
  const records = [];
  async function walk(path) {
    try {
      const info = await stat(path);
      if (info.isDirectory()) {
        await Promise.all((await readdir(path)).filter(name => !name.startsWith('.') && name !== 'node_modules').map(name => walk(resolve(path, name))));
      } else records.push(`${path}:${info.size}:${info.mtimeMs}:${info.ctimeMs}`);
    } catch (error) { records.push(`${path}:${error.code}`); }
  }
  await Promise.all(inputs.map(path => walk(resolve(root, path))));
  return createHash('sha256').update(records.sort().join('\n')).digest('hex');
}

const builds = new LocalBuilds(cache, async (target, id) => {
  const before = await sourceSignature();
  buildLog.write(`\n[${new Date().toISOString()}] Build ${id}\n`);
  await new Promise((accept, reject) => {
    buildProcess = spawn(process.execPath, [resolve(root, 'GameStarter/web-demo/build.mjs'), target], {
      cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    buildProcess.stdout.pipe(buildLog, { end: false });
    buildProcess.stderr.pipe(buildLog, { end: false });
    buildProcess.on('error', reject);
    buildProcess.on('exit', code => {
      buildProcess = null;
      code === 0 ? accept() : reject(new Error('本次更新未构建成功。上一版仍可使用；详情见 .cache/local-game/build.log。'));
    });
  });
  for (const file of ['index.html', 'chapter-one.html']) {
    const path = resolve(target, file);
    const html = await readFile(path, 'utf8');
    await writeFile(path, html.replace('</body>', `<script src="/__local/client.js" data-version="${id}" defer></script></body>`));
  }
  const after = await sourceSignature();
  if (before !== after) { observed = after; builds.request(); }
}, () => console.log(`[local] ${builds.phase}${builds.current ? ` ${builds.current.id.slice(0, 8)}` : ''}`));
await builds.init();

function json(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
}
const uiFiles = { '/local/': ['hub.html', 'text/html'], '/local': ['hub.html', 'text/html'], '/__local/client.js': ['client.js', 'text/javascript'] };
const server = createStaticServer({
  root: () => builds.current ? builds.path(builds.current.id) : resolve(cache, 'empty'),
  onRequest: async (req, res) => {
    const path = new URL(req.url, origin).pathname;
    // Loopback-only and host-checked. Control requests also require a per-process token.
    if (req.headers.host !== `127.0.0.1:${port}`) {
      json(res, 403, { error: `请使用 ${origin}` }); return true;
    }
    if (path === '/__local/status') {
      json(res, 200, { identity, workspace, pid: process.pid, ...builds.status(), api }); return true;
    }
    if (path === '/__local/stop') {
      if (req.method !== 'POST' || req.headers['x-local-token'] !== token) json(res, 403, { error: 'Forbidden' });
      else { json(res, 200, { stopping: true }); setTimeout(shutdown, 50); }
      return true;
    }
    if (uiFiles[path]) {
      const [file, mime] = uiFiles[path];
      res.writeHead(200, { 'Content-Type': `${mime}; charset=utf-8`, 'Cache-Control': 'no-store' });
      res.end(await readFile(resolve(root, 'tools/local-game', file))); return true;
    }
    if (!builds.current) {
      res.writeHead(503, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end('<meta charset="utf-8"><title>游戏正在准备</title><p>游戏正在准备，请在<a href="/local/">本地入口</a>查看进度。</p>'); return true;
    }
    return false;
  },
});
try {
  await new Promise((accept, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', accept); });
} catch (error) {
  console.error(`无法使用 ${origin}：${error.code}。请检查占用程序；不会自动换端口或关闭其他进程。`);
  process.exit(1);
}
await writeFile(resolve(cache, 'control.json'), JSON.stringify({ identity, workspace, port, token }));
console.log(`逆转五丈原本地入口：${origin}/local/`);

async function apiHealth() {
  try {
    const response = await fetch('http://127.0.0.1:8787/health', { signal: AbortSignal.timeout(1200) });
    const data = await response.json();
    if (!response.ok || data.ok !== true || typeof data.configured !== 'boolean' || !['disabled', 'disabled-requested'].includes(data.thinking)) return false;
    api = { state: 'ready', configured: data.configured, managed: Boolean(apiProcess) };
    return true;
  } catch { return false; }
}
async function startApi() {
  if (process.env.LOCAL_GAME_NO_API === '1') { api = { state: 'disabled', configured: false }; return; }
  if (await apiHealth()) return;
  const free = await new Promise(accept => {
    const probe = createServer(); probe.once('error', () => accept(false));
    probe.listen(8787, '127.0.0.1', () => probe.close(() => accept(true)));
  });
  if (!free) { api = { state: 'occupied', configured: false }; return; }
  apiProcess = spawn(process.execPath, ['--env-file-if-exists=.env', 'server.mjs'], {
    cwd: resolve(root, 'GameStarter/server'), windowsHide: true,
    env: { ...process.env, PORT: '8787' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  apiProcess.stdout.pipe(serviceLog, { end: false }); apiProcess.stderr.pipe(serviceLog, { end: false });
  apiProcess.on('error', () => { apiProcess = null; api = { state: 'offline', configured: false }; });
  apiProcess.on('exit', () => { apiProcess = null; api = { state: 'offline', configured: false }; });
}
await startApi();
observed = await sourceSignature();
void builds.request();
let ticks = 0;
async function poll() {
  if (stopping) return;
  try {
    const next = await sourceSignature();
    if (next !== observed) { observed = next; void builds.request(); }
    if (++ticks % 4 === 0 && api.state !== 'disabled') {
      if (!await apiHealth()) api = { state: api.state === 'occupied' ? 'occupied' : 'offline', configured: false };
    }
  } catch (error) { console.warn('Source check:', error.message); }
  if (!stopping) pollTimer = setTimeout(poll, 1200);
}
pollTimer = setTimeout(poll, 1200);

function shutdown() {
  if (stopping) return;
  stopping = true; builds.closed = true; clearTimeout(pollTimer);
  // Only stop children created by this launcher; a pre-existing API server belongs to its owner.
  apiProcess?.kill();
  server.close(); server.closeAllConnections();
  // Let an in-flight compiler exit so no orphan compiler or partially removed build is left behind.
  Promise.resolve(builds.running).finally(() => { buildLog.end(); serviceLog.end(); process.exit(0); });
}
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
