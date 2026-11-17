import { chromium } from 'playwright';
import { strict as assert } from 'node:assert';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const root = process.cwd();
const dir = path.join(root, 'source-art/visuals/investigation-expansion-20261022');
const resultPath = path.join(root, 'docs/art/chapter-assets-20261022/judgment-review-results.json');
const key = 'wuzhang-grain-chain-preview-v3';
const result = { checkedAt: new Date().toISOString(), browser: 'msedge headless', rules: {}, devices: [], failures: [] };
const sandbox = {};
vm.runInNewContext(await fs.readFile(path.join(dir, 'thought-chain-rules.js'), 'utf8'), sandbox);
const rules = sandbox.GrainJudgment;
let assessed = 0;
for (let i = 0; i < 4; i++) {
  const available = [...rules.steps[i].available];
  for (let mask = 0; mask < 2 ** available.length; mask++) {
    const ids = available.filter((_, j) => mask & (1 << j));
    for (const choice of [0, 1]) {
      const actual = rules.assess(i, choice, ids);
      const required = choice === 1 ? ['receipt', 'loss'] : [...rules.steps[i].needs];
      const expected = (choice === 0 || i === 0) && required.every(id => ids.includes(id));
      assert.equal(actual.ok, expected, `rules stage ${i} choice ${choice} proofs ${ids}`);
      if (actual.ok) assert.equal(actual.kind, choice === 1 ? 'inquiry' : 'supported');
      assessed++;
    }
  }
  assert.equal(rules.assess(i, 0, [...rules.steps[i].needs, 'invented']).ok, false);
  assert.equal(rules.assess(i, null, [...rules.steps[i].needs]).ok, false);
  assert.equal(rules.assess(i, 0, [rules.steps[i].needs[0], rules.steps[i].needs[0]]).ok, false);
}
result.rules = { passed: true, exhaustiveAvailableEvidenceCombinations: assessed, unknownEvidenceRejected: true, missingChoiceRejected: true, duplicateEvidenceCannotFillMissingRequirement: true };
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const mobile of [false, true]) {
    const viewport = mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 };
    const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const device = { name: mobile ? 'mobile' : 'desktop', viewport, checks: [], errors: [], screenshots: [], layouts: [] };
    const check = name => device.checks.push(name);
    page.on('pageerror', error => device.errors.push(error.message));
    const click = async selector => mobile ? page.locator(selector).tap() : page.locator(selector).click();
    const snapshot = () => page.evaluate(k => JSON.parse(sessionStorage.getItem(k)), key);
    const choose = (i, n) => click(`[data-step="${i}"][data-choice="${n}"]`);
    const put = async (i, ids) => {
      if (!await page.locator(`#step-${i} .picker`).count()) await click(`[data-picker="${i}"]`);
      for (const id of ids) await click(`#step-${i} [data-put="${id}"]`);
    };
    const submit = i => click(`[data-submit="${i}"]`);
    const reset = () => click('#reset');
    const layout = async label => {
      const value = await page.evaluate(() => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth, canvasWidth: document.querySelector('#scroll').clientWidth, canvasScrollWidth: document.querySelector('#scroll').scrollWidth, undersizedVerticalTargets: [...document.querySelectorAll('button')].filter(el => el.getBoundingClientRect().height > 0 && el.getBoundingClientRect().height < 44).map(el => ({ text: el.textContent, height: el.getBoundingClientRect().height })) }));
      assert(value.documentWidth <= value.width, `${label}: document horizontal overflow`);
      assert(value.canvasScrollWidth <= value.canvasWidth, `${label}: canvas horizontal overflow`);
      assert.deepEqual(value.undersizedVerticalTargets, [], `${label}: targets shorter than 44px`);
      device.layouts.push({ label, ...value });
    };
    try {
      await page.goto(pathToFileURL(path.join(dir, 'thought-chain-vertical.html')).href);
      await page.evaluate(() => sessionStorage.clear());
      await page.reload();
      assert.equal(await page.locator('.step').count(), 1);
      assert.equal(await page.locator('.proofs').count(), 0);
      await choose(0, 0);
      await submit(0);
      assert.equal(await page.locator('.step').count(), 1);
      assert.equal((await snapshot()).states[0].saved, false);
      assert.match(await page.locator('#step-0 .blocked').innerText(), /还没有放入/);
      await put(0, ['receipt']);
      await submit(0);
      assert.equal(await page.locator('.step').count(), 1);
      assert.equal((await snapshot()).states[0].saved, false);
      await put(0, ['loss']);
      await submit(0);
      assert.equal(await page.locator('.step').count(), 1);
      assert.equal((await snapshot()).states[0].saved, false);
      check('Zero, one, and two irrelevant/insufficient evidence cards are blocked without advancing');
      await layout('blocked');
      if (!mobile) {
        await page.locator('#step-0').evaluate(el => el.scrollIntoView({ block: 'start' }));
        const screenshot = path.join(dir, 'proof-judgment-blocked.png');
        await page.screenshot({ path: screenshot }); device.screenshots.push(screenshot);
      }
      await page.reload();
      assert.equal((await snapshot()).states[0].saved, false);
      await submit(0);
      assert.equal(await page.locator('.step').count(), 1);
      check('Reload preserves evidence drafts and enforces the same submission gate');
      await put(0, ['dispatch']);
      await submit(0);
      assert.equal(await page.locator('.step').count(), 2);
      assert.equal((await snapshot()).states[0].kind, 'supported');
      for (let i = 1; i < 4; i++) {
        await choose(i, 1);
        await put(i, [...rules.steps[i].available]);
        await submit(i);
        assert.equal((await snapshot()).states[i].saved, false);
        assert.equal(await page.locator('.step').count(), i + 1);
        assert.equal(await page.locator('#action-panel').count(), 0);
        await choose(i, 0);
        await put(i, [...rules.steps[i].needs]);
        await submit(i);
        assert.equal((await snapshot()).states[i].saved, true);
      }
      assert.equal((await snapshot()).phase, 'trace-ready');
      assert.equal(await page.locator('[data-action="verify-signature"]').count(), 1);
      check('Stages 2–4 reject false assertions even with every available card; supported combinations advance');
      await layout('trace-ready');
      await page.reload();
      assert.equal((await snapshot()).phase, 'trace-ready');
      assert.equal((await snapshot()).states.filter(s => s.saved).length, 4);
      await click('[data-action="verify-signature"]');
      assert.equal((await snapshot()).phase, 'trace-done');
      assert.match(await page.locator('#action-panel').innerText(), /仓中留存的缺额报告/);
      check('Full supported trace unlocks a separate signature-verification action before its report is acquired');
      const drafts = (await snapshot()).states.map(s => s.proofs);
      await click('[data-revise="0"]');
      let snap = await snapshot();
      assert(snap.states.every(s => !s.saved && s.kind === null));
      assert.deepEqual(snap.states.map(s => s.proofs), drafts);
      assert.equal(snap.phase, null);
      await submit(3);
      snap = await snapshot();
      assert.equal(snap.states[3].saved, false);
      assert.match(snap.states[3].feedback, /前面的依据/);
      await page.reload();
      assert((await snapshot()).states.every(s => !s.saved));
      await submit(3);
      assert.equal((await snapshot()).states[3].saved, false);
      check('Revising history invalidates downstream submissions, keeps drafts, and blocks downstream resubmission after refresh');
      await reset();
      await choose(0, 1);
      await put(0, ['receipt', 'loss']);
      await submit(0);
      snap = await snapshot();
      assert.equal(snap.phase, 'proposal');
      assert.equal(snap.states[0].kind, 'inquiry');
      assert.equal(await page.locator('.step').count(), 1);
      assert.equal(await page.locator('[data-testimony]').count(), 0);
      assert.equal(await page.locator('[data-action="confirm-close"]').count(), 0);
      assert.doesNotMatch(await page.locator('#flow').innerText(), /缺额报告|第二封信|调查失败/);
      assert.match(await page.locator('#action-panel').innerText(), /尚不能把整笔缺额归罪于他/);
      check('First-stage receipt + loss establishes inquiry only; no conviction, testimony, signature report, second letter, or ending is granted');
      await page.reload();
      assert.equal((await snapshot()).phase, 'proposal');
      await click('[data-action="return"]');
      assert.equal((await snapshot()).phase, null);
      assert.equal((await snapshot()).states[0].saved, false);
      await submit(0);
      await click('[data-action="ask"]');
      assert.equal((await snapshot()).phase, 'questioned');
      assert.equal(await page.locator('[data-testimony]').count(), 1);
      assert.equal(await page.locator('[data-action="retry"]').count(), 0);
      await click('[data-testimony]');
      assert.match(await page.locator('#detail').innerText(), /不能自动当作已查清的事实/);
      await click('#close-detail');
      await click('[data-action="close-case"]');
      assert.equal((await snapshot()).phase, 'confirm');
      assert.equal(await page.locator('[data-action="retry"]').count(), 0);
      await click('[data-action="cancel-close"]');
      assert.equal((await snapshot()).phase, 'questioned');
      await click('[data-action="return"]');
      assert.equal((await snapshot()).phase, null);
      assert.equal((await snapshot()).states[0].saved, false);
      check('Asking performs the encounter; testimony is acquired only afterward; cancelling closure and continuing investigation return safely');
      await submit(0);
      await click('[data-action="ask"]');
      await click('[data-action="close-case"]');
      await click('[data-action="confirm-close"]');
      assert.equal((await snapshot()).phase, 'bad');
      assert.match(await page.locator('#action-panel').innerText(), /调查失败/);
      assert.doesNotMatch(await page.locator('#flow').innerText(), /缺额报告|第二封信/);
      assert.equal(await page.locator('[data-revise]').count(), 0);
      assert.equal(await page.locator('[data-submit]').count(), 0);
      await layout('bad-ending');
      if (mobile) {
        await page.locator('#action-panel').evaluate(el => el.scrollIntoView({ block: 'start' }));
        const screenshot = path.join(dir, 'proof-judgment-mobile.png');
        await page.screenshot({ path: screenshot }); device.screenshots.push(screenshot);
      }
      await page.reload();
      assert.equal((await snapshot()).phase, 'bad');
      await click('[data-action="retry"]');
      snap = await snapshot();
      assert.equal(snap.phase, null);
      assert(snap.states.every(s => !s.saved && s.kind === null));
      assert.equal(await page.locator('#action-panel').count(), 0);
      assert.equal(await page.locator('[data-testimony]').count(), 0);
      check('Only ask → close-case → confirm-close reaches failure; refreshing preserves failure and retry clears submitted/action/outcome states while retaining editable drafts');
      await reset();
      snap = await snapshot();
      assert.equal(snap.opened, 0); assert.equal(snap.phase, null);
      assert(snap.states.every(s => !s.saved && s.choice === null && s.proofs.length === 0));
      assert.deepEqual(device.errors, []);
      check('Full reset clears all drafts; no browser JavaScript errors');
      device.passed = true;
    } catch (error) {
      device.passed = false; device.failure = error.stack; result.failures.push({ device: device.name, error: error.message });
    } finally { result.devices.push(device); await context.close(); }
  }
} finally { await browser.close(); }
result.passed = result.failures.length === 0;
await fs.writeFile(resultPath, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
if (!result.passed) process.exitCode = 1;
