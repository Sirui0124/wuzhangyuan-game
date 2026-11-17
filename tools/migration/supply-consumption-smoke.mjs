import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ChapterSession } from '../../GameStarter/web-demo/.build/GameStarter/web-demo/src/chapter-session.js';
import { balance } from '../../GameStarter/web-demo/.build/GameStarter/web-demo/src/chapters/chapter-one/supplies.js';
import { buildExpressionInput } from '../../GameStarter/web-demo/.build/GameStarter/web-demo/src/chapters/chapter-one/expression-context.js';
import { answerPhoneQuestion } from '../../GameStarter/web-demo/.build/GameStarter/web-demo/src/game/phone-assistant.js';
import { suppliesHTML, itemInventoryHTML } from '../../GameStarter/web-demo/.build/GameStarter/web-demo/src/chapters/chapter-one/views/supplies.js';

// Run after the current production build. Requests are mocked; the chapter
// session, UI, restore rules, prompt payload and view functions are real.
const base = process.env.PHONE_SMOKE_URL ?? 'http://127.0.0.1:8812';
const origin = new URL(base).origin, key = 'wuzhang-chapter-session-v1';
const output = resolve('outputs/supply-consumption-20261025'); mkdirSync(output, { recursive: true });
const load = path => JSON.parse(readFileSync(path, 'utf8'));
const fixture = load('GameStarter/web-demo/.build/playtest/weiyan-second.json');
const content = load('content/chapters/wuzhang/chapter-one.script.json'), flow = load('content/chapters/wuzhang/chapter-one.flow.json');
const paper = {
    id: 'shop-12345678-1234-4234-8234-123456789012', name: '纸笔记录套装 · 一本一支', price: 1200, icon: '物',
    ability: '现场记录并复核口令。', boundary: '只能记录实际听到的话，不等于他人签署或授权。', source: '',
    quote: '游戏标价，非市场报价。', date: '2026-10-25', priceKind: 'configured', searchState: 'not-needed', sources: [],
    why: '记录核对。', request: '帮我买纸笔', priceKey: 'a'.repeat(64), pricingVersion: 1,
    specification: { item: '纸笔套装', brand: '', model: '', variant: '一本一支', quantity: 1, unit: '套', components: [
        { item: '笔记本', brand: '', model: '', variant: '', quantity: 1, unit: '本' },
        { item: '笔', brand: '', model: '', variant: '', quantity: 1, unit: '支' },
    ] },
};
const cloth = { ...paper, id: 'shop-22345678-1234-4234-8234-123456789012', name: '白布一块', price: 500,
    ability: '遮挡或标记。', boundary: '不能据此证明任何人死亡。', priceKey: 'b'.repeat(64),
    specification: { item: '白布', brand: '', model: '', variant: '普通', quantity: 1, unit: '块', components: [] } };
const initial = structuredClone(fixture);
initial.supplies = { version: 2, rewards: ['weiyan-action'], purchases: [paper.id, cloth.id], attached: [], agreement: null,
    custom: [paper, cloth], penalties: [], consumed: [] };
