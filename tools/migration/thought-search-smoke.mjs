import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';

// Reach this screen through the chapter's real actions and inference rules. The
// save is isolated from player storage; no evidence or history is fabricated.
const build = resolve(process.argv[2] ?? 'GameStarter/web-demo/.build');
const output = resolve(process.argv[3] ?? 'outputs/thought-search-20261023');
mkdirSync(output, { recursive: true });
const { ChapterSession } = await import(pathToFileURL(resolve(build, 'GameStarter/web-demo/src/chapter-session.js')));
const json = file => JSON.parse(readFileSync(resolve(build, file), 'utf8'));
const script = json('story/chapter-one.script.json'), flow = json('story/chapter-one.flow.json');
const session = new ChapterSession(script, flow, json('story/session-manifest.json').contentVersion);
const read = () => { let count = 0; while (session.snapshot().phase === 'dialogue' && count++ < 200) session.nextLine(); assert.ok(count < 200); };
const act = id => { const action = flow.actions.find(item => item.id === id); if (session.snapshot().scene !== action.scene) session.move(action.scene); assert.ok(session.act(id)); read(); };
session.finishCinematic(); read(); ['read-notice', 'meet-first-scout'].forEach(act); session.chooseScout('a'); read(); act('intercept-first');
session.setFocus('我来转呈信息'); session.setDraft('将军，敌军尚未攻营，还不必强闯。帐内确实不许进入，我现在替您转呈，绝不耽误军情。'); await session.confirmExpression(); session.acknowledgeReply(); read();
['deliver-first', 'stand-watch'].forEach(act); session.finishCinematic(); read(); session.rewind(); read(); ['ask-guard', 'ask-relay', 'ask-scout'].forEach(act); assert.ok(session.beginThinking());
assert.ok(session.think()); session.placeThought('C04'); assert.ok(session.think());
assert.equal(session.snapshot().thinking.history.at(-1).outputs[0].id, 'R01');
assert.ok(['C06', 'C07', 'C10'].every(id => session.snapshot().story.collected.includes(id)));
const fixture = session.serialize(), key = 'wuzhang-chapter-session-v1';
const known = new Set([...session.snapshot().story.collected, ...session.snapshot().story.seen, ...Object.keys(session.graph())]);
const server = createStaticServer({ root: build }); await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, channel: process.env.SMOKE_BROWSER_CHANNEL ?? 'chrome' });
const results = [], errors = [], missing = [], layoutIssues = [], traces = [];
const overlaps = (a, b) => a && b && Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 1 && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 1;
let activePage, activeSize = '';
try {
  for (const [width, height] of [[1366, 768], [1440, 900]]) {
    const context = await browser.newContext({ viewport: { width, height } }), page = await context.newPage();
    activePage = page; activeSize = `${width}x${height}`;
    page.on('pageerror', error => errors.push({ size: activeSize, message: error.message }));
    page.on('response', response => { if (response.status() === 404) missing.push(response.url()); });
    await page.addInitScript(({ key, fixture }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, fixture); }, { key, fixture });
    await page.goto(base);
    const click = action => page.locator(`[data-action="${action}"]`).first().click();
    const state = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
    const metrics = () => page.locator('.workspace-layout').evaluate(el => ({ top: el.scrollTop, max: el.scrollHeight - el.clientHeight, height: el.clientHeight, width: el.clientWidth, pageY: window.scrollY }));
    const trace = async step => {
      const geometry = await page.evaluate(() => {
        const canvas = document.querySelector('.workspace-layout');
        const rect = selector => { const r = document.querySelector(selector)?.getBoundingClientRect(); return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null; };
        return { scrollTop: canvas.scrollTop, scrollHeight: canvas.scrollHeight, clientHeight: canvas.clientHeight, page: rect('.is-current-page'), slot: rect('.is-current-page .thought-inspection-slot'), inventory: rect('#thought-inventory'), detail: rect('.thought-detail-popover') };
      });
      traces.push({ size: activeSize, step, ...geometry });
    };
    const screenshot = async name => { await page.evaluate(() => document.fonts.ready); if (!name.includes('animation')) await page.waitForTimeout(250); await page.screenshot({ path: resolve(output, `${activeSize}-${name}.png`) }); };
    const inventory = page.locator('#thought-inventory'), search = page.locator('[data-inventory-search]');
    const visibleIds = () => page.locator('.inventory-entry:visible [data-inventory-item]').evaluateAll(nodes => nodes.map(node => node.dataset.inventoryItem));
    const open = async () => { if (!await inventory.count()) await click('open-inventory'); await search.waitFor({ state: 'visible' }); };
    const detailGeometry = async () => {
      const list = await inventory.boundingBox(), detail = await page.locator('.thought-detail-popover').boundingBox();
      assert.ok(list && detail); assert.ok(detail.x >= list.x + list.width + 4, 'Details are to the right of the search selection panel');
      assert.ok(Math.abs(detail.y - list.y) <= 2, 'Search selection and details share their top edge');
      if (!(detail.x + detail.width <= width + 1 && detail.y + detail.height <= height + 1)) layoutIssues.push({ issue: 'Details must remain on the laptop screen', list, detail, width, height });
      assert.ok(!overlaps(list, detail), 'Details do not obscure the selection panel');
      const graphBoxes = await page.locator('.working-clue,.current-question,.outcome-title,.thought-action button').evaluateAll(nodes => nodes.map(node => {
        const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, text: node.textContent };
      }));
      for (const box of graphBoxes.filter(box => box.y < height && box.y + box.height > 0)) assert.ok(!overlaps(box, detail), `Details must not obscure ${box.text}`);
      return { list, detail };
    };
    const currentGraphVisible = async () => {
      const canvas = await page.locator('.workspace-layout').boundingBox();
      const boxes = await page.locator('.is-current-page .thought-start,.is-current-page .current-question,.is-current-page .working-clue,.is-current-page .thought-outcome').evaluateAll(nodes => nodes.map(node => {
        const r = node.getBoundingClientRect(); return { y: r.y, bottom: r.bottom, text: node.textContent };
      }));
      for (const box of boxes) if (box.y < canvas.y - 1 || box.bottom > canvas.y + canvas.height + 1) layoutIssues.push({ issue: 'Current reasoning node must remain fully visible', width, height, canvas, box });
    };
    await click('continue'); await page.evaluate(() => document.fonts.ready);
    const entered = await metrics(); assert.ok(Math.abs(entered.top - entered.max) < 3, 'Saved canvas opens at the latest screen');
    assert.equal(await page.locator('.thought-editor [data-thought-node=R01]').count(), 0, 'The starting insight is not duplicated as another clue');
    assert.equal(await page.locator('.workspace-modes [data-action=language-mode]:visible').count(), 0, 'Polishing is absent outside an expression turn');
    await screenshot('01-latest');

    await trace('before-open'); await open(); await trace('after-open');
    const allIds = await visibleIds(); assert.ok(allIds.length > 3); assert.ok(allIds.every(id => known.has(id)), 'Inventory contains only actually acquired facts and derived thoughts'); assert.ok(!allIds.includes('C08'), 'Jiang Wei has not yet consented');
    const beforeSearch = await state();
    await search.fill('亲兵'); await trace('after-title-search'); assert.deepEqual(await visibleIds(), ['C10']);
    await search.fill('传令规矩'); await trace('after-source-search'); assert.deepEqual(await visibleIds(), ['C10'], 'Search includes the original source text');
    assert.deepEqual((await state()).thinking, beforeSearch.thinking, 'Search does not alter selected evidence, history, or outcomes');
    await page.locator('[data-inventory-item=C10]').click();
    await trace('after-open-detail');
    assert.match(await page.locator('.thought-detail-content').innerText(), /传令规矩/);
    const filteredGeometry = await detailGeometry(); await currentGraphVisible(); await screenshot('02-search-and-detail');
    await page.keyboard.press('Escape'); assert.equal(await page.locator('.thought-detail-popover').count(), 0); assert.equal(await inventory.count(), 1); assert.equal(await search.inputValue(), '传令规矩');
    await page.locator('[data-place-evidence=C10]').click();
    assert.ok((await state()).thinking.placed.includes('C10')); assert.equal(await search.inputValue(), '传令规矩'); assert.deepEqual(await visibleIds(), ['C10']);
    await click('clear-inventory-search'); assert.equal(await search.inputValue(), ''); assert.equal(await inventory.count(), 1, 'Clearing the search does not close the panel');
    assert.deepEqual(await visibleIds(), allIds);
    await search.fill('没有这样的线索'); assert.deepEqual(await visibleIds(), []); assert.ok(await page.locator('[data-inventory-empty]').isVisible(), 'Empty search has a visible no-result message');
    await click('clear-inventory-search');
    for (const id of ['C06', 'C07']) await page.locator(`[data-place-evidence=${id}]`).click();
    await page.keyboard.press('Escape'); assert.equal(await inventory.count(), 0, 'A second Escape closes only the inventory');
    assert.equal((await state()).phase, 'thoughts');
    const clueMetrics = await page.locator('.thought-editor .working-clue').evaluateAll(nodes => nodes.map(node => {
      const r = node.getBoundingClientRect(), title = node.querySelector('.working-clue-title'), style = getComputedStyle(title);
      return { id: node.dataset.thoughtNode, left: r.left, width: r.width, font: style.fontFamily, size: style.fontSize };
    }));
    const c06 = clueMetrics.find(node => node.id === 'C06'), c07 = clueMetrics.find(node => node.id === 'C07'), c10 = clueMetrics.find(node => node.id === 'C10');
    assert.ok(c06 && c07 && c10); assert.ok(Math.max(...clueMetrics.map(node => node.left)) - Math.min(...clueMetrics.map(node => node.left)) < 2, 'Selected clues remain left aligned');
    assert.equal(c06.size, '14px'); assert.equal(c10.size, c06.size); assert.equal(c10.font, c06.font); assert.match(c06.font, /Kai|楷/i);
    assert.ok(c06.width - c10.width > 5, 'A five-character clue is naturally narrower than a six-character clue');
    await screenshot('03-selected-natural-widths');
    await page.locator('.thought-editor [data-read-note=C10]').click();
    assert.equal(await inventory.count(), 1, 'A placed clue opens the same search-and-detail area');
    await detailGeometry(); await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    const fixed = await metrics(); await click('think'); await page.waitForTimeout(180);
    assert.equal((await state()).thinking.history.at(-1).outputs[0].id, 'R02');
    assert.equal(await page.locator('.is-revealing [data-thought-result=R02]').count(), 1, 'The new result is visibly revealed');
    assert.ok(await page.locator('[data-thought-result=R02]').evaluate(node => node.getAnimations().length > 0), 'R02 has an entry animation');
    await screenshot('04-new-result-animation'); await page.waitForTimeout(1550);
    const completed = await metrics(); assert.equal(completed.height, fixed.height); assert.equal(completed.width, fixed.width); assert.equal(completed.pageY, 0); assert.ok(Math.abs(completed.top - completed.max) < 3);
    assert.equal(await page.locator('[data-thought-result=R02] .outcome-title').evaluate(node => getComputedStyle(node).fontSize), '18px');
    const client = await context.newCDPSession(page); await client.send('DOM.enable'); await client.send('CSS.enable');
    const doc = await client.send('DOM.getDocument'), titleNode = await client.send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: '[data-thought-result=R02] .outcome-title' });
    const actualFont = await client.send('CSS.getPlatformFontsForNode', { nodeId: titleNode.nodeId });
    assert.ok(actualFont.fonts.some(font => /Kai|楷/i.test(font.familyName)), 'The result renders real KaiTi glyphs, not just a CSS fallback declaration');
    assert.equal((await state()).story.flags.JIANG_AUTH_GRANTED, undefined, 'A plan does not fabricate Jiang Wei consent');
    await screenshot('05-result');
    await open();
    for (const id of ['C10', 'C06', 'C07']) {
      const toggle = page.locator('.inventory-entry').filter({ has: page.locator(`[data-inventory-item=${id}]`) }).locator('.inventory-place');
      assert.equal(await toggle.getAttribute('aria-pressed'), 'true', `The completed canvas keeps ${id} visibly selected`);
      assert.equal((await toggle.innerText()).trim(), '✓');
    }
    await search.fill('亲兵'); await page.locator('[data-inventory-item=C10]').click();
    const resultGeometry = await detailGeometry(); await currentGraphVisible(); await screenshot('06-result-and-aligned-detail');
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    await page.locator('.workspace-layout').evaluate(el => el.scrollTop = 0);
    const top = await metrics(), rect = await page.locator('.workspace-layout').boundingBox();
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2); await page.mouse.wheel(0, 220); await page.waitForTimeout(200);
    const wheeled = await metrics(); if (top.max > 0) assert.ok(wheeled.top > 0, 'Mouse wheel scrolls the canvas history'); assert.equal(wheeled.pageY, 0);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal page overflow');
    await page.reload(); await click('continue'); const restored = await metrics(); assert.ok(Math.abs(restored.top - restored.max) < 3); assert.equal(await page.locator('.ink-drawing').count(), 0, 'Restoring a save does not replay the arrival animation');
    await page.locator('.workspace-layout').evaluate(el => el.scrollTop = 0);
    const beforeHistoryDetail = await metrics(), historySource = page.locator('.thought-record:not(.is-current-page) [data-read-note=C02]').first();
    const recordIndex = await historySource.evaluate(node => node.closest('.thought-record').dataset.recordIndex);
    await historySource.click();
    assert.equal(await inventory.evaluate(node => node.closest('.thought-record')?.dataset.recordIndex), recordIndex, 'Historical clues open the picker in the same history page');
    assert.equal(await page.locator('.thought-detail-popover').evaluate(node => node.closest('.thought-record')?.dataset.recordIndex), recordIndex, 'Historical details remain beside their own picker');
    assert.ok(Math.abs((await metrics()).top - beforeHistoryDetail.top) < 3, 'Opening historical details does not jump to the newest page');
    await detailGeometry(); await screenshot('07-history-detail');
    results.push({ viewport: { width, height }, entered, completed, wheeled, clueMetrics, actualFont, filteredGeometry, resultGeometry, availableIds: allIds });
    await context.close(); activePage = null;
  }
  assert.deepEqual(errors, []); assert.deepEqual(missing, []); assert.deepEqual(layoutIssues, [], 'Detail panels remain fully on screen');
  const report = { passed: true, checks: ['real chapter evidence only', 'title and original-source search', 'search preserves reasoning state', 'add preserves search', 'clear and Escape controls', 'right-side top-aligned details without overlaps', 'uniform KaiTi with natural clue widths', 'new-result animation', 'fixed viewport and inner scrolling', 'restored latest screen', 'historical details stay in their own page without jumping'], results, errors, missing };
  writeFileSync(resolve(output, 'checks.json'), JSON.stringify(report, null, 2)); writeFileSync(resolve(output, 'scroll-traces.json'), JSON.stringify(traces, null, 2)); console.log(JSON.stringify(report, null, 2));
} catch (error) {
  if (activePage) await activePage.screenshot({ path: resolve(output, `${activeSize}-failure.png`) });
  writeFileSync(resolve(output, 'failure.json'), JSON.stringify({ message: error.stack, results, errors, missing, layoutIssues }, null, 2)); writeFileSync(resolve(output, 'scroll-traces.json'), JSON.stringify(traces, null, 2)); throw error;
} finally { await browser.close(); server.closeAllConnections(); await new Promise(ok => server.close(ok)); }
