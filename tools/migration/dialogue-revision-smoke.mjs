import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';
import { dialogueFixtures } from '../ai/dialogue-fixtures.mjs';
import { runExpressionAligned, runDialogueVisual, runDialogueDoubleClick } from './dialogue-expression-aligned-checks.mjs';
import { npcTurn } from '../../GameStarter/tests/npc-fixture.mjs';

const build = resolve(process.argv[2] ?? 'GameStarter/web-demo/.build');
const output = resolve(process.argv[3] ?? 'outputs/dialogue-revision-20261023');
const doubleClickOnly = process.argv.includes('--double-click-only');
const visualOnly = process.argv.includes('--visual-only');
const expressionAligned = process.argv.includes('--expression-aligned');
mkdirSync(output, { recursive: true });
const f = await dialogueFixtures(build), key = 'wuzhang-chapter-session-v1';
const player = new f.ChapterSession(f.content, f.flow, f.version); player.finishCinematic();
const playerLabels = [];
for (let n = 0; player.snapshot().phase === 'dialogue' && n < 100; n++) {
  const speaker = player.row()?.speaker;
  if (['主角', '主角心声'].includes(speaker) && !playerLabels.some(item => item.speaker === speaker)) playerLabels.push({ speaker, fixture: player.serialize(), label: speaker === '主角' ? '你' : '你 · 心声' });
  player.nextLine();
}
f.act(player, 'read-notice');
const scoutScene = f.flow.actions.find(action => action.id === 'meet-first-scout').scene;
if (player.snapshot().scene !== scoutScene) player.move(scoutScene);
assert.ok(player.act('meet-first-scout'));
for (let n = 0; player.snapshot().phase === 'dialogue' && n < 100; n++) {
  if (player.row()?.speaker === '主角' && !playerLabels.some(item => item.speaker === '主角')) playerLabels.push({ speaker: '主角', fixture: player.serialize(), label: '你' });
  player.nextLine();
}
assert.equal(playerLabels.length, 2, 'Both player speaker labels come from the real opening and scout sequences');
const start = new f.ChapterSession(f.content, f.flow, f.version);
start.finishCinematic(); f.read(start); f.act(start, 'read-notice'); f.act(start, 'meet-first-scout');
assert.equal(start.snapshot().phase, 'choice'); const choice = start.serialize();
start.chooseScout('a'); f.read(start); assert.ok(start.act('intercept-first'));
for (let n = 0; !start.row()?.speaker.startsWith('魏延') && n < 30; n++) assert.ok(start.nextLine());
assert.ok(start.row()?.speaker.startsWith('魏延')); const ordinary = start.serialize();
assert.ok(start.nextLine()); const ordinaryNext = start.snapshot().story.current;
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
const report = { passed: false, isolated: true, realAPI: false, checks: [], viewports: [], screenshots: [], errors: [], missing: [], unexpectedRequests: [], mockRequests: 0 };
let activePage, activeName = '';
const overlaps = (a, b) => Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 1 && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 1;

