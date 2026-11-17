import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Every API endpoint is intercepted in a fresh, non-persistent browser context.
// Progress, income, purchases and troops are obtained through the game UI only.
const base = process.env.GAME_BASE || 'http://127.0.0.1:8812';
const output = resolve('outputs/chapter-three-integration-20261026/browser-online');
mkdirSync(output, { recursive: true });
const report = { mockedApi: true, persistentBrowser: false, results: [], requests: [], pageErrors: [], unexpectedRequests: [], screenshots: [], layouts: [] };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const keys = ['gapEstablished', 'reinforcementUse', 'concernAnswered', 'risk', 'route', 'reception', 'motive', 'means', 'withdrawal'];
const product = {
    id: 'shop-00000000-0000-4000-8000-000000000001', name: '自带电池的录音喇叭', price: 5000, icon: '物',
    ability: '按键播放预录声音，内置已充电电池。', boundary: '仅能播放预录内容，声音能传多远须实地试用。',
    source: '', quote: '受控测试标价50元', date: '2026-10-26', priceKind: 'configured', why: '供界面集成测试的虚拟商品。',
    request: '帮我买一只自带电池的录音喇叭', searchState: 'not-needed', sources: [], pricingVersion: 1, priceKey: 'a'.repeat(64),
    specification: { item: '录音喇叭', brand: '', model: '', variant: '自带已充电电池', quantity: 1, unit: '台', components: [] },
};
const emptyCriterion = () => ({ value: false, quote: '', evidenceIds: [], itemIds: [], reason: '' });
const promptData = text => JSON.parse(text.slice(text.lastIndexOf('\n') + 1));
function judgment(data, followup = false, adoptItem = false) {
    const evidence = data.context.ownedClues.find(c => c.id === 'JT-C04' && c.current !== false) ?? data.context.ownedClues.find(c => c.current !== false);
    assert.ok(evidence, 'Fixture must have an actually acquired clue');
    const raw = {
        version: 1, valid: true, factsReliable: true, factualIssues: [], maintain: { value: false, quote: '' },
        criteria: Object.fromEntries(keys.map(key => [key, emptyCriterion()])),
        acknowledgment: followup ? '正面和侧路都要人，这个缺口我听明白了。' : '把守路的人手和赶路的工夫一并算进去，这个办法说得通。',
        followup: { needed: followup, question: followup ? '为什么不能等山下告急以后再派人？' : '' },
        offense: { direct: false, target: 'none', kind: 'none', context: 'asserted', intent: 'argument', targetQuote: '', actQuote: '', quote: '', reason: '正常进言' },
        eraAssessment: { version: 1, severeMismatch: false, explanation: 'coherent', itemIds: [], quote: '', reason: '正常试用与军情讨论' },
        deploymentTasks: [{ task: 'road', quote: data.playerWords }],
    };
    for (const key of ['gapEstablished', 'reinforcementUse', ...(followup ? [] : ['concernAnswered'])]) raw.criteria[key] = {
        value: true, quote: data.playerWords, evidenceIds: [evidence.id], itemIds: adoptItem && key === 'reinforcementUse' ? [product.id] : [],
        reason: '当前已获军报支持守路需要，玩家建议由将领批准提前部署。',
    };
    if (adoptItem) assert.ok(data.context.items.some(i => i.id === product.id && i.available && i.shown && i.tested), 'Adopt only a real UI-purchased, attached, confirmed trial item');
    return raw;
}
function trial(data) {
    assert.equal(data.item.id, product.id);
    return { version: 1, status: 'ready', supportedOperation: true, operationQuote: data.playerOperation,
        requirements: [{ text: '播放需要电源', satisfied: true, sourceItemIds: [product.id], specQuote: '内置已充电电池' }],
        effect: '喇叭响起预录喊声，停止播放后声音停下。', effectSources: [{ itemId: product.id, quote: '按键播放预录声音' }],
        feedback: '帐侧能听清声音，远处是否听得见，还不能据此保证。' };
}
async function fixture(kind) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
    await context.addInitScript(() => { if (!/^https?:$/.test(location.protocol)) return; localStorage.setItem('wuzhang-runtime-mode-v1', 'ai-phone'); localStorage.setItem('wuzhang-phone-enabled-v1', '1'); localStorage.setItem('wuzhang-item-system-enabled-v1', '1'); });
    const controls = { next: 'great', pending: null, modelCalls: 0 };
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
    await context.route('http://127.0.0.1:8787/**', async route => {
        const request = route.request(), path = new URL(request.url()).pathname;
        if (request.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return; }
        report.requests.push({ fixture: kind, path, method: request.method(), mocked: true });
        const reply = json => route.fulfill({ headers, json });
        if (path === '/health') return reply({ configured: true });
        if (path === '/api/game/settings') return reply({ apiKey: 'fixture-only-key', baseUrl: 'https://example.test/v1', model: 'mock-jieting' });
        if (path === '/api/game/phone/guard') return reply({ blocked: false });
        if (path === '/api/game/shop') return reply({ message: '这只喇叭自带电池，可先在帐侧试用。', products: [product] });
        if (path === '/api/game/shop/confirm') { assert.equal(request.postDataJSON().offerId, product.id); return reply({ product }); }
        if (path === '/api/game/respond') {
            const body = request.postDataJSON(), data = promptData(body.text); controls.modelCalls++;
            if (body.text.startsWith('你核对街亭')) return reply({ text: JSON.stringify(trial(data)), responseId: 'trial-fixture' });
            assert.ok(body.text.startsWith('你在《逆转五丈原》第三章街亭中'), 'Unexpected model purpose');
            const mode = controls.next; controls.next = 'great';
            const response = { text: JSON.stringify(judgment(data, mode === 'followup', mode === 'adopt')), responseId: `judgment-${controls.modelCalls}` };
            if (mode === 'hold') {
                await new Promise(resolve => { controls.pending = async () => { try { await reply(response); } catch { /* The tested browser request was explicitly aborted. */ } finally { resolve(); } }; });
                return;
            }
            return reply(response);
        }
        report.unexpectedRequests.push(path); return route.fulfill({ status: 501, headers, json: { error: 'Unexpected endpoint blocked by smoke' } });
    });
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    page.on('pageerror', error => report.pageErrors.push({ fixture: kind, message: error.message }));
    await page.goto(`${base}/?chapter=jieting&playtest=${kind}`, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-node="JT-OPEN-R1"]').waitFor();
    const saveKey = `jieting-chapter-three-v1:playtest:${kind}`;
    const state = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), saveKey);
    const click = selector => page.locator(selector).click({ noWaitAfter: true });
    const shot = async name => { const file = resolve(output, name + '.png'); await page.screenshot({ path: file }); report.screenshots.push(file); };
    const close = () => click('[data-action=close-modal]');
    return { context, controls, page, state, click, shot, close };
}
const below = state => 5000 + Object.values(state.roundResults).reduce((n, round) => n + (round.arrived ? round.troops : 0), 0);
const balance = state => (state.supplies.worldItems.sold.includes('fuhu-wood-tiger') ? 50000 : 0) - state.supplies.custom.reduce((n, item) => n + (state.supplies.purchases.includes(item.id) ? item.price : 0), 0) - state.supplies.penalties.reduce((n, p) => n + p.amount, 0);
async function throughArrival(f, adopt = false) {
    let s = await f.state(); assert.equal(below(s), 5000); assert.equal(s.roundResults[1].ordered, false); assert.equal(s.roundResults[1].arrived, false);
    let orderSeen = false;
    for (let i = 0; i < 20; i++) {
        await f.click('.dialogue-advance'); s = await f.state();
        if (s.roundResults[1].ordered && !orderSeen) { orderSeen = true; assert.equal(below(s), 5000, 'Order alone must not count as arrival'); if (adopt) assert.deepEqual(s.supplies.consumed, [product.id]); }
        if (s.roundResults[1].arrived) { assert.ok(orderSeen); assert.equal(below(s), 10000); return s; }
        assert.equal(below(s), 5000);
    }
    throw new Error('The first reinforcement never arrived');
}
async function checkExpressionLayout(f) {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }]) {
        await f.page.setViewportSize(viewport); await f.page.evaluate(() => document.fonts.ready);
        const layout = await f.page.evaluate(() => {
            const paper = document.querySelector('.expression-paper'), input = document.querySelector('#player-expression');
            const action = document.querySelector('[data-action=speak]'), question = document.querySelector('.expression-current-reply p');
            const style = getComputedStyle(paper), p = paper.getBoundingClientRect(), t = input.getBoundingClientRect(), a = action.getBoundingClientRect();
            return { width: innerWidth, height: innerHeight, inputRatio: t.width / (p.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)),
                submitBelowInput: a.top >= t.bottom, questionWhiteSpace: getComputedStyle(question).whiteSpace,
                questionNotClipped: question.scrollWidth <= question.clientWidth + 1, submitWithinViewport: a.bottom <= innerHeight };
        });
        report.layouts.push(layout); assert.ok(layout.inputRatio >= .8, 'Input should span the single-column paper');
        assert.ok(layout.submitBelowInput, 'Submit button belongs below the draft'); assert.equal(layout.questionWhiteSpace, 'normal');
        assert.ok(layout.questionNotClipped, 'The followup should remain fully readable'); assert.ok(layout.submitWithinViewport);
        await f.shot(`reinforcement-followup-${viewport.width}`);
    }
    await f.page.setViewportSize({ width: 1440, height: 900 });
}
try {
    const readyUntil = Date.now() + 45000;
    while (true) {
        try {
            const response = await fetch(`${base}/__local/status`, { signal: AbortSignal.timeout(5000) });
            if (response.ok) { const status = await response.json(); if (status.phase === 'ready') { report.build = { phase: status.phase, id: status.current?.id }; break; } }
        } catch { /* The local watcher may still be rebuilding. */ }
        if (Date.now() > readyUntil) throw new Error('Local game server did not become ready within 45 seconds');
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    const f = await fixture('reinforcement');
    const words = '正面和侧路都缺人，请将军先增兵守路。';
    assert.equal(await f.page.evaluate(() => localStorage.getItem('jieting-chapter-three-v1')), null);
    await f.page.locator('#player-expression').fill(words); f.controls.next = 'hold'; await f.click('[data-action=speak]');
    await f.page.locator('[data-action=cancel-speech]').waitFor();
    await new Promise((resolve, reject) => { const began = Date.now(); const timer = setInterval(() => { if (f.controls.pending) { clearInterval(timer); resolve(); } else if (Date.now() - began > 10000) { clearInterval(timer); reject(new Error('No held mock request')); } }, 25); });
    await f.click('[data-action=cancel-speech]'); assert.equal(await f.page.locator('#player-expression').inputValue(), words);
    await f.controls.pending(); await f.page.waitForTimeout(200);
    assert.equal((await f.state()).judgments.length, 0); assert.equal(below(await f.state()), 5000);
    report.results.push('Cancelled model request retains draft; its late response grants no judgment, order or soldiers.');
    f.controls.next = 'followup'; await f.click('[data-action=speak]'); await f.page.locator('.dialogue-advance').waitFor();
    assert.match(await f.page.locator('.dialogue-text').innerText(), /为什么不能等山下告急/); assert.equal(below(await f.state()), 5000);
    await f.click('.dialogue-advance'); await f.page.locator('#player-expression').waitFor();
    assert.match(await f.page.locator('.expression-current-reply').innerText(), /为什么不能等山下告急/);
    assert.equal(Object.keys((await f.state()).roundResults).length, 0); await checkExpressionLayout(f);
    const answer = '等山下告急，再下山列阵就要耽搁。请先派兵守住正面和侧路，山上的人也才有出击的机会。';
    await f.page.locator('#player-expression').fill(answer); await f.click('[data-action=speak]'); await f.page.locator('.dialogue-advance').waitFor();
    assert.equal(below(await f.state()), 5000); assert.equal(Object.keys((await f.state()).roundResults).length, 0);
    await f.click('.dialogue-advance'); assert.equal((await f.state()).roundResults[1].troops, 5000);
    await throughArrival(f); await f.shot('reinforcement-arrival');
    report.results.push('Necessary followup appears as the next question; final response remains unexecuted until the authored order and actual arrival are read.');
    assert.equal(await f.page.evaluate(() => localStorage.getItem('jieting-chapter-three-v1')), null); await f.context.close();

    const g = await fixture('item');
    let s = await g.state(); assert.deepEqual(s.supplies.worldItems.acquired, ['fuhu-wood-tiger']); assert.equal(balance(s), 0);
    await g.click('[data-action=supplies]'); await g.click('[data-sell-world-item="fuhu-wood-tiger"]'); await g.click('[data-confirm-sale="fuhu-wood-tiger"]');
    s = await g.state(); assert.deepEqual(s.supplies.worldItems.sold, ['fuhu-wood-tiger']); assert.equal(balance(s), 50000);
    assert.match(await g.page.locator('.phone-wallet').innerText(), /^¥500(?:\.00)?$/); assert.equal(await g.page.locator('[data-sell-world-item="fuhu-wood-tiger"]').count(), 0);
    await g.close(); await g.click('[data-action=supplies]'); assert.equal(await g.page.locator('[data-sell-world-item="fuhu-wood-tiger"]').count(), 0); assert.equal(balance(await g.state()), 50000);
    await g.shot('wood-tiger-sold'); report.results.push('Real fixture gift sold once through confirmation for ¥500 (50000 cents); reopening the phone cannot sell it again.');
    await g.page.locator('#shopping-query').fill(product.request); await g.click('[data-action=search-supplies]'); await g.page.locator(`[data-buy-offer="${product.id}"]`).waitFor();
    assert.equal((await g.state()).supplies.purchases.length, 0); await g.click(`[data-buy-offer="${product.id}"]`);
    await g.page.locator(`[data-attach-item="${product.id}"]`).waitFor(); s = await g.state(); assert.deepEqual(s.supplies.purchases, [product.id]); assert.equal(balance(s), 45000);
    await g.click(`[data-attach-item="${product.id}"]`); await g.close(); await g.click('[data-action=attach-items]'); await g.click(`[data-prepare-item="${product.id}"]`);
    const operation = '在帐侧按下喇叭的播放键，听一段预录喊声。'; await g.page.locator('#item-preparation').fill(operation); await g.click('[data-action=test-item]');
    await g.page.locator('[data-action=confirm-item-test]').waitFor(); assert.equal((await g.state()).itemTrials[product.id], undefined);
    assert.equal(await g.page.locator('#item-preparation').isDisabled(), true); await g.click('[data-action=revise-item-test]');
    assert.equal(await g.page.locator('#item-preparation').inputValue(), operation); assert.equal(await g.page.locator('#item-preparation').isEnabled(), true);
    await g.click('[data-action=test-item]'); await g.page.locator('[data-action=confirm-item-test]').waitFor(); await g.shot('item-trial-awaiting-confirmation');
    await g.click('[data-action=confirm-item-test]'); assert.ok((await g.state()).itemTrials[product.id]); assert.deepEqual((await g.state()).supplies.consumed, []); await g.close();
    report.results.push('Shopping uses guard, quotation and price confirmation endpoints; trial preview grants no effect until confirmed; editing a ready trial safely resets the preview.');
    const proposal = '请将军先派兵守正面和侧路，免得告急以后下山列阵耽搁。让领队使用已试过的录音喇叭传信，仍照将军的军令行事。';
    await g.page.locator('#player-expression').fill(proposal); g.controls.next = 'adopt'; await g.click('[data-action=speak]'); await g.page.locator('.dialogue-advance').waitFor();
    s = await g.state(); assert.deepEqual(s.supplies.consumed, []); assert.deepEqual(s.pendingJudgment.usedItemIds, [product.id]);
    await g.click('.dialogue-advance'); assert.deepEqual((await g.state()).supplies.consumed, []); await throughArrival(g, true);
    assert.equal(balance(await g.state()), 45000); await g.click('[data-action=bag]'); assert.match(await g.page.locator('.game-modal').innerText(), /尚未携带物品/); await g.shot('item-consumed'); await g.close();
    await g.click('[data-action=save]'); await g.click('[data-store-slot="1"]'); const stored = await g.state(); await g.close();
    await g.click('.dialogue-advance'); await g.click('[data-action=save]'); await g.click('[data-load-slot="1"]');
    assert.equal((await g.state()).node, stored.node); assert.deepEqual((await g.state()).supplies.consumed, [product.id]); assert.equal(balance(await g.state()), 45000);
    assert.equal(await g.page.evaluate(() => localStorage.getItem('jieting-chapter-three-v1')), null);
    report.results.push('Only the actually adopted item is consumed by the formal order; acceptance alone, trial and attachment do not consume it. Manual save/load preserves the consumed ledger, balance and actual troop arrival.');
    await g.context.close();
    assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.unexpectedRequests, []); report.passed = true;
} catch (error) {
    report.passed = false; report.error = error.stack;
    for (const context of browser.contexts()) for (const page of context.pages()) { try { await page.screenshot({ path: resolve(output, 'failure.png') }); report.failurePage = { url: page.url(), body: await page.locator('body').innerText() }; } catch {} }
    process.exitCode = 1;
} finally {
    writeFileSync(resolve(output, 'report.json'), JSON.stringify(report, null, 2)); await browser.close(); console.log(JSON.stringify(report, null, 2));
}
