import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';

const build = resolve(process.argv[2] ?? 'GameStarter/web-demo/.build');
const output = resolve(process.argv[3] ?? 'outputs/thought-progression-20261023');
mkdirSync(output, { recursive: true });
const { ChapterSession } = await import(pathToFileURL(resolve(build, 'GameStarter/web-demo/src/chapter-session.js')));
const json = file => JSON.parse(readFileSync(resolve(build, file), 'utf8'));
const script = json('story/chapter-one.script.json'), flow = json('story/chapter-one.flow.json'), version = json('story/session-manifest.json').contentVersion;
const session = new ChapterSession(script, flow, version);
const read = () => { let count = 0; while (session.snapshot().phase === 'dialogue' && count++ < 200) session.nextLine(); assert.ok(count < 200); };
const act = id => { const action = flow.actions.find(item => item.id === id); if (session.snapshot().scene !== action.scene) session.move(action.scene); assert.ok(session.act(id)); read(); };
session.finishCinematic(); read(); ['read-notice', 'meet-first-scout'].forEach(act); session.chooseScout('a'); read(); act('intercept-first');
session.setFocus('我来转呈信息'); session.setDraft('将军，敌军尚未攻营，还不必强闯。帐内确实不许进入，我现在替您转呈，绝不耽误军情。'); await session.confirmExpression(); session.acknowledgeReply(); read();
['deliver-first', 'stand-watch'].forEach(act); session.finishCinematic(); read(); session.rewind(); read(); ['ask-guard', 'ask-relay', 'ask-scout'].forEach(act); assert.ok(session.beginThinking());
assert.equal(session.snapshot().thinking.history.length, 0);
const initialFixture = session.serialize(), key = 'wuzhang-chapter-session-v1';
// This alternate save is also produced by legal player actions, not patched
// flags: the player inferred the reporting route before finishing the military analysis.
assert.equal(session.think(), 'I01'); session.placeThought('C06'); session.placeThought('C07'); assert.equal(session.think(), 'I03');
assert.equal(session.graph().R01, undefined); assert.equal(session.graph().R02, undefined);
const oldBranchFixture = session.serialize();
const goalText = '如何在不惊扰丞相的情况下，不误军情？', firstQuestion = '今晚的军情如何？', secondQuestion = '不惊扰丞相，军情应该交给谁？';
const server = createStaticServer({ root: build }); await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, channel: process.env.SMOKE_BROWSER_CHANNEL ?? 'chrome' });
const errors = [], missing = [], results = []; let activePage, activeName = '';
const overlap = (a, b) => Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 1 && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 1;

