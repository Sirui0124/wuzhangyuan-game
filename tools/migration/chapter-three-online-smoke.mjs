import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Every API endpoint is intercepted in a fresh, non-persistent browser context.
// Progress and troops are obtained through the game UI only.
const base = process.env.GAME_BASE || 'http://127.0.0.1:8812';
const output = resolve('outputs/chapter-three-integration-20261026/browser-online');
mkdirSync(output, { recursive: true });
const report = { mockedApi: true, persistentBrowser: false, results: [], requests: [], pageErrors: [], unexpectedRequests: [], screenshots: [], layouts: [] };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const keys = ['gapEstablished', 'reinforcementUse', 'concernAnswered', 'risk', 'route', 'reception', 'motive', 'means', 'withdrawal'];
const emptyCriterion = () => ({ value: false, quote: '', evidenceIds: [], reason: '' });
const promptData = text => JSON.parse(text.slice(text.lastIndexOf('\n') + 1));
function judgment(data, followup = false, ) {
    const evidence = data.context.ownedClues.find(c => c.id === 'JT-C04' && c.current !== false) ?? data.context.ownedClues.find(c => c.current !== false);
    assert.ok(evidence, 'Fixture must have an actually acquired clue');
    const raw = {
        version: 1, valid: true, factsReliable: true, factualIssues: [], maintain: { value: false, quote: '' },
        criteria: Object.fromEntries(keys.map(key => [key, emptyCriterion()])),
        acknowledgment: followup ? '正面和侧路都要人，这个缺口我听明白了。' : '把守路的人手和赶路的工夫一并算进去，这个办法说得通。',
        followup: { needed: followup, question: followup ? '为什么不能等山下告急以后再派人？' : '' },
        offense: { direct: false, target: 'none', kind: 'none', context: 'asserted', intent: 'argument', targetQuote: '', actQuote: '', quote: '', reason: '正常进言' },
        deploymentTasks: [{ task: 'road', quote: data.playerWords }],
    };
    for (const key of ['gapEstablished', 'reinforcementUse', ...(followup ? [] : ['concernAnswered'])]) raw.criteria[key] = {
        value: true, quote: data.playerWords, evidenceIds: [evidence.id],
        reason: '当前已获军报支持守路需要，玩家建议由将领批准提前部署。',
    };
    return raw;
}
async function fixture(kind) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
    await context.addInitScript(() => { if (!/^https?:$/.test(location.protocol)) return; localStorage.setItem('wuzhang-runtime-mode-v1', 'ai'); });
    const controls = { next: 'great', pending: null, modelCalls: 0 };
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
    await context.route('http://127.0.0.1:8787/**', async route => {
        const request = route.request(), path = new URL(request.url()).pathname;
        if (request.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return; }
        report.requests.push({ fixture: kind, path, method: request.method(), mocked: true });
        const reply = json => route.fulfill({ headers, json });
        if (path === '/health') return reply({ configured: true });
        if (path === '/api/game/settings') return reply({ apiKey: 'fixture-only-key', baseUrl: 'https://example.test/v1', model: 'mock-jieting' });
        if (path === '/api/game/respond') {
            const body = request.postDataJSON(), data = promptData(body.text); controls.modelCalls++;
            assert.ok(body.text.startsWith('你在《逆转五丈原》第三章街亭中'), 'Unexpected model purpose');
            const mode = controls.next; controls.next = 'great';
            const response = { text: JSON.stringify(judgment(data, mode === 'followup')), responseId: `judgment-${controls.modelCalls}` };
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
async function throughArrival(f) {
    let s = await f.state(); assert.equal(below(s), 5000); assert.equal(s.roundResults[1].ordered, false); assert.equal(s.roundResults[1].arrived, false);
    let orderSeen = false;
    for (let i = 0; i < 20; i++) {
        await f.click('.dialogue-advance'); s = await f.state();
        if (s.roundResults[1].ordered && !orderSeen) { orderSeen = true; assert.equal(below(s), 5000, 'Order alone must not count as arrival');  }
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


    assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.unexpectedRequests, []); report.passed = true;
} catch (error) {
    report.passed = false; report.error = error.stack;
    for (const context of browser.contexts()) for (const page of context.pages()) { try { await page.screenshot({ path: resolve(output, 'failure.png') }); report.failurePage = { url: page.url(), body: await page.locator('body').innerText() }; } catch {} }
    process.exitCode = 1;
} finally {
    writeFileSync(resolve(output, 'report.json'), JSON.stringify(report, null, 2)); await browser.close(); console.log(JSON.stringify(report, null, 2));
}
