import assert from 'node:assert/strict';

/** Narrow visual/interaction regression reused by the dialogue smoke entry. */
export async function runExpressionAligned({ page, width, height, viewportResult, load, font, faceSafety, capture, state, click, clickBackground, backgroundDoesNotAdvance, visible, evidence, preserved, releasePending, key, ordinary, ordinaryNext, choice, p1Expression, p2Expression, longPlayerText, ownFocus, overlaps, setMode }) {
  viewportResult.dialogueFrames = [];
  const dialogueFrame = async () => {
    const frame = await page.locator('.dialogue-box').boundingBox(); assert.ok(frame);
    assert.ok(Math.abs(frame.x - width * .15) <= 2 && Math.abs(frame.width - width * .7) <= 2, 'Dialogue frames occupy 70% with equal 15% side margins');
    const art = await page.locator('.scene-image').evaluate(node => ({ image: getComputedStyle(node).backgroundImage, opacity: getComputedStyle(node).opacity }));
    assert.equal(art.opacity, '1'); assert.doesNotMatch(art.image, /thought-night-air/); assert.match(art.image, /url/);
    assert.equal(await page.locator('.dialogue-cue,[data-action=next],[data-action=reply]').count(), 0);
    viewportResult.dialogueFrames.push({ phase: (await state()).phase, frame, art }); viewportResult.faces.push(...await faceSafety());
  };
  await load(ordinary); await font('#spoken-line', 22); await font('.dialogue-speaker', 20); await font('.dialogue-key-hint', 16); await dialogueFrame(); await capture('01-original-npc-wide');
  await clickBackground(); assert.equal((await state()).story.current, ordinaryNext);
  await load(choice); await dialogueFrame(); for (const id of ['a', 'b']) await visible(page.locator(`[data-scout-choice=${id}]`));
  await load(p1Expression); await click('suggestion'); await click('speak'); assert.equal((await state()).speech.status, 'ready'); await dialogueFrame();
  await clickBackground(); assert.equal((await state()).phase, 'reply'); await dialogueFrame();
  await load(p2Expression);
  const columnMetrics = async () => {
    const left = await page.locator('.expression-input-block').boundingBox(), right = await page.locator('.expression-result').boundingBox();
    assert.ok(left && right && right.x >= left.x + left.width + 24 && Math.abs(right.y - left.y) <= 2, 'Expression columns are separated and top aligned');
    return { left, right };
  };
  const buttonRow = async label => {
    const polish = page.locator('[data-action=generate-expression]'), confirm = page.locator('[data-action=speak]');
    await visible(polish); await visible(confirm);
    const left = await polish.boundingBox(), right = await confirm.boundingBox();
    assert.ok(Math.abs(left.y - right.y) <= 2 && Math.abs(left.y + left.height / 2 - right.y - right.height / 2) <= 2, `${label}: polish and confirmation share one horizontal row`);
    assert.ok(right.x >= left.x + left.width + 24, `${label}: actions stay in their respective columns`);
    await font('[data-action=generate-expression]', 18); await font('[data-action=speak]', 18);
    viewportResult.buttonRows.push({ label, left, right });
  };
  viewportResult.buttonRows = [];
  viewportResult.columns = await columnMetrics(); await font('#expression-focus', 16); await font('#player-expression', 16); await font('.expression-current-reply p', 16); await font('[data-expression-output]', 20);
  const initialHeight = await page.locator('#player-expression').evaluate(node => node.getBoundingClientRect().height);
  await backgroundDoesNotAdvance('Initial expression requires explicit confirmation'); assert.ok(await page.locator('[data-action=speak]').isDisabled()); await buttonRow('initial'); await capture('02-expression-initial');
  for (const id of ['R01', 'C08']) await evidence(id); await click('suggestion'); await columnMetrics();
  assert.equal((await state()).composition.status, 'ready'); await backgroundDoesNotAdvance('Ready expression is not submitted by a background click');
  const topic = await page.locator('.speech-evidence>header').boundingBox(), node = await page.locator('[data-expression-source]').first().boundingBox();
  viewportResult.nodeIndent = node.x - topic.x; assert.ok(Math.abs(viewportResult.nodeIndent - 54) <= 2, 'Expression clues follow the reasoning node indentation');
  const inspectCurves = async () => {
    await page.waitForFunction(() => document.querySelectorAll('.reasoning-curve[data-to="expression-draft"]').length === document.querySelectorAll('[data-expression-source]').length);
    const geometry = await page.evaluate(() => {
      const target = document.querySelector('[data-expression-output]').getBoundingClientRect();
      return { target: { x: target.x, y: target.y, height: target.height }, ends: [...document.querySelectorAll('.reasoning-curve[data-to="expression-draft"]')].map(path => { const point = path.getPointAtLength(path.getTotalLength()), end = new DOMPoint(point.x, point.y).matrixTransform(path.getScreenCTM()); return { from: path.dataset.from, x: end.x, y: end.y, d: path.getAttribute('d') }; }) };
    });
    assert.equal(geometry.ends.length, await page.locator('[data-expression-source]').count()); assert.ok(geometry.ends.length >= 2);
    for (const end of geometry.ends) { assert.match(end.d, /C/); assert.ok(Math.abs(end.x - geometry.target.x) <= 2 && Math.abs(end.y - geometry.target.y - geometry.target.height / 2) <= 2, 'The curve reaches the output title instead of the middle of the editor'); }
    return geometry;
  };
  viewportResult.readyCurves = await inspectCurves();
  await buttonRow('ready'); await capture('03-expression-ready');
  const readyHeight = await page.locator('#player-expression').evaluate(node => node.getBoundingClientRect().height);
  for (const id of ['C04', 'C06', 'C07']) { assert.ok((await state()).story.collected.includes(id), `${id} was earned through the real chapter flow`); if (!(await state()).story.selected.includes(id)) await evidence(id); }
  assert.ok((await state()).story.selected.length >= 5); await buttonRow('five-selected-clues'); await click('suggestion'); await columnMetrics();
  viewportResult.manyClueCurves = await inspectCurves(); await capture('03b-five-selected-clues');
  viewportResult.editors = await page.locator('#expression-focus,#player-expression').evaluateAll(nodes => nodes.map(node => ({ id: node.id, borderBottom: getComputedStyle(node).borderBottomWidth, size: getComputedStyle(node).fontSize })));
  for (const editor of viewportResult.editors) assert.equal(editor.borderBottom, '0px', 'Editable ink fields have no underline');
  await page.locator('#player-expression').fill('即刻转呈。'); const shortHeight = await page.locator('#player-expression').evaluate(node => node.getBoundingClientRect().height);
  await page.locator('#player-expression').fill(longPlayerText);
  viewportResult.fixedHeight = await page.locator('#player-expression').evaluate(node => ({ height: node.getBoundingClientRect().height, total: node.scrollHeight, visible: node.clientHeight, overflow: getComputedStyle(node).overflowY, fieldSizing: getComputedStyle(node).fieldSizing }));
  Object.assign(viewportResult.fixedHeight, { initial: initialHeight, ready: readyHeight, short: shortHeight });
  for (const value of [initialHeight, readyHeight, shortHeight]) assert.ok(Math.abs(viewportResult.fixedHeight.height - value) <= 1, 'Empty, ready, short and long drafts retain the same editor height');
  assert.equal(viewportResult.fixedHeight.fieldSizing, 'fixed'); assert.equal(viewportResult.fixedHeight.overflow, 'auto'); assert.ok(viewportResult.fixedHeight.total > viewportResult.fixedHeight.visible);
  await page.locator('#player-expression').evaluate(node => { node.scrollTop = 0; }); await page.locator('#player-expression').hover(); await page.mouse.wheel(0, 300);
  await page.waitForFunction(() => document.querySelector('#player-expression').scrollTop > 0); assert.equal(await page.locator('#player-expression').inputValue(), longPlayerText);
  viewportResult.fixedHeight.scrolled = await page.locator('#player-expression').evaluate(node => node.scrollTop);
  viewportResult.longCurves = await inspectCurves();
  await buttonRow('long-draft-five-clues'); await capture('04-long-expression');
  const beforeSearch = await state(); await click('open-inventory'); const search = page.locator('[data-inventory-search]'); await visible(search); await search.fill('试探');
  preserved(await state(), beforeSearch); await page.locator('[data-inventory-item=R01]').click();
  const list = await page.locator('#thought-inventory').boundingBox(), detail = await page.locator('.thought-detail-popover').boundingBox();
  assert.ok(list && detail && Math.abs(list.y - detail.y) <= 2 && detail.x >= list.x + list.width + 4 && !overlaps(list, detail));
  assert.ok(detail.x + detail.width <= width + 1 && detail.y >= 0 && detail.y + detail.height <= height + 1);
  for (const editor of ['#expression-focus', '#player-expression']) assert.ok(!overlaps(detail, await page.locator(editor).boundingBox()));
  viewportResult.inspection = { list, detail }; preserved(await state(), beforeSearch); await capture('05-search-detail');
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await visible(page.locator('[data-action=speak]'));
  await page.locator('#expression-focus').fill(ownFocus);
  assert.ok(await page.locator('[data-action=speak]').isDisabled()); assert.equal(await page.locator('.reasoning-curve[data-to="expression-draft"]').count(), 0, 'Editing the intention clears obsolete result curves immediately');
  setMode('hold'); await click('generate-expression');
  await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).composition.status === 'waiting', key);
  await backgroundDoesNotAdvance('Generation waiting does not advance'); await visible(page.locator('[data-action=cancel-generation]')); await capture('06-generation-waiting');
  await click('cancel-generation'); await releasePending(); assert.equal((await state()).composition.status, 'cancelled');
  assert.equal(await page.locator('#expression-focus').inputValue(), ownFocus); assert.equal(await page.locator('#player-expression').inputValue(), longPlayerText); assert.deepEqual((await state()).story.selected, beforeSearch.story.selected);
  await page.locator('#player-expression').fill(longPlayerText); await backgroundDoesNotAdvance('Only explicit confirmation may speak the draft'); await click('speak');
  await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).speech?.status === 'waiting', key); await dialogueFrame(); await visible(page.locator('[data-action=cancel-speech]')); await capture('07-explicit-confirmation');
  await click('cancel-speech'); await releasePending();
  assert.equal(await page.evaluate(() => window.scrollY), 0); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
}

