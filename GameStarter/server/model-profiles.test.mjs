import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { modelRequest, modelText, callModel } from './model-transport.mjs';
import { readProfiles, selectProfile, saveTemporaryProfile, profilesFileFor } from './model-profiles.mjs';
import { callShoppingModel } from './shopping.mjs';
const primary = { baseUrl: 'https://primary.example/v1', model: 'primary', apiKey: 'fake-primary-key' };
const second = { baseUrl: 'https://secondary.example/v1/messages', model: 'deepseek-v4-flash', apiKey: 'fake-secondary-key' };
const profile = until => ({ version: 1, activeId: 'config2', activeUntil: until, profiles: { primary, config2: second } });

test('Messages preserves rules, maps images and auth, filters thinking, rejects partial output', async t => {
  const request = modelRequest(second, { text: '你好', system: '系统规则', temperature: 0, images: ['https://example.com/a.png', 'data:image/png;base64,YWJj'] });
  assert.equal(request.url, second.baseUrl); assert.equal(request.headers['x-api-key'], second.apiKey);
  assert.equal(request.headers.Authorization, undefined); assert.equal(request.headers['anthropic-version'], '2023-06-01');
  assert.equal(request.payload.system, '系统规则'); assert.deepEqual(request.payload.messages.map(m => m.role), ['user']);
  assert.equal(request.payload.max_tokens, 4096); assert.deepEqual(request.payload.thinking, { type: 'disabled' });
  assert.equal(request.payload.messages[0].content[0].source.type, 'url'); assert.equal(request.payload.messages[0].content[1].source.type, 'base64');
  const result = { id: 'test', stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: 'private' }, { type: 'text', text: '最终文字' }] };
  assert.equal(modelText(result, true).text, '最终文字');
  for (const stop_reason of ['max_tokens', 'tool_use', null]) assert.throws(() => modelText({ ...result, stop_reason }, true));
  assert.throws(() => modelText({ ...result, content: [{ type: 'thinking', thinking: 'private' }] }, true));
  assert.throws(() => modelRequest(second, { text: 'hi', temperature: 2 }));
  let captured;
  t.mock.method(globalThis, 'fetch', async (url, options) => { captured = { url, options, body: JSON.parse(options.body) }; return new Response(JSON.stringify(result)); });
  assert.equal(await callShoppingModel(second, { system: '独立定价规则', user: '{"item":"笔"}' }, new AbortController().signal), '最终文字');
  assert.equal(captured.body.system, '独立定价规则'); assert.equal(captured.body.messages[0].content, '{"item":"笔"}');
  const alternate = modelRequest({ ...second, systemBaseUrl: 'https://secondary.example/v1/chat/completions' }, { text: '商品规格', system: '定价规则' });
  assert.equal(alternate.messagesProtocol, false); assert.deepEqual(alternate.payload.messages.map(m => m.role), ['system', 'user']);
  assert.equal(alternate.payload.model, second.model);
  assert.equal(modelRequest({ ...second, systemBaseUrl: 'https://secondary.example/v1/chat/completions' }, { text: '普通游戏请求' }).messagesProtocol, true);
  const aborted = new AbortController(); aborted.abort();
  await callModel(second, { text: 'hi' }, aborted.signal); assert.equal(captured.options.signal, aborted.signal);
});

test('temporary profile expires at Shanghai midnight; edits preserve primary and expiry', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'game-profiles-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, '.env'), expiry = '2026-10-26T00:00:00+08:00';
  const p = profile(expiry);
  assert.equal(selectProfile(primary, p, Date.parse('2026-10-25T23:59:59+08:00')).profile, 'config2');
  assert.deepEqual(selectProfile(primary, p, Date.parse(expiry)).config, primary);
  assert.equal(await readProfiles(file), null);
  p.activeUntil = new Date(Date.now() + 60000).toISOString();
  await writeFile(profilesFileFor(file), JSON.stringify(p));
  const next = { ...second, model: 'updated' };
  await saveTemporaryProfile(file, next, p.activeUntil);
  const saved = await readProfiles(file); assert.deepEqual(saved.profiles.primary, primary); assert.deepEqual(saved.profiles.config2, next); assert.equal(saved.activeUntil, p.activeUntil);
  await assert.rejects(() => saveTemporaryProfile(file, next, 'changed'));
  saved.activeUntil = new Date(0).toISOString(); await writeFile(profilesFileFor(file), JSON.stringify(saved));
  await assert.rejects(() => saveTemporaryProfile(file, next, saved.activeUntil));
  await writeFile(profilesFileFor(file), '{}'); await assert.rejects(() => readProfiles(file));
});

