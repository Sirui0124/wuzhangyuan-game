// Real play-through in isolated origins; never reads or modifies the player's saved game.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';
const output = resolve('docs/art/review-20261022/dialogue-light');
mkdirSync(output, { recursive: true });
const server = createStaticServer({ root: resolve('GameStarter/web-demo/.build') });
await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, reducedMotion: 'reduce' });
const key = 'wuzhang-chapter-session-v1', errors = [], checks = [];
const state = (p = page) => p.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
const click = action => page.locator(`[data-action="${action}"]`).first().click();
const read = async () => { let n = 0; while ((await state()).phase === 'dialogue' && n++ < 80) await click('next'); assert.ok(n < 80); };
const capture = async name => {
    await page.locator('.clue-receipt').waitFor({ state: 'detached' });
    // Default visual review, after the separately tested keyboard focus state.
    await page.locator('.scene-heading').click();
    await page.mouse.move(5, 500);
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode().catch(() => {}))); });
    await page.screenshot({ path: resolve(output, `${name}.png`) });
};
page.on('pageerror', e => errors.push(e.message));
try {
    await page.goto(base); await page.locator('.game-menu').waitFor();
    await click('new'); await page.locator('[data-cinema-action=skip]').click();
    const first = await state();
    assert.equal(await page.locator('.dialogue-advance button').count(), 0);
    await page.locator('.dialogue-advance').click({ position: { x: 8, y: 8 } });
    assert.equal((await state()).lineIndex, first.lineIndex + 1);
    for (const key of ['Space', 'Enter']) {
        const before = await state();
        await page.locator('.dialogue-advance').focus();
        await page.keyboard.press(key);
        assert.equal((await state()).lineIndex, before.lineIndex + 1);
        assert.equal(await page.locator('.dialogue-advance').evaluate(e => document.activeElement === e), true);
        assert.match(await page.locator('.dialogue-advance').getAttribute('aria-label'), /.+：.+（继续对白）/);
    }
    checks.push('对白框留白区域可推进；原生 Space / Enter 每次只推进一句，无嵌套按钮');
    await page.mouse.move(5, 500); await capture('awakening');
    assert.equal(await page.locator('.dialogue-foot,.scene-caption,.scene-heading p').count(), 0);
    assert.doesNotMatch(await page.locator('.game-scene').innerText(), /第六夜 · 醒来|这句话，记在心里|停留不会错过/);
    const border = await page.locator('.dialogue-advance').evaluate(e => ({ bottom: getComputedStyle(e).borderBottomWidth, top: getComputedStyle(e).borderTopWidth }));
    assert.deepEqual(border, { bottom: '0px', top: '0px' });
    const beforeOverlay = await state(); await click('settings');
    await page.locator('.dialogue-advance').evaluate(e => e.click());
    assert.equal((await state()).story.current, beforeOverlay.story.current);
    await click('close-modal'); await read();
    checks.push('无底部横线、无重复段落说明；设置浮层阻止背景对白误推进');
    await page.locator('[data-scene-action=read-notice]').click();
    const noticeSave = JSON.stringify(await state());
    await page.mouse.move(5, 500); await capture('notice');
    assert.equal(await page.locator('.clue-receipt').count(), 0);
    await page.locator('.dialogue-advance').click({ position: { x: 8, y: 8 } });
    assert.ok((await state()).story.collected.includes('T01'));
    await page.locator('.clue-receipt').waitFor();
    assert.match(await page.locator('#clue-receipt-status').innerText(), /已收进思绪/);
    const transform = await page.locator('.clue-receipt').evaluate(e => e.getAnimations()[0].effect.getKeyframes().map(f => f.transform));
    assert.ok(transform.every(t => !t || t === 'none'));
    await page.locator('.clue-receipt').waitFor({ state: 'detached' });
    await page.reload(); await click('continue'); assert.equal(await page.locator('.clue-receipt').count(), 0);
    checks.push('实际读完线索才反馈；减少动态模式不位移；动画自行消失，读档不补发');
    await read();
    await page.locator('[data-move=report_post]').click(); await page.locator('[data-scene-action=meet-first-scout]').click();
    await page.mouse.move(5, 500); await capture('scout'); await read();
    assert.equal((await state()).phase, 'choice');
    await page.locator('.scout-choice').click({ position: { x: 8, y: 8 } });
    assert.equal((await state()).phase, 'choice');
    assert.equal(await page.locator('.dialogue-advance').count(), 0);
    await capture('choice'); await page.locator('[data-scout-choice=a]').click(); await read();
    await page.locator('[data-scene-action=intercept-first]').click();
    await page.mouse.move(5, 500); await capture('weiyan');
    assert.ok(await page.locator('.dialogue-advance').evaluate(e => {
        const r = e.getBoundingClientRect();
        return [[8, 8], [r.width - 8, 8], [r.width - 8, r.height - 8]].every(([x, y]) => e.contains(document.elementFromPoint(r.left + x, r.top + y)));
    }));
    await page.setViewportSize({ width: 768, height: 900 }); await capture('tablet');
    const fits = await page.locator('.dialogue-advance').evaluate(e => { const r = e.getBoundingClientRect(); return r.x >= 0 && r.right <= innerWidth && r.y >= 0 && r.bottom <= innerHeight; });
    assert.ok(fits); checks.push('分支面板空白不推进，真实选项可选；768px 与 1600px 对白布局均在屏内');
    const motion = await browser.newPage({ viewport: { width: 1600, height: 1000 }, reducedMotion: 'no-preference' });
    motion.on('pageerror', e => errors.push(e.message));
    await motion.addInitScript(({ key, save }) => localStorage.setItem(key, save), { key, save: noticeSave });
    await motion.goto(base); await motion.locator('[data-action=continue]').click();
    // First click reveals the unfinished line, without prematurely collecting its clue.
    await motion.locator('.dialogue-advance').click({ position: { x: 8, y: 8 } });
    assert.equal((await state(motion)).story.collected.includes('T01'), false);
    await motion.locator('.dialogue-advance').click({ position: { x: 8, y: 8 } });
    assert.ok((await state(motion)).story.collected.includes('T01'));
    await motion.locator('.clue-receipt').waitFor();
    // Freeze only presentation to document a readable frame of the actual collection event.
    await motion.locator('.clue-receipt').evaluate(e => { const a = e.getAnimations()[0]; a.pause(); a.currentTime = 600; });
    await motion.waitForFunction(() => {
        const b = document.querySelector('.dialogue-advance'), line = document.querySelector('#spoken-line');
        return b?.getAttribute('aria-label')?.includes(`：${line?.textContent}（继续对白）`);
    });
    await motion.mouse.move(5, 500); await motion.screenshot({ path: resolve(output, 'clue-in-flight.png') });
    await motion.locator('.clue-receipt').evaluate(e => e.getAnimations()[0].play());
    await motion.locator('.clue-receipt').waitFor({ state: 'detached' });
    checks.push('打字途中点击先展示完整对白；再次点击才收录，正常动态模式飞向思绪后清理');
    // Exercise back-to-back presentation events without fabricating any story state.
    await motion.evaluate(async () => {
        const { showClueReceipt } = await import('/GameStarter/web-demo/src/clue-receipt.js');
        const root = document.querySelector('#game-root');
        showClueReceipt(root, '连续收录一', true);
        showClueReceipt(root, '连续收录二', true);
    });
    await motion.locator('.clue-receipt').waitFor();
    assert.equal(await motion.locator('.clue-receipt').count(), 1);
    await motion.locator('[data-action=menu]').click();
    assert.equal(await motion.locator('.clue-receipt').count(), 0);
    assert.equal(await motion.locator('#clue-receipt-status').innerText(), '');
    await motion.locator('[data-action=continue]').click();
    assert.equal(await motion.locator('.clue-receipt').count(), 0);
    checks.push('连续收录动画排队不重叠；离开场景与读档清除动画、队列及播报');
    await motion.close(); assert.deepEqual(errors, []);
    writeFileSync(resolve(output, 'checks.json'), JSON.stringify({ passed: true, checks, errors }, null, 2));
    console.log(JSON.stringify({ passed: true, checks, errors }, null, 2));
} catch (error) { await page.screenshot({ path: resolve(output, 'failure.png') }); throw error; }
finally { await browser.close(); server.closeAllConnections(); await new Promise(ok => server.close(ok)); }