try {
  for (const [width, height] of doubleClickOnly ? [[1366, 768]] : visualOnly || expressionAligned ? [[1366, 768], [1280, 720], [1440, 900]] : [[1280, 720], [1366, 768], [1440, 900]]) {
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
    const clickBackground = () => page.mouse.click(24, height * .4);
    const positionState = async () => { const s = await state(); return { phase: s.phase, current: s.story.current, speechStatus: s.speech?.status, draft: s.story.draft }; };
    const backgroundDoesNotAdvance = async label => { const before = await positionState(); await clickBackground(); assert.deepEqual(await positionState(), before, label); };
    const load = async fixture => {
      await releasePending(); await page.goto(base); await page.locator('.game-menu').waitFor();
      await page.evaluate(({ key, fixture }) => localStorage.setItem(key, fixture), { key, fixture });
      await page.reload(); await click('continue');
      await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].filter(image => image.getClientRects().length).map(image => image.decode().catch(() => {}))); });
    };
    const capture = async label => {
      await page.evaluate(async () => {
        await Promise.all([...document.images].filter(image => image.getClientRects().length).map(image => image.decode().catch(() => {})));
        await Promise.all([...document.querySelectorAll('.game-scene,.scene-image,.thought-landscape')].map(async node => {
          const url = getComputedStyle(node).backgroundImage.match(/url\(["']?([^"')]+)/)?.[1]; if (!url) return;
          const image = new Image(); image.src = url; await image.decode().catch(() => {});
        }));
        await new Promise(ok => requestAnimationFrame(() => requestAnimationFrame(ok)));
      });
      for (const opacity of await page.locator('.dialogue-box').evaluateAll(nodes => nodes.map(node => ({ wash: getComputedStyle(node, '::before').opacity, panel: getComputedStyle(node).opacity, text: getComputedStyle(node.querySelector('#spoken-line,.said-text,[data-scout-choice]') ?? node).opacity })))) {
        assert.equal(opacity.wash, '0.7'); assert.equal(opacity.panel, '1'); assert.equal(opacity.text, '1');
      }
      const file = `${name}-${label}.png`; await page.screenshot({ path: resolve(output, file) }); report.screenshots.push(file);
    };
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

    if (expressionAligned) {
      await runExpressionAligned({ page, width, height, viewportResult, load, font, faceSafety, capture, state, click, clickBackground, backgroundDoesNotAdvance, visible, evidence, preserved, releasePending, key, ordinary, ordinaryNext, choice, p1Expression, p2Expression, longPlayerText, ownFocus, overlaps, setMode: value => { mode = value; } });
      report.viewports.push(viewportResult); await context.close(); activePage = null; continue;
    }

    if (visualOnly) {
      await runDialogueVisual({ page, width, height, viewportResult, load, font, faceSafety, capture, state, click, clickBackground, backgroundDoesNotAdvance, visible, evidence, preserved, releasePending, key, ordinary, ordinaryNext, choice, p1Expression, p2Expression, longPlayerText, ownFocus, overlaps, setMode: value => { mode = value; }, longDialogue, longNpcText, report });
      report.viewports.push(viewportResult); await releasePending(); await context.close(); activePage = null; continue;
    }

    if (doubleClickOnly) {
      await runDialogueDoubleClick({ page, base, width, height, viewportResult, load, font, faceSafety, capture, state, click, clickBackground, backgroundDoesNotAdvance, visible, evidence, preserved, releasePending, key, ordinary, ordinaryNext, choice, p1Expression, p2Expression, longPlayerText, ownFocus, overlaps, setMode: value => { mode = value; }, longDialogue, longNpcText, report });
      report.viewports.push(viewportResult); await context.close(); activePage = null; continue;
    }

    await load(ordinary); assert.equal((await state()).phase, 'dialogue');
    assert.equal(await page.locator('.dialogue-advance').evaluate(node => node.tagName), 'SECTION');
    assert.equal(await page.locator('.dialogue-cue,.dialogue-advance button').count(), 0);
    await visible(page.locator('.dialogue-advance'));
    viewportResult.fonts.dialogue = await font('#spoken-line', 22); viewportResult.fonts.auxiliary = await font('.dialogue-key-hint', 16);
    const fontClient = await context.newCDPSession(page); await fontClient.send('DOM.enable'); await fontClient.send('CSS.enable');
    const fontDoc = await fontClient.send('DOM.getDocument'), textNode = await fontClient.send('DOM.querySelector', { nodeId: fontDoc.root.nodeId, selector: '#spoken-line' });
    viewportResult.actualFont = await fontClient.send('CSS.getPlatformFontsForNode', { nodeId: textNode.nodeId }); assert.ok(viewportResult.actualFont.fonts.some(font => /Kai|楷/i.test(font.familyName)));
    viewportResult.faces.push(...await faceSafety()); await capture('01-dialogue');
    await page.locator('.dialogue-advance').focus(); await page.keyboard.press('Space'); assert.equal((await state()).story.current, ordinaryNext);
    for (const action of ['notes', 'records', 'save', 'settings', 'menu']) await visible(page.locator(`.game-hud [data-action="${action}"]`));

    for (const target of ['background', 'portrait', 'text']) {
      await load(ordinary);
      if (target === 'background') await clickBackground();
      else if (target === 'text') await page.locator('#spoken-line').click();
      else { const r = await page.locator('.portrait-stage').boundingBox(); await page.mouse.click(r.x + r.width * .6, r.y + r.height * .35); }
      assert.equal((await state()).story.current, ordinaryNext, `${target} click advances exactly one line`);
    }
    for (const action of ['settings', 'records', 'save']) {
      await load(ordinary); const before = await positionState(); await click(action); await page.locator('.game-modal').waitFor();
      assert.deepEqual(await positionState(), before, `${action} control does not advance dialogue`);
      await page.locator('.game-modal h1').first().click(); await page.keyboard.press('Space');
      assert.deepEqual(await positionState(), before, 'Clicks and Space within a modal do not advance dialogue');
      await click('close-modal'); assert.deepEqual(await positionState(), before, 'Dismissing a modal does not advance dialogue');
    }
    await load(ordinary); const beforeMenu = await positionState(); await click('menu'); await page.locator('.game-menu').waitFor();
    assert.deepEqual(await positionState(), beforeMenu); await click('continue'); assert.deepEqual(await positionState(), beforeMenu);
    for (const player of playerLabels) {
      await load(player.fixture); assert.equal((await page.locator('.dialogue-speaker').innerText()).trim(), player.label);
    }

    for (const branch of ['a', 'b']) {
      await load(choice); assert.equal((await state()).phase, 'choice'); assert.ok(await page.locator('.portrait-stage [data-character=scout]').isVisible());
      await backgroundDoesNotAdvance('A choice requires an explicit option');
      for (const option of ['a', 'b']) await visible(page.locator(`[data-scout-choice="${option}"]`));
      await font('[data-scout-choice=a]', 20); viewportResult.faces.push(...await faceSafety()); await capture(`02-choice-${branch}`);
      await page.locator(`[data-scout-choice="${branch}"]`).focus(); await page.keyboard.press('Enter'); assert.equal((await state()).phase, 'dialogue');
    }

    await load(longDialogue); assert.equal((await state()).story.current, 'A-40B'); assert.equal((await page.locator('#spoken-line').innerText()).trim(), longNpcText);
    const reading = page.locator('.dialogue-reading'); viewportResult.longScroll.dialogue = await reading.evaluate(node => ({ height: node.clientHeight, total: node.scrollHeight }));
    if (viewportResult.longScroll.dialogue.total > viewportResult.longScroll.dialogue.height) {
      await reading.hover(); await page.mouse.wheel(0, 300); await page.waitForFunction(() => document.querySelector('.dialogue-reading').scrollTop > 0);
    }
    assert.equal((await state()).story.current, 'A-40B'); viewportResult.faces.push(...await faceSafety()); await capture('03-long-dialogue');
    await reading.evaluate(node => node.scrollTop = 0);
    const textBox = await page.locator('#spoken-line').boundingBox();
    await page.mouse.move(textBox.x + 4, textBox.y + 12); await page.mouse.down(); await page.mouse.move(textBox.x + Math.min(190, textBox.width - 4), textBox.y + 12, { steps: 12 }); await page.mouse.up();
    assert.equal((await state()).story.current, 'A-40B', 'Dragging to select dialogue does not advance it');
    assert.ok(await page.evaluate(() => (getSelection()?.toString().length ?? 0) > 0), 'Dialogue text remains selectable');
    await page.evaluate(() => getSelection()?.removeAllRanges());

    await load(p1Expression); assert.equal((await state()).phase, 'expression');
    await backgroundDoesNotAdvance('Expression requires explicit confirmation');
    const leftEditor = await page.locator('.expression-input-block').boundingBox(), rightEditor = await page.locator('.expression-result').boundingBox();
    assert.ok(leftEditor && rightEditor && rightEditor.x >= leftEditor.x + leftEditor.width + 24 && Math.abs(leftEditor.y - rightEditor.y) <= 2, 'Expression has two aligned, separate columns');
    viewportResult.columns = { leftEditor, rightEditor };
    viewportResult.fonts.input = await font('#expression-focus', 16); viewportResult.fonts.draft = await font('#player-expression', 16);
    await page.locator('#expression-focus').fill(ownFocus); await page.locator('#player-expression').fill(longPlayerText);
    const manual = await state(); mode = 'hold'; await visible(page.locator('[data-action=generate-expression]')); await click('generate-expression');
    await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).composition.status === 'waiting', key);
    await backgroundDoesNotAdvance('Generation cannot be advanced by a background click');
    assert.equal((await state()).phase, 'expression'); await visible(page.locator('[data-action=cancel-generation]')); await capture('04-polish-waiting');
    await click('cancel-generation'); await releasePending(); assert.equal((await state()).composition.status, 'cancelled');
    assert.equal((await page.locator('#expression-focus').inputValue()), ownFocus); assert.equal(await page.locator('#player-expression').inputValue(), longPlayerText);
    await page.locator('#player-expression').fill(longPlayerText); await visible(page.locator('[data-action=speak]')); viewportResult.faces.push(...await faceSafety()); await capture('05-long-expression');
    await backgroundDoesNotAdvance('A completed draft is not spoken by clicking the background');
    await click('speak'); await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).speech?.status === 'waiting', key);
    assert.equal((await state()).phase, 'spoken'); assert.equal((await page.locator('.said-text').innerText()).trim(), longPlayerText);
    await backgroundDoesNotAdvance('Waiting for speech does not advance on a background click');
    await font('.said-text', 22); await visible(page.locator('[data-action=cancel-speech]')); viewportResult.faces.push(...await faceSafety());
    viewportResult.longScroll.player = await page.locator('.said-text').evaluate(node => ({ height: node.clientHeight, total: node.scrollHeight }));
    assert.ok(viewportResult.longScroll.player.total > viewportResult.longScroll.player.height);
    await page.locator('.said-text').evaluate(node => node.scrollTop = node.scrollHeight); assert.ok(await page.locator('.said-text').evaluate(node => node.scrollTop > 0)); await capture('06-spoken-waiting');
    await click('cancel-speech'); await releasePending(); assert.equal((await state()).speech.status, 'cancelled');
    await backgroundDoesNotAdvance('Cancelled speech requires an explicit action');
    for (const action of ['retry-speech', 'revise']) await visible(page.locator(`[data-action=${action}]`));
    mode = 'fail'; const requestsBeforeRetry = report.mockRequests;
    for (let attempt = 0; attempt < 2; attempt++) {
      await click('retry-speech'); await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).speech?.status === 'failed', key);
      await backgroundDoesNotAdvance('Failed speech requires an explicit retry or revision');
      assert.equal((await state()).speech.result, undefined); assert.equal((await state()).story.flags.PERSUADED, undefined);
    }
    viewportResult.apiRetries = report.mockRequests - requestsBeforeRetry; assert.equal(viewportResult.apiRetries, 2);
    await capture('07-service-failed'); await page.locator('[data-action=revise]').focus(); await page.keyboard.press('Enter');
    assert.equal((await state()).phase, 'expression'); preserved(await state(), manual); assert.equal(await page.locator('#player-expression').inputValue(), longPlayerText);

    await load(p1Expression); await page.locator('#expression-focus').fill('请先听我说明'); await click('suggestion'); const referenceInput = await state();
    const beforeReferenceRequests = report.mockRequests; await click('speak'); assert.equal((await state()).speech.status, 'ready'); assert.equal(report.mockRequests, beforeReferenceRequests);
    assert.equal(await page.locator('[data-action=reply]').count(), 0); await capture('08-spoken-ready'); await clickBackground();
    assert.equal((await state()).phase, 'reply'); assert.equal((await page.locator('#spoken-line').innerText()).trim(), f.content.rows.find(row => row.id === 'A-40').text.trim());
    assert.equal(await page.locator('.workspace-screen').count(), 0); assert.equal(await page.locator('.previous-reply').count(), 0); preserved(await state(), referenceInput);
    assert.equal(await page.locator('[data-action=revise]').count(), 0); viewportResult.faces.push(...await faceSafety()); await capture('09-refusal');
    await page.locator('.dialogue-advance').focus(); await page.keyboard.press('Space'); assert.equal((await state()).phase, 'expression'); preserved(await state(), referenceInput);
    await click('transfer-focus'); await click('suggestion'); await click('speak'); assert.equal((await state()).speech.result, 'ok'); await clickBackground();
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
    await click('speak'); assert.equal((await state()).speech.status, 'ready'); assert.equal((await state()).speech.result, 'ok'); await clickBackground();
    assert.equal((await state()).phase, 'dialogue'); assert.equal((await state()).story.flags.PERSUADED, true); assert.equal((await state()).story.flags.FORMAL_REPORT_RECEIVED, undefined); assert.equal((await state()).story.flags.REPORT_CLOSED, undefined);
    await visible(page.locator('.dialogue-advance')); await capture('12-authorized-success');

    if (width === 1366) {
      await page.emulateMedia({ reducedMotion: 'no-preference' }); await page.evaluate(() => localStorage.setItem('wuzhang-reduced-motion', '0')); await load(p1Expression);
      await click('suggestion'); await click('speak'); await clickBackground();
      const full = f.content.rows.find(row => row.id === 'A-40').text.trim(), partial = (await page.locator('#spoken-line').innerText()).trim(); assert.ok(partial.length < full.length);
      await clickBackground(); assert.equal((await state()).phase, 'reply'); assert.equal((await page.locator('#spoken-line').innerText()).trim(), full);
      await clickBackground(); assert.equal((await state()).phase, 'expression');
      await load(longDialogue); assert.ok((await page.locator('#spoken-line').innerText()).length < longNpcText.length);
      await page.locator('.dialogue-advance').focus(); await page.keyboard.press('Space'); assert.equal((await state()).story.current, 'A-40B'); assert.equal((await page.locator('#spoken-line').innerText()).trim(), longNpcText);
      await page.keyboard.press('Space'); assert.notDeepEqual({ phase: (await state()).phase, current: (await state()).story.current }, { phase: 'dialogue', current: 'A-40B' });
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); assert.equal(await page.evaluate(() => window.scrollY), 0);
    report.viewports.push(viewportResult); await releasePending(); await context.close(); activePage = null;
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.missing, []); assert.deepEqual(report.unexpectedRequests, []);
  report.passed = true;
  report.checks = expressionAligned ? ['original scene and portrait with 70% dialogue frames across all reading states', 'KaiTi: dialogue 22px, expression body 16px, titles 20px and buttons 18px', 'top-aligned expression columns and underline-free editable ink fields', 'polish and confirm share one row; draft height stays fixed with internal scroll', 'search preserves selected evidence and draft', 'source details stay right of search at the same top edge', 'generation cancellation preserves writing', 'expression only submits after explicit confirmation', 'no red continue button, JS errors, 404s, user storage or live AI access'] : visualOnly ? ['three laptop sizes across dialogue, long text, choice, spoken waiting/ready and refusal', 'original camp scene and 70% dialogue frames', '22px KaiTi dialogue and 16px auxiliary text', 'ink wash opacity 0.7 with opaque text', 'portraits keep faces clear of reading areas', 'long text scrolls inside its reading area', 'screen click still advances once without a red continue button', 'no user storage or live AI access'] : doubleClickOnly ? ['rapid background double click reveals then advances', 'both actual click details 1 and 2 are recorded', 'real nonempty text selection still does not advance', 'no user storage or live AI access'] : ['background, portrait and text clicks advance exactly one line without a red button', 'click and Space reveal typing before advancing', 'menus and modal interaction do not advance dialogue', 'text selection, dragging and scroll do not advance dialogue', 'choice, expression and pending or failed speech require explicit actions', 'ready speech and refusal use screen continuation', '22px KaiTi dialogue and 16px auxiliary text', '30% transparency applies only to the ink wash, not panel or text', 'actual player lines label speech and inner thoughts distinctly', 'long text stays readable with scrolling when needed', 'two-column expression controls and right-side source details stay reachable', 'generation and speech cancellation', '503 failures retry without invented outcome', 'return to editing preserves full text and evidence', 'reference refusal and earned P2 authorization flow', 'no user storage or live AI access'];
} catch (error) {
  report.failure = error.stack ?? String(error); process.exitCode = 1;
  if (activePage) { try { await activePage.screenshot({ path: resolve(output, `${activeName}-failure.png`) }); } catch {} }
} finally {
  await browser.close(); server.closeAllConnections(); await new Promise(ok => server.close(ok));
  writeFileSync(resolve(output, 'checks.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ passed: report.passed, checks: report.checks, viewportCount: report.viewports.length, screenshotCount: report.screenshots.length, failure: report.failure }, null, 2));
}