initial.phone = { version: 1, intent: 'ask', draft: '', pending: false,
    messages: [{ role: 'assistant', text: '已购入纸笔和白布。', products: [paper, cloth] }] };
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const errors = [], checks = [];
function deferred() { let resolve; const promise = new Promise(ok => { resolve = ok; }); return { promise, resolve }; }
const words = '姜维已在帐外等候，我们立即交报并核回令。我用纸笔当面记下口令，读回请他核对。';
try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
    await context.addInitScript(({ key, initial }) => {
        if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(initial));
        localStorage.setItem('wuzhang-voice-muted', '1'); localStorage.setItem('wuzhang-reduced-motion', '1');
    }, { key, initial });
    const page = await context.newPage(); page.setDefaultTimeout(15000); page.on('pageerror', e => errors.push(e.message));
    const headers = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
    let mode = 'reject', nextHold = null, captured;
    await page.route('**/api/game/respond', async route => {
        if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        const request = route.request().postDataJSON();
        captured = JSON.parse(request.text.slice(request.text.lastIndexOf('\n资料：') + 4));
        const accept = mode === 'accept', hold = nextHold; nextHold = null;
        const decision = { version: 1, route: accept ? 'item-plan' : null, itemIds: accept ? [paper.id] : [],
            quote: accept ? captured.current : '', reason: accept ? '纸笔支持现场记录复核。' : '物品本身不能证明死亡。' };
        if (hold) { hold.started.resolve(); await hold.release.promise; }
        try { await route.fulfill({ status: 200, headers, json: { text: JSON.stringify({ decision, reply: '这物件证明不了丞相生死。' }) } }); }
        catch (error) { if (!hold) throw error; }
        finally { hold?.finished.resolve(); }
    });
    const state = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
    const current = async () => { const s = await state(); assert.equal(balance(s.supplies), 3300); return s; };
    const waitReady = () => page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).speech?.status === 'ready', key);
    const advance = () => page.locator('.game-scene').click({ position: { x: 24, y: 300 } });
    const resume = async () => {
        await page.locator('[data-action=continue]').click();
        await page.locator('.game-menu').waitFor({ state: 'hidden' }).catch(async error => {
            writeFileSync(resolve(output, 'restore-failure.json'), JSON.stringify({ state: await state(), text: await page.locator('body').innerText() }, null, 2));
            throw error;
        });
    };
    await page.goto(base); await resume();
    await page.locator('.phone-launcher').click();
    await page.locator(`.phone-panel [data-attach-item="${paper.id}"]`).click();
    await page.locator(`.phone-panel [data-attach-item="${paper.id}"]`).click();
    assert.deepEqual((await current()).supplies.consumed, []); assert.deepEqual((await state()).supplies.attached, []);
    await page.locator(`.phone-panel [data-attach-item="${paper.id}"]`).click();
    await page.locator(`.phone-panel [data-attach-item="${cloth.id}"]`).click();
    await page.locator('[data-action=close-modal]').click();
    await page.locator('#player-expression').fill('这两件东西证明诸葛亮已经死了。'); await page.locator('[data-action=speak]').click(); await waitReady();
    assert.deepEqual(captured.items.map(p => p.id), [paper.id, cloth.id]); assert.deepEqual((await current()).supplies.consumed, []);
    await advance(); assert.equal((await state()).phase, 'reply'); assert.deepEqual((await current()).supplies.consumed, []);
    await advance(); assert.equal((await state()).phase, 'expression');
    checks.push('选择、撤下、判定失败与修改均不消耗，也不退款');

    const held = { started: deferred(), release: deferred(), finished: deferred() }; nextHold = held; mode = 'accept';
    await page.locator('#player-expression').fill(words); await page.locator('[data-action=speak]').click(); await held.started.promise;
    await page.locator('[data-action=cancel-speech]').click(); held.release.resolve(); await held.finished.promise;
    assert.equal((await state()).speech.status, 'cancelled'); assert.deepEqual((await current()).supplies.consumed, []);
    await page.locator('[data-action=revise]').click();
    checks.push('取消后的迟到成功回复不能消耗物品');

    await page.locator('[data-action=speak]').click(); await waitReady();
    assert.deepEqual((await current()).supplies.consumed, []);
    await page.reload(); await resume(); assert.equal((await state()).speech.status, 'ready');
    assert.deepEqual((await current()).supplies.consumed, []);
    await advance();
    const settled = await current();
    assert.deepEqual(settled.supplies.consumed, [paper.id]); assert.deepEqual(settled.supplies.purchases, [paper.id, cloth.id]);
    assert.equal(settled.supplies.custom[0].specification.components.length, 2);
    assert.ok(!settled.supplies.attached.includes(paper.id)); assert.equal(settled.supplies.agreement.route, 'item-plan');
    assert.deepEqual(settled.story.history.at(-1).items, [paper.id, cloth.id]);
    assert.deepEqual(settled.story.history.at(-1).itemDecision.itemIds, [paper.id]);
    await page.reload(); await resume();
    assert.deepEqual((await current()).supplies.consumed, [paper.id]); assert.equal((await state()).supplies.agreement.route, 'item-plan');
    checks.push('成功被确认时只消耗实际使用的整套纸笔；未使用白布保留；刷新不复活或退款');

    const session = new ChapterSession(content, flow, settled.contentVersion); session.restore(JSON.stringify(settled));
    const restored = session.snapshot(); assert.equal(balance(restored.supplies), 3300);
    assert.equal(session.attachItem(paper.id), false);
    const expression = session.expressionContext(words); assert.ok(!(expression.items ?? []).some(item => item.id === paper.id));
    const buildContext = state => ({ state, content, rows: new Map(content.rows.map(row => [row.id, row])), collected: session.collected, graph: () => session.graph() });
    const generated = buildExpressionInput(buildContext(restored));
    assert.ok(!(generated.brief.attachedItems ?? []).some(item => item.id === paper.id));
    const forged = structuredClone(restored); forged.supplies.attached = [paper.id];
    assert.throws(() => buildExpressionInput(buildContext(forged)), /物品|消耗/);
    const nativeFetch = globalThis.fetch; let phonePayload;
    try {
        globalThis.fetch = async (_url, init) => {
            const request = JSON.parse(init.body); phonePayload = JSON.parse(request.text.slice(request.text.lastIndexOf('\n资料：') + 4));
            return Response.json({ text: '纸笔已经用掉，目前还有白布。' });
        };
        await answerPhoneQuestion(session, '刚才买的东西还有什么？', restored.phone.messages, new AbortController().signal);
    } finally { globalThis.fetch = nativeFetch; }
    assert.deepEqual(phonePayload.owned.map(item => item.name), [cloth.name]); assert.equal(phonePayload.budgetYuan, 33);
    checks.push('润色、判定与手机 owned 均排除已消耗物品，历史购买文本不恢复当前持有');

    const audit = await browser.newPage();
    await audit.setContent(suppliesHTML(session, restored, { messages: restored.phone.messages, offers: [paper, cloth], intent: 'ask', query: '', message: '', status: 'idle' }));
    const usedCard = audit.locator('.supply-card').filter({ has: audit.getByRole('heading', { name: paper.name, exact: true }) });
    assert.equal(await usedCard.count(), 1); assert.match(await usedCard.innerText(), /已消耗/);
    assert.equal(await usedCard.locator('[data-attach-item],[data-buy-offer],[data-buy-item]').count(), 0);
    assert.equal(await audit.locator(`[data-attach-item="${cloth.id}"]`).count(), 1);
    await audit.screenshot({ path: resolve(output, 'consumed-purchase-history.png') });
    await audit.setContent(itemInventoryHTML(restored));
    assert.equal(await audit.locator(`[data-inventory-item="item:${paper.id}"]`).count(), 0);
    assert.equal(await audit.locator(`[data-inventory-item="item:${cloth.id}"]`).count(), 1);
    checks.push('历史商品卡保留并标已消耗，无复用按钮；当前库存只剩未消耗物品');

    const legacy = structuredClone(settled); delete legacy.supplies.consumed; legacy.supplies.attached = [paper.id, cloth.id];
    const migrated = new ChapterSession(content, flow, settled.contentVersion); migrated.restore(JSON.stringify(legacy));
    assert.deepEqual(migrated.snapshot().supplies.consumed, [paper.id]);
    assert.deepEqual(migrated.snapshot().supplies.purchases, [paper.id, cloth.id]); assert.equal(balance(migrated.snapshot().supplies), 3300);
    migrated.restore(migrated.serialize()); assert.deepEqual(migrated.snapshot().supplies.consumed, [paper.id]);
    checks.push('缺 consumed 的旧成功档按真实方案迁移一次，保留购买账本与余额');
    assert.deepEqual(errors, []);
    const report = { passed: true, checks, errors }; writeFileSync(resolve(output, 'browser-report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
} finally { await browser.close(); }
