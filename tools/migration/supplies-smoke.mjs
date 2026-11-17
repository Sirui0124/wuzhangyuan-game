import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';
import { supplyCatalog } from '../../GameStarter/web-demo/.build/GameStarter/web-demo/src/chapters/chapter-one/supplies.js';
const output = resolve('outputs/supplies-20261024'); mkdirSync(output, { recursive: true });
const server = createStaticServer({ root: resolve('GameStarter/web-demo/.build') });
await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;
const fixture = JSON.parse(readFileSync('GameStarter/web-demo/.build/playtest/weiyan-second.json', 'utf8'));
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const key = 'wuzhang-chapter-session-v1', checks = [], errors = [];
try {
    for (const [width, height, catalogId, result] of [[1366, 768, 'radio-pair', 'radio-relay'], [1280, 720, 'flashlight', 'light-signal']]) {
        const item = 'shop-12345678-1234-4234-8234-123456789012';
        const offer = { ...supplyCatalog.find(p => p.id === catalogId), id: item, icon: '物', source: '', quote: 'AI估价，未核实实时市场价。', priceKind: 'estimate', searchState: 'empty', sources: [], why: '支持你的提议。', request: '帮我买通讯物品' };
        const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
        await context.addInitScript(({ key, fixture }) => {
            localStorage.setItem(key, JSON.stringify(fixture));
            localStorage.setItem('wuzhang-reduced-motion', '1'); localStorage.setItem('wuzhang-voice-muted', '1');
        }, { key, fixture: { ...fixture, supplies: { version: 1, rewards: ['R01', 'R02'], purchases: [item], attached: [], agreement: null, custom: [offer] } } });
        const page = await context.newPage(); page.on('pageerror', e => { errors.push(e.message); console.error(e.message); });
        await page.route('**/api/game/shop', route => {
            const headers = { 'Access-Control-Allow-Origin': base, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
            return route.fulfill(route.request().method() === 'OPTIONS' ? { status: 204, headers } : { status: 200, headers, json: { message: '这是适合这次用途的物品。', products: [offer] } });
        });
        let mode = 'refuse', captured;
        await page.route('**/api/game/respond', async route => {
            const headers = { 'Access-Control-Allow-Origin': base, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
            if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
            const request = route.request().postDataJSON();
            captured = JSON.parse(request.text.slice(request.text.lastIndexOf('\n资料：') + 4));
            const decision = { version: 1, route: mode === 'accept' ? result : null, itemIds: mode === 'accept' ? [item] : [], quote: mode === 'accept' ? captured.current : '', reason: mode === 'accept' ? '物品支持先交接再试验的方案。' : '物品不能证明死亡。' };
            await route.fulfill({ status: 200, headers, json: { text: JSON.stringify({ decision, reply: mode === 'accept' ? '先把军报交清，再试你这物件。' : '只凭这物件，就能断言丞相已死？' }) } });
        });
        const state = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
        await page.goto(base); await page.locator('[data-action=continue]').click({ timeout: 10000 }).catch(async error => { console.error(await page.locator('body').innerText()); throw error; });
        await page.locator('[data-action=supplies]').first().click();
        assert.match(await page.locator('[aria-label=可用资金]').innerText(), /¥0/);
        await page.screenshot({ path: resolve(output, `shop-${width}.png`) });
        assert.deepEqual((await state()).supplies.purchases, [item]);
        await page.locator(`[data-attach-item=${item}]`).click();
        await page.locator('[data-action=close-modal]').click();
        assert.equal(await page.locator('[data-action=generate-expression]').isDisabled(), false);
        await page.locator('#player-expression').fill('这件东西证明诸葛亮已经死了。');
        await page.locator('[data-action=speak]').click();
        await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).speech?.status === 'ready', key);
        assert.equal(captured.items[0].id, item);
        await page.locator('.game-scene').click({ position: { x: 24, y: 300 } });
        assert.equal((await state()).phase, 'reply');
        await page.locator('.game-scene').click({ position: { x: 24, y: 300 } });
        assert.equal((await state()).phase, 'expression');
        assert.deepEqual((await state()).supplies.attached, [item]); mode = 'accept';
        const words = catalogId === 'radio-pair' ? '姜维已在帐外等候，我们立即当面交报并核回令。随后把两台对讲机分给你和姜维，先试通，每次核对身份与军令。'
            : '姜维已答应帐外接报，我们立即交清军报和回令。随后双方约定手电筒灯号并在帐外试过视线，灯号仅作提醒，详细军情仍由人传。';
        await page.locator('#player-expression').fill(words);
        await page.locator('#player-expression').scrollIntoViewIfNeeded();
        await page.screenshot({ path: resolve(output, `expression-${width}.png`) });
        await page.locator('[data-action=save]').click(); await page.locator('[data-store-slot="1"]').click();
        await page.locator('[data-action=close-modal]').click();
        await page.locator('[data-action=save]').click(); await page.locator('[data-load-slot="1"]').click();
        assert.deepEqual((await state()).supplies.attached, [item]);
        await page.locator('[data-action=speak]').click();
        await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).speech?.status === 'ready', key);
        assert.equal((await state()).supplies.agreement, null);
        await page.locator('.game-scene').click({ position: { x: 24, y: 300 } });
        assert.equal((await state()).story.flags.REPORT_CLOSED, undefined);
        for (let step = 0; step < 70 && (await state()).phase !== 'ending'; step++) {
            if (await page.locator('[data-story-film]').count()) {
                const confirm = page.locator('[data-film-confirm]');
                if (!await confirm.isVisible()) await page.locator('[data-cinema-action=skip]').click();
                if (await confirm.isVisible()) await confirm.click();
            } else if ((await state()).phase === 'cinematic') await page.locator('[data-cinema-action=skip]').click();
            else await page.locator('.game-scene').click({ position: { x: 24, y: 300 } });
        }
        assert.equal((await state()).end, result); assert.equal((await state()).story.flags.REPORT_CLOSED, true);
        await page.screenshot({ path: resolve(output, `ending-${width}.png`) });
        assert.equal(await page.locator('.supply-epilogue p').count(), 3);
        const collection = await page.evaluate(() => JSON.parse(localStorage.getItem('wuzhang-chapter-endings-v2')));
        assert.ok(collection.unlocked[result]);
        checks.push(`${width}x${height}: legacy purchase migration, attach, rejection/revision, save/load, actual handoff, ${result}, album unlock`);
        await context.close();
    }
    assert.deepEqual(errors, []);
    writeFileSync(resolve(output, 'browser-report.json'), JSON.stringify({ checks, errors }, null, 2));
    console.log(JSON.stringify({ checks, errors }));
} finally { await browser.close(); await new Promise(ok => server.close(ok)); }
