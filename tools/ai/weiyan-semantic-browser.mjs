// Explicit opt-in: one real judgment through the local game proxy in an isolated Chrome context.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

if (!process.argv.includes('--live')) throw new Error('Pass --live to use the configured local AI proxy');
const base = process.env.WEIYAN_BROWSER_TEST_URL || 'http://127.0.0.1:8812';
const output = resolve('outputs/weiyan-false-rejection-20261025/browser');
const key = 'wuzhang-chapter-session-v1:weiyan-second';
const current = '将军，今夜敌军随我军调动改变方向，与前几夜不同，恐怕是在试探我军反应。丞相已让姜维代为处置军报，姜维亲口答应在帐外接报、判断是否禀报丞相并担责，此刻就在帐外等候。今夜不得入帐，还请将军在帐外与姜维接报。';
mkdirSync(output, { recursive: true });
const health = await fetch('http://127.0.0.1:8787/health').then(r => r.json());
assert.equal(health.configured, true); assert.equal(health.thinking, 'disabled');
const served = await fetch(base + '/GameStarter/web-demo/src/chapters/chapter-one/session-state.js').then(r => r.text());
assert.match(served, /weiyan-three-results-20261025-v2/);
const report = { passed: false, realAI: true, mockedAI: false, model: health.model,
  thinking: health.thinking, isolatedSave: key, text: current, requests: [], responses: [],
  checks: [], screenshots: [], films: [], errors: [], ttsRequests: 0, blockedApiRequests: [] };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
await context.addInitScript(() => {
  localStorage.setItem('wuzhang-ai-voice-enabled', '0');
  localStorage.setItem('wuzhang-reduced-motion', '1');
});
const page = await context.newPage(); page.setDefaultTimeout(20000);
const pendingResponses = [];
page.on('pageerror', error => report.errors.push(error.message));
page.on('request', request => {
  if (request.url().endsWith('/api/game/respond') && request.method() === 'POST')
    report.requests.push({ at: new Date().toISOString(), body: request.postDataJSON() });
});
page.on('response', response => {
  if (response.url().endsWith('/api/game/respond') && response.request().method() === 'POST')
    pendingResponses.push(response.json().then(body => report.responses.push({ status: response.status(), body })));
});
await context.route('**/api/game/**', route => {
  const path = new URL(route.request().url()).pathname;
  if (path === '/api/game/respond') return route.continue();
  if (path === '/api/game/tts') report.ttsRequests++;
  report.blockedApiRequests.push(path);
  return route.abort();
});
const state = () => page.evaluate(storageKey => JSON.parse(localStorage.getItem(storageKey)), key);
const flagsPending = async () => {
  const flags = (await state()).story.flags;
  assert.notEqual(flags.FORMAL_REPORT_RECEIVED, true);
  assert.notEqual(flags.REPORT_CLOSED, true);
};
async function capture(name) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: resolve(output, name + '.png') }); report.screenshots.push(name + '.png');
}
async function finishFilm(expectedTitle) {
  const film = page.locator('[data-story-film]'); await film.waitFor();
  const title = await page.locator('.cinema-frame').getAttribute('aria-label');
  assert.equal(title, expectedTitle);
  report.films.push({ title, method: 'existing skip and continue controls; no film quality review' });
  await flagsPending();
  await page.locator('[data-cinema-action="skip"]').click();
  await page.locator('[data-film-confirm]').waitFor({ state: 'visible' });
  await flagsPending();
  await page.locator('[data-film-confirm]').click();
}
try {
  await page.goto(base + '/?playtest=weiyan-second');
  await page.locator('#player-expression').waitFor();
  const before = await state();
  assert.equal(before.round, 2); assert.equal(before.phase, 'expression');
  assert.equal(before.story.flags.JIANG_AUTH_GRANTED, true);
  assert.ok(before.story.collected.includes('C08'));
  report.contentVersion = before.contentVersion;
  await page.locator('#player-expression').fill(current);
  await page.locator('#player-expression').scrollIntoViewIfNeeded();
  await capture('01-original-player-words');
  await page.locator('[data-action="speak"]').click();
  await page.waitForFunction(storageKey => {
    const speech = JSON.parse(localStorage.getItem(storageKey))?.speech;
    return speech && speech.status !== 'waiting';
  }, key, { timeout: 90000 });
  const judged = await state(); report.judged = judged;
  assert.equal(judged.phase, 'spoken'); assert.equal(judged.speech.status, 'ready');
  assert.equal(judged.speech.result, 'ok');
  assert.equal(judged.speech.npcTurn.reply.text, '带路，我亲自问他。');
  assert.equal(judged.speech.judgmentVersion, 'weiyan-three-results-20261025-v2');
  assert.equal(await page.locator('.said-text').innerText(), current);
  await flagsPending();
  report.checks.push('用户原句经真实模型判定为接受，固定成功句与新判定版本进入实际浏览器状态。');
  await page.locator('.speech-box').click();
  assert.equal((await state()).story.flags.PERSUADED, true);
  await finishFilm('亲兵当面见证');
  await page.locator('#spoken-line').waitFor();
  assert.equal(await page.locator('#spoken-line').innerText(), '带路，我亲自问他。');
  assert.equal(await page.locator('.dialogue-speaker').innerText(), '魏延');
  await capture('02-weiyan-accepts');
  await flagsPending();
  report.checks.push('确认原话后进入亲兵见证，随后真实页面显示魏延“带路，我亲自问他。”；未提前置位正式接报。');
  await page.locator('.dialogue-advance').click();
  await page.locator('[data-story-film]').waitFor();
  await capture('03-return-to-jiangwei');
  await finishFilm('带魏延返回中军帐外');
  await page.locator('[data-story-film]').waitFor();
  assert.equal(await page.locator('.cinema-frame').getAttribute('aria-label'), '姜维正式接报');
  await flagsPending(); report.after = await state();
  report.checks.push('继续后返回中军帐外并进入姜维正式接报流程；尚未完成军报接收与处置。');
  assert.equal(await page.evaluate(() => localStorage.getItem('wuzhang-ai-voice-enabled')), '0');
  assert.equal(await page.evaluate(() => localStorage.getItem('wuzhang-chapter-session-v1')), null);
  await Promise.all(pendingResponses);
  assert.equal(report.requests.length, 1); assert.equal(report.responses.length, 1);
  assert.equal(report.ttsRequests, 0); assert.deepEqual(report.blockedApiRequests, []); assert.deepEqual(report.errors, []);
  report.checks.push('独立试玩存档、AI语音关闭且零 TTS，未读取密钥或触及正式玩家存档；全程一次真实分类请求。');
  report.passed = true;
} catch (error) {
  report.failure = error.stack;
  await capture('failure').catch(() => {});
  throw error;
} finally {
  await Promise.allSettled(pendingResponses);
  writeFileSync(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
console.log('PASS: real AI accepts the exact player wording, displays Wei Yan acceptance and reaches the Jiang Wei handoff; isolated save and voice off.');
