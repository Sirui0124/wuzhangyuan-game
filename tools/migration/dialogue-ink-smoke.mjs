import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';
import { dialogueFixtures } from '../ai/dialogue-fixtures.mjs';
import { npcTurn } from '../../GameStarter/tests/npc-fixture.mjs';

const build = resolve(process.argv[2] ?? 'GameStarter/web-demo/.build');
const output = resolve(process.argv[3] ?? 'outputs/dialogue-ink-20261023');
const layoutOnly = process.argv.includes('--layout-only');
mkdirSync(output, { recursive: true });
const f = await dialogueFixtures(build), key = 'wuzhang-chapter-session-v1';
const start = new f.ChapterSession(f.content, f.flow, f.version);
start.finishCinematic(); f.read(start); f.act(start, 'read-notice'); f.act(start, 'meet-first-scout');
assert.equal(start.snapshot().phase, 'choice'); const choice = start.serialize();
start.chooseScout('a'); f.read(start); assert.ok(start.act('intercept-first'));
for (let n = 0; !start.row()?.speaker.startsWith('魏延') && n < 30; n++) assert.ok(start.nextLine());
assert.ok(start.row()?.speaker.startsWith('魏延')); const ordinary = start.serialize();
const p1 = f.first(), p2 = await f.authorized();
assert.ok(p2.snapshot().story.flags.JIANG_AUTH_GRANTED);
const p1Expression = p1.serialize(), p2Expression = p2.serialize();

// A schema-valid generated NPC turn travels through the real session API. This
// text is a length stress fixture, not a new authored story row or a test of AI quality.
const longNpcText = '军情不能耽搁。你既愿即刻转呈，就把眼前所知说明白；不明之处仍须问准，不可把推想当成事实。'.repeat(5);
assert.ok(longNpcText.length <= 300);
const longNpc = f.first(async input => npcTurn(input, 'ok', longNpcText));
longNpc.setDraft('我即刻替将军转呈军情。'); await longNpc.confirmExpression(); longNpc.acknowledgeReply();
for (let n = 0; longNpc.row()?.id !== 'A-40B' && n < 30; n++) assert.ok(longNpc.nextLine());
assert.equal(longNpc.row().text, longNpcText); const longDialogue = longNpc.serialize();
const longPlayerText = '禀将军，眼前军情不能耽搁。我愿即刻转呈已经听到的消息，把亲眼所见与尚待判断的部分分别说清。帐前的禁令仍须遵守，不明之处也请当面问准。'.repeat(10);
const ownFocus = '请先听我把已经知道的军情说明白，我愿立即转呈，未明之事仍须问准。';

const server = createStaticServer({ root: build }); await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, channel: process.env.SMOKE_BROWSER_CHANNEL ?? 'chrome' });
const report = { passed: false, layoutOnly, isolated: true, realAPI: false, checks: [], viewports: [], screenshots: [], errors: [], missing: [], unexpectedRequests: [], mockRequests: 0 };
let activePage, activeName = '';
const overlaps = (a, b) => Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 1 && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 1;

