import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';
import { ChapterSession, GAME_SAVE_KEY, GAME_ENDINGS_KEY } from '../../GameStarter/web-demo/.build/GameStarter/web-demo/src/chapter-session.js';
import { GrainSession } from '../../GameStarter/web-demo/.build/GameStarter/web-demo/src/chapters/chapter-two/session.js';
import { grainHasCompleted, GRAIN_SAVE_KEY, GRAIN_COMPLETED_KEY } from '../../GameStarter/web-demo/.build/GameStarter/web-demo/src/chapters/chapter-two/navigation.js';

const read = path => JSON.parse(readFileSync(path, 'utf8'));
const story = read('GameStarter/web-demo/.build/story/chapter-two.films.json');
const game = new ChapterSession(read('content/chapters/wuzhang/chapter-one.script.json'), read('content/chapters/wuzhang/chapter-one.flow.json'), read('GameStarter/web-demo/.build/story/session-manifest.json').contentVersion, undefined, undefined, 'offline');
game.finishCinematic(); while (game.snapshot().phase === 'dialogue') game.nextLine();
const firstSave = game.snapshot(); firstSave.story.run = 'map-actions-resume-fixture';
const grain = new GrainSession(story); grain.advance();
const grainSave = structuredClone(grain.state); grainSave.run = 123456;
const finishSave = { ...grainSave, node: story.nodes.find(node => node.kind === 'finish').id };
assert.equal(grainHasCompleted(story, JSON.stringify(grainSave), null), false);
assert.equal(grainHasCompleted(story, JSON.stringify(finishSave), null), true);
assert.equal(grainHasCompleted(story, JSON.stringify({ ...finishSave, end: 'era-arrest' }), null), false);
assert.equal(grainHasCompleted(story, JSON.stringify({ ...finishSave, version: 'old' }), null), false);
assert.equal(grainHasCompleted(story, '{broken', null), false);
const collection = { schemaVersion: 1, unlocked: { safe: { firstUnlockedAt: '2026-10-26T00:00:00.000Z', lastLoopId: 'fixture', times: 1 } } };
const output = resolve('outputs/map-polish-20261026'); mkdirSync(output, { recursive: true });
const server = createStaticServer(); await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const errors = [], passed = [];
try {
    for (const completed of [false, true]) {
        for (const chapter of ['first', 'grain']) {
            const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
            const initialGrain = completed ? finishSave : grainSave;
            await context.addInitScript(({ firstSave, initialGrain, completed, collection, GAME_SAVE_KEY, GAME_ENDINGS_KEY, GRAIN_SAVE_KEY, story }) => {
                if (localStorage.getItem('map-actions-seeded')) return;
                localStorage.setItem(GAME_SAVE_KEY, JSON.stringify(firstSave));
                localStorage.setItem(GAME_SAVE_KEY + ':slot:1', JSON.stringify(firstSave));
                localStorage.setItem(GRAIN_SAVE_KEY, JSON.stringify(initialGrain));
                localStorage.setItem(GRAIN_SAVE_KEY + ':slot:1', JSON.stringify(initialGrain));
                localStorage.setItem('grain-prefix-cinematics-v1', JSON.stringify({ version: story.version, completed: [], active: { key: story.start, index: 0, time: 20, rate: 1 } }));
                if (completed) localStorage.setItem(GAME_ENDINGS_KEY, JSON.stringify(collection));
                localStorage.setItem('wuzhang-runtime-mode-v1', 'offline');
                localStorage.setItem('wuzhang-reduced-motion', '1');
                localStorage.setItem('map-actions-seeded', '1');
            }, { firstSave, initialGrain, completed, collection, GAME_SAVE_KEY, GAME_ENDINGS_KEY, GRAIN_SAVE_KEY, story });
            const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
            await page.goto(base); await page.locator('.game-menu').waitFor();
            await page.locator('[data-action=chapters]').click();
            const actions = page.locator('.map-chapter-action');
            assert.equal(await actions.count(), 4);
            for (const id of ['wuzhang', 'grain', 'jieting', 'yiling']) {
                const action = page.locator(`[data-map-node="${id}"] .map-chapter-action`);
                const chapterCompleted = completed && ['wuzhang', 'grain'].includes(id);
                assert.ok((await action.textContent()).startsWith(chapterCompleted ? '重玩这一章' : '继续这一章'), `${id} uses its own completion state`);
                if (id !== 'wuzhang') assert.equal(await action.getAttribute('href'), `/?chapter=${id}${chapterCompleted ? '&restart=1' : ''}`);
            }
            assert.equal(await page.locator('.map-chapter :is(p,details)').count(), 0);
            assert.equal(await page.getByText('回看影像', { exact: true }).count(), 0);
            const key = chapter === 'first' ? GAME_SAVE_KEY : GRAIN_SAVE_KEY;
            const original = await page.evaluate(key => localStorage.getItem(key), key);
            await page.locator(`[data-map-node="${chapter === 'first' ? 'wuzhang' : 'grain'}"] .map-chapter-action`).click();
            await page.locator('.archive-map').waitFor({ state: 'detached' });
            if (chapter === 'grain') await page.locator('.cinema-screen, .grain-game').first().waitFor();
            const state = await page.evaluate(({ key, GAME_ENDINGS_KEY, GRAIN_COMPLETED_KEY }) => ({ save: JSON.parse(localStorage.getItem(key)), backup: localStorage.getItem(key + ':before-new'), manual: localStorage.getItem(key + ':slot:1'), collection: localStorage.getItem(GAME_ENDINGS_KEY), done: localStorage.getItem(GRAIN_COMPLETED_KEY), cinema: JSON.parse(localStorage.getItem('grain-prefix-cinematics-v1')) }), { key, GAME_ENDINGS_KEY, GRAIN_COMPLETED_KEY });
            assert.equal(state.manual, original, 'Manual save stays intact');
            if (completed) {
                assert.equal(state.backup, original, 'Replay backs up old automatic progress');
                assert.deepEqual(JSON.parse(state.collection), collection, 'Replay retains achievements');
                if (chapter === 'first') assert.notEqual(state.save.story.run, firstSave.story.run);
                else {
                    assert.equal(state.save.node, story.start);
                    assert.notEqual(state.save.run, grainSave.run);
                    assert.equal(state.done, 'true');
                    assert.ok(!new URL(page.url()).searchParams.has('restart'));
                    assert.ok(state.cinema.active.time < 5, 'Replay starts first film from beginning');
                    await page.reload(); await page.locator('.cinema-screen').waitFor();
                    assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).run, key), state.save.run, 'Refresh must not restart again');
                    await page.goto(base); await page.locator('.game-menu').waitFor();
                    await page.locator('[data-action=chapters]').click();
                    assert.ok((await page.locator('[data-map-node="grain"] .map-chapter-action').textContent()).startsWith('重玩这一章'), 'Completion remains after replay');
                }
            } else if (chapter === 'first') assert.equal(state.save.story.run, firstSave.story.run);
            else { assert.equal(state.save.node, grainSave.node); assert.equal(state.save.run, grainSave.run); }
            passed.push(`${chapter}: ${completed ? 'replay and retained collection' : 'resume existing progress'}`);
            await context.close();
        }
    }
    assert.deepEqual(errors, []);
    writeFileSync(resolve(output, 'actions-verification.json'), JSON.stringify({ passed, errors }, null, 2));
    console.log('PASS:', passed.join('; '));
} finally { await browser.close(); server.closeAllConnections(); await new Promise(ok => server.close(ok)); }
