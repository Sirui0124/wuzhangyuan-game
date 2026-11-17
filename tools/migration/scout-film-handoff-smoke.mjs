import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';
import { ChapterSession } from '../../GameStarter/web-demo/.build/GameStarter/web-demo/src/chapter-session.js';

const out = resolve('outputs/scout-handoff-20261025'); mkdirSync(out, { recursive: true });
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const content = read('content/chapters/wuzhang/chapter-one.script.json');
const flow = read('content/chapters/wuzhang/chapter-one.flow.json');
const movies = read('GameStarter/web-demo/public/cinematics.json');
const manifest = read('GameStarter/web-demo/.build/story/session-manifest.json');
const saveKey = 'wuzhang-chapter-session-v1', filmKey = 'wuzhang-session-films-v1';
const filmVersion = `${manifest.contentVersion}:${JSON.stringify(movies)}`;
function checkpoint(option) {
    const game = new ChapterSession(content, flow, manifest.contentVersion, undefined, undefined, 'offline');
    const readLines = () => { while (game.snapshot().phase === 'dialogue') game.nextLine(); };
    game.finishCinematic(); readLines();
    for (const id of ['read-notice', 'meet-first-scout']) {
        game.move(flow.actions.find(action => action.id === id).scene); assert.ok(game.act(id)); readLines();
    }
    assert.ok(game.chooseScout(option)); return game.snapshot();
}
const server = createStaticServer(); await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [], errors = [];
try {
    for (const option of ['a', 'b']) for (const mode of ['ended', 'skip', 'completed-save']) {
        const save = checkpoint(option), film = movies.chapterDialogue.find(f => f.rows[0] === save.story.current);
        const key = `story:${save.story.run}:${save.round}:${save.section}:${film.id}`;
        const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' });
        const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
        await page.addInitScript(({ save, saveKey, filmKey, filmVersion, key, mode }) => {
            if (localStorage.getItem(saveKey)) return;
            localStorage.setItem(saveKey, JSON.stringify(save));
            localStorage.setItem('wuzhang-runtime-mode-v1', 'offline');
            localStorage.setItem('wuzhang-reduced-motion', '1');
            if (mode === 'completed-save') localStorage.setItem(filmKey, JSON.stringify({ version: filmVersion, completed: [key], active: null }));
        }, { save, saveKey, filmKey, filmVersion, key, mode });
        const state = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), saveKey);
        await page.goto(base, { waitUntil: 'domcontentloaded' }); await page.locator('[data-action=continue]').click();
        if (mode !== 'completed-save') {
            await page.waitForFunction(() => document.querySelector('video')?.readyState >= 2);
            assert.ok(!(await state()).story.collected.includes('T02'));
            if (mode === 'ended') await page.locator('video').evaluate(async video => { video.currentTime = video.duration - .2; await video.play(); });
            else await page.locator('[data-cinema-action=skip]').click();
        }
        await page.locator('[data-scene-action=intercept-first]').waitFor();
        const after = await state(); assert.equal(after.phase, 'explore');
        assert.equal(after.story.collected.includes('T02'), option === 'a');
        assert.equal(after.story.collected.filter(id => id === 'T02').length, option === 'a' ? 1 : 0);
        assert.equal(await page.locator('[data-story-film]').count(), 0);
        if (option === 'a') { await page.locator('#clue-receipt-status').waitFor({ state: 'attached' }); assert.match(await page.locator('#clue-receipt-status').textContent(), /营门/); }
        await page.screenshot({ path: resolve(out, `${option}-${mode}.png`) });
        await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('[data-action=continue]').click();
        await page.locator('[data-scene-action=intercept-first]').waitFor();
        assert.deepEqual((await state()).story.collected, after.story.collected);
        assert.deepEqual((await state()).story.completed, after.story.completed);
        // The actual next action must lead to Wei Yan, not just a static recovered screen.
        await page.locator('[data-scene-action=intercept-first]').click();
        await page.waitForFunction(() => document.querySelector('video')?.readyState >= 2);
        assert.match(await page.locator('video').getAttribute('src'), /C1T05/);
        if (option === 'a' && mode === 'ended') {
            // A different story film still awaits confirmation and must retain a real picture.
            await page.locator('[data-cinema-action=skip]').click();
            await page.locator('[data-film-confirm]').waitFor();
            const lit = await page.locator('.cinema-transition-frame').evaluate(canvas => {
                const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
                let count = 0; for (let i = 0; i < pixels.length; i += 40) if (pixels[i] + pixels[i + 1] + pixels[i + 2] > 30) count++; return count;
            });
            assert.ok(lit > 1000); assert.equal((await state()).phase, 'dialogue');
            await page.locator('[data-film-confirm]').click();
            assert.equal((await state()).phase, 'expression');
        }
        results.push({ option, mode, phase: after.phase, clues: after.story.collected, nextAction: 'intercept-first' });
        await context.close();
    }
    assert.deepEqual(errors, []);
    writeFileSync(resolve(out, 'checks.json'), JSON.stringify({ passed: true, results, errors }, null, 2));
    console.log(JSON.stringify({ passed: true, results, errors }));
} finally { await browser.close(); server.closeAllConnections(); await new Promise(ok => server.close(ok)); }
