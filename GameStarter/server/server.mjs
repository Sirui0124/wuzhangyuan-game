import http from 'node:http';
import { readFile, writeFile, mkdir, rename, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { randomUUID } from 'node:crypto';

const settingsFile = resolve(process.env.GAME_SETTINGS_FILE || resolve(dirname(fileURLToPath(import.meta.url)), '.env'));
const readSettingsFile = async () => { try { return await readFile(settingsFile, 'utf8'); } catch (error) { if (error.code === 'ENOENT') return ''; throw error; } };
const stored = parseEnv(await readSettingsFile());
let config = {
  apiKey: stored.DEEPSEEK_API_KEY ?? process.env.DEEPSEEK_API_KEY ?? '',
  baseUrl: stored.DEEPSEEK_BASE_URL ?? process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com',
  model: stored.DEEPSEEK_MODEL ?? process.env.DEEPSEEK_MODEL ?? 'deepseek-flash',
};
const endpointFor = (baseUrl) => {
  const url = new URL(baseUrl);
  const path = url.pathname.replace(/\/+$/, '');
  url.pathname = path.endsWith('/chat/completions') ? path : `${path}/chat/completions`;
  return url.href;
};
const envValue = (value) => {
  // Check round-trip rather than interpreting a credential as shell syntax.
  for (const candidate of [`'${value}'`, `"${value}"`, value]) {
    if (parseEnv(`VALUE=${candidate}\n`).VALUE === value) return candidate;
  }
  throw new Error('配置包含无法保存的字符');
};
const validateSettings = (data) => {
  if (!data || typeof data !== 'object' || ['apiKey', 'baseUrl', 'model'].some(k => typeof data[k] !== 'string' || !data[k].trim() || /[\r\n\0]/.test(data[k]) || data[k].length > 4096)) throw new Error('请填写服务网址、模型和 API 密钥');
  const next = Object.fromEntries(['apiKey', 'baseUrl', 'model'].map(k => [k, data[k].trim()]));
  let url; try { url = new URL(next.baseUrl); } catch { throw new Error('服务网址需要是有效的 HTTP 或 HTTPS 地址'); }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password || url.hash) throw new Error('服务网址需要是有效的 HTTP 或 HTTPS 地址');
  next.baseUrl = url.href.replace(/\/$/, '');
  Object.values(next).forEach(envValue);
  return next;
};
let saveQueue = Promise.resolve();
const persistSettings = (next) => {
  const operation = saveQueue.then(async () => {
    const entries = parseEnv(await readSettingsFile());
    Object.assign(entries, { DEEPSEEK_API_KEY: next.apiKey, DEEPSEEK_BASE_URL: next.baseUrl, DEEPSEEK_MODEL: next.model });
    const contents = Object.entries(entries).map(([k, v]) => `${k}=${envValue(v)}`).join('\n') + '\n';
    const temporary = `${settingsFile}.${randomUUID()}.tmp`;
    await mkdir(dirname(settingsFile), { recursive: true });
    try {
      await writeFile(temporary, contents, { mode: 0o600, flag: 'wx' });
      await rename(temporary, settingsFile);
      config = next;
    } finally { await unlink(temporary).catch(() => {}); }
  });
  saveQueue = operation.catch(() => {});
  return operation;
};
const port = Number(process.env.PORT || 8787);
const allowedOrigin = (origin) => {
  if (!origin) return true;
  try { const u = new URL(origin); return ['http:', 'https:'].includes(u.protocol) && ['localhost', '127.0.0.1'].includes(u.hostname); } catch { return false; }
};
const localSettingsRequest = (req) => {
  const address = req.socket.remoteAddress;
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address)) return false;
  try { return ['localhost', '127.0.0.1'].includes(new URL(`http://${req.headers.host}`).hostname); } catch { return false; }
};
const server = http.createServer(async (req, res) => {
  if (!allowedOrigin(req.headers.origin)) { res.writeHead(403); res.end(); return; }
  if (req.headers.origin) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  const send = (status, body) => { if (res.destroyed || res.writableEnded) return; res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
  const settingsRequest = req.url === '/api/game/settings';
  if (settingsRequest) {
    res.setHeader('Cache-Control', 'no-store');
    if (!localSettingsRequest(req)) { send(403, { error: '设置仅允许本机访问' }); return; }
  }
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.method === 'GET' && req.url === '/health') { send(200, { ok: true, model: config.model, thinking: 'disabled', configured: Boolean(config.apiKey) }); return; }
  if (settingsRequest && req.method === 'GET') { send(200, config); return; }
  if (req.method !== 'POST' || !['/api/game/respond', '/api/game/settings'].includes(req.url)) { send(404, { error: '接口不存在' }); return; }
  if (settingsRequest && req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') { send(415, { error: '设置需要使用 JSON 提交' }); return; }
  try {
    let body = ''; let bytes = 0;
    for await (const chunk of req) { bytes += chunk.length; if (bytes > (settingsRequest ? 16384 : 8 * 1024 * 1024)) { send(413, { error: '请求过大' }); return; } body += chunk; }
    let data;
    try { data = JSON.parse(body); } catch { send(400, { error: '无效 JSON' }); return; }
    if (settingsRequest) {
      let next;
      try { next = validateSettings(data); } catch (error) { send(400, { error: error.message }); return; }
      try { await persistSettings(next); } catch { send(500, { error: '无法保存本机 API 设置，请检查配置目录权限' }); return; }
      send(200, { ok: true }); return;
    }
    const current = config;
    if (!current.apiKey) { send(503, { error: '请先在游戏设置中填写 API 密钥' }); return; }
    if (typeof data.text !== 'string' || !data.text.trim() || (data.images !== undefined && (!Array.isArray(data.images) || data.images.length > 8 || data.images.some(x => typeof x !== 'string' || !/^(https:\/\/|data:image\/)/.test(x)))) || (data.previousResponseId !== undefined && typeof data.previousResponseId !== 'string')) {
      send(400, { error: '需要非空 text；images 可传最多 8 个 HTTPS 图片地址或图片 data URL' }); return;
    }
    // Each game call carries its complete current context; do not silently drop a history request.
    if (data.previousResponseId) { send(400, { error: '当前接口不支持 previousResponseId，请在 text 中提供本次所需上下文' }); return; }
    const content = data.images?.length
      ? [...data.images.map(url => ({ type: 'image_url', image_url: { url } })), { type: 'text', text: data.text }]
      : data.text;
    const payload = { model: current.model, thinking: { type: 'disabled' }, stream: false, messages: [{ role: 'user', content }] };
    const controller = new AbortController();
    const disconnect = () => { if (!res.writableEnded) controller.abort(); };
    res.once('close', disconnect);
    // Cancel provider work as soon as the page cancels or times out.
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(45000)]);
    let upstream;
    try { upstream = await fetch(endpointFor(current.baseUrl), { method: 'POST', headers: { Authorization: `Bearer ${current.apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal }); }
    catch (error) { res.removeListener('close', disconnect); throw error; }
    if (!upstream.ok) { await upstream.body?.cancel(); send(upstream.status, { error: `模型接口请求失败（HTTP ${upstream.status}）` }); return; }
    const result = await upstream.json();
    res.removeListener('close', disconnect);
    const choice = result.choices?.[0];
    const text = choice?.message?.content;
    if (typeof text !== 'string' || !text.trim() || choice.finish_reason !== 'stop') { send(502, { error: '模型未返回完整文字回复' }); return; }
    send(200, { text, responseId: result.id, usage: result.usage });
  } catch (error) { send(error.name === 'TimeoutError' ? 504 : 502, { error: error.name === 'TimeoutError' ? '模型请求超时，请重试' : '模型连接失败，请检查代理和网络' }); }
});
server.listen(port, '127.0.0.1', () => console.log(`Game API: http://127.0.0.1:${port}`));
