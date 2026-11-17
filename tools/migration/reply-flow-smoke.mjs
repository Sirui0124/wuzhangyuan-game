import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const typingOnly = process.argv.includes('--typing-only');
const buildRoot = resolve(root, process.argv.slice(2).find(arg => !arg.startsWith('--')) ?? 'GameStarter/web-demo/.build');
const output = resolve(root, 'docs/design/review-20261022/reply-flow');
mkdirSync(output, { recursive: true });
const { ChapterSession } = await import(pathToFileURL(resolve(buildRoot, 'GameStarter/web-demo/src/chapter-session.js')));
const json = name => JSON.parse(readFileSync(resolve(buildRoot, 'story', name), 'utf8'));
const content = json('chapter-one.script.json'), flow = json('chapter-one.flow.json'), manifest = json('session-manifest.json');
const newSession = () => new ChapterSession(content, flow, manifest.contentVersion);
const drain = session => { let count = 0; while (session.snapshot().phase === 'dialogue' && count++ < 200) session.nextLine(); assert.ok(count < 200); };
const act = (session, id) => { const action = flow.actions.find(item => item.id === id); if (session.snapshot().scene !== action.scene) assert.ok(session.move(action.scene)); assert.ok(session.act(id)); drain(session); };
const first = () => {
  const session = newSession(); session.finishCinematic(); drain(session);
  act(session, 'read-notice'); act(session, 'meet-first-scout'); session.chooseScout('a'); drain(session); act(session, 'intercept-first');
  assert.equal(session.snapshot().phase, 'expression'); return session;
};
const p1 = first();
const p2 = first();
p2.setFocus('我来转呈信息'); p2.setDraft('将军，敌军尚未攻营，还不必强闯。帐内确实不许进入，我现在替您转呈，绝不耽误军情。'); await p2.confirmExpression(); p2.acknowledgeReply(); drain(p2);
act(p2, 'deliver-first'); act(p2, 'stand-watch'); p2.finishCinematic(); drain(p2); p2.rewind(); drain(p2);
for (const id of ['ask-guard', 'ask-relay', 'ask-scout']) act(p2, id);
assert.ok(p2.beginThinking());
p2.think(); p2.placeThought('C04'); p2.think(); p2.placeThought('C06'); p2.placeThought('C07'); p2.think();
assert.ok(p2.followPlan()); drain(p2); act(p2, 'intercept-weiyan');
assert.equal(p2.snapshot().phase, 'expression'); assert.equal(p2.snapshot().story.flags.JIANG_AUTH_GRANTED, true);
const report = { passed: false, contentVersion: manifest.contentVersion, isolated: true, realAPI: false, checks: [], screenshots: [], mockRequests: 0, errors: [], missing: [], unexpectedRequests: [] };
const server = createStaticServer({ root: buildRoot }); await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;
const key = 'wuzhang-chapter-session-v1';
let browser, context, page, mode = 'fail';
try {
  browser = await chromium.launch({ headless: true, channel: 'chrome' });
  context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  await context.addInitScript(() => { if (localStorage.getItem('wuzhang-reduced-motion') === null) localStorage.setItem('wuzhang-reduced-motion', '1'); });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    const headers = { 'Access-Control-Allow-Origin': base, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
    if (url.pathname.startsWith('/api/')) {
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      if (url.pathname === '/api/game/settings') return route.fulfill({ status: 200, headers, contentType: 'application/json', body: '{"apiKey":"","baseUrl":"https://example.invalid/v1","model":"isolated-reply-test"}' });
      if (url.pathname === '/api/game/respond') {
        report.mockRequests++;
        if (mode === 'fail') return route.fulfill({ status: 503, headers, contentType: 'application/json', body: '{"error":"isolated service failure"}' });
        if (mode === 'delay') await new Promise(ok => setTimeout(ok, 700));
        try { await route.fulfill({ status: 200, headers, contentType: 'application/json', body: '{"text":"{\\"result\\":\\"ok\\"}"}' }); } catch { /* Deliberately cancelled browser request. */ }
        return;
      }
    }
    if (url.origin === base && !url.pathname.startsWith('/api/')) return route.continue();
    if (['data:', 'blob:'].includes(url.protocol)) return route.continue();
    report.unexpectedRequests.push(url.origin + url.pathname); return route.abort();
  });
  page = await context.newPage(); page.setDefaultTimeout(15000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('response', response => { if (response.status() === 404) report.missing.push(new URL(response.url()).pathname); });
  const state = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
  const click = async action => {
    const current = await state();
    const sceneAction = (action === 'next' && current?.phase === 'dialogue') || (action === 'revise' && current?.phase === 'reply') || (action === 'reply' && current?.phase === 'spoken');
    if (sceneAction) {
      if (action === 'reply') await page.waitForFunction(() => { const current = JSON.parse(localStorage.getItem('wuzhang-chapter-session-v1')); return current?.phase === 'spoken' && current.speech?.status === 'ready'; });
      return page.locator('.game-scene').click({ position: { x: 24, y: (page.viewportSize()?.height ?? 600) * .4 } });
    }
    return page.locator(`[data-action="${action}"]`).first().click();
  };
  const load = async session => {
    await page.goto(base); await page.locator('.game-menu').waitFor();
    await page.evaluate(({ key, data }) => localStorage.setItem(key, data), { key, data: session.serialize() });
    await page.reload(); await click('continue');
  };
  const capture = async name => {
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].filter(img => img.getClientRects().length).map(img => img.decode().catch(() => {}))); });
    const file = `ui-${name}.png`; await page.screenshot({ path: resolve(output, file) }); report.screenshots.push(file);
  };
  const preserved = (current, previous) => {
    assert.equal(current.story.draft, previous.story.draft);
    assert.equal(current.composition.focus, previous.composition.focus);
    assert.deepEqual(current.story.selected, previous.story.selected);
    assert.deepEqual(current.story.edges, previous.story.edges);
    assert.deepEqual(current.story.collected, previous.story.collected);
  };
  const assertReply = async (source, id) => {
    assert.equal((await state()).phase, 'reply');
    assert.equal(await page.locator('.workspace-screen').count(), 0, 'Refusal must not automatically return to the thought workspace');
    assert.equal(await page.locator('.previous-reply').count(), 0, 'Old corner feedback must be removed');
    assert.ok(await page.locator('.portrait-stage [data-character="weiyan"]').isVisible());
    const text = page.locator('.game-scene .dialogue-text'); await text.waitFor();
    assert.equal((await text.innerText()).trim(), source.sourceRow(id).text.trim());
    assert.match(await page.locator('.dialogue-speaker').innerText(), /魏延/);
    assert.equal(await page.locator('.dialogue-advance').evaluate(node => node.tagName), 'SECTION');
    assert.equal(await page.locator('.dialogue-advance button,[data-action="revise"]').count(), 0);
    assert.equal(await page.locator('[data-action="speak"]').count(), 0);
  };
  const keyboardRevise = async () => { await page.locator('.dialogue-advance').focus(); await page.keyboard.press('Enter'); assert.equal((await state()).phase, 'expression'); };
  const place = async id => {
    if (!await page.locator('#thought-inventory').count()) await page.locator('.inventory-tab').click();
    const row = page.locator(`[data-inventory-item="${id}"]`);
    if (await row.getAttribute('aria-expanded') !== 'true') await row.click();
    await page.locator(`[data-place-evidence="${id}"]`).click(); await page.locator('.inventory-tab').click();
  };
  const noOldFeedback = async text => {
    assert.equal(await page.locator('.previous-reply').count(), 0);
    assert.equal((await page.locator('.game-scene').innerText()).includes(text), false);
  };

  if (!typingOnly) {
  await load(p1); await page.locator('#expression-focus').fill('请先听我说'); await click('suggestion');
  const firstInput = await state(); await capture('p1-expression'); await click('speak'); assert.equal((await state()).phase, 'spoken');
  const firstSpeech = (await state()).speech.text; await capture('p1-player-speech'); await click('reply');
  await assertReply(p1, 'A-40'); preserved(await state(), firstInput); assert.equal((await state()).speech.text, firstSpeech);
  await page.waitForTimeout(400); await assertReply(p1, 'A-40'); await capture('p1-weiyan-refusal');
  const firstReply = await state();
  assert.equal(firstReply.story.history.length, firstInput.story.history.length + 1); assert.equal(firstReply.story.flags.FIRST_TRANSFER_ACCEPTED, undefined);
  await click('notes'); assert.equal((await state()).notesReturn, 'reply'); await click('close-notes'); await assertReply(p1, 'A-40');
  assert.deepEqual((await state()).story.history, firstReply.story.history);
  await click('save'); await page.locator('[data-store-slot="1"]').click(); await click('close-modal');
  await page.reload(); await click('continue'); await click('save'); await page.locator('[data-load-slot="1"]').click(); await assertReply(p1, 'A-40');
  assert.deepEqual((await state()).story.history, firstReply.story.history); preserved(await state(), firstReply); await capture('p1-reply-reloaded');
  await keyboardRevise(); preserved(await state(), firstReply); await capture('p1-explicit-revision');
  await click('transfer-focus'); await click('suggestion'); await click('speak');
  assert.equal((await state()).phase, 'spoken'); await noOldFeedback(p1.sourceRow('A-40').text); await capture('p1-second-player-speech');
  await click('reply'); assert.equal((await state()).phase, 'dialogue'); await noOldFeedback(p1.sourceRow('A-40').text); await capture('p1-success-npc-dialogue');
  assert.equal((await state()).story.flags.FIRST_TRANSFER_ACCEPTED, undefined);
  report.checks.push('P1 exact reference refusal stays on Wei Yan dialogue; explicit keyboard revision retains original draft/focus/evidence. Notes and manual save/reload return to reply without duplicate history. Second speech has no stale corner feedback; successful reply follows real NPC dialogue.');

  await load(p2); await place('C08'); await page.locator('#expression-focus').fill('请将军听我说明'); await click('suggestion'); const secondInput = await state();
  await click('speak'); assert.equal((await state()).speech.result, 'P2-F4'); await click('reply'); await assertReply(p2, 'P2-F4');
  preserved(await state(), secondInput); assert.equal((await state()).story.flags.JIANG_AUTH_GRANTED, true); assert.equal((await state()).story.flags.COMPANION_PRESENT, true); await capture('p2-insufficient-reply');
  const secondReply = await state();
  await click('save'); await page.locator('[data-store-slot="2"]').click(); await click('close-modal');
  await page.reload(); await click('continue'); await click('save'); await page.locator('[data-load-slot="2"]').click(); await assertReply(p2, 'P2-F4');
  assert.deepEqual((await state()).story.history, secondReply.story.history); assert.equal((await state()).story.flags.JIANG_AUTH_GRANTED, true);
  await page.setViewportSize({ width: 900, height: 1000 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  const bounds = await page.locator('.dialogue-box').boundingBox(); assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 900 && bounds.y >= 0 && bounds.y + bounds.height <= 1000);
  await capture('p2-reply-tablet'); await page.setViewportSize({ width: 1600, height: 1000 }); await keyboardRevise(); preserved(await state(), secondReply);
  await place('R01'); await page.locator('#player-expression').fill('请先听我把军情说清楚。'); const historyBeforeService = (await state()).story.history;
  mode = 'fail'; await click('speak'); await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).speech?.status === 'failed', key);
  assert.equal((await state()).phase, 'spoken'); assert.equal(await page.locator('[data-action="reply"]').count(), 0); await noOldFeedback(p2.sourceRow('P2-F4').text);
  assert.deepEqual((await state()).story.history, historyBeforeService); assert.equal((await state()).story.flags.JIANG_AUTH_GRANTED, true); await capture('service-failure-not-npc-refusal'); await click('revise');
  mode = 'delay'; await click('speak'); await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).speech?.status === 'waiting', key); await click('cancel-speech'); await page.waitForTimeout(850);
  assert.equal((await state()).phase, 'spoken'); assert.equal((await state()).speech.status, 'cancelled'); assert.equal((await state()).story.flags.PERSUADED, undefined); assert.deepEqual((await state()).story.history, historyBeforeService); await noOldFeedback(p2.sourceRow('P2-F4').text);
  await capture('service-cancel-not-npc-refusal'); await click('revise');
  await click('suggestion'); await click('speak'); assert.equal((await state()).phase, 'spoken'); assert.equal((await state()).speech.result, 'ok'); await noOldFeedback(p2.sourceRow('P2-F4').text); await capture('p2-repaired-player-speech');
  await click('reply'); assert.equal((await state()).phase, 'dialogue'); assert.equal((await state()).story.flags.PERSUADED, true); assert.equal((await state()).story.flags.FORMAL_REPORT_RECEIVED, undefined); assert.equal((await state()).story.flags.REPORT_CLOSED, undefined);
  await noOldFeedback(p2.sourceRow('P2-F4').text); await capture('p2-success-npc-dialogue');
  report.checks.push('P2 partial evidence gives actual P2-F4 dialogue without revoking earned authorization. Reply reload and tablet layout remain valid. Mock service failure/cancellation stay recoverable technical states; adding evidence and confirming success returns to real cooperation dialogue without premature report completion.');
  }
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(base); await page.evaluate(() => localStorage.setItem('wuzhang-reduced-motion', '0'));
  await load(p1); await click('suggestion'); await click('speak'); await click('reply');
  assert.equal((await state()).phase, 'reply');
  const fullReply = p1.sourceRow('A-40').text;
  const partial = await page.locator('.game-scene .dialogue-text').innerText();
  assert.ok(partial.length < fullReply.length, 'Normal motion should initially reveal the reply progressively');
  await page.locator('.dialogue-advance').focus(); await page.keyboard.press('Enter');
  assert.equal((await state()).phase, 'reply', 'First keyboard activation reveals the full line, not the editor');
  assert.equal((await page.locator('.game-scene .dialogue-text').innerText()).trim(), fullReply.trim());
  await capture('p1-typing-first-activation'); await page.keyboard.press('Enter');
  assert.equal((await state()).phase, 'expression');
  report.checks.push('Normal-motion keyboard: first activation reveals the complete refusal and remains in reply; second explicit activation opens editing.');
  assert.deepEqual(report.errors, []); assert.deepEqual(report.missing, []); assert.deepEqual(report.unexpectedRequests, []);
  report.passed = true;
} catch (error) {
  report.failure = error.stack || String(error); process.exitCode = 1;
  if (page) { try { await page.screenshot({ path: resolve(output, 'ui-smoke-failure.png') }); } catch {} }
} finally {
  if (context) await context.close(); if (browser) await browser.close(); server.closeAllConnections(); await new Promise(ok => server.close(ok));
  let finalReport = report;
  if (typingOnly) {
    const previous = JSON.parse(readFileSync(resolve(output, 'ui-smoke-checks.json'), 'utf8'));
    finalReport = { ...previous, passed: previous.passed && report.passed, checks: [...previous.checks, ...report.checks], screenshots: [...new Set([...previous.screenshots, ...report.screenshots])], typingRefresh: report };
  }
  writeFileSync(resolve(output, 'ui-smoke-checks.json'), JSON.stringify(finalReport, null, 2) + '\n');
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks, screenshots: report.screenshots.length, report: 'docs/design/review-20261022/reply-flow/ui-smoke-checks.json', failure: report.failure }));
}