async function openFixture(viewport, fixture, name) {
  const context = await browser.newContext({ viewport }), page = await context.newPage(); activePage = page; activeName = name;
  page.on('pageerror', error => errors.push({ name, message: error.message }));
  page.on('response', response => { if (response.status() === 404) missing.push(response.url()); });
  await page.addInitScript(({ key, fixture }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, fixture); }, { key, fixture });
  await page.goto(base); await page.locator('[data-action=continue]').click(); await page.evaluate(() => document.fonts.ready);
  const click = action => page.locator(`[data-action="${action}"]`).filter({ visible: true }).first().click();
  const state = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
  const metrics = () => page.locator('.workspace-layout').evaluate(el => ({ top: el.scrollTop, max: el.scrollHeight - el.clientHeight, height: el.clientHeight, width: el.clientWidth, pageY: window.scrollY }));
  const screenshot = async label => { if (!label.includes('animation')) await page.waitForTimeout(220); await page.screenshot({ path: resolve(output, `${name}-${label}.png`) }); };
  const search = page.locator('[data-inventory-search]'), inventory = page.locator('#thought-inventory');
  const openInventory = async () => { if (!await inventory.count()) await click('open-inventory'); await search.waitFor({ state: 'visible' }); };
  const closeInventory = async () => { if (await page.locator('.thought-detail-popover').count()) await page.keyboard.press('Escape'); if (await inventory.count()) await page.keyboard.press('Escape'); };
  const add = async ids => { await openInventory(); await search.fill(''); for (const id of ids) await inventory.locator(`[data-place-evidence="${id}"]`).click(); await closeInventory(); };
  const assertGoal = async () => {
    const goal = page.getByText(goalText, { exact: true }); assert.equal(await goal.count(), 1);
    const r = await goal.boundingBox(); assert.ok(r && r.y >= 0 && r.y + r.height <= viewport.height, 'The overall goal stays visible');
  };
  const questions = async (first, second) => { assert.equal(await page.getByText(firstQuestion, { exact: true }).count(), first); assert.equal(await page.getByText(secondQuestion, { exact: true }).count(), second); };
  const infer = async expected => {
    await click('think'); await page.waitForTimeout(170);
    const result = page.locator(`[data-thought-result="${expected}"]`); assert.equal(await result.count(), 1);
    assert.ok(await result.evaluate(node => node.getAnimations().length > 0), `${expected} visibly arrives`);
    assert.ok((await state()).thinking.history.at(-1).outputs.some(item => item.id === expected));
    await screenshot(`animation-${expected}`); await page.waitForTimeout(1510);
    assert.equal(await page.locator('.thought-start').count(), 0, 'Previous results are not copied into new starting nodes');
  };
  const compact = async () => {
    const ranges = await page.locator('.thought-record,.thought-editor').evaluateAll(sections => sections.map(section => {
      const rects = [...section.querySelectorAll('[data-thought-question],.working-clue,.outcome-title,.outcome-summary,.thought-controls,.thought-await,.thought-action')]
        .filter(node => node.textContent.trim() && node.getClientRects().length)
        .map(node => node.getBoundingClientRect());
      return { kind: section.className, top: Math.min(...rects.map(r => r.top)), bottom: Math.max(...rects.map(r => r.bottom)) };
    }).filter(range => Number.isFinite(range.top)));
    const gaps = ranges.slice(1).map((range, i) => range.top - ranges[i].bottom);
    assert.ok(gaps.every(gap => gap < 80), `Continuous inference has no whole-screen gaps: ${JSON.stringify({ ranges, gaps })}`);
    return { ranges, gaps };
  };
  const detail = async () => {
    await openInventory(); const before = (await state()).thinking;
    await search.fill('传令规矩'); assert.deepEqual(await inventory.locator('.inventory-entry:visible [data-inventory-item]').evaluateAll(nodes => nodes.map(node => node.dataset.inventoryItem)), ['C10']);
    assert.deepEqual((await state()).thinking, before);
    await page.locator('[data-inventory-item=C10]').click(); await page.waitForTimeout(220);
    const list = await inventory.boundingBox(), panel = await page.locator('.thought-detail-popover').boundingBox();
    assert.ok(list && panel && panel.x >= list.x + list.width + 4); assert.ok(Math.abs(list.y - panel.y) < 2, 'Search and details have aligned top edges');
    assert.ok(!overlap(list, panel)); assert.ok(panel.x + panel.width <= viewport.width + 1 && panel.y + panel.height <= viewport.height + 1);
    const nodeRects = await page.locator('.working-clue,.outcome-title,[data-thought-question]').evaluateAll(nodes => nodes.map(node => {
      const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height };
    }));
    assert.ok(nodeRects.every(rect => !overlap(rect, panel)), 'Details do not cover reasoning nodes');
    await screenshot('search-detail');
    const expanded = await metrics(); let expandedWheel = null;
    if (expanded.max > 0) {
      await page.locator('.workspace-layout').evaluate(node => node.scrollTop = 0);
      const canvas = await page.locator('.workspace-layout').boundingBox();
      await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2); await page.mouse.wheel(0, 180); await page.waitForTimeout(200);
      expandedWheel = await metrics(); assert.ok(expandedWheel.top > 0, 'Expanded canvas content actually scrolls'); assert.equal(expandedWheel.pageY, 0);
      await assertGoal();
    }
    await closeInventory(); return { list, panel, expanded, expandedWheel };
  };
  const follow = async () => {
    const before = await state(); assert.ok(!before.story.collected.includes('C08')); assert.ok(!before.story.flags.JIANG_AUTH_GRANTED);
    const action = page.locator('[data-action=follow-plan]'); assert.match(await action.innerText(), /去找姜伯约/); assert.ok(await action.isEnabled());
    await action.click(); const after = await state(); assert.equal(after.phase, 'dialogue'); assert.ok(!after.story.collected.includes('C08')); assert.ok(!after.story.flags.JIANG_AUTH_GRANTED);
    assert.equal(await page.locator('.workspace-screen').count(), 0); assert.equal(await page.locator('.dialogue-advance').count(), 1);
    const current = after.story.current; assert.ok(flow.sections.find(section => section.id === 'jiang-commitment').rows.includes(current), `Follow plan enters Jiang's actual dialogue: ${current}`);
    await screenshot('jiang-dialogue'); return { phase: after.phase, current, scene: after.scene, collected: after.story.collected };
  };
  return { context, page, click, state, metrics, screenshot, add, closeInventory, assertGoal, questions, infer, compact, detail, follow };
}

