import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const base = process.env.GAME_BASE || 'http://127.0.0.1:8812';
const out = resolve('outputs/chapter-three-integration-20261026/browser'); mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [], results = [];
try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.route('http://127.0.0.1:8787/health', r => r.fulfill({ headers: { 'Access-Control-Allow-Origin': '*' }, json: { configured: false } }));
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${base}/?chapter=jieting`, { waitUntil: 'domcontentloaded' }); await page.locator('[data-node="JT-002"]').waitFor();
    await page.screenshot({ path: resolve(out, 'opening.png') });
    await page.getByRole('button', { name: '线索', exact: true }).click();
    assert.match(await page.locator('.game-modal').innerText(), /还没有收录线索/);
    await page.locator('[data-action=close-modal]').click();
    const node = () => page.locator('#game-root').getAttribute('data-node');
    const picks = { 'JT-Q1': 'JT-O018', 'JT-Q2': 'JT-O029', 'JT-Q3': 'JT-O093', 'JT-Q4': 'JT-O111',
        'JT-R1-FIXED': 'JT-O132', 'JT-R2-FIXED': 'JT-O167', 'JT-R3-FIXED': 'JT-O198',
        'JT-ROUTE-CHOICE': 'JT-O229', 'JT-LURE-METHOD': 'JT-O278', 'JT-LURE-CONFIRM': 'JT-O305', 'JT-LURE-SIGNAL': 'lure-wait-signal' };
    const seenScenes = new Set(), captures = new Set();
    async function walk(target, choices = picks, max = 450) {
        for (let step = 0; step < max; step++) {
            const current = await node();
            if (current === target) return;
            const readingPage = await page.locator('#game-root').getAttribute('data-reading-page');
            const scene = await page.locator('[data-scene]').getAttribute('data-scene').catch(() => null);
            if (scene) seenScenes.add(scene);
            if (['JT-Q1', 'JT-R1-FIXED', 'JT-LURE-CONFIRM', 'JT-153'].includes(current) && !captures.has(current)) {
                captures.add(current); await page.screenshot({ path: resolve(out, current + '.png') });
            }
            const options = page.locator('[data-option]');
            if (await options.count()) {
                const pick = choices[current] ?? (current === 'JT-VISIT-REMAINING' ? await options.first().getAttribute('data-option') : null);
                assert.ok(pick, `No explicit smoke choice at ${current}`);
                await page.locator(`[data-option="${pick}"]`).click();
            } else {
                assert.ok(await page.locator('.dialogue-advance').count(), `Stalled ${current}: ${await page.locator('body').innerText()}`);
                await page.locator('.dialogue-advance').click();
            }
            await page.waitForFunction(({ id, readingPage }) => {
                const root = document.querySelector('#game-root');
                return root?.getAttribute('data-node') !== id || root?.getAttribute('data-reading-page') !== readingPage;
            }, { id: current, readingPage });
        }
        throw new Error(`Did not reach ${target}`);
    }
    await walk('JT-END-GREAT-VICTORY');
    assert.equal(await page.locator('.clue-receipt').count(), 0);
    await page.screenshot({ path: resolve(out, 'great-victory.png') });
    const completed = await page.evaluate(() => localStorage.getItem('jieting-chapter-three-completed-v1'));
    assert.equal(completed, 'true');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('jieting-chapter-three-v1')));
    assert.equal(saved.ending, 'great-victory');
    assert.equal(saved.visits.length, 3);
    assert.equal(saved.clueIds.length, 12);
    assert.equal(Object.values(saved.roundResults).reduce((n, r) => n + (r.arrived ? r.troops : 0), 5000), 20000);
    await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('[data-node="JT-END-GREAT-VICTORY"]').waitFor();
    await page.locator('[data-action=onward]').click(); await page.locator('[data-action=map]').click();
    await page.locator('[data-map-node=jieting]').waitFor();
    assert.match(await page.locator('[data-map-node=jieting]').innerText(), /已通关/);
    results.push('offline opening through all three rounds to great victory; actual clue/arrival gates; save restore; map completion');

    const beforeMain = await page.evaluate(() => localStorage.getItem('jieting-chapter-three-v1'));
    await page.goto(`${base}/?chapter=jieting&playtest=reinforcement`, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-node="JT-R1-FIXED"]').waitFor();
    await page.setViewportSize({ width: 1366, height: 768 }); await page.screenshot({ path: resolve(out, 'reinforcement-1366.png') });
    const fits = await page.locator('[data-option]').evaluateAll(nodes => nodes.every(n => { const r = n.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth; }));
    assert.ok(fits, 'Ordinary choices are within the viewport');
    await page.locator('[data-action=pause]').click(); await page.locator('[data-action=pause-save]').click();
    await page.locator('[data-store-slot="1"]').click();
    await page.locator('[data-action=close-modal]').click(); await page.locator('[data-action=resume-game]').click();
    await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('[data-node="JT-R1-FIXED"]').waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem('jieting-chapter-three-v1')), beforeMain);
    results.push('isolated repeatable reinforcement entry; ordinary choice layout; pause and save');

    assert.deepEqual(errors, []);
    const report = { results, scenesSeen: [...seenScenes], errors };
    writeFileSync(resolve(out, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