test('game settings and respond use config2 until expiry, then restore original .env without restart', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'game-profile-server-')), file = join(dir, '.env');
  let child; const received = [];
  const provider = http.createServer(async (req, res) => {
    let raw = ''; for await (const c of req) raw += c;
    const body = JSON.parse(raw); received.push({ url: req.url, body, headers: req.headers });
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(req.url === '/v1/messages'
      ? { id: 'm', stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: 'private' }, { type: 'text', text: 'OK' }] }
      : { id: 'c', choices: [{ finish_reason: 'stop', message: { content: 'PRIMARY' } }] }));
  });
  provider.listen(0, '127.0.0.1'); await once(provider, 'listening');
  const base = `http://127.0.0.1:${provider.address().port}`;
  const a = { ...primary, baseUrl: base }, b = { ...second, baseUrl: base + '/v1/messages', systemBaseUrl: base + '/v1/chat/completions' };
  const env = `DEEPSEEK_API_KEY=${a.apiKey}\nDEEPSEEK_BASE_URL=${a.baseUrl}\nDEEPSEEK_MODEL=${a.model}\nTTS_PLAYER_VOICE=keep\n`;
  await writeFile(file, env);
  const p = { ...profile(new Date(Date.now() + 60000).toISOString()), profiles: { primary: a, config2: b } };
  await writeFile(profilesFileFor(file), JSON.stringify(p));
  const reserve = http.createServer(); reserve.listen(0, '127.0.0.1'); await once(reserve, 'listening'); const port = reserve.address().port; await new Promise(ok => reserve.close(ok));
  const local = `http://127.0.0.1:${port}`;
  try {
    child = spawn(process.execPath, ['server.mjs'], { cwd: new URL('.', import.meta.url), env: { ...process.env, GAME_SETTINGS_FILE: file, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
    await Promise.race([once(child.stdout, 'data'), once(child, 'exit').then(() => { throw Error('server stopped'); })]);
    assert.deepEqual(await (await fetch(local + '/api/game/settings')).json(), b);
    const send = () => fetch(local + '/api/game/respond', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"text":"hello"}' });
    assert.equal((await (await send()).json()).text, 'OK'); assert.equal(received.at(-1).url, '/v1/messages');
    assert.equal(received.at(-1).headers['x-api-key'], b.apiKey);
    assert.equal((await (await fetch(local + '/health')).json()).profile, 'config2');
    const modified = { ...b, model: 'changed' };
    const { systemBaseUrl, ...uiFields } = modified;
    assert.equal((await fetch(local + '/api/game/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(uiFields) })).status, 200);
    assert.equal((await readProfiles(file)).profiles.config2.systemBaseUrl, systemBaseUrl);
    assert.equal(await readFile(file, 'utf8'), env); assert.deepEqual((await readProfiles(file)).profiles.primary, a);
    const saved = await readProfiles(file); saved.activeUntil = new Date(0).toISOString(); await writeFile(profilesFileFor(file), JSON.stringify(saved));
    assert.deepEqual(await (await fetch(local + '/api/game/settings')).json(), a);
    assert.equal((await (await send()).json()).text, 'PRIMARY'); assert.equal((await (await fetch(local + '/health')).json()).profile, 'primary');
    assert.equal(await readFile(file, 'utf8'), env);
  } finally {
    if (child?.exitCode === null) { const exited = once(child, 'exit'); child.kill(); await exited; }
    await new Promise(ok => provider.close(ok)); await rm(dir, { recursive: true, force: true });
  }
});
