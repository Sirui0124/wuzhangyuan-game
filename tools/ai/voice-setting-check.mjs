// Isolated Chrome checks: every API response is mocked; no real settings or game saves are accessed.
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const base = process.env.VOICE_SETTING_TEST_URL || 'http://127.0.0.1:8812';
const output = resolve('outputs/voice-setting-20261023/browser');
const voiceKey = 'wuzhang-ai-voice-enabled', saveKey = 'wuzhang-chapter-session-v1:weiyan-first';
mkdirSync(output, { recursive: true });
const served = await fetch(base + '/GameStarter/web-demo/src/game-ui-panels.js').then(r => {
  assert.equal(r.status, 200); return r.text();
});
assert.match(served, /ai-voice-enabled/, 'Build the current AI voice setting before testing');
const report = { passed: false, mockedAI: true, mockedTTS: true, isolatedSave: saveKey,
  checks: [], requests: [], tts: [], screenshots: [], errors: [] };
const streams = new Set();
let streamDelay = 2600, routeError, judgeMode = 'clarify';
const provider = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  let body = ''; for await (const chunk of req) body += chunk;
  const request = { ...JSON.parse(body), receivedAt: Date.now(), closedAt: null, completed: false };
  report.tts.push(request); streams.add(res);
  res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
  const pcm = Buffer.alloc(24000 * 2);
  for (let i = 0; i < 24000; i++) pcm.writeInt16LE(Math.round(Math.sin(i / 20) * 700), i * 2);
  res.write(JSON.stringify({ audio: pcm.toString('base64') }) + '\n');
  const timer = setTimeout(() => { request.completed = true; res.end('{"done":true}\n'); }, streamDelay);
  res.on('close', () => { request.closedAt = Date.now(); clearTimeout(timer); streams.delete(res); });
});
provider.listen(0, '127.0.0.1'); await once(provider, 'listening');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, reducedMotion: 'reduce' });
await context.addInitScript(() => {
  if (!localStorage.getItem('voice-setting-test-seeded')) {
    localStorage.setItem('voice-setting-test-seeded', '1');
    localStorage.setItem('wuzhang-audio-v1', JSON.stringify({ music: 27, sfx: 39 }));
    localStorage.setItem('wuzhang-reduced-motion', '1');
  }
  window.voiceTestPlayback = { starts: [], stops: [] };
  const start = AudioBufferSourceNode.prototype.start, stop = AudioBufferSourceNode.prototype.stop;
  AudioBufferSourceNode.prototype.start = function (...args) {
    if (this.buffer?.sampleRate === 24000) window.voiceTestPlayback.starts.push(Date.now());
    return start.apply(this, args);
  };
  AudioBufferSourceNode.prototype.stop = function (...args) {
    if (this.buffer?.sampleRate === 24000) window.voiceTestPlayback.stops.push(Date.now());
    return stop.apply(this, args);
  };
});
const page = await context.newPage(); page.setDefaultTimeout(12000);
page.on('pageerror', error => report.errors.push(error.message));
await context.route('**/api/game/**', async route => {
  const req = route.request(), url = new URL(req.url()), headers = { 'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
  try {
    if (url.pathname.endsWith('/tts')) return route.continue({ url: `http://127.0.0.1:${provider.address().port}/tts` });
    if (url.pathname.endsWith('/settings')) {
      assert.equal(req.method(), 'GET', 'The test must never write API credentials');
      return route.fulfill({ status: 200, headers, contentType: 'application/json',
        body: JSON.stringify({ apiKey: 'isolated-test-placeholder', baseUrl: 'https://example.invalid/v1', model: 'isolated-test' }) });
    }
    assert.ok(url.pathname.endsWith('/respond'), 'Unexpected API request is blocked');
    const request = req.postDataJSON(), marker = '\n资料：';
    const input = JSON.parse(request.text.slice(request.text.lastIndexOf(marker) + marker.length));
    report.requests.push({ stage: input.stage ?? null, kind: input.checks ? 'classifier' : 'reply', input, at: Date.now() });
    const result = input.checks ? { fatal: { type: 'none', quote: '' },
      checks: Object.fromEntries(input.checks.map(check => [check.id, judgeMode === 'accept' ? input.current : ''])), unsupported: '' }
      : { reply: input.intent };
    await route.fulfill({ status: 200, headers, contentType: 'application/json',
      body: JSON.stringify({ text: JSON.stringify(result), responseId: 'controlled-voice-check' }) });
  } catch (error) {
    routeError = error;
    await route.fulfill({ status: 500, headers, contentType: 'application/json', body: JSON.stringify({ error: error.message }) }).catch(() => {});
  }
});

const action = name => page.locator(`[data-action="${name}"]`).first();
const state = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), saveKey);
const rawSave = () => page.evaluate(key => localStorage.getItem(key), saveKey);
const phase = () => page.locator('.game-scene').getAttribute('data-phase');
async function capture(name) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: resolve(output, name + '.png') }); report.screenshots.push(name + '.png');
}
async function load() {
  await page.goto(base + '/?playtest=weiyan-first');
  await page.locator('#player-expression').waitFor();
}
async function settings() {
  await action('settings').click();
  await page.locator('#ai-voice-enabled').waitFor();
  await page.waitForFunction(() => document.querySelector('#api-status')?.textContent === '本机配置已读取。');
}
async function closeSettings() { await action('close-modal').click(); }
async function voice(enabled, keyboard = false) {
  const before = await rawSave();
  await settings();
  const control = page.getByRole('checkbox', { name: 'AI语音', exact: true });
  if (await control.isChecked() !== enabled) {
    if (keyboard) { await control.focus(); await control.press('Space'); }
    else await control.setChecked(enabled);
  }
  assert.equal(await control.isChecked(), enabled);
  assert.equal(await page.evaluate(key => localStorage.getItem(key), voiceKey), enabled ? '1' : '0');
  assert.equal(await rawSave(), before, 'Voice setting never changes story/save data');
  assert.equal(await page.locator('[data-volume="music"]').inputValue(), '27');
  assert.equal(await page.locator('[data-volume="sfx"]').inputValue(), '39');
  assert.equal(await page.locator('#reduce-motion').isChecked(), true);
  await closeSettings();
}
async function ready() {
  await page.waitForFunction(key => JSON.parse(localStorage.getItem(key))?.speech?.status === 'ready', saveKey);
  if (routeError) throw routeError;
}
async function say(text) {
  await page.locator('#player-expression').fill(text); await action('speak').click(); await ready();
}
async function waitForStreams(count) {
  for (let i = 0; streams.size !== count && i < 100; i++) await page.waitForTimeout(25);
  assert.equal(streams.size, count, 'Expected the controlled synth/prefetch streams');
}
async function waitForPlayback(count) {
  await page.waitForFunction(n => window.voiceTestPlayback.starts.length >= n, count);
}
try {
  await load(); await settings();
  assert.equal(await page.locator('#ai-voice-enabled').isChecked(), false);
  assert.equal(await page.evaluate(key => localStorage.getItem(key), voiceKey), null);
  await capture('01-settings-default-off'); await closeSettings();
  report.checks.push('无新设置值时默认关闭；设置中的 AI语音可见且与声音、阅读选项并列。');

  const firstLine = '将军，今夜不得入帐，我立即替您转呈军情。';
  await say(firstLine);
  await page.waitForFunction(() => document.querySelector('.game-scene')?.dataset.phase === 'reply');
  await page.waitForTimeout(400);
  assert.equal(await phase(), 'reply', 'Text mode reveals the NPC automatically and waits for reading');
  assert.equal(report.tts.length, 0);
  assert.equal(report.requests.filter(r => r.kind === 'classifier').length, 1);
  assert.equal(await phase(), 'reply');
  await capture('03-text-weiyan-reply');
  await page.locator('.dialogue-advance').press('Space');
  await page.locator('#player-expression').waitFor();
  assert.equal(report.tts.length, 0);
  report.checks.push('关闭语音时判定正常执行、零 TTS 请求；自动显示魏延回应，阅读与重新组织仍由玩家继续。');

  await page.evaluate(key => { localStorage.removeItem(key); localStorage.setItem('wuzhang-voice-muted', '0'); }, voiceKey);
  await load(); await settings(); assert.equal(await page.locator('#ai-voice-enabled').isChecked(), false);
  await closeSettings();
  report.checks.push('旧 wuzhang-voice-muted=0 不会自动启用新版 AI语音。');

  await voice(true, true); await page.reload(); await page.locator('#player-expression').waitFor();
  await settings(); assert.equal(await page.locator('#ai-voice-enabled').isChecked(), true);
  await closeSettings(); await voice(false, true); await page.reload(); await page.locator('#player-expression').waitFor();
  await settings(); assert.equal(await page.locator('#ai-voice-enabled').isChecked(), false);
  await capture('04-settings-saved-off'); await closeSettings();
  report.checks.push('空格键切换开关，开启/关闭均持久化并刷新保留；音乐 27%、音效 39%、减少动态及剧情存档原值保持。');

  await voice(true); judgeMode = 'accept'; streamDelay = 2800;
  const playbackStart = await page.evaluate(() => window.voiceTestPlayback.starts.length);
  const synthStart = report.tts.length;
  await say('将军，帐前有禁令，我现在立即转呈军情。');
  await waitForPlayback(playbackStart + 1); await waitForStreams(2);
  assert.equal(await phase(), 'spoken');
  assert.deepEqual(report.tts.slice(synthStart).map(r => r.role), ['player', 'weiyan']);
  const cancelledAt = Date.now(); await voice(false);
  await waitForStreams(0);
  assert.ok(report.tts.slice(synthStart).every(r => !r.completed && r.closedAt - cancelledAt < 1500));
  await page.waitForTimeout(2900);
  assert.equal(await phase(), 'dialogue', 'Turning voice off reveals the ready response after closing settings');
  assert.equal(await page.evaluate(() => window.voiceTestPlayback.starts.length), playbackStart + 1, 'Cancelled prefetch never starts');
  assert.ok(await page.evaluate(() => window.voiceTestPlayback.stops.length > 0), 'Current PCM playback stopped');
  assert.equal(await phase(), 'dialogue');
  assert.equal(report.tts.length, synthStart + 2);
  report.checks.push('播放/预取中关闭语音立即取消两路请求及PCM；关闭设置后自动展示已就绪文字，迟到音频不多推进一行。');

  await load(); await voice(true); judgeMode = 'clarify'; streamDelay = 150;
  const resumedAt = report.tts.length;
  await say('将军，请再听我说一句。');
  await page.waitForFunction(() => document.querySelector('.game-scene')?.dataset.phase === 'reply');
  await waitForPlayback(2);
  assert.deepEqual(report.tts.slice(resumedAt).map(r => r.role), ['player', 'weiyan']);
  assert.match(await page.locator('#spoken-line').innerText(), /军情/);
  await voice(false); await waitForStreams(0);
  assert.equal(await page.evaluate(key => localStorage.getItem(key), voiceKey), '0');
  await settings(); await capture('05-settings-final-off'); await closeSettings();
  assert.equal(await page.evaluate(() => localStorage.getItem('wuzhang-chapter-session-v1')), null);
  assert.equal(await page.evaluate(() => localStorage.getItem('wuzhang-endings-v1')), null);
  assert.deepEqual(report.errors, []);
  if (routeError) throw routeError;
  report.checks.push('重新开启后的新一句恢复双角色语音及自动接话；测试最后明确关闭；正式存档和密钥均未访问/修改。');
  report.passed = true;
  console.log(JSON.stringify({ passed: true, checks: report.checks.length, ttsRequests: report.tts.length,
    classifierCalls: report.requests.filter(r => r.kind === 'classifier').length, output }));
} catch (error) {
  report.error = error.stack || error.message;
  report.state = await state().catch(() => null);
  await capture('failure').catch(() => {});
  process.exitCode = 1; console.error(error);
} finally {
  // The isolated browser profile always ends with AI voice disabled, including after failure.
  await page.evaluate(key => localStorage.setItem(key, '0'), voiceKey).catch(() => {});
  writeFileSync(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
  for (const stream of streams) stream.destroy();
  await new Promise(resolveClose => provider.close(resolveClose));
}
