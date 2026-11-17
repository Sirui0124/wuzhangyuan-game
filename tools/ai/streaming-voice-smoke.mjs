import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const requests = [], streams = new Set();
const provider = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  let body = ''; for await (const chunk of req) body += chunk;
  const data = JSON.parse(body); requests.push({ ...data, at: Date.now() });
  res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
  // Split JSON and PCM sample boundaries. Output must begin before the delayed done event.
  const pcm = Buffer.alloc(48000); for (let i = 0; i < 24000; i++) pcm.writeInt16LE(Math.round(Math.sin(i / 20) * 1000), i * 2);
  const line = JSON.stringify({ audio: pcm.subarray(0, 16001).toString('base64') }) + '\n';
  res.write(line.slice(0, 17)); res.write(line.slice(17));
  res.write(JSON.stringify({ audio: pcm.subarray(16001).toString('base64') }) + '\n');
  const timer = setTimeout(() => res.end('{"done":true}\n'), 1800); streams.add(res);
  res.on('close', () => { clearTimeout(timer); streams.delete(res); });
});
provider.listen(0, '127.0.0.1'); await once(provider, 'listening');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ reducedMotion: 'reduce' }), page = await context.newPage();
const errors = []; page.on('pageerror', error => errors.push(error.message));
let judgeAt = 0, judgeDelay = 200;
await context.addInitScript(() => {
  localStorage.setItem('wuzhang-ai-voice-enabled', '1');
  window.voiceStarts = [];
  const original = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (...args) {
    if (this.buffer?.sampleRate === 24000) window.voiceStarts.push({ at: Date.now(), duration: this.buffer.duration });
    return original.apply(this, args);
  };
});
await context.route('**/api/game/tts', route => route.continue({ url: `http://127.0.0.1:${provider.address().port}/tts` }));
await context.route('**/api/game/respond', async route => {
  judgeAt = Date.now(); await new Promise(r => setTimeout(r, judgeDelay));
  await route.fulfill({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ text: JSON.stringify({ fatal: { type: 'none', quote: '' }, checks: { situation: '将军', ban: '将军', relay: '将军' }, unsupported: '' }) }) });
});
try {
  await page.goto('http://127.0.0.1:8812/?playtest=weiyan-first');
  await page.locator('#player-expression').fill('将军，我现在替您转呈军情。');
  await page.locator('[data-action=speak]').click();
  await page.waitForFunction(() => window.voiceStarts.length > 0);
  const firstAudioAt = await page.evaluate(() => window.voiceStarts[0].at);
  assert.ok(judgeAt > 0 && judgeAt - requests[0].at < 500, 'judge starts alongside player TTS');
  assert.ok(streams.size > 0, 'PCM starts before response finishes');
  await page.waitForTimeout(350);
  assert.equal(await page.locator('.game-scene').getAttribute('data-phase'), 'spoken', 'ready reply must wait for player audio');
  assert.equal(requests[0].role, 'player'); assert.equal(requests[1].role, 'weiyan');
  await page.waitForFunction(() => document.querySelector('.game-scene')?.dataset.phase === 'dialogue');
  await page.waitForFunction(() => window.voiceStarts.length >= 4);
  assert.equal(requests.filter(r => r.role === 'weiyan').length, 1, 'cached reply is not synthesized twice');
  await page.locator('[data-action=menu]').click();
  await page.waitForTimeout(100); assert.equal(streams.size, 0, 'menu cancels every provider stream');
  judgeDelay = 2600;
  requests.length = 0;
  await page.goto('http://127.0.0.1:8812/?playtest=weiyan-first');
  await page.locator('#player-expression').fill('将军，我现在替您转呈军情。');
  await page.locator('[data-action=speak]').click();
  await page.waitForTimeout(2100);
  assert.equal(await page.locator('.game-scene').getAttribute('data-phase'), 'spoken', 'finished player waits for late judgment');
  await page.waitForFunction(() => document.querySelector('.game-scene')?.dataset.phase === 'dialogue');
  await page.waitForFunction(() => window.voiceStarts.length >= 4);
  await page.locator('[data-action=menu]').click();
  judgeDelay = 200;
  await page.goto('http://127.0.0.1:8812/?playtest=weiyan-first');
  await page.locator('#player-expression').fill('将军，我现在替您转呈军情。');
  await page.locator('[data-action=speak]').click();
  await page.waitForFunction(() => window.voiceStarts.length > 0);
  await page.locator('[data-action=menu]').click();
  await page.waitForTimeout(2100);
  assert.equal(await page.locator('.game-scene').count(), 0, 'cancelled audio never auto-advances menu');
  assert.equal(await page.evaluate(() => localStorage.getItem('wuzhang-chapter-session-v1')), null);
  assert.deepEqual(errors, []);
  mkdirSync('outputs/tts-demo', { recursive: true });
  writeFileSync('outputs/tts-demo/browser.json', JSON.stringify({ passed: true, mockedAudio: true, judgeAt, firstAudioAt, checks: ['parallel judge', 'play before finish', 'split samples', 'prefetch reply', 'automatic early reply', 'automatic late reply', 'no overlapping voices', 'menu cancellation', 'isolated save'] }, null, 2));
  console.log('Streaming voice browser smoke passed (mock PCM/provider; isolated save).');
} finally {
  await browser.close(); for (const res of streams) res.destroy(); await new Promise(r => provider.close(r));
}
