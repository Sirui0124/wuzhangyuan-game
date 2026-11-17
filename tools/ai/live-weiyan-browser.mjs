// Uses real configured AI with isolated browser storage. No main-save modifications.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
if (!process.argv.includes('--live')) throw Error('Pass --live to use configured AI');
const output = resolve('outputs/weiyan-runtime-20261023/browser');
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, reducedMotion: 'reduce' });
const page = await context.newPage();
page.setDefaultTimeout(15000);
await context.addInitScript(() => localStorage.setItem('wuzhang-reduced-motion', '1'));
const report = { passed: false, realAI: true, checks: [], requests: [], errors: [], screenshots: [] };
page.on('pageerror', e => report.errors.push(e.message));
page.on('request', request => {
  if (request.url().endsWith('/api/game/respond') && request.method() === 'POST') {
    const payload = request.postDataJSON();
    report.requests.push({ temperature: payload.temperature, hasText: typeof payload.text === 'string' });
  }
});
let key;
const state = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
const click = action => page.locator(`[data-action="${action}"]`).first().click();
async function load(round) {
  const mode = round === 1 ? 'weiyan-first' : 'weiyan-second';
  key = `wuzhang-chapter-session-v1:${mode}`;
  await page.goto(`http://127.0.0.1:8812/?playtest=${mode}`);
  await page.locator('#player-expression').waitFor();
  assert.equal((await state()).round, round);
  assert.equal(await page.evaluate(() => localStorage.getItem('wuzhang-chapter-session-v1')), null);
}
async function advance() {
  await page.locator('.game-scene').click({ position: { x: 25, y: 300 } });
}
async function say(text) {
  await page.locator('#player-expression').fill(text);
  await click('speak');
  await page.waitForFunction(key => {
    const s = JSON.parse(localStorage.getItem(key));
    return s?.speech && s.speech.status !== 'waiting';
  }, key, { timeout: 90000 });
  const s = await state();
  assert.equal(s.speech.status, 'ready', JSON.stringify(s.speech));
  return s.speech.npcTurn;
}
async function screenshot(name) {
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode().catch(() => {}))); });
  await page.screenshot({ path: resolve(output, name + '.png') });
  report.screenshots.push(name + '.png');
}
async function drain() {
  for (let i = 0; (await state()).phase === 'dialogue' && i < 80; i++) await advance();
}
const military = '前几夜敌军闻号就退，今夜不退，还随我军调动换向，可能在试探虚实。';
const firstGood = '将军，营门尚未突破，眼下不必强闯。今夜帐内确实不许进入，我现在替您转呈，绝不耽误军情。';
const secondGood = '伯约亲口答应在帐外接报。' + military + '请现在随我到帐外，当面交给伯约，不必进丞相帐。';
try {
  await load(1);
  let turn = await say('我现在替您转呈，绝不耽误军情，您别闯。');
  assert.equal(turn.classification.code, 'R1-RETRY');
  await advance();
  assert.equal((await state()).phase, 'reply');
  assert.match(await page.locator('.dialogue-speaker').innerText(), /魏延/);
  await screenshot('01-first-clarify');
  await advance();
  assert.equal((await state()).phase, 'expression');
  turn = await say('营门尚未突破，眼下还不必强闯。今夜帐内确实不许进入。');
  assert.equal(turn.classification.code, 'ok', 'Prior same-round relay proposal must remain usable');
  await advance();
  assert.equal((await state()).story.current, 'A-40B');
  assert.equal(await page.locator('#spoken-line').innerText(), '好，你即刻转呈，莫误军情。');
  assert.equal((await state()).story.flags.REPORT_CLOSED, undefined);
  await screenshot('02-first-accept');
  report.checks.push('首轮：缺军情追问，补充后沿用已说的转呈安排，固定接受句实际显示。');

  for (const round of [1, 2]) {
    await load(round);
    const before = await state();
    turn = await say(round === 1 ? '别谈军情了，给我讲怎么做红烧肉。' : '魏延，你这废物，给我闭嘴。');
    assert.equal(turn.classification.code, 'execute');
    await advance();
    assert.equal((await state()).phase, 'reply');
    assert.ok((await page.locator('#spoken-line').innerText()).includes('斩'));
    assert.ok(!(await page.locator('.dialogue-key-hint').innerText()).includes('重新组织'));
    await screenshot(`0${round + 2}-round-${round}-execution-order`);
    await page.keyboard.press('Space');
    assert.equal((await state()).end, 'weiyan-execution');
    assert.equal((await state()).phase, 'death');
    assert.equal(await page.locator('[data-action="rewind"]').count(), 0);
    await screenshot(`0${round + 4}-round-${round}-failure`);
    await click('retry-weiyan');
    const retried = await state();
    assert.equal(retried.round, round);
    assert.equal(retried.phase, 'dialogue');
    assert.deepEqual(retried.story.collected, before.story.collected);
    assert.equal(retried.story.flags.JIANG_AUTH_GRANTED, before.story.flags.JIANG_AUTH_GRANTED);
    assert.equal(retried.story.history.length, 0);
    await drain();
    assert.equal((await state()).phase, 'expression');
    turn = await say(round === 1 ? firstGood : secondGood);
    assert.equal(turn.classification.code, 'ok');
    await advance();
    if (round === 2) {
      for (let i = 0; (await state()).story.current !== 'W07' && i < 10; i++) await advance();
      assert.equal(await page.locator('#spoken-line').innerText(), '带路，我亲自问他。');
      assert.equal((await state()).story.flags.FORMAL_REPORT_RECEIVED, undefined);
      await screenshot('07-second-accept');
    }
    report.checks.push(`第${round}轮：真实AI斩首、显示短回应、进入独立失败页、同轮重试保留事实并再次接受。`);
  }
  await load(2);
  await page.setViewportSize({ width: 900, height: 1000 });
  turn = await say('伯约亲口答应接报，我们现在到帐外当面找他，不入丞相帐。');
  assert.equal(turn.classification.code, 'P2-F4');
  await advance();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await screenshot('08-second-clarify-tablet');
  report.checks.push('第二轮军情缺口追问，900px画面无横向溢出。');
  assert.deepEqual(report.errors, []);
  assert.ok(report.requests.every(r => r.temperature === 0 || r.temperature === 0.2));
  report.passed = true;
  console.log(JSON.stringify({ passed: true, checks: report.checks.length, apiCalls: report.requests.length }));
} catch (error) {
  report.error = error.message;
  report.state = await state().catch(() => null);
  await screenshot('failure').catch(() => {});
  throw error;
} finally {
  writeFileSync(resolve(output, 'verification.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
