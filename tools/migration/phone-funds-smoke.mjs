import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const origin = 'http://127.0.0.1:8812', key = 'wuzhang-chapter-session-v1';
const fixture = JSON.parse(readFileSync('GameStarter/web-demo/.build/playtest/weiyan-second.json', 'utf8'));
const output = 'outputs/phone-funds-20261024'; mkdirSync(output, { recursive: true });
const product = { id: `shop-${randomUUID()}`, name: '纸笔套装', price: 1200, icon: '物', ability: '记录文字。', boundary: '不能证明未见之事。',
    source: '', quote: '独立估价，未核实市场价。', date: '2026-10-24', priceKind: 'estimate', searchState: 'empty', sources: [], why: '方便记录。', request: '买纸笔' };
const headers = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const browser = await chromium.launch({ headless: true, channel: 'chrome' }), checks = [];
try {
    for (const available of [0, 1199, 1200]) {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
        const saved = structuredClone(fixture); saved.supplies.penalties = [{ id: randomUUID(), amount: 5000 - available }];
        saved.phone = { version: 1, messages: [], intent: 'ask', draft: '', pending: false };
        await context.addInitScript(({ key, saved }) => {
            if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(saved));
            localStorage.setItem('wuzhang-voice-muted', '1');
        }, { key, saved });
        const page = await context.newPage(), errors = []; let confirmations = 0;
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/api/game/**', async route => {
            if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
            const path = new URL(route.request().url()).pathname;
            if (path.endsWith('/phone/guard')) return route.fulfill({ headers, json: { blocked: false } });
            if (path.endsWith('/shop/confirm')) { confirmations++; return route.fulfill({ headers, json: { product } }); }
            if (path.endsWith('/shop')) return route.fulfill({ headers, json: { message: '可以用它记下军令。', products: [product] } });
            if (path.endsWith('/respond')) return route.fulfill({ headers, json: { text: '我在，可以继续问。' } });
            await route.continue();
        });
        await page.goto(origin); await page.locator('[data-action=continue]').click(); await page.locator('.phone-launcher').click();
        await page.locator('#shopping-query').fill('买纸笔'); await page.locator('[data-action=search-supplies]').click();
        const buy = page.locator('[data-buy-offer]'); await buy.waitFor();
        if (available < 1200) {
            assert.equal(await buy.isDisabled(), true);
            assert.equal(await buy.innerText(), available === 0 ? '余额为0' : '还差¥0.01');
            // Exercise the controller too: DOM button state must not be the only guard.
            await buy.evaluate(button => { button.disabled = false; button.click(); });
            await page.getByText(available === 0 ? '余额为¥0，暂时无法购买。' : '余额不足，还差¥0.01。', { exact: true }).waitFor();
            assert.equal(confirmations, 0); assert.equal(await buy.isDisabled(), true);
            assert.deepEqual(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).supplies.purchases, key), []);
        } else {
            assert.equal(await buy.isDisabled(), false); await buy.click();
            await page.locator('[data-attach-item]').waitFor(); assert.equal(confirmations, 1);
            assert.equal(await page.locator('[aria-label=可用资金]').innerText(), '¥0');
            await page.locator('[data-attach-item]').click();
            assert.deepEqual(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).supplies.attached, key), [product.id]);
        }
        await page.locator('#shopping-query').fill('我想问问，还能继续说话吗？'); await page.locator('[data-action=search-supplies]').click();
        await page.getByText('我在，可以继续问。', { exact: true }).waitFor();
        await page.screenshot({ path: `${output}/balance-${available}.png` });
        await page.reload(); await page.locator('[data-action=continue]').click(); await page.locator('.phone-launcher').click();
        assert.equal(await page.locator('[aria-label=可用资金]').innerText(), available === 1199 ? '¥11.99' : '¥0');
        if (available < 1200) assert.equal(await page.locator('[data-buy-offer]').isDisabled(), true);
        assert.deepEqual(errors, []); checks.push({ initialFen: available, confirmations, noPageErrors: true });
        await context.close();
    }
    writeFileSync(`${output}/verification.json`, JSON.stringify({ passed: true, checks }, null, 2));
    console.log(JSON.stringify({ passed: true, checks }));
} finally { await browser.close(); }