export async function runDialogueVisual({ page, width, height, viewportResult, load, font, faceSafety, capture, state, click, clickBackground, backgroundDoesNotAdvance, visible, evidence, preserved, releasePending, key, ordinary, ordinaryNext, choice, p1Expression, p2Expression, longPlayerText, ownFocus, overlaps, setMode, longDialogue, longNpcText, report }) {
  viewportResult.surfaces = [];
  const visualState = async label => {
    const metrics = await page.evaluate(() => {
      const scene = document.querySelector('.game-scene'), background = scene.querySelector('.scene-image'), speaker = scene.querySelector('.dialogue-speaker'), panel = scene.querySelector('.dialogue-box'), art = scene.querySelector('.character-art');
      const r = speaker.getBoundingClientRect();
      const frame = panel.getBoundingClientRect();
      return { phase: scene.dataset.phase, background: getComputedStyle(background).backgroundImage, originalSceneOpacity: getComputedStyle(background).opacity, left: r.left, frame: { x: frame.x, width: frame.width }, panelOpacity: getComputedStyle(panel).opacity, washOpacity: getComputedStyle(panel, '::before').opacity, portraitFilter: art ? getComputedStyle(art).filter : null, portraitMask: art ? getComputedStyle(art).maskImage : null };
    });
    assert.match(metrics.background, /url/); assert.doesNotMatch(metrics.background, /thought-night-air/);
    assert.equal(metrics.originalSceneOpacity, '1', 'The original location remains visible in reading states');
    assert.ok(Math.abs(metrics.frame.x - width * .15) <= 2 && Math.abs(metrics.frame.width - width * .7) <= 2, 'Dialogue has equal 15% side margins');
    assert.equal(metrics.panelOpacity, '1'); assert.equal(metrics.washOpacity, '0.7');
    assert.equal(await page.locator('.dialogue-cue,[data-action=next],[data-action=reply]').count(), 0);
    await font('.dialogue-speaker', 20);
    if (await page.locator('#spoken-line').count()) await font('#spoken-line', 22);
    if (await page.locator('.said-text').count()) await font('.said-text', 22);
    if (await page.locator('.dialogue-key-hint').count()) await font('.dialogue-key-hint', 16);
    viewportResult.surfaces.push(metrics); viewportResult.faces.push(...await faceSafety()); await capture(label);
  };
  await load(ordinary); await visualState('01-weiyan'); await clickBackground(); assert.equal((await state()).story.current, ordinaryNext);
  await load(longDialogue);
  const reading = page.locator('.dialogue-reading'); viewportResult.longScroll.dialogue = await reading.evaluate(node => ({ height: node.clientHeight, total: node.scrollHeight }));
  assert.equal((await page.locator('#spoken-line').innerText()).trim(), longNpcText);
  if (viewportResult.longScroll.dialogue.total > viewportResult.longScroll.dialogue.height) {
    await reading.hover(); await page.mouse.wheel(0, 300); await page.waitForFunction(() => document.querySelector('.dialogue-reading').scrollTop > 0);
  }
  assert.equal((await state()).story.current, 'A-40B'); await visualState('02-long-dialogue');
  await load(choice); for (const option of ['a', 'b']) await visible(page.locator(`[data-scout-choice=${option}]`));
  await font('[data-scout-choice=a]', 20); await visualState('03-choice');
  await load(p1Expression); await page.locator('#player-expression').fill(longPlayerText); setMode('hold'); await click('speak');
  await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).speech?.status === 'waiting', key);
  await visible(page.locator('[data-action=cancel-speech]')); await backgroundDoesNotAdvance('Waiting remains an explicit action state');
  viewportResult.longScroll.player = await page.locator('.said-text').evaluate(node => ({ height: node.clientHeight, total: node.scrollHeight }));
  assert.ok(viewportResult.longScroll.player.total > viewportResult.longScroll.player.height); await visualState('04-spoken-waiting');
  await load(p1Expression); await click('suggestion'); await click('speak'); assert.equal((await state()).speech.status, 'ready'); await visualState('05-spoken-ready');
  await clickBackground(); assert.equal((await state()).phase, 'reply'); await visualState('06-refusal');
  assert.equal(await page.evaluate(() => window.scrollY), 0); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
}