try {
  for (const [width, height] of [[1366, 768], [1440, 900]]) {
    const viewport = { width, height }, run = await openFixture(viewport, initialFixture, `${width}x${height}-normal`);
    const { page } = run;
    await run.assertGoal(); await run.questions(1, 0); assert.equal(await page.locator('[data-thought-result]').count(), 0);
    assert.deepEqual((await run.state()).thinking.placed, ['C02', 'C03']); await run.screenshot('01-initial');
    await run.infer('I01'); await run.assertGoal(); await run.questions(1, 0); await run.compact();
    await run.add(['C04']); await run.infer('R01'); await run.questions(1, 1); await run.assertGoal();
    assert.equal(await page.locator('[data-thought-result=R01]').count(), 1); assert.equal(await page.locator('[data-thought-start-ids~=R01]').count(), 1, 'The next step references the actual R01 result');
    const compactAfterR01 = await run.compact(); await run.screenshot('02-second-question');
    await run.add(['C06', 'C07', 'C10', 'C09']); await run.infer('R02'); await run.questions(1, 1); await run.assertGoal();
    const record = (await run.state()).thinking.history.at(-1), output = record.outputs.find(item => item.id === 'R02');
    assert.ok(record.inputs.includes('C10') && record.inputs.includes('C09')); assert.ok(!output.used.includes('C10') && !output.used.includes('C09'), 'Optional clues are not fabricated into required evidence');
    const compactAfterR02 = await run.compact(), detailGeometry = await run.detail();
    await run.screenshot('03-ready-action');
    const canvas = await page.locator('.workspace-layout').boundingBox(); await page.locator('.workspace-layout').evaluate(el => el.scrollTop = 0);
    const atTop = await run.metrics(); await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2); await page.mouse.wheel(0, 220); await page.waitForTimeout(200);
    const wheel = await run.metrics(); if (atTop.max > 0) assert.ok(wheel.top > 0); assert.equal(wheel.pageY, 0);
    await page.reload(); await run.click('continue'); const restored = await run.metrics(); assert.ok(Math.abs(restored.top - restored.max) < 3, 'Reopening shows the latest continuous step');
    await run.assertGoal(); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const followed = await run.follow(); results.push({ viewport, branch: 'normal', compactAfterR01, compactAfterR02, detailGeometry, wheel, restored, followed });
    await run.context.close(); activePage = null;

    const legacy = await openFixture(viewport, oldBranchFixture, `${width}x${height}-old-I03`);
    await legacy.assertGoal(); assert.deepEqual((await legacy.state()).thinking.history.map(item => item.outputs[0].id), ['I01', 'I03']);
    const reconnect = legacy.page.locator('[data-place-evidence=I01]').filter({ hasText: '接回此前军情判断' }); assert.equal(await reconnect.count(), 1);
    const oldCollected = (await legacy.state()).story.collected;
    await reconnect.click(); assert.ok((await legacy.state()).thinking.placed.includes('I01')); assert.deepEqual((await legacy.state()).story.collected, oldCollected);
    await legacy.add(['C04']); await legacy.infer('R02'); await legacy.assertGoal(); const legacyCompact = await legacy.compact();
    await legacy.screenshot('04-reconnected-ready'); const legacyFollowed = await legacy.follow();
    results.push({ viewport, branch: 'old-I01-I03', compact: legacyCompact, followed: legacyFollowed });
    await legacy.context.close(); activePage = null;
  }
  assert.deepEqual(errors, []); assert.deepEqual(missing, []);
  assert.ok(results.some(result => result.detailGeometry?.expandedWheel?.top > 0), 'At least one laptop scenario verifies real overflow scrolling');
  const report = { passed: true, checks: ['real narrative fixtures only', 'persistent overall goal and stage-correct questions', 'same-stage questions shown once', 'continuous compact history', 'actual prior results connect without duplicate starting nodes', 'R01 and R02 arrival animation', 'optional clues remain non-required', 'search and right-aligned detail', 'inner scrolling and latest restore', 'Jiang action enters actual dialogue without granting consent', 'old I01-to-I03 branch can reconnect and complete'], results, errors, missing };
  writeFileSync(resolve(output, 'checks.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
} catch (error) {
  if (activePage) await activePage.screenshot({ path: resolve(output, `${activeName}-failure.png`) });
  writeFileSync(resolve(output, 'failure.json'), JSON.stringify({ message: error.stack, results, errors, missing }, null, 2)); throw error;
} finally { await browser.close(); server.closeAllConnections(); await new Promise(ok => server.close(ok)); }
