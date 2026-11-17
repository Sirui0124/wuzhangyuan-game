// Isolated browser regression. No credentials, live model calls, or user saves.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const base = process.env.RESPONSE_UI_URL || 'http://127.0.0.1:8812';
const out = resolve('outputs/weiyan-response-ui-20261025');
mkdirSync(out, { recursive: true });
const report = { passed: false, mockedAI: true, mockedTTS: true, checks: [], errors: [] };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const text = '将军，营门尚未失守，眼下不必强闯。帐内确实不许进入，我现在替您转呈，绝不耽误军情。';
const delay = ms => new Promise(r => setTimeout(r, ms));
let context, page, aiDelay, failAI, failVoice, accept, ttsCalls;
async function setup({ voice = false, width = 1440, reduced = false } = {}) {
  await context?.close(); aiDelay = 600; failAI = false; failVoice = false; accept = false; ttsCalls = [];
  context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await context.addInitScript(({ voice, reduced }) => {
    localStorage.setItem('wuzhang-ai-voice-enabled', voice ? '1' : '0');
    localStorage.setItem('wuzhang-reduced-motion', reduced ? '1' : '0');
    window.testHidden = false;
    Object.defineProperty(document, 'hidden', { get: () => window.testHidden });
    window.pcmStarts = [];
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      if (this.buffer?.sampleRate === 24000) window.pcmStarts.push(Date.now());
      return start.apply(this, args);
    };
  }, { voice, reduced });
  await context.route('**/api/game/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (path.endsWith('/settings')) {
      assert.equal(request.method(), 'GET');
      return route.fulfill({ headers, json: { apiKey: 'isolated-test-placeholder', baseUrl: 'https://example.invalid', model: 'isolated' } });
    }
    if (path.endsWith('/tts')) {
      ttsCalls.push(request.postDataJSON().role);
      if (failVoice) return route.fulfill({ status: 503, headers, json: { error: '语音暂不可用，可继续阅读文字。' } });
      const pcm = Buffer.alloc(24000 * 2 * 2);
      for (let i = 0; i < pcm.length / 2; i++) pcm.writeInt16LE(Math.round(Math.sin(i / 25) * 100), i * 2);
      return route.fulfill({ headers, contentType: 'application/x-ndjson', body: JSON.stringify({ audio: pcm.toString('base64') }) + '\n{"done":true}\n' });
    }
    assert.ok(path.endsWith('/respond'));
    const failed = failAI;
    await delay(aiDelay);
    if (failed) return route.fulfill({ status: 502, headers, json: { error: '受控测试：服务未能回应' } }).catch(() => {});
    const req = request.postDataJSON(), marker = '\n资料：';
    const input = JSON.parse(req.text.slice(req.text.lastIndexOf(marker) + marker.length));
    const result = input.checks ? { fatal: { type: 'none', quote: '' }, checks: Object.fromEntries(input.checks.map(c => [c.id, accept ? input.current : ''])), unsupported: '' } : { reply: input.intent };
    await route.fulfill({ headers, json: { text: JSON.stringify(result), responseId: 'response-ui-check' } }).catch(() => {});
  });
  page = await context.newPage(); page.setDefaultTimeout(15000);
  page.on('pageerror', e => report.errors.push(e.message));
  await page.goto(base + '/?playtest=weiyan-first', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('#player-expression').waitFor();
}
const action = name => page.locator(`[data-action="${name}"]`).first();
const phase = () => page.locator('.game-scene').getAttribute('data-phase');
async function say() { await page.locator('#player-expression').fill(text); await action('speak').click(); }
async function reply() { await page.waitForFunction(() => document.querySelector('.game-scene')?.getAttribute('data-phase') === 'reply'); }
async function capture(name) { await page.screenshot({ path: resolve(out, name + '.png') }); }
async function settings() { await action('settings').click(); await page.locator('#ai-voice-enabled').waitFor(); }
try {
  await setup(); aiDelay = 1200; await say();
  assert.equal(await phase(), 'spoken');
  assert.match(await page.locator('.speech-response-status').innerText(), /魏延正在回应/);
  assert.equal(await page.locator('.response-dots i').count(), 3);
  assert.equal(await page.locator('.said-text').innerText(), text);
  await capture('01-waiting-desktop'); await reply();
  await page.waitForTimeout(350); assert.equal(await phase(), 'reply');
  assert.equal(ttsCalls.length, 0); await capture('02-automatic-reply');
  report.checks.push('文字模式显示等待状态与动态圆点，无额外点击自动接话；回应停留供阅读，零TTS。');

  await setup({ width: 820, reduced: true }); failAI = true; await say();
  assert.equal(await page.locator('.response-dots i').first().evaluate(el => getComputedStyle(el).animationName), 'none');
  await capture('03-waiting-compact');
  await page.locator('[data-speech-status=failed]').waitFor(); await capture('04-failure');
  assert.equal(await page.locator('.said-text').innerText(), text);
  assert.equal(await action('retry-speech').count(), 1); failAI = false;
  await action('retry-speech').click(); await reply();
  report.checks.push('紧凑视口、减少动态、真实失败反馈与保留原话重试；重试成功自动接话。');

  await setup(); aiDelay = 900; await say(); await action('cancel-speech').click();
  await page.waitForTimeout(2000);
  assert.equal(await page.locator('[data-speech-status=cancelled]').count(), 1);
  await action('revise').click(); assert.equal(await page.locator('#player-expression').inputValue(), text);
  report.checks.push('停止等待后迟到结果不接话；重新组织保留原文。');

  await setup(); await say(); await settings(); await page.waitForTimeout(1800);
  assert.equal(await phase(), 'spoken'); await action('close-modal').click(); await reply();
  report.checks.push('设置面板打开时不推进；关面板后自动接话。');

  await setup(); await say(); await page.locator('[data-character-open]').first().click();
  await page.waitForTimeout(1800); assert.equal(await phase(), 'spoken');
  assert.equal(await page.locator('dialog[open]').count(), 1);
  await page.locator('[data-character-close]').click(); await reply();
  report.checks.push('阅读人物志时不在背景接话；关闭人物志后接回回应。');

  await setup(); await say();
  await page.evaluate(() => { window.testHidden = true; document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(1800); assert.equal(await phase(), 'spoken');
  await page.evaluate(() => { window.testHidden = false; document.dispatchEvent(new Event('visibilitychange')); }); await reply();
  report.checks.push('模拟页面隐藏时不推进，恢复可见后自动接话。');

  await setup({ voice: true }); aiDelay = 50; await say();
  await page.locator('[data-speech-status=ready]').waitFor();
  assert.equal(await phase(), 'spoken'); await capture('05-player-voice');
  assert.equal(await action('reveal-reply').innerText(), '略过我的配音');
  await reply(); await page.waitForTimeout(300);
  const starts = await page.evaluate(() => window.pcmStarts);
  assert.equal(starts.length, 2); assert.ok(starts[1] - starts[0] >= 1800, 'NPC voice must wait for player audio');
  assert.deepEqual(ttsCalls, ['player', 'weiyan']);
  report.checks.push('快速AI等待我的配音播完再接话，双方PCM起播间隔符合2秒音轨，无抢话。');

  await setup({ voice: true }); aiDelay = 50; await say(); await action('reveal-reply').waitFor();
  await action('reveal-reply').click(); await reply();
  report.checks.push('略过我的配音可直接接话，操作不跳过魏延回应。');

  await setup({ voice: true }); failVoice = true; await say(); await reply();
  report.checks.push('配音服务失败自动降为文字，仍能接话。');

  await setup({ voice: true }); aiDelay = 50; await say(); await action('reveal-reply').waitFor();
  await settings(); await page.locator('#ai-voice-enabled').uncheck();
  assert.equal(await phase(), 'spoken'); await action('close-modal').click(); await reply();
  report.checks.push('等待配音时关闭语音，设置关闭后自动用文字接话。');

  await setup(); accept = true; await say();
  await page.waitForFunction(() => document.querySelector('.game-scene')?.getAttribute('data-phase') === 'dialogue');
  await page.waitForFunction(() => document.querySelector('#spoken-line')?.textContent?.includes('即刻'));
  assert.match(await page.locator('#spoken-line').innerText(), /好|即刻|转呈/);
  report.checks.push('接受分支自动显示魏延接受句，尚未自动进入后续剧情。');
  assert.deepEqual(report.errors, []); report.passed = true;
} finally {
  await browser.close(); writeFileSync(resolve(out, 'browser-check.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
