import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';

const server = process.env.GAME_BASE ? null : createStaticServer();
if (server) await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const base = process.env.GAME_BASE || `http://127.0.0.1:${server.address().port}`;
const out = resolve(process.env.CH3_ENDINGS_OUTPUT || 'outputs/chapter-three-integration-20261026/browser-endings');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [], results = [];
const standard = {
    'JT-Q1': 'JT-O018', 'JT-Q2': 'JT-O031', 'JT-Q3': 'JT-O093', 'JT-Q4': 'JT-O111',
    'JT-R1-FIXED': 'JT-O132', 'JT-R2-FIXED': 'JT-O167', 'JT-R3-FIXED': 'JT-O198',
    'JT-R4-FIXED': 'r4-none', 'JT-R5-FIXED': 'r5-none',
    'JT-ROUTE-CHOICE': 'JT-O228', 'JT-WITHDRAW-FIXED': 'JT-O232', 'JT-WITHDRAW-REPLY': 'withdraw-facts',
    'JT-LAST-TASK': 'JT-O251', 'JT-GUARD-CONFIRM': 'guard-go', 'JT-RETREAT-CHOICE': 'JT-O372',
    'JT-LURE-METHOD': 'JT-O278', 'JT-LURE-CONFIRM': 'JT-O305', 'JT-LURE-SIGNAL': 'lure-wait-signal',
};
const report = () => writeFileSync(resolve(out, 'report.json'), JSON.stringify({ base, results, errors }, null, 2));
async function runCase(name, choices, exercise) {
    // Each case gets a new Chromium storage partition. No persisted user profile or real saves are read.
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript(() => {
        localStorage.setItem('wuzhang-runtime-mode-v1', 'offline');
        localStorage.setItem('wuzhang-chapter-history-v1', JSON.stringify({ version: 1, entered: ['wuzhang', 'grain'], completed: ['wuzhang', 'grain'] }));
    });
    await context.route('http://127.0.0.1:8787/health', r => r.fulfill({ headers: { 'Access-Control-Allow-Origin': '*' }, json: { configured: false } }));
    const page = await context.newPage();
    page.on('pageerror', error => errors.push({ case: name, message: error.message }));
    const node = () => page.locator('#game-root').getAttribute('data-node');
    const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('jieting-chapter-three-v1') || 'null'));
    const below = s => 5000 + Object.values(s.roundResults).reduce((sum, r) => sum + (r.arrived ? r.troops : 0), 0);
    const guardScore = s => below(s) / 1000 + (s.scores.w + s.scores.m) / 2 + s.scores.r
        + (s.flags.rearReception && !s.flags.early ? 3 : 0) - (s.flags.failedLure ? 3 : 0);
    let steps = 0;
    async function advance(pick) {
        const previous = await node();
        const readingPage = await page.locator('#game-root').getAttribute('data-reading-page');
        if (pick) await page.locator(`[data-option="${pick}"]`).click();
        else {
            assert.ok(await page.locator('.dialogue-advance').count(), `No advance at ${previous}`);
            await page.locator('.dialogue-advance').click();
        }
        await page.waitForFunction(({ id, readingPage }) => {
            const root = document.querySelector('#game-root');
            return root?.getAttribute('data-node') !== id || root?.getAttribute('data-reading-page') !== readingPage;
        }, { id: previous, readingPage });
        steps++;
    }
    async function walk(target) {
        for (let step = 0; step < 500; step++) {
            const current = await node();
            if (current === target) return;
            const options = page.locator('[data-option]');
            if (await options.count()) {
                const pick = choices[current] ?? standard[current] ?? (current === 'JT-VISIT-REMAINING' ? await options.first().getAttribute('data-option') : null);
                assert.ok(pick, `No explicit choice for ${current}, target ${target}`);
                await advance(pick);
            } else await advance();
        }
        throw new Error(`Did not reach ${target}`);
    }
    try {
        await page.goto(`${base}/?chapter=jieting`, { waitUntil: 'domcontentloaded' });
        await page.locator('[data-node="JT-002"]').waitFor();
        assert.equal(await page.evaluate(() => localStorage.getItem('jieting-chapter-three-completed-v1')), null);
        await exercise({ page, node, saved, below, guardScore, advance, walk });
        const s = await saved();
        results.push({ case: name, steps, node: await node(), ending: s.ending, below: below(s), scores: s.scores, guardScore: guardScore(s), version: s.version });
        report();
    } catch (error) {
        errors.push({ case: name, message: error.message, node: await node().catch(() => null) });
        await page.screenshot({ path: resolve(out, name + '-failure.png') }).catch(() => {});
        report(); throw error;
    } finally { await context.close(); }
}

