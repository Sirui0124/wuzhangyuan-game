import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const key = 'wuzhang-chapter-session-v1:supplies-playtest';
const product = { id: 'shop-12345678-1234-4234-8234-123456789012', name: '纸笔套装', price: 1200, icon: '物', ability: '书写记录。', boundary: '只记录真实听到的信息。', source: '', quote: 'AI估价，未核实实时市场价。', date: '2026-10-24', priceKind: 'estimate', searchState: 'empty', sources: [], why: '记录用。', request: '帮我买纸笔' };
try {
    const context = await browser.newContext(); const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const headers = { 'Access-Control-Allow-Origin': 'http://127.0.0.1:8812', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
    let calls = 0, captured, delay = false, release, notify;
    const guarded = new Map();
    await page.route('**/api/game/phone/guard', async route => {
        if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        const { requestId, query } = route.request().postDataJSON();
        assert.match(requestId, /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i); assert.equal(typeof query, 'string'); guarded.set(requestId, query);
        await route.fulfill({ status: 200, headers, json: { blocked: false } });
    });
    await page.route('**/api/game/shop/confirm', async route => {
        if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        assert.deepEqual(route.request().postDataJSON(), { offerId: product.id });
        await route.fulfill({ status: 200, headers, json: { product } });
    });
    await page.route('**/api/game/respond', async route => {
        if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        calls++; captured = route.request().postDataJSON().text;
        if (delay) { const waiting = new Promise(ok => { release = ok; }); notify(); await waiting; }
        try { await route.fulfill({ status: 200, headers, json: { text: delay ? '迟到的回复不该覆盖新档。' : '纸笔可记录，但不能凭空证明一个人的生死。' } }); } catch { /* request aborted by reload */ }
    });
    await page.route('**/api/game/shop', route => {
        if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        const body = route.request().postDataJSON(); assert.ok(body.guardRequestId); assert.equal(guarded.get(body.guardRequestId), body.query);
        return route.fulfill({ status: 200, headers, json: { message: '这套纸笔可以做记录。', products: [product] } });
    });
    const state = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
    const refreshPhone = async () => { await page.reload(); await page.locator('#shopping-query').waitFor(); };
    await page.goto('http://127.0.0.1:8812/?playtest=supplies');
    await page.locator('#shopping-query').fill('我想问问纸笔能做什么？'); await page.locator('[data-action=search-supplies]').click();
    await page.locator('.phone-message.assistant').filter({ hasText: '纸笔可记录' }).waitFor();
    await page.locator('#shopping-query').fill('帮我买纸笔'); await page.locator('[data-action=search-supplies]').click();
    await page.locator('[data-buy-offer]').waitFor();
    await page.locator('#shopping-query').fill('我想问问这是没发出的草稿');
    const savedChat = (await state()).phone;
    await page.locator('[data-action=close-modal]').click(); await page.locator('[data-action=save]').click();
    await page.locator('[data-store-slot="1"]').click(); await page.locator('[data-action=close-modal]').click();
    await refreshPhone();
    assert.deepEqual((await state()).phone, savedChat); assert.equal(await page.locator('#shopping-query').inputValue(), savedChat.draft);
    assert.equal(await page.locator('.phone-message.user').count(), 2); assert.equal(calls, 1);
    await page.locator('[data-buy-offer]').click();
    await page.waitForFunction(({ key, id }) => JSON.parse(localStorage.getItem(key)).supplies.purchases.includes(id), { key, id: product.id });
    assert.equal((await state()).supplies.purchases.length, 1);
    await page.locator('[data-attach-item]').click();
    const boughtChat = (await state()).phone; await refreshPhone();
    assert.deepEqual((await state()).phone, boughtChat); assert.equal(await page.locator('[data-buy-offer]').count(), 0);
    assert.match(await page.locator('[aria-label=可用资金]').innerText(), /38/);
    await page.locator('#shopping-query').fill('我想问问刚才的东西如何使用？'); await page.locator('[data-action=search-supplies]').click();
    await page.waitForFunction(() => !document.querySelector('[data-action=cancel-shopping]'));
    assert.match(captured, /纸笔可记录/); assert.match(captured, /纸笔套装/);
    await page.locator('[data-action=close-modal]').click(); await page.locator('[data-action=save]').click(); await page.locator('[data-load-slot="1"]').click();
    await page.locator('.phone-launcher').click();
    assert.deepEqual((await state()).phone, savedChat); assert.deepEqual((await state()).supplies.purchases, []);
    delay = true; const requested = new Promise(ok => { notify = ok; });
    await page.locator('#shopping-query').fill('我想问问回复中刷新'); await page.locator('[data-action=search-supplies]').click(); await requested;
    assert.equal((await state()).phone.pending, true); const requestsBeforeReload = calls;
    await refreshPhone(); release();
    assert.equal(calls, requestsBeforeReload); assert.equal((await state()).phone.pending, false);
    assert.match(await page.locator('.shopping-status').innerText(), /尚未完成/);
    assert.equal(await page.locator('#shopping-query').inputValue(), '我想问问回复中刷新');
    assert.equal(await page.getByText('迟到的回复不该覆盖新档。', { exact: true }).count(), 0);
    await page.locator('[data-action=close-modal]').click(); await page.locator('[data-action=menu]').click();
    await page.locator('[data-action=new]').click(); await page.locator('[data-action=new-confirmed]').click();
    assert.deepEqual((await state()).phone.messages, []); assert.equal((await state()).phone.draft, '');
    assert.deepEqual((await state()).supplies.purchases, []); assert.deepEqual((await state()).supplies.rewards, []);
    await page.reload(); assert.deepEqual((await state()).phone.messages, []);
    assert.equal(await page.evaluate(() => localStorage.getItem('wuzhang-chapter-session-v1')), null);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed: true, checks: ['Same chapter refresh preserves conversation, draft, offer, purchase receipt, balance and attachment', 'Restored quotes remain buyable; follow-up uses restored history; manual load restores matching chat', 'Pending reload keeps words without restarting request; late response ignored; new game clears chat; playtest stays isolated'], errors }));
} finally { await browser.close(); }
