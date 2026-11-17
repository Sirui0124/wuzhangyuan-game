import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';

// Formal game entry + real state machine. No preview DOM, real API, or user profile.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const modalsOnly = process.argv.includes('--modals-only');
const built = resolve(root, process.argv.slice(2).find(arg => !arg.startsWith('--')) ?? 'GameStarter/web-demo/.build');
const output = resolve(root, 'docs/art/review-20261022/xuan-live');
mkdirSync(output, { recursive: true });
const json = name => JSON.parse(readFileSync(resolve(built, 'story', name), 'utf8'));
const { ChapterSession } = await import(pathToFileURL(resolve(built, 'GameStarter/web-demo/src/chapter-session.js')));
const script = json('chapter-one.script.json'), flow = json('chapter-one.flow.json'), manifest = json('session-manifest.json');
const fixtureSession = new ChapterSession(script, flow, manifest.contentVersion);
const drain = () => { let n = 0; while (fixtureSession.snapshot().phase === 'dialogue' && n++ < 200) fixtureSession.nextLine(); assert.ok(n < 200); };
const actFixture = id => { const action = flow.actions.find(item => item.id === id); if (fixtureSession.snapshot().scene !== action.scene) fixtureSession.move(action.scene); assert.ok(fixtureSession.act(id)); drain(); };
fixtureSession.finishCinematic(); drain();
['read-notice', 'meet-first-scout'].forEach(actFixture); fixtureSession.chooseScout('a'); drain(); actFixture('intercept-first');
fixtureSession.setFocus('我来转呈信息'); fixtureSession.restoreSuggestion(); await fixtureSession.confirmExpression(); fixtureSession.acknowledgeReply(); drain();
['deliver-first', 'stand-watch'].forEach(actFixture); fixtureSession.finishCinematic(); drain(); fixtureSession.rewind(); drain();
['ask-guard', 'ask-relay', 'ask-scout'].forEach(actFixture);
assert.ok(fixtureSession.beginThinking());
assert.equal(fixtureSession.snapshot().phase, 'thoughts');
if (modalsOnly) {
  fixtureSession.think(); fixtureSession.placeThought('C04'); fixtureSession.think();
  fixtureSession.placeThought('C06'); fixtureSession.placeThought('C07'); fixtureSession.think();
  fixtureSession.followPlan(); drain(); actFixture('intercept-weiyan');
  fixtureSession.selectEvidence('R01'); fixtureSession.selectEvidence('C08'); fixtureSession.restoreSuggestion();
  fixtureSession.setThoughtMode('reasoning');
  assert.ok(fixtureSession.snapshot().story.draft);
}
const fixture = fixtureSession.serialize();
const report = { passed: false, contentVersion: manifest.contentVersion, entry: '/', isolatedBrowserContext: true, isolatedStaticOrigin: true, realAPI: false, checks: [], styles: {}, curves: [], captures: [], requests: { settings: 0, generation: 0, grounding: 0, judgment: 0 }, errors: [], missing: [], blockedRemote: [] };
const server = createStaticServer({ root: built });
await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;
let browser, context, page;
let mockMode = 'success';
const polished = '禀将军，往日敌骑闻号即退，今夜却不退，还随我军调动换向，或是在试探。伯约已亲口应允接报，请随我立即前往帐外，当面交他处置，不必惊扰丞相。';
const key = 'wuzhang-chapter-session-v1';
try {
  browser = await chromium.launch({ headless: true, channel: 'chrome' });
  context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  await context.addInitScript(() => localStorage.setItem('wuzhang-reduced-motion', '1'));
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    const headers = { 'Access-Control-Allow-Origin': base, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
    if (url.pathname.startsWith('/api/')) {
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      if (url.pathname === '/api/game/settings') {
        report.requests.settings++;
        return route.fulfill({ status: 200, headers, contentType: 'application/json', body: JSON.stringify({ apiKey: '', baseUrl: 'https://example.invalid/v1', model: 'isolated-ui-mock' }) });
      }
      if (url.pathname === '/api/game/respond') {
        const prompt = request.postDataJSON()?.text ?? '';
        const type = prompt.startsWith('核对对白') ? 'grounding' : prompt.startsWith('你是第一章交涉') ? 'judgment' : 'generation';
        report.requests[type]++;
        if (mockMode === 'fail') return route.fulfill({ status: 503, headers, contentType: 'application/json', body: '{"error":"isolated mock failure"}' });
        const modeAtRequest = mockMode;
        if (modeAtRequest === 'delay') await new Promise(ok => setTimeout(ok, 700));
        const data = type === 'grounding' ? { supported: true } : type === 'judgment' ? { result: 'ok' } : { text: modeAtRequest === 'delay' ? '这段迟到的测试结果不得覆盖新输入。' : polished, evidenceIds: ['R01', 'C08'] };
        try { await route.fulfill({ status: 200, headers, contentType: 'application/json', body: JSON.stringify({ text: JSON.stringify(data) }) }); } catch { /* Browser cancellation deliberately invalidates delayed requests. */ }
        return;
      }
      report.blockedRemote.push(url.pathname); return route.abort();
    }
    if (url.origin === base || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
    report.blockedRemote.push(url.origin + url.pathname); return route.abort();
  });
  page = await context.newPage(); page.setDefaultTimeout(15000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('response', response => { if (response.status() === 404) report.missing.push(new URL(response.url()).pathname); });
  const state = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
  const click = action => page.locator(`[data-action="${action}"]`).first().click();
  const waitState = async predicate => {
    await page.waitForFunction(({ key, text }) => Function('s', `return (${text})(s)`)(JSON.parse(localStorage.getItem(key))), { key, text: predicate.toString() });
  };
  const capture = async name => {
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].filter(img => img.getClientRects().length).map(img => img.decode().catch(() => {}))); });
    await page.screenshot({ path: resolve(output, name + '.png') }); report.captures.push(name + '.png');
  };
  const assertTheme = async target => {
    assert.equal(await target.locator('html').getAttribute('data-ui-theme'), 'xuan');
    for (const file of ['xuan-panels.css', 'xuan-thought.css']) assert.equal(await target.locator(`link[href="/${file}"]`).count(), 1);
  };
  const openInventory = async () => { if (!await page.locator('#thought-inventory').count()) await page.locator('.inventory-tab').click(); };
  const closeInventory = async () => { if (await page.locator('#thought-inventory').count()) await page.locator('.inventory-tab').click(); };
  const place = async (id, keyboard = false) => {
    await openInventory(); const row = page.locator(`[data-inventory-item="${id}"]`);
    await row.scrollIntoViewIfNeeded();
    if (await row.getAttribute('aria-expanded') !== 'true') { if (keyboard) { await row.focus(); await page.keyboard.press('Enter'); } else await row.click(); }
    const action = page.locator(`[data-place-evidence="${id}"]`);
    if (keyboard) { await action.focus(); await page.keyboard.press('Enter'); } else await action.click();
    await closeInventory();
  };
  const drag = async id => {
    await openInventory(); const row = page.locator(`[data-inventory-item="${id}"]`), zone = page.locator('[data-thought-drop],[data-expression-drop]');
    await row.scrollIntoViewIfNeeded(); await zone.scrollIntoViewIfNeeded();
    const a = await row.boundingBox(), b = await zone.boundingBox(); assert.ok(a && b);
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2, b.y + Math.min(b.height / 2, 45), { steps: 20 }); await page.mouse.up();
    assert.ok((await state()).thinking.placed.includes(id), `Pointer placement failed: ${id}`); await closeInventory();
  };
  const noOverflow = async label => {
    const sizes = await page.evaluate(() => ({ width: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth, workspace: document.querySelector('.workspace-layout') && { width: document.querySelector('.workspace-layout').clientWidth, scroll: document.querySelector('.workspace-layout').scrollWidth } }));
    assert.ok(sizes.document <= sizes.width && sizes.body <= sizes.width, `${label}: page horizontal overflow`);
    if (sizes.workspace) assert.ok(sizes.workspace.scroll <= sizes.workspace.width + 1, `${label}: workspace horizontal overflow`);
  };
  const checkCurves = async stage => {
    const snapshot = await state();
    const expected = snapshot.thinking.history.flatMap(record => record.outputs.flatMap(out => out.used.map(from => `${from}>${out.id}`))).sort();
    await page.waitForFunction(n => document.querySelectorAll('.reasoning-timeline .reasoning-curve:not(.continuation-curve)').length === n, expected.length);
    const curves = await page.locator('.reasoning-timeline .reasoning-curve:not(.continuation-curve)').evaluateAll(nodes => nodes.map(node => ({ from: node.dataset.from, to: node.dataset.to, d: node.getAttribute('d'), length: node.getTotalLength() })));
    assert.deepEqual(curves.map(curve => `${curve.from}>${curve.to}`).sort(), expected);
    assert.ok(curves.every(curve => curve.length > 0 && curve.d.includes('C') && !/NaN|Infinity/.test(curve.d)));
    assert.ok(curves.every(curve => curve.from !== 'C05'), 'Unused distractor must not become a source branch');
    report.curves.push({ stage, expected, actual: curves });
  };
  const checkContinuationClearance = async () => {
    const geometry = await page.locator('.reasoning-timeline').evaluate(host => {
      const obstacles = [...host.querySelectorAll('.thought-outcome,[data-thought-node]')];
      const distance = (point, node) => { const r = node.getBoundingClientRect(); return Math.hypot(Math.max(r.left - point.x, 0, point.x - r.right), Math.max(r.top - point.y, 0, point.y - r.bottom)); };
      const identify = node => ({ kind: node.matches('.thought-outcome') ? 'outcome' : 'node', id: node.dataset.thoughtResult || node.dataset.thoughtNode });
      return [...host.querySelectorAll('.continuation-curve')].map(path => {
        const matrix = path.getScreenCTM();
        if (!matrix) throw new Error('Continuation path has no viewport transform');
        const length = path.getTotalLength();
        const at = offset => { const p = path.getPointAtLength(offset); return new DOMPoint(p.x, p.y).matrixTransform(matrix); };
        const start = at(0), end = at(length);
        const source = obstacles.filter(node => node.dataset.thoughtResult === path.dataset.from).sort((a, b) => distance(start, a) - distance(start, b))[0];
        const target = obstacles.filter(node => node.dataset.thoughtNode === path.dataset.to).sort((a, b) => distance(end, a) - distance(end, b))[0];
        if (!source || !target) throw new Error('Continuation source or target cannot be identified');
        const others = obstacles.filter(node => node !== source && node !== target).map(node => ({ node, rect: node.getBoundingClientRect() }));
        // At most one viewport pixel per sample; shrink interiors by 2 px so
        // a stroke touching an intentional node boundary is not a collision.
        const scale = Math.max(Math.hypot(matrix.a, matrix.b), Math.hypot(matrix.c, matrix.d));
        const samples = Math.max(2, Math.ceil(length * scale));
        const collisions = new Map();
        for (let i = 0; i <= samples; i++) {
          const point = at(length * i / samples);
          for (const { node, rect: r } of others) if (point.x > r.left + 2 && point.x < r.right - 2 && point.y > r.top + 2 && point.y < r.bottom - 2 && !collisions.has(node)) {
            collisions.set(node, { ...identify(node), sample: i, point: { x: point.x, y: point.y }, rect: { left: r.left, top: r.top, right: r.right, bottom: r.bottom } });
          }
        }
        return { from: path.dataset.from, to: path.dataset.to, samples: samples + 1, tolerancePixels: 2, source: identify(source), target: identify(target), collisions: [...collisions.values()] };
      });
    });
    report.continuationGeometry = geometry;
    assert.equal(geometry.length, 2, 'Both independent outputs must continue to their own next input');
    assert.deepEqual(geometry.flatMap(path => path.collisions), [], 'Multi-branch continuation crosses unrelated node/outcome interior');
  };
  const readDialogue = async () => { let n = 0; while ((await state()).phase === 'dialogue' && n++ < 180) await click('next'); assert.ok(n < 180); };

  await page.goto(base); await page.locator('.game-menu').waitFor(); await assertTheme(page);
  await page.evaluate(({ key, fixture }) => localStorage.setItem(key, fixture), { key, fixture }); await page.reload(); await click('continue');
  if (modalsOnly) {
    const prior = await state();
    assert.equal(prior.thinking.history.length, 3); assert.ok(prior.story.draft);
    for (const [action, name] of [['settings', 'settings'], ['save', 'saves'], ['records', 'history']]) {
      await click(action);
      if (action === 'settings') { await page.waitForFunction(() => !document.querySelector('#api-model')?.disabled); assert.equal(await page.locator('#api-key').inputValue(), ''); }
      if (action === 'save') await page.locator('[data-store-slot="1"]').click();
      assert.equal(await page.locator('.workspace-layout').evaluate(node => getComputedStyle(node).visibility), 'hidden');
      assert.equal(await page.locator('.inventory-tab').evaluate(node => getComputedStyle(node).visibility), 'hidden');
      assert.equal(await page.locator('.thought-landscape').evaluate(node => getComputedStyle(node).visibility), 'visible');
      assert.equal(await page.locator('.game-modal').isVisible(), true);
      await capture(name); await click('close-modal');
      assert.equal(await page.locator('.game-modal').count(), 0);
      assert.equal(await page.locator('.workspace-layout').evaluate(node => getComputedStyle(node).visibility), 'visible');
      assert.equal(await page.locator('.inventory-tab').evaluate(node => getComputedStyle(node).visibility), 'visible');
      const after = await state();
      assert.deepEqual(after.story, prior.story); assert.deepEqual(after.thinking, prior.thinking);
      assert.deepEqual(after.composition, prior.composition); assert.equal(after.notesReturn, prior.notesReturn);
      report.checks.push(`${name}: workspace text hidden while camp remains visible; close restores workspace; full clue/graph/history, selected evidence, nonempty draft, composition and return mode unchanged.`);
    }
    assert.deepEqual(report.errors, []); assert.deepEqual(report.missing, []); assert.deepEqual(report.blockedRemote, []);
    report.passed = true;
  } else {
  assert.deepEqual((await state()).thinking.placed, ['C02', 'C03']);
  assert.equal(await page.locator('[data-action="language-mode"]').isEnabled(), false);
  assert.equal((await state()).story.collected.includes('C08'), false);
  report.styles.initial = await page.locator('.workspace-screen').evaluate(node => ({ color: getComputedStyle(node).color, background: getComputedStyle(node).backgroundColor, heading: getComputedStyle(node.querySelector('h1')).fontSize, clue: getComputedStyle(node.querySelector('.working-clue-title')).fontSize }));
  assert.equal(report.styles.initial.heading, '28px'); assert.equal(report.styles.initial.clue, '20px');
  await capture('thought-initial');

  // A board is evidence-driven, not a forced three-step wizard. These independent
  // branches must both survive one click without crossing their source sets.
  await place('C06'); await place('C07'); await click('think');
  const parallel = (await state()).thinking.history;
  assert.equal(parallel.length, 1);
  assert.deepEqual(parallel[0].outputs.map(item => item.id).sort(), ['I01', 'I03']);
  assert.deepEqual([...parallel[0].outputs.find(item => item.id === 'I01').used].sort(), ['C02', 'C03']);
  assert.deepEqual([...parallel[0].outputs.find(item => item.id === 'I03').used].sort(), ['C06', 'C07']);
  assert.equal(await page.locator('.thought-outcome').count(), 2);
  assert.equal((await state()).story.flags.Q1_DONE, undefined);
  assert.equal((await state()).story.flags.Q2_DONE, undefined);
  assert.equal((await state()).story.flags.JIANG_AUTH_GRANTED, undefined);
  await checkCurves('multi-branch-I01-I03'); await checkContinuationClearance(); await capture('multi-branch');
  report.checks.push('Evidence-driven alternative: one Think creates independent I01 and I03 from C02/C03 and C06/C07; four branches connect only each output’s own used evidence, with no R01/R02 or authorization manufactured.');
  await page.evaluate(({ key, fixture }) => localStorage.setItem(key, fixture), { key, fixture });
  await page.reload(); await click('continue');
  assert.deepEqual((await state()).thinking.placed, ['C02', 'C03']);
  assert.equal((await state()).thinking.history.length, 0);

  await click('settings'); await page.waitForFunction(() => !document.querySelector('#api-model')?.disabled);
  assert.equal(await page.locator('#api-key').inputValue(), '');
  report.styles.modal = await page.locator('.game-modal').evaluate(node => ({ background: getComputedStyle(node).backgroundColor, image: getComputedStyle(node).backgroundImage, color: getComputedStyle(node).color }));
  const slider = page.locator('[data-volume="music"]'); await slider.evaluate(node => { node.value = '24'; node.dispatchEvent(new Event('input', { bubbles: true })); });
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('wuzhang-audio-v1')).music), 24);
  await capture('settings'); await page.keyboard.press('Escape'); assert.equal(await page.locator('.game-modal').count(), 0);
  await click('save'); await page.locator('[data-store-slot="1"]').click();
  assert.ok(await page.evaluate(key => localStorage.getItem(key + ':slot:1'), key)); await capture('saves'); await click('close-modal');
  await click('records'); assert.ok(await page.locator('.history-content p').count() > 0);
  const actualOriginal = fixtureSession.sourceRow(fixtureSession.snapshot().story.completed[0]).text;
  assert.ok((await page.locator('.dialogue-stream').innerText()).includes(actualOriginal));
  await capture('history'); await click('close-modal');
  report.checks.push('Formal settings use mocked empty credentials; volume persists only in isolated storage; real manual slot and actual completed dialogue history render.');

  await page.locator('[data-read-note="C02"]').first().click(); assert.ok((await page.locator('.thought-detail-content').innerText()).length > 30); await capture('thought-original-source'); await closeInventory();
  await click('think'); assert.equal((await state()).thinking.history.at(-1).outputs[0].id, 'I01');
  assert.equal((await state()).story.flags.Q1_DONE, undefined); await checkCurves('I01'); await capture('thought-I01');
  await place('C05'); await click('think'); assert.equal((await state()).thinking.history.length, 1); assert.match((await state()).thinking.feedback, /不能证明/); await capture('thought-insufficient-evidence');
  await drag('C04'); await click('think'); assert.equal((await state()).thinking.history.at(-1).outputs[0].id, 'R01'); await checkCurves('R01');
  assert.equal((await state()).story.edges.some(edge => edge.includes('C05')), false); await capture('thought-R01');
  const result = page.locator('[data-thought-result="R01"]');
  await result.hover(); await page.waitForFunction(() => document.querySelectorAll('.is-related').length > 0);
  assert.ok(await page.locator('.is-unrelated').count() > 0); await capture('thought-related-sources');
  await page.locator('[data-thought-result="R01"] [data-read-note="R01"],[data-thought-result="R01"][data-read-note="R01"]').first().click();
  assert.ok((await page.locator('.thought-detail-content').innerText()).length > 30); await closeInventory();
  await page.reload(); await click('continue'); assert.equal((await state()).thinking.history.length, 2); assert.equal(await page.locator('.ink-drawing').count(), 0);
  await place('C06'); await place('C07', true); await click('think');
  assert.equal((await state()).thinking.history.at(-1).outputs[0].id, 'R02'); await checkCurves('R02');
  assert.equal((await state()).story.flags.JIANG_AUTH_GRANTED, undefined); assert.equal((await state()).story.collected.includes('C08'), false);
  await page.locator('.thought-action').scrollIntoViewIfNeeded(); await capture('thought-R02-action');
  await click('save'); await page.locator('[data-store-slot="2"]').click(); await click('close-modal');
  const readyEdges = (await state()).story.edges;
  await click('revise-thought'); assert.equal((await state()).story.flags.Q2_DONE, false); assert.equal(await page.locator('.thought-action').count(), 0);
  await page.locator('[data-remove-thought="C07"]').click(); await click('think'); assert.equal((await state()).thinking.history.length, 2);
  await click('save'); await page.locator('[data-load-slot="2"]').click(); assert.deepEqual((await state()).story.edges, readyEdges); assert.equal((await state()).story.flags.JIANG_AUTH_GRANTED, undefined);
  report.checks.push('Initial→I01→R01→R02 via real controls; C05 feedback/no invented edge; pointer and keyboard placement; per-used curves, hover/source inspection, reload, undo and manual load preserve the rule boundary.');
  await page.setViewportSize({ width: 900, height: 1000 }); await openInventory(); await noOverflow('thought 900 drawer'); await capture('thought-tablet'); await closeInventory(); await page.setViewportSize({ width: 1600, height: 1000 });
  await click('follow-plan'); assert.equal((await state()).story.flags.JIANG_AUTH_GRANTED, undefined);
  await readDialogue(); assert.equal((await state()).story.flags.JIANG_AUTH_GRANTED, true); assert.equal((await state()).story.flags.COMPANION_PRESENT, true); assert.ok((await state()).story.collected.includes('C08'));
  if ((await state()).scene !== 'report_post') await page.locator('[data-move="report_post"]').click();
  await page.locator('[data-scene-action="intercept-weiyan"]').click(); await readDialogue(); assert.equal((await state()).phase, 'expression');
  await place('R01'); await place('C08'); await click('suggestion'); const reference = await page.locator('#player-expression').inputValue(); assert.ok(reference);
  await capture('expression-reference');
  await click('reasoning-mode'); assert.equal(await page.locator('.thought-record').count(), 3); await checkCurves('expression-return-to-reasoning');
  await click('language-mode'); assert.equal(await page.locator('#player-expression').inputValue(), reference); assert.deepEqual((await state()).story.selected, ['R01', 'C08']);
  const words = '将军，敌军今晚可能在试探。伯约已答应接报，请随我到帐外当面说清，不必惊扰丞相。';
  const beforeRequests = { ...report.requests }; await page.locator('#expression-focus').fill(words); await page.waitForTimeout(250);
  assert.deepEqual(report.requests, beforeRequests); assert.equal(await page.locator('[data-action="speak"]').isEnabled(), false);
  await click('generate-expression'); await waitState(s => s.composition.status === 'ready');
  assert.equal(await page.locator('#player-expression').inputValue(), polished); assert.equal(await page.locator('#expression-focus').inputValue(), words);
  assert.equal((await state()).phase, 'expression'); assert.equal((await state()).story.flags.PERSUADED, undefined);
  assert.equal(report.requests.generation - beforeRequests.generation, 1); assert.equal(report.requests.grounding - beforeRequests.grounding, 1);
  assert.ok(await page.locator('.expression-layout .reasoning-curve').count() >= 1); await capture('expression-polished');
  mockMode = 'delay'; await page.locator('#expression-focus').fill(words + '请先听我说。'); await click('generate-expression'); await waitState(s => s.composition.status === 'waiting');
  await click('reasoning-mode'); await click('language-mode'); mockMode = 'success'; await page.waitForTimeout(900);
  assert.notEqual(await page.locator('#player-expression').inputValue(), '这段迟到的测试结果不得覆盖新输入。'); assert.deepEqual((await state()).story.selected, ['R01', 'C08']);
  mockMode = 'fail'; await click('generate-expression'); await waitState(s => s.composition.status === 'failed');
  assert.equal((await state()).story.flags.JIANG_AUTH_GRANTED, true); assert.ok((await page.locator('#expression-focus').inputValue()).includes(words)); await capture('expression-retry');
  mockMode = 'success'; await click('generate-expression'); await waitState(s => s.composition.status === 'ready');
  await page.locator('#player-expression').fill(polished + '我陪您前往。'); assert.equal(await page.locator('[data-action="speak"]').isEnabled(), true);
  for (const width of [900, 768]) { await page.setViewportSize({ width, height: 1000 }); await noOverflow(`expression ${width}`); await capture(`expression-${width}`); }
  await page.setViewportSize({ width: 1600, height: 1000 }); await click('speak'); await waitState(s => s.speech?.status === 'ready');
  assert.equal((await state()).phase, 'spoken'); assert.equal((await state()).story.flags.PERSUADED, undefined); await capture('expression-explicit-speech');
  await click('reply'); assert.equal((await state()).story.flags.PERSUADED, true);
  report.checks.push('Authorization is earned only through actual Jiang dialogue. Expression/notes retain evidence and draft; mocked generation+grounding never auto-speak, late/cancelled/failing generation preserves facts, explicit editable speech and reply advance cooperation.');
  const other = await context.newPage(); await other.goto(base + '/chapter-one.html'); await other.locator('.game-menu').waitFor(); await assertTheme(other); await other.close();
  assert.deepEqual(report.errors, []); assert.deepEqual(report.missing, []); assert.deepEqual(report.blockedRemote, []);
  report.checks.push('Both formal entry HTML files enable xuan; desktop/tablet screenshots use real page controls with no preview replacement and no remote calls.');
  report.passed = true;
  }
} catch (error) {
  report.failure = error.stack || String(error); process.exitCode = 1;
  if (page) { try { await page.screenshot({ path: resolve(output, 'failure.png') }); } catch {} }
} finally {
  if (context) await context.close(); if (browser) await browser.close();
  server.closeAllConnections(); await new Promise(ok => server.close(ok));
  let finalReport = report;
  if (modalsOnly) {
    const previous = JSON.parse(readFileSync(resolve(output, 'checks.json'), 'utf8'));
    finalReport = { ...previous, passed: previous.passed && report.passed, checks: [...previous.checks, ...report.checks], captures: [...new Set([...previous.captures, ...report.captures])], modalRefresh: report };
  }
  writeFileSync(resolve(output, 'checks.json'), JSON.stringify(finalReport, null, 2) + '\n');
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks, screenshots: report.captures.length, output, failure: report.failure }));
}