try {
    await runCase('hold-both', {}, async ({ page, saved, walk }) => {
        await walk('JT-END-HOLD-BOTH');
        assert.equal((await saved()).ending, 'hold-both');
        assert.match(await page.locator('body').innerText(), /马谡生还/);
        assert.equal(await page.evaluate(() => localStorage.getItem('jieting-chapter-three-completed-v1')), 'true');
        await page.screenshot({ path: resolve(out, 'hold-both.png') });
    });
    await runCase('hold-masu-dies', { 'JT-R2-FIXED': 'JT-O168', 'JT-R3-FIXED': 'JT-O199' }, async ({ page, saved, below, walk }) => {
        await walk('JT-END-HOLD-MASU-DIES');
        assert.equal((await saved()).ending, 'hold-masu-dies');assert.equal(below(await saved()), 10000);
        assert.match(await page.locator('body').innerText(), /马谡战死/);
        assert.equal(await page.evaluate(() => localStorage.getItem('jieting-chapter-three-completed-v1')), 'true');
        await page.screenshot({ path: resolve(out, 'hold-masu-dies.png') });
    });
    await runCase('below-threshold-retreat-and-retry', {
        'JT-Q1': 'JT-O016', 'JT-Q2': 'JT-O029', 'JT-Q3': 'JT-O085', 'JT-Q4': 'JT-O107',
        'JT-R1-FIXED': 'JT-O133', 'JT-R2-FIXED': 'JT-O168', 'JT-R3-FIXED': 'JT-O199',
    }, async ({ page, node, saved, below, advance, walk }) => {
        await walk('JT-223');assert.equal(below(await saved()),5000);await advance();
        assert.equal(await node(),'JT-225');assert.equal(await page.locator('[data-option="JT-O229"]').count(),0);
        await walk('JT-END-RETREAT');assert.equal((await saved()).ending,'retreat');
        assert.equal(await page.evaluate(() => localStorage.getItem('jieting-chapter-three-completed-v1')),null);
        await page.locator('[data-action="retry"]').click();await page.locator('[data-node="JT-GUARD-CONFIRM"]').waitFor();
        assert.equal((await saved()).ending,null);assert.equal(below(await saved()),5000);
        assert.ok(await page.locator('[data-option="guard-adjust"]').count());
    });
    await runCase('premature-signal-then-guard', { 'JT-Q2': 'JT-O029', 'JT-ROUTE-CHOICE': 'JT-O229' }, async ({ node, saved, guardScore, advance, walk }) => {
        await walk('JT-LURE-SIGNAL');const initial=await saved();const initialScore=guardScore(initial);
        assert.equal(initial.flags.lureExecuted,true);assert.notEqual(initial.flags.failedLure,true);
        await advance('lure-rush-signal');assert.equal(await node(),'JT-LURE-PREMATURE');
        assert.notEqual((await saved()).flags.failedLure,true);assert.equal(guardScore(await saved()),initialScore);
        await walk('JT-318');assert.notEqual((await saved()).flags.failedLure,true);assert.equal(guardScore(await saved()),initialScore);
        await advance();assert.equal(await node(),'JT-319');assert.equal((await saved()).flags.failedLure,true);assert.equal(guardScore(await saved()),initialScore-3);
        await walk('JT-231');assert.equal((await saved()).flags.lurePlanReady,false);
        await walk('JT-END-HOLD-BOTH');assert.equal((await saved()).ending,'hold-both');
    });
    assert.deepEqual(errors, []); report(); console.log(JSON.stringify({ results, errors }, null, 2));
} finally {
    await browser.close();
    if (server) { server.closeAllConnections(); await new Promise(ok => server.close(ok)); }
}
