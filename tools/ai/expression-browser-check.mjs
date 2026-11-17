// Exercises the served game in a fresh Chrome context; all model responses are controlled.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const base = process.env.EXPRESSION_TEST_URL || 'http://127.0.0.1:8812';
const output = resolve('outputs/expression-refactor-20261023/browser');
mkdirSync(output, { recursive: true });
const servedAgent = await fetch(base + '/GameStarter/web-demo/src/expression-agent.js').then(r => {
  assert.equal(r.status, 200); return r.text();
});
assert.match(servedAgent, /brief\.schemaVersion !== 2/, 'The served game must contain the v2 expression adapter');
assert.match(servedAgent, /expressionWriterPrompt\.replace\(/);

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, reducedMotion: 'reduce' });
const page = await context.newPage();
page.setDefaultTimeout(15000);
await context.addInitScript(() => localStorage.setItem('wuzhang-reduced-motion', '1'));
const report = { passed: false, realAI: false, servedSchemaVersion: 2, checks: [], requests: [], errors: [], screenshots: [] };
page.on('pageerror', error => report.errors.push(error.message));
let key, mode = 'success', held, heldDone, routeFailure;
const drafts = {
  first: '将军方才所说的敌军探问发令之人，我明白。帐前已有告示，闲人不得入内。',
  second: '将军，今夜不得入帐。姜伯约本就受命接报，如今也已亲口答应在帐外接报、判断并担责，请当面向他报明。',
  rejected: '这句受控候选未通过核验，不应覆盖已有草稿。',
  late: '迟到的受控结果不应覆盖当前草稿。',
};
const state = () => page.evaluate(storageKey => JSON.parse(localStorage.getItem(storageKey)), key);
const click = action => page.locator(`[data-action="${action}"]`).first().click();
const retained = () => page.getByText('先前保留的草稿 · 并非本次润色结果', { exact: true });
async function status(expected) {
  await page.waitForFunction(({ key, expected }) => JSON.parse(localStorage.getItem(key))?.composition.status === expected, { key, expected });
}
async function heldRequest() {
  for (let i = 0; !held && i < 100; i++) await page.waitForTimeout(20);
  assert.ok(held, 'Writer request has reached the controlled endpoint');
}
async function capture(name) {
  await page.evaluate(() => document.fonts.ready);
  await page.locator('.expression-result').scrollIntoViewIfNeeded();
  await page.screenshot({ path: resolve(output, name + '.png') });
  report.screenshots.push(name + '.png');
}
async function load(round) {
  const playtest = round === 1 ? 'weiyan-first' : 'weiyan-second';
  key = `wuzhang-chapter-session-v1:${playtest}`;
  await page.goto(`${base}/?playtest=${playtest}`);
  await page.locator('#player-expression').waitFor();
  assert.equal((await state()).round, round);
  assert.equal(await page.evaluate(() => localStorage.getItem('wuzhang-chapter-session-v1')), null);
}
async function choose(ids) {
  for (const id of (await state()).story.selected) {
    if (!ids.includes(id)) await page.locator(`[data-expression-source="${id}"] [data-use]`).click();
  }
  for (const id of ids) {
    if ((await state()).story.selected.includes(id)) continue;
    if (!await page.locator('#thought-inventory').count()) await click('open-inventory');
    await page.locator(`#thought-inventory [data-place-evidence="${id}"]`).click();
  }
  if (await page.locator('#thought-inventory').count()) await page.locator('#thought-inventory [data-action="notes-list"]').click();
  assert.deepEqual([...(await state()).story.selected].sort(), [...ids].sort());
}
function decodeInput(text) {
  const marker = '\n资料：', start = text.lastIndexOf(marker);
  assert.ok(start >= 0, 'Request must use the v2 structured payload separator');
  return JSON.parse(text.slice(start + marker.length));
}
await context.route('**/api/game/**', async route => {
  const headers = { 'Access-Control-Allow-Origin': base, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
  if (!route.request().url().endsWith('/api/game/respond'))
    return route.fulfill({ status: 503, headers, contentType: 'application/json', body: '{"error":"isolated expression browser check"}' });
  try {
    const request = route.request().postDataJSON(), input = decodeInput(request.text);
    const kind = input.schemaVersion === 2 ? 'writer' : input.brief?.schemaVersion === 2 ? 'audit' : 'unexpected';
    assert.notEqual(kind, 'unexpected', 'No NPC judge or legacy expression request is expected');
    const selectedMode = mode;
    report.requests.push({ kind, mode: selectedMode, temperature: request.temperature, text: request.text, input });
    let result;
    if (kind === 'writer') {
      result = { status: 'ok', text: selectedMode === 'failure' ? drafts.rejected : selectedMode === 'hold' ? drafts.late : drafts[input.conversation.stage === 'first' ? 'first' : 'second'], evidenceIds: input.selectedEvidence.map(item => item.id) };
      if (selectedMode === 'hold') {
        heldDone = new Promise(resolveDone => {
          held = async () => {
            try { await route.fulfill({ status: 200, headers, contentType: 'application/json', body: JSON.stringify({ text: JSON.stringify(result), responseId: 'controlled-late' }) }); }
            catch (error) { report.lateTransport = error.message; }
            finally { resolveDone(); }
          };
        });
        await heldDone; return;
      }
    } else result = { checks: { intent: true, actors: true, facts: true, items: true, coverage: true }, supported: selectedMode !== 'failure', reason: selectedMode === 'failure' ? '受控核验拒绝' : '受控核验通过' };
    await route.fulfill({ status: 200, headers, contentType: 'application/json', body: JSON.stringify({ text: JSON.stringify(result), responseId: 'controlled-expression' }) });
  } catch (error) {
    routeFailure = error;
    await route.fulfill({ status: 500, headers, contentType: 'application/json', body: JSON.stringify({ error: error.message }) }).catch(() => {});
  }
});

try {
  await load(1);
  await choose(['T01', 'T03']);
  await click('generate-expression'); await status('ready');
  if (routeFailure) throw routeFailure;
  const firstWriter = report.requests.find(item => item.kind === 'writer').input;
  const firstAudit = report.requests.find(item => item.kind === 'audit').input;
  assert.deepEqual(Object.keys(firstWriter).sort(), ['conversation', 'playerIntent', 'schemaVersion', 'selectedEvidence']);
  assert.deepEqual(firstWriter.selectedEvidence.map(item => item.id).sort(), ['T01', 'T03']);
  assert.equal(firstWriter.playerIntent.mode, 'compose-from-selected');
  assert.equal(firstWriter.playerIntent.words, '');
  assert.equal(firstWriter.selectedEvidence.find(item => item.id === 'T03').listenerAlreadyKnows, true);
  assert.ok(!JSON.stringify(firstWriter).includes('originals'));
  assert.deepEqual(firstAudit.brief, firstWriter);
  assert.ok(firstAudit.verificationSources.every(item => item.originals.length > 0));
  assert.equal(await page.locator('.expression-current-reply p').getAttribute('title'), firstWriter.conversation.listenerTurn.text);
  assert.equal(await page.locator('#player-expression').inputValue(), drafts.first);
  assert.equal(await page.locator('[data-action="speak"]').isEnabled(), true);
  assert.equal(await retained().isVisible(), false);
  await capture('01-first-ready');
  report.checks.push('首轮 T01/T03 实际 writer 请求仅含结构化表达材料；原对白只进入 audit；界面魏延发言与请求一致，受控生成达到 ready。');

  mode = 'failure';
  await click('generate-expression'); await status('failed');
  assert.equal(await page.locator('#player-expression').inputValue(), drafts.first);
  assert.equal(await retained().isVisible(), false);
  assert.equal(await page.locator('[data-action="speak"]').isDisabled(), true);
  await capture('02-audit-failed-retained');
  report.checks.push('核验拒绝不覆盖旧稿，显示旧稿标示，确认说出禁用。');

  await page.locator('[data-expression-source="T03"] [data-use]').click(); await status('idle');
  assert.equal(await page.locator('#player-expression').inputValue(), drafts.first);
  assert.equal(await retained().isVisible(), false);
  assert.equal(await page.locator('[data-action="speak"]').isDisabled(), true);
  const manual = '将军，帐前告示在此，我不敢放人入帐。';
  await page.locator('#player-expression').fill(manual); await status('ready');
  assert.equal(await retained().isVisible(), false);
  assert.equal(await page.locator('[data-action="speak"]').isEnabled(), true);
  await page.locator('#expression-focus').fill('请说得简短'); await status('idle');
  assert.equal(await page.locator('#player-expression').inputValue(), manual);
  assert.equal(await retained().isVisible(), false);
  assert.equal(await page.locator('[data-action="speak"]').isDisabled(), true);
  await page.locator('#player-expression').fill(manual + '请将军明察。'); await status('ready');
  assert.equal(await retained().isVisible(), false);
  assert.equal(await page.locator('[data-action="speak"]').isEnabled(), true);
  report.checks.push('改选依据、改补充输入均使旧结果失效但保留原文；手写草稿恢复 ready 并移除旧稿标示。');

  const beforeLate = await page.locator('#player-expression').inputValue();
  mode = 'hold'; held = undefined; await click('generate-expression'); await status('waiting');
  assert.equal(await retained().isVisible(), false);
  assert.equal(await page.locator('[data-action="speak"]').isDisabled(), true);
  await page.waitForFunction(() => document.querySelector('.expression-status')?.textContent.includes('正在润色'));
  await heldRequest();
  await capture('03-waiting-retained');
  await page.locator('#expression-focus').fill('改成只说明告示'); await status('idle');
  const callCount = report.requests.length;
  await held(); await heldDone;
  await page.waitForTimeout(250);
  assert.equal((await state()).composition.status, 'idle');
  assert.equal(await page.locator('#player-expression').inputValue(), beforeLate);
  assert.equal(report.requests.length, callCount, 'Cancelled writer must not start audit');
  assert.equal(await retained().isVisible(), false);
  report.checks.push('等待期间修改补充输入会取消请求；放行迟到 writer 响应后原文和 idle 状态不被覆盖，未继续 audit。');

  held = undefined; await click('generate-expression'); await status('waiting'); await heldRequest();
  await click('cancel-generation'); await status('cancelled');
  assert.equal(await page.locator('#player-expression').inputValue(), beforeLate);
  assert.equal(await retained().isVisible(), false);
  assert.equal(await page.locator('[data-action="speak"]').isDisabled(), true);
  await held(); await heldDone;
  report.checks.push('主动取消润色同样保留旧稿标示、原文及禁用的确认状态。');

  mode = 'success'; await load(2); await choose(['C06', 'C07', 'R02', 'C08']);
  const secondStart = report.requests.length;
  await click('generate-expression'); await status('ready');
  const secondWriter = report.requests.slice(secondStart).find(item => item.kind === 'writer').input;
  const secondAudit = report.requests.slice(secondStart).find(item => item.kind === 'audit').input;
  assert.deepEqual(secondWriter.selectedEvidence.map(item => item.id).sort(), ['C06', 'C07', 'C08', 'R02']);
  assert.equal(secondWriter.conversation.stage, 'authorized');
  assert.equal(secondWriter.selectedEvidence.find(item => item.id === 'R02').time, 'historical-plan');
  assert.equal(secondWriter.selectedEvidence.find(item => item.id === 'C08').kind, 'commitment');
  assert.ok(!JSON.stringify(secondWriter).includes('originals'));
  assert.ok(!JSON.stringify(secondWriter).includes('号角'));
  assert.ok(secondAudit.verificationSources.find(item => item.evidenceId === 'R02').originals.length > 0);
  assert.equal(await page.locator('#player-expression').inputValue(), drafts.second);
  assert.equal(await retained().isVisible(), false);
  assert.equal(await page.locator('[data-action="speak"]').isEnabled(), true);
  await capture('04-second-ready');
  report.checks.push('第二轮 C06/C07/R02/C08：writer 无原对白及号角细节，R02 标明历史方案，C08 标明当前承诺，audit 保留来源。');

  await page.locator('#player-expression').fill('');
  mode = 'failure'; await click('generate-expression'); await status('failed');
  assert.equal(await retained().isVisible(), false);
  assert.doesNotMatch(await page.locator('.expression-status').innerText(), /原话已保留|旧稿|先前保留/);
  assert.equal(await page.locator('[data-action="speak"]').isDisabled(), true);
  report.checks.push('无草稿时核验失败不会声称存在保留的旧稿。');

  assert.equal(await page.evaluate(() => localStorage.getItem('wuzhang-chapter-session-v1')), null);
  assert.deepEqual(report.errors, []);
  if (routeFailure) throw routeFailure;
  report.passed = true;
  console.log(JSON.stringify({ passed: true, checks: report.checks.length, requests: report.requests.length, output }));
} catch (error) {
  report.error = error.stack || error.message;
  report.state = await state().catch(() => null);
  await capture('failure').catch(() => {});
  process.exitCode = 1;
  console.error(error);
} finally {
  writeFileSync(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}