export async function runDialogueDoubleClick({ page, base, width, height, viewportResult, load, font, faceSafety, capture, state, click, clickBackground, backgroundDoesNotAdvance, visible, evidence, preserved, releasePending, key, ordinary, ordinaryNext, choice, p1Expression, p2Expression, longPlayerText, ownFocus, overlaps, setMode, longDialogue, longNpcText, report }) {
  await page.goto(base); await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => localStorage.setItem('wuzhang-reduced-motion', '0')); await load(longDialogue);
  assert.ok((await page.locator('#spoken-line').innerText()).length < longNpcText.length, 'The double-click begins during typewriting');
  await page.evaluate(key => {
    window.__readingClicks = [];
    document.addEventListener('click', event => { const saved = JSON.parse(localStorage.getItem(key)); window.__readingClicks.push({ detail: event.detail, target: event.target.className, selection: getSelection()?.toString(), phase: saved.phase, current: saved.story.current, text: document.querySelector('#spoken-line')?.textContent ?? '' }); });
  }, key);
  await page.mouse.dblclick(24, height * .4, { delay: 40 });
  const events = await page.evaluate(() => window.__readingClicks);
  report.doubleClickObservation = events;
  assert.deepEqual(events.map(event => event.detail), [1, 2]);
  assert.equal(events[0].phase, 'dialogue'); assert.equal(events[0].current, 'A-40B'); assert.equal(events[0].text.trim(), longNpcText);
  assert.notDeepEqual({ phase: events[1].phase, current: events[1].current }, { phase: 'dialogue', current: 'A-40B' }, 'The second rapid click advances instead of being discarded');
  viewportResult.doubleClick = events; await capture('double-click-advance');
  await load(longDialogue); await clickBackground();
  const r = await page.locator('#spoken-line').boundingBox();
  await page.mouse.move(r.x + 4, r.y + 12); await page.mouse.down(); await page.mouse.move(r.x + Math.min(190, r.width - 4), r.y + 12, { steps: 12 }); await page.mouse.up();
  const selected = await page.evaluate(() => getSelection()?.toString().trim() ?? ''); assert.ok(selected.length > 0);
  assert.equal((await state()).phase, 'dialogue'); assert.equal((await state()).story.current, 'A-40B');
  viewportResult.selectionProtection = { selectedCharacters: selected.length, phase: (await state()).phase, current: (await state()).story.current };
  await capture('selection-does-not-advance');
}
