import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
mkdirSync('outputs/phone-20261024', { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const fixture = JSON.parse(readFileSync('GameStarter/web-demo/.build/playtest/weiyan-second.json', 'utf8'));
const key = 'wuzhang-chapter-session-v1';
const product = { id: 'shop-12345678-1234-4234-8234-123456789012', name: '白布一块 <img src=x onerror=alert(1)>', price: 1200, icon: '物',
    ability: '遮挡或展示约定标识。', boundary: '白布本身不能证明有人死亡。', source: '', quote: 'AI估价，未核实实时市场价。', date: '2026-10-24',
    priceKind: 'estimate', searchState: 'unavailable', sources: [], why: '按描述用途准备。', request: '买一块白布' };
try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await context.addInitScript(({ key, fixture }) => {
        localStorage.setItem(key, JSON.stringify(fixture)); localStorage.setItem('wuzhang-voice-muted', '1');
    }, { key, fixture });
    const page = await context.newPage(); const errors = [], dialogs = [];
    page.on('pageerror', e => errors.push(e.message)); page.on('dialog', async d => { dialogs.push(d.message()); await d.dismiss(); });
    let mode = 'fail', release, received, shopCalls = 0, askCalls = 0, guardCalls = 0, confirmCalls = 0;
    const headers = { 'Access-Control-Allow-Origin': 'http://127.0.0.1:8812', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
    const guarded = new Map();
    await page.route('**/api/game/phone/guard', async route => {
        if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        const { requestId, query } = route.request().postDataJSON();
        assert.match(requestId, /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i); assert.equal(typeof query, 'string');
        guardCalls++; guarded.set(requestId, query);
        await route.fulfill({ status: 200, headers, json: { blocked: false } });
    });
    await page.route('**/api/game/shop/confirm', async route => {
        if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        assert.deepEqual(route.request().postDataJSON(), { offerId: product.id }); confirmCalls++;
        await route.fulfill({ status: 200, headers, json: { product } });
    });
    const response = { message: '白布用途需结合实际说法判断。', products: [product] };
    await page.route('**/api/game/shop', async route => {
        if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        const body = route.request().postDataJSON(); assert.ok(body.guardRequestId); assert.equal(guarded.get(body.guardRequestId), body.query);
        shopCalls++; const currentMode = mode; received?.();
        if (currentMode === 'delay') await new Promise(ok => { release = ok; });
        try { await route.fulfill({ status: currentMode === 'fail' ? 502 : 200, headers,
            json: currentMode === 'fail' ? { error: '查询失败，请重试。' } : currentMode === 'expensive' ? { ...response, products: [{ ...product, id: product.id.replace('12345678', '22345678'), price: 999000 }] } : response }); } catch { /* An aborted browser request may already be disposed. */ }
    });
    await page.route('**/api/game/respond', async route => {
        const headers = { 'Access-Control-Allow-Origin': 'http://127.0.0.1:8812', 'Access-Control-Allow-Headers': 'Content-Type' };
        if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        askCalls++; assert.match(route.request().postDataJSON().text, /knownEvidence/);
        await route.fulfill({ status: 200, headers, json: { text: '白布可以用作约定好的信号，但它本身不能证明一个人的生死。' } });
    });
    const state = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
    await page.goto('http://127.0.0.1:8812/'); await page.locator('[data-action=continue]').click();
    await page.locator('.phone-launcher').waitFor();
    await page.screenshot({ path: 'outputs/phone-20261024/side-button.png' });
    await page.locator('.phone-launcher').click();
    assert.equal(await page.locator('[data-phone-tab]').count(), 0);
    assert.equal(await page.locator('[data-phone-prompt]').count(), 2);
    const before = await state();
    await page.locator('[data-phone-prompt=ask]').click();
    assert.equal(await page.locator('#shopping-query').inputValue(), '我想问问');
    assert.equal(askCalls + shopCalls + guardCalls, 0); assert.ok(await page.locator('[data-action=search-supplies]').isDisabled());
    await page.locator('#shopping-query').fill('我想问问白布能证明有人死了吗？');
    await page.locator('#shopping-query').press('Enter');
    await page.getByText('白布可以用作约定好的信号，但它本身不能证明一个人的生死。', { exact: true }).waitFor();
    assert.equal(askCalls, 1); assert.equal(shopCalls, 0);
    const afterQuestion = await state(); assert.deepEqual({ ...afterQuestion, phone: null, savedAt: '' }, { ...before, phone: null, savedAt: '' });
    await page.locator('[data-action=close-modal]').click(); await page.locator('.phone-launcher').click();
    assert.equal(await page.locator('.phone-message.user').count(), 1);
    await page.screenshot({ path: 'outputs/phone-20261024/chat-1280.png' });
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.screenshot({ path: 'outputs/phone-20261024/chat-1366.png' });
    await page.locator('[data-phone-prompt=buy]').click();
    assert.equal(await page.locator('#shopping-query').inputValue(), '帮我买');
    await page.locator('#shopping-query').fill('买一块白布');
    await page.locator('[data-action=search-supplies]').click(); await page.getByText('查询失败，请重试。', { exact: true }).waitFor();
    assert.equal(await page.locator('#shopping-query').inputValue(), '买一块白布');
    mode = 'delay'; const requested = new Promise(ok => { received = ok; });
    await page.locator('[data-action=search-supplies]').click(); await requested;
    await page.locator('[data-action=cancel-shopping]').click();
    assert.equal(await page.locator('#shopping-query').inputValue(), '买一块白布');
    release();
    mode = 'expensive'; await page.locator('[data-action=search-supplies]').click();
    await page.locator('[data-buy-offer]').waitFor(); assert.ok(await page.locator('[data-buy-offer]').isDisabled());
    assert.deepEqual((await state()).supplies.purchases, []);
    mode = 'ready'; await page.locator('#shopping-query').fill('请找一块便宜的白布');
    await page.locator('[data-action=search-supplies]').click(); await page.locator('[data-buy-offer]:not([disabled])').waitFor();
    assert.ok(await page.locator('.shopping-results').last().innerText().then(s => s.includes('<img src=x onerror=alert(1)>')));
    assert.equal(await page.locator('.shopping-results img').count(), 0);
    await page.locator('[data-buy-offer]:not([disabled])').click();
    await page.waitForFunction(({ key, id }) => JSON.parse(localStorage.getItem(key)).supplies.purchases.includes(id), { key, id: product.id });
    assert.equal((await state()).supplies.purchases.length, 1); assert.equal((await state()).supplies.custom[0].price, 1200);
    assert.equal(confirmCalls, 1); assert.equal(guardCalls, askCalls + shopCalls);
    assert.equal(await page.locator('[data-buy-offer]:not([disabled])').count(), 0);
    assert.match(await page.locator('[aria-label=可用资金]').innerText(), /38/);
    await page.locator('[data-attach-item]').click(); assert.deepEqual((await state()).supplies.attached, [product.id]);
    const locked = await browser.newContext();
    await locked.addInitScript(({ key, fixture }) => localStorage.setItem(key, JSON.stringify(fixture)), { key, fixture: JSON.parse(readFileSync('GameStarter/web-demo/.build/playtest/weiyan-first.json', 'utf8')) });
    const lockedPage = await locked.newPage(); await lockedPage.goto('http://127.0.0.1:8812/'); await lockedPage.locator('[data-action=continue]').click();
    assert.equal(await lockedPage.locator('[data-action=supplies]').count(), 0); await locked.close();
    assert.deepEqual(errors, []); assert.deepEqual(dialogs, []);
    console.log(JSON.stringify({ passed: true, checks: ['Locked phone absent; unlocked side button; one chat page; prompt chips fill without sending; question is read-only; close/reopen retains chat', 'Failed query retains draft; cancellation rejects late offer; over-budget quote cannot buy; escaped product name; explicit purchase updates wallet and supports attachment'], errors }));
} finally { await browser.close(); }
