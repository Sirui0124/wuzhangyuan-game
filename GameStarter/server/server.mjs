import http from 'node:http';
import { callModel, isMessagesEndpoint } from './model-transport.mjs';
import { readProfiles, selectProfile, saveTemporaryProfile } from './model-profiles.mjs';
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
  ...(stored.DEEPSEEK_SYSTEM_BASE_URL ? { systemBaseUrl: stored.DEEPSEEK_SYSTEM_BASE_URL } : {}),
};
const envValue = (value) => {
  // Check round-trip rather than interpreting a credential as shell syntax.
  for (const candidate of [`'${value}'`, `"${value}"`, value]) {
    if (parseEnv(`VALUE=${candidate}\n`).VALUE === value) return candidate;
  }
  throw new Error('配置包含无法保存的字符');
};
const validateSettings = (data, previous = {}) => {
  if (!data || typeof data !== 'object' || ['apiKey', 'baseUrl', 'model'].some(k => typeof data[k] !== 'string' || !data[k].trim() || /[\r\n\0]/.test(data[k]) || data[k].length > 4096)) throw new Error('请填写服务网址、模型和 API 密钥');
  const next = Object.fromEntries(['apiKey', 'baseUrl', 'model'].map(k => [k, data[k].trim()]));
  let url; try { url = new URL(next.baseUrl); } catch { throw new Error('服务网址需要是有效的 HTTP 或 HTTPS 地址'); }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password || url.hash) throw new Error('服务网址需要是有效的 HTTP 或 HTTPS 地址');
  next.baseUrl = url.href.replace(/\/$/, '');
  const systemBaseUrl = data.systemBaseUrl ?? (next.baseUrl === previous.baseUrl ? previous.systemBaseUrl : undefined);
  if (systemBaseUrl) {
    const alternate = new URL(systemBaseUrl);
    if (alternate.origin !== url.origin || alternate.username || alternate.password || alternate.hash) throw new Error('系统规则接口必须属于同一服务');
    next.systemBaseUrl = alternate.href.replace(/\/$/, '');
  }
  Object.values(next).forEach(envValue);
  return next;
};
let saveQueue = Promise.resolve();
const persistSettings = (next, extra = {}) => {
  const operation = saveQueue.then(async () => {
    const entries = parseEnv(await readSettingsFile());
    Object.assign(entries, { DEEPSEEK_API_KEY: next.apiKey, DEEPSEEK_BASE_URL: next.baseUrl, DEEPSEEK_MODEL: next.model });
    if (next.systemBaseUrl || entries.DEEPSEEK_SYSTEM_BASE_URL) entries.DEEPSEEK_SYSTEM_BASE_URL = next.systemBaseUrl ?? '';
    Object.assign(entries, extra);
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
  if (req.url === '/api/game/tts' || req.url === '/api/game/tts/settings') { send(410, { error: '实时配音已移除' }); return; }
  let selected;
  try { selected = selectProfile(config, await readProfiles(settingsFile)); }
  catch { send(503, { error: '本机模型配置档案无法读取，请检查保存的配置。' }); return; }
  const current = selected.config;
  if (req.method === 'GET' && req.url === '/health') { send(200, { ok: true, model: current.model, thinking: isMessagesEndpoint(current.baseUrl) ? 'disabled-requested' : 'disabled', configured: Boolean(current.apiKey), profile: selected.profile, profileExpiresAt: selected.expiresAt, protocol: isMessagesEndpoint(current.baseUrl) ? 'messages' : 'chat-completions' }); return; }
  if (settingsRequest && req.method === 'GET') { send(200, current); return; }
  if (req.method !== 'POST' || !['/api/game/respond', '/api/game/settings'].includes(req.url)) { send(404, { error: '接口不存在' }); return; }
  if (settingsRequest && req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') { send(415, { error: '设置需要使用 JSON 提交' }); return; }
  try {
    let body = ''; let bytes = 0;
    for await (const chunk of req) { bytes += chunk.length; if (bytes > (settingsRequest ? 16384 : 8 * 1024 * 1024)) { send(413, { error: '请求过大' }); return; } body += chunk; }
    let data;
    try { data = JSON.parse(body); } catch { send(400, { error: '无效 JSON' }); return; }
    if (settingsRequest) {
      let next;
      try { next = validateSettings(data, current); } catch (error) { send(400, { error: error.message }); return; }
      try { if (selected.profile === 'config2') await saveTemporaryProfile(settingsFile, next, selected.expiresAt); else await persistSettings(next); } catch { send(500, { error: '无法保存本机 API 设置，请检查配置目录权限' }); return; }
      send(200, { ok: true }); return;
    }
    if (!current.apiKey) { send(503, { error: '请先在游戏设置中填写 API 密钥' }); return; }
    if (!data || typeof data !== 'object' || typeof data.text !== 'string' || !data.text.trim() || (data.images !== undefined && (!Array.isArray(data.images) || data.images.length > 8 || data.images.some(x => typeof x !== 'string' || !/^(https:\/\/|data:image\/)/.test(x)))) || (data.previousResponseId !== undefined && typeof data.previousResponseId !== 'string')) {
      send(400, { error: '需要非空 text；images 可传最多 8 个 HTTPS 图片地址或图片 data URL' }); return;
    }
    if (data.temperature !== undefined && (typeof data.temperature !== 'number' || !Number.isFinite(data.temperature) || data.temperature < 0 || data.temperature > 2)) {
      send(400, { error: 'temperature 需要是 0 到 2 之间的有限数值' }); return;
    }
    // Each game call carries its complete current context; do not silently drop a history request.
    if (data.previousResponseId) { send(400, { error: '当前接口不支持 previousResponseId，请在 text 中提供本次所需上下文' }); return; }
    const controller = new AbortController();
    const disconnect = () => { if (!res.writableEnded) controller.abort(); };
    res.once('close', disconnect);
    // Cancel provider work as soon as the page cancels or times out.
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(45000)]);
    try {
      const result = await callModel(current, { text: data.text, images: data.images, temperature: data.temperature }, signal);
      send(200, result);
    } finally { res.removeListener('close', disconnect); }
  } catch (error) { send(error.status || (error.name === 'TimeoutError' ? 504 : 502), { error: error.status ? error.message : error.name === 'TimeoutError' ? '模型请求超时，请重试' : '模型连接失败，请检查代理和网络' }); }
});
// The desktop launcher uses port 0 and owns this server's lifecycle.
export const gameServer = server;
server.listen(port, '127.0.0.1', () => console.log(`Game API: http://127.0.0.1:${server.address().port}`));
