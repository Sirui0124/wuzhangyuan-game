import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { makeStage } from './stage.mjs';
import { buildChapter } from './chapter.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const port = Number(process.env.FILM_STUDIO_PORT || 8926);
const origin = `http://127.0.0.1:${port}`;
const dataDir = path.resolve(process.env.FILM_STUDIO_DATA_DIR || path.join(root, 'outputs/film-studio'));
fs.mkdirSync(dataDir, { recursive: true });
const stateFile = path.join(dataDir, 'review.json');
const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : { version: 1, notes: [], decisions: {} };
const spatial = 'source-art/visuals/spatial/camp-v1';
const promptDir = 'video/production/CH01-continuity-20261028';
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'GameStarter/web-demo/public/cinematics.json')));
const clips = [...manifest.opening, ...manifest.chapterDialogue, ...manifest.sacrifice, ...manifest.safe].map((c, i) => {
  const relative = `video/current/${path.basename(c.src)}`;
  const file = path.join(root, relative);
  const stat = fs.statSync(file);
  return { ...c, order: i + 1, file: relative, url: `/files/${relative}`, version: createHash('sha256').update(`${relative}:${stat.size}:${stat.mtimeMs}`).digest('hex').slice(0, 16), bytes: stat.size, modified: stat.mtime.toISOString() };
});
const chapter = buildChapter(root, clips);
const chapterDraftFile = path.join(dataDir, 'chapter-draft.json');
let chapterDraft = fs.existsSync(chapterDraftFile) ? JSON.parse(fs.readFileSync(chapterDraftFile,'utf8')) : {baseHash:chapter.baseHash,revision:0,lines:{},videos:{},history:[]};
const prompts = fs.readdirSync(path.join(root, promptDir)).filter(n => /^R\d\d-.*\.md$/.test(n)).map(name => {
  const text = fs.readFileSync(path.join(root, promptDir, name), 'utf8');
  const refs = [...text.matchAll(/本地路径：`([^`]+)`/g)].map(m => {
    const rel = path.relative(root, m[1]).replaceAll('\\', '/');
    return { path: m[1], url: rel.startsWith('../') ? null : `/files/${rel}`, exists: fs.existsSync(m[1]) };
  });
  return { id: name.slice(0, 3), name: name.replace('.md', ''), url: `/files/${promptDir}/${name}`, text, refs, hash: createHash('sha256').update(text).digest('hex') };
});
const resources = [
  { title: '项目现有军营空间样机', kind: '本地可用', format: 'OBJ + MTL / WebGL', use: '统一主帐、营道、灯位与人物距离；可直接调机位、导出参考图。', limitation: '空间样机；人物是尺度代理，材质与灯光仍需细化。', url: `/files/${spatial}/index.html`, image: `/files/${spatial}/preview-overview.png` },
  { title: 'Three Kingdoms Military camp', kind: '外部整场景', format: 'Unity 6 / URP · 455.9 MB', use: '三国军营整场景候选，可用于后续布景与机位研究。', limitation: '页面标价 $58.88（2026-10-29）；未购买、未下载，尚未验证资产内容和可转用格式。', url: 'https://assetstore.unity.com/packages/3d/environments/historic/three-kingdoms-military-camp-397822' },
  { title: '次世代中国古代军帐篷', kind: '外部布景部件', format: 'FBX / 3ds Max 2016 / TB', use: '候选主帐外形与布料部件，适合放进统一营区。', limitation: '页面有个人、企业等授权选项；游戏及AI参考用途需核对具体授权。未购买、未下载。', url: 'https://www.cgmodel.com/model/296699.html' },
  { title: '古代汉军营帐内部场景', kind: '观摩', format: 'C4D R19 · 1.85 MB', use: '可查看帐内陈设与空间组织，作为选型对照。', limitation: '页面明确“仅限学习交流”，暂不纳入生产素材。未下载。', url: 'https://www.cgmol.com/model/11/76856.html' }
];
const assetImages = fs.readdirSync(path.join(root, spatial)).filter(n => /^(preview-|camp-plan|main-tent-plan).*\.png$/.test(n)).map(name => ({ name, url: `/files/${spatial}/${name}` }));
const contentTypes = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.vtt': 'text/vtt; charset=utf-8' };
function json(res, value, status = 200) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); }
function sendFile(req, res, file) {
  const stat = fs.statSync(file);
  if (!stat.isFile()) throw Error('Not a file');
  const headers = { 'Content-Type': contentTypes[path.extname(file)] || 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' };
  const range = req.headers.range;
  if (range) {
    const m = /^bytes=(\d+)-(\d*)$/.exec(range);
    if (!m) { res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }); return res.end(); }
    const start = Number(m[1]), end = m[2] ? Math.min(Number(m[2]), stat.size - 1) : stat.size - 1;
    if (start > end || start >= stat.size) { res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }); return res.end(); }
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Content-Length': end - start + 1 });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { ...headers, 'Content-Length': stat.size });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  }
}
function persist() { fs.writeFileSync(`${stateFile}.tmp`, JSON.stringify(state, null, 2)); fs.renameSync(`${stateFile}.tmp`, stateFile); }
let stage;
const server = http.createServer(async (req, res) => {
  try {
    if (req.headers.host !== `127.0.0.1:${port}` && req.headers.host !== `localhost:${port}`) return json(res, { error: 'Host rejected' }, 403);
    const url = new URL(req.url, origin);
    const pathname = decodeURIComponent(url.pathname);
    if (pathname === '/api/catalog' && req.method === 'GET') return json(res, { clips, prompts, resources, assetImages, reviewFile: stateFile, scannedAt: new Date().toISOString() });
    if (pathname === '/api/chapter' && req.method === 'GET') return json(res, {...chapter,draft:chapterDraft,draftFile:chapterDraftFile});
    if (pathname === '/api/chapter/draft' && req.method === 'POST') {
      if (req.headers.origin !== origin) return json(res, {error:'Origin rejected'},403);
      let body='';for await(const chunk of req){body+=chunk;if(body.length>500000)return json(res,{error:'编辑内容过大'},413);}
      const input=JSON.parse(body);
      if(input.baseHash!==chapter.baseHash || chapterDraft.baseHash!==chapter.baseHash)return json(res,{error:'文案或视频来源已变化，旧草稿保留，请重新核对来源后再编辑。'},409);
      if(input.revision!==chapterDraft.revision)return json(res,{error:'其他页面已经更新台本，请刷新并比较草稿后再保存。'},409);
      if(!Array.isArray(input.changes)||!input.changes.length||input.changes.length>250)return json(res,{error:'没有有效修改'},400);
      const next=structuredClone(chapterDraft);
      for(const change of input.changes){
        const table=change.kind==='line'?chapter.lines:change.kind==='video'?Object.fromEntries(chapter.videos.map(v=>[v.clip,v])):null;
        if(!table||!Object.hasOwn(table,change.id)||!change.fields||typeof change.fields!=='object')return json(res,{error:'台词或视频编号无效'},400);
        const allowed=change.kind==='line'?['speaker','text','receiver','direction']:['note'];
        if(!Object.keys(change.fields).length||Object.entries(change.fields).some(([k,v])=>!allowed.includes(k)||typeof v!=='string'||v.length>15000))return json(res,{error:'修改字段无效或过长'},400);
        const dest=change.kind==='line'?next.lines:next.videos;
        dest[change.id]={...dest[change.id],...change.fields,updatedAt:new Date().toISOString()};
      }
      next.revision++;next.history.push({revision:next.revision,at:new Date().toISOString(),changes:input.changes});
      fs.writeFileSync(chapterDraftFile+'.tmp',JSON.stringify(next,null,2));fs.renameSync(chapterDraftFile+'.tmp',chapterDraftFile);chapterDraft=next;
      return json(res,chapterDraft);
    }
    if (pathname === '/api/review' && req.method === 'GET') return json(res, state);
    if (pathname === '/api/export' && req.method === 'POST') {
      if (req.headers.origin !== origin) return json(res, { error: 'Origin rejected' }, 403);
      let body = '';
      for await (const chunk of req) { body += chunk; if (body.length > 24000000) return json(res, { error: '导出文件过大' }, 413); }
      const input = JSON.parse(body);
      if (typeof input.name !== 'string' || typeof input.data !== 'string') return json(res, { error: '导出内容无效' }, 400);
      const ext = path.extname(input.name).toLowerCase();
      let bytes;
      if (ext === '.png' && input.data.startsWith('data:image/png;base64,')) {
        bytes = Buffer.from(input.data.slice(22), 'base64');
        if (bytes.length < 24 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') return json(res, { error: '图片内容无效' }, 400);
      } else if (ext === '.json') { JSON.parse(input.data); bytes = Buffer.from(input.data); }
      else if(ext === '.md')bytes=Buffer.from(input.data,'utf8');
      else return json(res, { error: '不支持的导出类型' }, 400);
      const exportsDir = path.join(dataDir, 'exports'); fs.mkdirSync(exportsDir, { recursive: true });
      const name = `${input.name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').slice(0, 120).replace(/\.(png|json|md)$/i, '')}-${crypto.randomUUID().slice(0,8)}${ext}`;
      const file = path.join(exportsDir, name); fs.writeFileSync(file, bytes, { flag: 'wx' });
      return json(res, { path: file, url: `/exports/${encodeURIComponent(name)}`, name });
    }
    if (pathname === '/api/review' && req.method === 'POST') {
      if (req.headers.origin !== origin) return json(res, { error: 'Origin rejected' }, 403);
      let body = '';
      for await (const chunk of req) { body += chunk; if (body.length > 100000) return json(res, { error: 'Request too large' }, 413); }
      const input = JSON.parse(body);
      const clip = clips.find(c => c.id === input.clip && c.version === input.version);
      if (!clip) return json(res, { error: '视频版本已变化，请刷新后再写意见。' }, 409);
      if (input.action === 'note') {
        if (typeof input.text !== 'string' || !input.text.trim() || input.text.length > 10000 || !Number.isFinite(input.time) || input.time < 0) return json(res, { error: '请填写有效时间和意见。' }, 400);
        state.notes.push({ id: crypto.randomUUID(), clip: clip.id, version: clip.version, file: clip.file, time: input.time, category: String(input.category || '整体').slice(0, 40), text: input.text.trim(), created: new Date().toISOString() });
      } else if (input.action === 'comment') {
        if (typeof input.text !== 'string' || input.text.length > 15000 || !Number.isSafeInteger(input.revision) || input.revision < 0) return json(res, { error: '评论内容无效或过长。' }, 400);
        const key = `${clip.id}:${clip.version}`;
        const previous = state.comments?.[key];
        if (input.revision !== (previous?.revision || 0)) return json(res, { error: '另一个页面已更新这条评论。你的输入已暂存，请先核对已保存的内容。', comment: previous }, 409);
        state.comments ??= {};
        state.comments[key] = { text: input.text, revision: (previous?.revision || 0) + 1, updated: new Date().toISOString(), clip: clip.id, version: clip.version, file: clip.file };
      } else if (input.action === 'decision' && ['待review', '待更新', '已通过'].includes(input.status)) {
        state.decisions[`${clip.id}:${clip.version}`] = { status: input.status, at: new Date().toISOString(), source: '工作台人工选择' };
      } else return json(res, { error: '无效操作' }, 400);
      persist(); return json(res, state);
    }
    if (pathname === '/stage' && req.method === 'GET') { stage ??= makeStage(root); res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(stage); }
    if (!['GET', 'HEAD'].includes(req.method)) return json(res, { error: 'Method not allowed' }, 405);
    if (pathname.startsWith('/exports/')) {
      const name = pathname.slice(9);
      if (path.basename(name) !== name || /[\\/]/.test(name) || !/\.(png|json|md)$/.test(name)) return json(res, { error: 'Forbidden' }, 403);
      return sendFile(req, res, path.join(dataDir, 'exports', name));
    }
    if (pathname.startsWith('/files/')) {
      const rel = pathname.slice(7).replaceAll('\\', '/');
      const allowed = [ 'video/current/', `${promptDir}/`, `${spatial}/`, 'GameStarter/web-demo/public/video/subtitles/' ];
      if (!allowed.some(p => rel.startsWith(p)) || rel.split('/').some(p => p === '..' || p.startsWith('.'))) return json(res, { error: 'Forbidden' }, 403);
      const file = path.resolve(root, rel);
      const permittedRoot = allowed.find(p => rel.startsWith(p));
      const real = fs.realpathSync(file), base = fs.realpathSync(path.join(root, permittedRoot));
      if (!real.startsWith(base + path.sep)) return json(res, { error: 'Forbidden' }, 403);
      return sendFile(req, res, real);
    }
    const name = pathname === '/' || pathname === '/index.html' ? 'comments.html' : pathname.slice(1);
    if (!['comments.html', 'workbench.html', 'comments.js', 'comments.css', 'app.js', 'chapter-ui.js', 'style.css', 'chapter.css'].includes(name)) return json(res, { error: 'Not found' }, 404);
    sendFile(req, res, path.join(here, 'public', name));
  } catch (error) { if (!res.headersSent) json(res, { error: error.code === 'ENOENT' ? '文件不存在' : String(error.message) }, error.code === 'ENOENT' ? 404 : 500); else res.end(); }
});
server.listen(port, '127.0.0.1', () => console.log(`片场工作台 ${origin}\n审片意见 ${stateFile}`));
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