try {
  for (const [width, height] of [[1280, 720], [1366, 768], [1440, 900]]) {
    const name = `${width}x${height}`; activeName = name;
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', serviceWorkers: 'block' });
    await context.addInitScript(() => { if (localStorage.getItem('wuzhang-reduced-motion') === null) localStorage.setItem('wuzhang-reduced-motion', '1'); });
    let mode = 'fail'; const pending = [];
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      const headers = { 'Access-Control-Allow-Origin': base, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
      if (url.pathname.startsWith('/api/')) {
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        if (url.pathname === '/api/game/settings') return route.fulfill({ status: 200, headers, contentType: 'application/json', body: '{"apiKey":"","baseUrl":"https://example.invalid/v1","model":"isolated-ui-test"}' });
        if (url.pathname === '/api/game/respond') {
          report.mockRequests++;
          if (mode === 'hold') { pending.push(route); return; }
          return route.fulfill({ status: 503, headers, contentType: 'application/json', body: '{"error":"isolated UI service failure"}' });
        }
      }
      if (url.origin === base || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
      report.unexpectedRequests.push(url.origin + url.pathname); return route.abort();
    });
    const releasePending = async () => { for (const route of pending.splice(0)) { try { await route.abort(); } catch { /* Requests may already be cancelled by the player action. */ } } };
    const page = await context.newPage(); activePage = page; page.setDefaultTimeout(15000);
    page.on('pageerror', error => report.errors.push({ name, message: error.message }));
    page.on('response', response => { if (response.status() === 404) report.missing.push(response.url()); });
    const state = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
    const click = action => page.locator(`[data-action="${action}"]:visible`).first().click();
    const load = async fixture => {
      await releasePending(); await page.goto(base); await page.locator('.game-menu').waitFor();
      await page.evaluate(({ key, fixture }) => localStorage.setItem(key, fixture), { key, fixture });
      await page.reload(); await click('continue');
      await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].filter(image => image.getClientRects().length).map(image => image.decode().catch(() => {}))); });
    };
    const capture = async label => { const file = `${name}-${label}.png`; await page.screenshot({ path: resolve(output, file) }); report.screenshots.push(file); };
    const visible = async locator => {
      await locator.scrollIntoViewIfNeeded(); const r = await locator.boundingBox();
      assert.ok(r && r.width > 0 && r.height > 0 && r.x >= -1 && r.y >= -1 && r.x + r.width <= width + 1 && r.y + r.height <= height + 1, `Control is on screen: ${await locator.getAttribute('data-action')}`);
      assert.ok(await locator.evaluate(node => { const r = node.getBoundingClientRect(), at = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2), control = node.closest('button') ?? node; return control === at || control.contains(at); }), 'Control is not covered by another panel');
    };
    const faceSafety = async () => {
      const images = page.locator('.portrait-stage .character-art,.weiyan-presence .character-art');
      const faces = await images.evaluateAll(nodes => nodes.filter(image => image.naturalWidth && image.getClientRects().length).map(image => {
        const r = image.getBoundingClientRect(), style = getComputedStyle(image), scale = style.objectFit === 'cover' ? Math.max(r.width / image.naturalWidth, r.height / image.naturalHeight) : Math.min(r.width / image.naturalWidth, r.height / image.naturalHeight);
        const drawnWidth = image.naturalWidth * scale, drawnHeight = image.naturalHeight * scale;
        // Authored safe area: central 35–65% horizontally and upper 8–30% of
        // the actual artwork, accounting for the approved cover/centre/top crop.
        const verticalPosition = style.objectPosition.split(' ')[1];
        const drawnTop = verticalPosition === '0%' ? r.y : r.bottom - drawnHeight;
        return { character: image.dataset.character, fit: style.objectFit, x: r.x + (r.width - drawnWidth) / 2 + drawnWidth * .35, y: drawnTop + drawnHeight * .08, width: drawnWidth * .3, height: drawnHeight * .22 };
      }));
      const panels = await page.locator('.dialogue-box,.expression-input-block,.expression-result,.expression-current-reply,#thought-inventory,.thought-detail-popover').evaluateAll(nodes => nodes.filter(node => node.getClientRects().length).map(node => {
        const r = node.getBoundingClientRect(); return { className: node.className, x: r.x, y: r.y, width: r.width, height: r.height };
      }));
      for (const face of faces) {
        assert.ok(['contain', 'cover'].includes(face.fit), 'Portrait art uses predictable crop placement');
        assert.ok(face.y >= 0 && face.y + face.height <= height, 'The face stays inside the viewport');
        for (const panel of panels) assert.ok(!overlaps(face, panel), `Reading panel must not cover ${face.character}'s face: ${JSON.stringify({ face, panel })}`);
      }
      return faces;
    };
    const font = async (selector, expected) => {
      const node = page.locator(selector).first();
      const style = await node.evaluate(node => ({ size: getComputedStyle(node).fontSize, family: getComputedStyle(node).fontFamily }));
      assert.equal(style.size, `${expected}px`, `${selector} has the approved text size`); assert.match(style.family, /Kai|楷/i);
      return style;
    };
    const preserved = (after, before) => { assert.equal(after.story.draft, before.story.draft); assert.equal(after.composition.focus, before.composition.focus); assert.deepEqual(after.story.selected, before.story.selected); assert.deepEqual(after.story.collected, before.story.collected); assert.deepEqual(after.story.edges, before.story.edges); };
    const evidence = async id => {
      if (!await page.locator('#thought-inventory').count()) await click('open-inventory');
      await visible(page.locator('[data-inventory-search]')); await faceSafety();
      await page.locator('[data-inventory-search]').fill('');
      await page.locator(`[data-place-evidence="${id}"]`).click();
      await page.keyboard.press('Escape');
    };
    const viewportResult = { width, height, faces: [], fonts: {}, longScroll: {}, apiRetries: 0 };

    if (layoutOnly) {
      await load(ordinary); viewportResult.fonts.dialogue = await font('#spoken-line', 18); viewportResult.faces.push(...await faceSafety());
      await visible(page.locator('.dialogue-cue')); await capture('01-dialogue');
      await load(p2Expression); for (const id of ['R01', 'C08']) await evidence(id); await click('suggestion');
      await visible(page.locator('[data-action=speak]')); viewportResult.fonts.draft = await font('#player-expression', 18);
      viewportResult.fonts.previousReply = await page.locator('.expression-current-reply p').evaluate(node => ({ size: getComputedStyle(node).fontSize, family: getComputedStyle(node).fontFamily }));
      assert.equal(viewportResult.fonts.previousReply.size, '14px', 'Previous reply uses the approved auxiliary text scale');
      assert.match(viewportResult.fonts.previousReply.family, /Kai|楷/i); viewportResult.faces.push(...await faceSafety());
      const modesBefore = await page.locator('.workspace-modes').boundingBox(); await capture('02-expression');
      await click('open-inventory'); const search = page.locator('[data-inventory-search]'); await visible(search); await search.fill('可能试探');
      await page.locator('[data-inventory-item=R01]').click();
      const list = await page.locator('#thought-inventory').boundingBox(), detail = await page.locator('.thought-detail-popover').boundingBox(), focus = await page.locator('#expression-focus').boundingBox();
      const modesAfter = await page.locator('.workspace-modes').boundingBox();
      assert.ok(Math.abs(modesBefore.x - modesAfter.x) < 1 && Math.abs(modesBefore.y - modesAfter.y) < 1, 'Workspace modes do not jump when sources open');
      assert.ok(list && detail && focus && detail.x >= list.x + list.width + 4 && Math.abs(detail.y - list.y) <= 2, 'Source details stay right-aligned at the same top edge');
      assert.ok(!overlaps(list, detail) && !overlaps(list, focus) && !overlaps(detail, focus), 'Source panels do not cover writing controls');
      assert.ok(detail.x + detail.width <= width + 1 && detail.y >= 0 && detail.y + detail.height <= height + 1);
      viewportResult.inspection = { list, detail, focus, modesBefore, modesAfter }; viewportResult.faces.push(...await faceSafety()); await capture('03-expression-search');
      await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await visible(page.locator('[data-action=speak]'));
      assert.equal(await page.locator('#thought-inventory').count(), 0); assert.equal(await page.locator('.thought-detail-popover').count(), 0); assert.equal(await page.evaluate(() => window.scrollY), 0);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      report.viewports.push(viewportResult); await context.close(); activePage = null; continue;
    }

    await load(ordinary); assert.equal((await state()).phase, 'dialogue');
    assert.equal(await page.locator('.dialogue-advance').evaluate(node => node.tagName), 'BUTTON'); assert.equal(await page.locator('.dialogue-advance button').count(), 0);
    await visible(page.locator('.dialogue-advance')); await visible(page.locator('.dialogue-cue'));
    viewportResult.fonts.dialogue = await font('#spoken-line', 18); viewportResult.fonts.cue = await font('.dialogue-cue', 16); viewportResult.fonts.auxiliary = await font('.dialogue-key-hint', 14);
    const fontClient = await context.newCDPSession(page); await fontClient.send('DOM.enable'); await fontClient.send('CSS.enable');
    const fontDoc = await fontClient.send('DOM.getDocument'), textNode = await fontClient.send('DOM.querySelector', { nodeId: fontDoc.root.nodeId, selector: '#spoken-line' });
    viewportResult.actualFont = await fontClient.send('CSS.getPlatformFontsForNode', { nodeId: textNode.nodeId }); assert.ok(viewportResult.actualFont.fonts.some(font => /Kai|楷/i.test(font.familyName)));
    viewportResult.faces.push(...await faceSafety()); await capture('01-dialogue');
    const beforeNext = (await state()).story.current; await page.locator('.dialogue-advance').focus(); await page.keyboard.press('Enter'); assert.notEqual((await state()).story.current, beforeNext);
    for (const action of ['notes', 'records', 'save', 'settings', 'menu']) await visible(page.locator(`.game-hud [data-action="${action}"]`));

    for (const branch of ['a', 'b']) {
      await load(choice); assert.equal((await state()).phase, 'choice'); assert.ok(await page.locator('.portrait-stage [data-character=scout]').isVisible());
      for (const option of ['a', 'b']) await visible(page.locator(`[data-scout-choice="${option}"]`));
      await font('[data-scout-choice=a]', 18); viewportResult.faces.push(...await faceSafety()); await capture(`02-choice-${branch}`);
      await page.locator(`[data-scout-choice="${branch}"]`).focus(); await page.keyboard.press('Enter'); assert.equal((await state()).phase, 'dialogue');
    }

    await load(longDialogue); assert.equal((await state()).story.current, 'A-40B'); assert.equal((await page.locator('#spoken-line').innerText()).trim(), longNpcText);
    const reading = page.locator('.dialogue-reading'); viewportResult.longScroll.dialogue = await reading.evaluate(node => ({ height: node.clientHeight, total: node.scrollHeight }));
    assert.ok(viewportResult.longScroll.dialogue.total > viewportResult.longScroll.dialogue.height, 'Long NPC dialogue scrolls inside its reading area');
    await reading.evaluate(node => node.scrollTop = node.scrollHeight); assert.ok(await reading.evaluate(node => node.scrollTop > 0));
    assert.equal((await state()).story.current, 'A-40B'); await visible(page.locator('.dialogue-cue')); viewportResult.faces.push(...await faceSafety()); await capture('03-long-dialogue');

    await load(p1Expression); assert.equal((await state()).phase, 'expression');
    viewportResult.fonts.input = await font('#expression-focus', 18); viewportResult.fonts.draft = await font('#player-expression', 18);
    await page.locator('#expression-focus').fill(ownFocus); await page.locator('#player-expression').fill(longPlayerText);
    const manual = await state(); mode = 'hold'; await visible(page.locator('[data-action=generate-expression]')); await click('generate-expression');
    await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).composition.status === 'waiting', key);
    assert.equal((await state()).phase, 'expression'); await visible(page.locator('[data-action=cancel-generation]')); await capture('04-polish-waiting');
    await click('cancel-generation'); await releasePending(); assert.equal((await state()).composition.status, 'cancelled');
    assert.equal((await page.locator('#expression-focus').inputValue()), ownFocus); assert.equal(await page.locator('#player-expression').inputValue(), longPlayerText);
    await page.locator('#player-expression').fill(longPlayerText); await visible(page.locator('[data-action=speak]')); viewportResult.faces.push(...await faceSafety()); await capture('05-long-expression');
    await click('speak'); await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).speech?.status === 'waiting', key);
    assert.equal((await state()).phase, 'spoken'); assert.equal((await page.locator('.said-text').innerText()).trim(), longPlayerText);
    await font('.said-text', 18); await visible(page.locator('[data-action=cancel-speech]')); viewportResult.faces.push(...await faceSafety());
    viewportResult.longScroll.player = await page.locator('.said-text').evaluate(node => ({ height: node.clientHeight, total: node.scrollHeight }));
    assert.ok(viewportResult.longScroll.player.total > viewportResult.longScroll.player.height);
    await page.locator('.said-text').evaluate(node => node.scrollTop = node.scrollHeight); assert.ok(await page.locator('.said-text').evaluate(node => node.scrollTop > 0)); await capture('06-spoken-waiting');
    await click('cancel-speech'); await releasePending(); assert.equal((await state()).speech.status, 'cancelled');
    for (const action of ['retry-speech', 'revise']) await visible(page.locator(`[data-action=${action}]`));
    mode = 'fail'; const requestsBeforeRetry = report.mockRequests;
    for (let attempt = 0; attempt < 2; attempt++) {
      await click('retry-speech'); await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).speech?.status === 'failed', key);
      assert.equal((await state()).speech.result, undefined); assert.equal((await state()).story.flags.PERSUADED, undefined);
    }
    viewportResult.apiRetries = report.mockRequests - requestsBeforeRetry; assert.equal(viewportResult.apiRetries, 2);
    await capture('07-service-failed'); await page.locator('[data-action=revise]').focus(); await page.keyboard.press('Enter');
    assert.equal((await state()).phase, 'expression'); preserved(await state(), manual); assert.equal(await page.locator('#player-expression').inputValue(), longPlayerText);

    await load(p1Expression); await page.locator('#expression-focus').fill('请先听我说明'); await click('suggestion'); const referenceInput = await state();
    const beforeReferenceRequests = report.mockRequests; await click('speak'); assert.equal((await state()).speech.status, 'ready'); assert.equal(report.mockRequests, beforeReferenceRequests);
    await visible(page.locator('[data-action=reply]')); await capture('08-spoken-ready'); await click('reply');
    assert.equal((await state()).phase, 'reply'); assert.equal((await page.locator('#spoken-line').innerText()).trim(), f.content.rows.find(row => row.id === 'A-40').text.trim());
    assert.equal(await page.locator('.workspace-screen').count(), 0); assert.equal(await page.locator('.previous-reply').count(), 0); preserved(await state(), referenceInput);
    await visible(page.locator('[data-action=revise]')); viewportResult.faces.push(...await faceSafety()); await capture('09-refusal');
    await page.locator('[data-action=revise]').focus(); await page.keyboard.press('Enter'); assert.equal((await state()).phase, 'expression'); preserved(await state(), referenceInput);
    await click('transfer-focus'); await click('suggestion'); await click('speak'); assert.equal((await state()).speech.result, 'ok'); await click('reply');
    assert.equal((await state()).phase, 'dialogue'); assert.equal((await state()).story.flags.FIRST_TRANSFER_ACCEPTED, undefined); await capture('10-p1-success');

    await load(p2Expression);
    const beforeInspect = await state(); await click('open-inventory');
    const search = page.locator('[data-inventory-search]'); await visible(search); await search.fill('可能试探');
    await page.locator('[data-inventory-item=R01]').click();
    const list = await page.locator('#thought-inventory').boundingBox(), detail = await page.locator('.thought-detail-popover').boundingBox(), focus = await page.locator('#expression-focus').boundingBox();
    assert.ok(list && detail && focus); assert.ok(detail.x >= list.x + list.width + 4 && Math.abs(detail.y - list.y) <= 2, 'Expression source details share the picker top edge on its right');
    assert.ok(!overlaps(list, detail) && !overlaps(list, focus) && !overlaps(detail, focus), 'The in-flow source panels do not cover the writing controls');
    assert.ok(detail.x + detail.width <= width + 1 && detail.y >= 0 && detail.y + detail.height <= height + 1, 'Source details remain on screen');
    preserved(await state(), beforeInspect); viewportResult.faces.push(...await faceSafety()); await capture('11a-expression-search');
    viewportResult.inspection = { list, detail, focus };
    await page.keyboard.press('Escape'); assert.equal(await page.locator('.thought-detail-popover').count(), 0); assert.equal(await search.inputValue(), '可能试探');
    await page.keyboard.press('Escape'); assert.equal(await page.locator('#thought-inventory').count(), 0);
    for (const id of ['R01', 'C08']) await evidence(id); await click('suggestion');
    assert.ok((await state()).story.flags.JIANG_AUTH_GRANTED); assert.ok((await state()).story.flags.COMPANION_PRESENT);
    await visible(page.locator('[data-action=speak]')); viewportResult.faces.push(...await faceSafety()); await capture('11-authorized-expression');
    await click('speak'); assert.equal((await state()).speech.status, 'ready'); assert.equal((await state()).speech.result, 'ok'); await click('reply');
    assert.equal((await state()).phase, 'dialogue'); assert.equal((await state()).story.flags.PERSUADED, true); assert.equal((await state()).story.flags.FORMAL_REPORT_RECEIVED, undefined); assert.equal((await state()).story.flags.REPORT_CLOSED, undefined);
    await visible(page.locator('[data-action=next]')); await capture('12-authorized-success');

    if (width === 1366) {
      await page.emulateMedia({ reducedMotion: 'no-preference' }); await page.evaluate(() => localStorage.setItem('wuzhang-reduced-motion', '0')); await load(p1Expression);
      await click('suggestion'); await click('speak'); await click('reply');
      const full = f.content.rows.find(row => row.id === 'A-40').text.trim(), partial = (await page.locator('#spoken-line').innerText()).trim(); assert.ok(partial.length < full.length);
      await page.locator('[data-action=revise]').focus(); await page.keyboard.press('Enter'); assert.equal((await state()).phase, 'reply'); assert.equal((await page.locator('#spoken-line').innerText()).trim(), full);
      await page.keyboard.press('Enter'); assert.equal((await state()).phase, 'expression');
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); assert.equal(await page.evaluate(() => window.scrollY), 0);
    report.viewports.push(viewportResult); await releasePending(); await context.close(); activePage = null;
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.missing, []); assert.deepEqual(report.unexpectedRequests, []);
  report.passed = true;
  report.checks = layoutOnly ? ['final ordinary and expression artwork at all three laptop sizes', '18px KaiTi body and recorded previous-reply auxiliary size', 'workspace modes stay fixed when source panels open', 'right-side top-aligned source details without writing or face overlaps', 'source dismissal and confirmation remain reachable', 'no user storage or live AI access'] : ['ordinary dialogue and both actual scout branches', '18px KaiTi body, 14px auxiliary, and separate 16px button cue', 'native advance button with no nested button', 'long NPC and player text scroll locally', 'controls remain reachable and face safe areas stay clear', 'in-flow expression search and right-side top-aligned source details', 'generation and speech cancellation', '503 failures retry without invented outcome', 'return to editing preserves full text and evidence', 'reference ready/refusal/revision and success flow', 'earned P2 authorization succeeds without premature report completion', 'keyboard reveal then explicit revision', 'no user storage or live AI access'];
} catch (error) {
  report.failure = error.stack ?? String(error); process.exitCode = 1;
  if (activePage) { try { await activePage.screenshot({ path: resolve(output, `${activeName}-failure.png`) }); } catch {} }
} finally {
  await browser.close(); server.closeAllConnections(); await new Promise(ok => server.close(ok));
  writeFileSync(resolve(output, 'checks.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ passed: report.passed, checks: report.checks, viewportCount: report.viewports.length, screenshotCount: report.screenshots.length, failure: report.failure }, null, 2));
}
