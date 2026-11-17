import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';
import { ChapterSession, GAME_SAVE_KEY, GAME_ENDINGS_KEY } from '../../GameStarter/web-demo/.build/GameStarter/web-demo/src/chapter-session.js';

const read = path => JSON.parse(readFileSync(path, 'utf8'));
const source = read('content/chapters/wuzhang/chapter-one.script.json');
const flow = read('content/chapters/wuzhang/chapter-one.flow.json');
const manifest = read('GameStarter/web-demo/.build/story/session-manifest.json');
const game = new ChapterSession(source, flow, manifest.contentVersion, undefined, undefined, 'offline');
game.finishCinematic(); while (game.snapshot().phase === 'dialogue') game.nextLine();
const manual = game.snapshot(); manual.story.run = 'archive-manual-fixture';
const auto = structuredClone(manual); auto.story.run = 'archive-auto-fixture';
const collection = { schemaVersion: 1, unlocked: Object.fromEntries(['tutorial-sacrifice', 'safe'].map(id => [id, { firstUnlockedAt: '2026-10-25T09:00:00.000Z', lastLoopId: 'fixture', times: 1 }])) };
const output = resolve(process.argv[2] || 'outputs/map-archive-20261026'); mkdirSync(output, { recursive: true });
const server = createStaticServer(); await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const errors = [];
try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await context.addInitScript(({ auto, manual, collection, GAME_SAVE_KEY, GAME_ENDINGS_KEY }) => {
        if (localStorage.getItem('archive-test-seeded')) return;
        localStorage.setItem(GAME_SAVE_KEY, JSON.stringify(auto));
        localStorage.setItem(GAME_SAVE_KEY + ':slot:1', JSON.stringify(manual));
        localStorage.setItem(GAME_ENDINGS_KEY, JSON.stringify(collection));
        localStorage.setItem('wuzhang-runtime-mode-v1', 'offline');
        localStorage.setItem('wuzhang-reduced-motion', '1');
        localStorage.setItem('archive-test-seeded', '1');
    }, { auto, manual, collection, GAME_SAVE_KEY, GAME_ENDINGS_KEY });
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    await page.goto(base, { waitUntil: 'domcontentloaded' }); await page.locator('.game-menu').waitFor();
    const snapshot = () => page.evaluate(({ GAME_SAVE_KEY, GAME_ENDINGS_KEY }) => [localStorage.getItem(GAME_SAVE_KEY), localStorage.getItem(GAME_SAVE_KEY + ':slot:1'), localStorage.getItem(GAME_ENDINGS_KEY)], { GAME_SAVE_KEY, GAME_ENDINGS_KEY });
    const before = await snapshot();
    await page.getByRole('button', { name: '存档留痕', exact: true }).click();
    await page.locator('[data-page=saves]').waitFor();
    assert.equal(await page.locator('.save-leaf').count(), 3);
    assert.equal(await page.locator('[data-store-slot]').count(), 0);
    assert.equal(await page.locator('[data-load-slot="2"]').isDisabled(), true);
    await page.screenshot({ path: resolve(output, 'saves.png') });
    await page.locator('[data-action=close-modal]').click();
    await page.getByRole('button', { name: '回溯舆图', exact: true }).click();
    assert.deepEqual(await page.locator('.map-chapter h2').allTextContents(), ['五丈原', '祁山', '街亭', '夷陵', '荆州', '落凤坡']);
    assert.equal(await page.locator('.map-chapter.locked').count(), 2);
    assert.deepEqual(await page.locator('.map-chapter.locked h2').allTextContents(), ['荆州', '落凤坡']);
    assert.equal(await page.locator('.map-chapter.locked :is(button,a,p,details)').count(), 0, 'Locked locations expose no story or entry');
    for (const id of ['grain', 'jieting', 'yiling']) {
        assert.equal(await page.locator(`[data-map-node="${id}"] .map-chapter-action`).getAttribute('href'), `/?chapter=${id}`);
        assert.ok(!(await page.locator(`[data-map-node="${id}"] small`).innerText()).includes('已通关'), `${id} has no completion marker`);
    }
    assert.equal(await page.locator('.achievement-card').count(), 2);
    assert.equal(await page.locator('[data-achievement-id=no-plan]').count(), 0);
    await page.locator('[data-achievement-id=safe]').click();
    await page.locator('[data-album-detail=safe]').waitFor();
    assert.equal(await page.locator('.album-filters').count(), 0);
    await page.keyboard.press('Escape'); await page.locator('.ending-album-host').waitFor({ state: 'detached' });
    assert.equal(await page.locator('[data-achievement-id=safe]').evaluate(el => el === document.activeElement), true);
    assert.deepEqual(await snapshot(), before, 'Viewing map and achievement details must not mutate saves or unlocks');
    for (const [width, height] of [[1440, 900], [1920, 1080], [390, 844]]) {
        await page.setViewportSize({ width, height });
        await page.screenshot({ path: resolve(output, `map-${width}.png`), fullPage: true });
        const geometry = await page.evaluate(() => {
            const root = document.querySelector('.archive-map'), map = document.querySelector('.map-stage').getBoundingClientRect(), archive = document.querySelector('.achievement-archive').getBoundingClientRect();
            return { noHorizontalOverflow: root.scrollWidth <= innerWidth, mapWidth: map.width, archiveWidth: archive.width, mapRight: map.right, archiveLeft: archive.left };
        });
        assert.ok(geometry.noHorizontalOverflow);
        const nodesFit = await page.evaluate(() => {
            const stage = document.querySelector('.map-stage').getBoundingClientRect();
            const nodes = Array.from(document.querySelectorAll('.map-chapter')).map(node => node.getBoundingClientRect());
            return nodes.every(node => node.left >= stage.left && node.right <= stage.right + 1 && node.top >= stage.top && node.bottom <= stage.bottom + 1)
                && nodes.every((node, i) => nodes.slice(i + 1).every(other => node.right <= other.left || other.right <= node.left || node.bottom <= other.top || other.bottom <= node.top));
        });
        assert.ok(nodesFit, `Six map nodes fit without overlaps at ${width}px`);
        if (width > 850) { assert.ok(geometry.mapWidth > geometry.archiveWidth * 2); assert.ok(geometry.mapRight <= geometry.archiveLeft + 1); }
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator('[data-action=menu]').click(); await page.locator('.game-menu [data-action=save]').click();
    await page.locator('[data-load-slot="1"]').click(); await page.locator('.game-menu').waitFor({ state: 'detached' });
    assert.equal(JSON.parse((await snapshot())[0]).story.run, manual.story.run);
    await page.locator('[data-action=save]').click();
    assert.equal(await page.locator('[data-store-slot]').count(), 2);
    await page.locator('[data-store-slot="1"]').click();
    assert.equal((await snapshot())[1], before[1], 'First click must only request overwrite confirmation');
    await page.locator('[data-store-slot="1"]').click();
    assert.equal(JSON.parse((await snapshot())[1]).story.run, manual.story.run);
    await page.locator('[data-action=close-modal]').click();
    await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('.game-menu').waitFor();
    await page.locator('[data-action=save]').click(); await page.locator('[data-action=load-auto]').click();
    await page.locator('.game-menu').waitFor({ state: 'detached' });
    assert.equal(JSON.parse((await snapshot())[0]).story.run, manual.story.run);
    await context.close();
    const empty = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    await empty.goto(base, { waitUntil: 'domcontentloaded' }); await empty.locator('.game-menu').waitFor();
    await empty.locator('[data-action=chapters]').click(); await empty.locator('.archive-empty').waitFor();
    assert.equal(await empty.locator('.achievement-card').count(), 0);
    await empty.screenshot({ path: resolve(output, 'map-empty.png') });
    assert.deepEqual(errors, []);
    writeFileSync(resolve(output, 'verification.json'), JSON.stringify({ passed: true, cases: ['menu routes to saves', 'manual save restore', 'auto restore after reload', 'overwrite confirmation', 'home cannot save a fresh session', 'unlocked cards only', 'detail close restores focus', 'viewing never mutates progress or unlocks', 'empty archive', 'desktop and narrow layouts'], errors }, null, 2));
    console.log('PASS: save/load separation, overwrite confirmation, read-only achievement archive and responsive map.');
} finally { await browser.close(); server.closeAllConnections(); await new Promise(ok => server.close(ok)); }
