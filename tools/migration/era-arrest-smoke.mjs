import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';
import { GrainSession } from '../../GameStarter/web-demo/.build/GameStarter/web-demo/src/chapters/chapter-two/session.js';
import { buySuggestedSupply } from '../../GameStarter/web-demo/.build/GameStarter/web-demo/src/phone/supplies.js';
const out = process.argv[2] || 'outputs/era-arrest-20261025'; mkdirSync(out, { recursive: true });
const json = p => JSON.parse(readFileSync(p, 'utf8'));
const item = { id: 'shop-11111111-2222-4333-8444-555555555555', name: '便携全息风扇显示器', price: 1000, ability: '用旋转灯条显示预装的人像，呈现悬浮影像效果。', boundary: '需供电，无网络，不能拘魂或创造生命。', source: '', quote: '测试估价', date: '2026-10-25', priceKind: 'estimate', why: '展示', request: '买显示器', searchState: 'empty', sources: [] };
const words = '看我放出这悬空人影！这是我拘来的魂魄，我乃天降神人，你们都须听我号令。';
const clear = { version: 1, severeMismatch: false, explanation: 'coherent', itemIds: [], quote: '', reason: '可以用有限器具解释' };
const server = createStaticServer({ root: resolve('GameStarter/web-demo/.build') });
await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, channel: 'chrome' }), errors = [], results = [];
try {
    for (const chapter of ['wuzhang', 'grain']) {
        let seed, key, url;
        if (chapter === 'wuzhang') {
            seed = json('GameStarter/web-demo/.build/playtest/weiyan-second.json');
            seed.supplies = { version: 2, rewards: ['weiyan-action'], purchases: [item.id], attached: [item.id], agreement: null, custom: [item], penalties: [], consumed: [] };
            key = 'wuzhang-chapter-session-v1'; url = base;
        } else {
            const s = new GrainSession(json('content/chapters/grain/chapter-two.playable.json'), undefined, json('content/chapters/grain/chapter-two.rubric.json'));
            for (let i = 0; i < 100 && s.current.kind !== 'open'; i++) assert.ok(s.advance(s.current.options?.[0]?.id));
            s.unlockPhone(); buySuggestedSupply(s.state.supplies, item); s.state.supplies.attached = [item.id];
            seed = s.state; key = 'grain-chapter-two-prefix-v1'; url = base + '/?chapter=grain';
        }
        const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' });
        await context.addInitScript(({ key, seed }) => {
            if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(seed));
            localStorage.setItem('wuzhang-reduced-motion', '1'); localStorage.setItem('wuzhang-voice-muted', '1');
            localStorage.setItem('wuzhang-runtime-mode-v1', 'ai-phone');
        }, { key, seed });
        const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
        let mode = 'arrest';
        await page.route('**/api/game/respond', async route => {
            const headers = { 'Access-Control-Allow-Origin': base, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
            if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
            const text = route.request().postDataJSON().text;
            assert.match(text, /通用物品时代常识核验/);
            const assessment = mode === 'arrest' ? { version: 1, severeMismatch: true, explanation: 'incoherent', itemIds: [item.id], quote: words, reason: '悬空人像严重超出常识，自称神人不能解释器具。' } : clear;
            const normal = chapter === 'wuzhang' ? { decision: { version: 1, route: null, itemIds: [], quote: '', reason: '还需说明交报安排。' }, reply: '先说清军报如何交接。' }
                : { valid: true, scores: Object.fromEntries(['trust', 'rigor', 'responsibility'].map(k => [k, { delta: 0, quote: '', reason: '未涉及' }])), gift: { ids: [], quote: '' } };
            return route.fulfill({ headers, json: { text: mode === 'malformed' ? '{}' : JSON.stringify({ ...normal, eraAssessment: assessment }) } });
        });
        const state = () => page.evaluate(k => JSON.parse(localStorage.getItem(k)), key);
        await page.goto(url); if (chapter === 'wuzhang') await page.locator('[data-action=continue]').click();
        await page.locator('#player-expression').fill(words); await page.locator('[data-action=speak]').click();
        if (chapter === 'wuzhang') {
            await page.waitForFunction(k => JSON.parse(localStorage.getItem(k)).speech?.status === 'ready', key);
            await page.locator('.game-scene').click({ position: { x: 24, y: 300 } });
        }
        await page.getByText('这等异物，你又说不清来由，莫非是妖孽作祟？来人，拿下！', { exact: true }).waitFor();
        assert.equal(await page.locator('[data-action=revise]').count(), 0);
        assert.equal((await state()).end, null);
        await page.screenshot({ path: `${out}/${chapter}-reply.png` });
        if (chapter === 'wuzhang') await page.locator('.game-scene').click({ position: { x: 24, y: 300 } });
        else await page.locator('[data-action=next]').click();
        await page.locator('.era-ending').waitFor(); assert.equal((await state()).end, 'era-arrest');
        assert.equal(await page.locator('.era-ending-story p').count(), 5);
        assert.equal(await page.locator('.era-ending-story strong').innerText(), '然后泼过来的，不是雨，是猪血。');
        assert.doesNotMatch(await page.locator('.era-ending').innerText(), /手机负责送货/);
        const ended = await state(); assert.deepEqual(ended.supplies.consumed, []);
        if (chapter === 'grain') assert.deepEqual(ended.gifts, []);
        else { assert.equal(ended.story.flags.REPORT_CLOSED, undefined); assert.equal(ended.supplies.agreement, null); }
        await page.screenshot({ path: `${out}/${chapter}-ending.png` });
        await page.reload(); if (chapter === 'wuzhang') await page.locator('[data-action=continue]').click();
        await page.locator('.era-ending').waitFor(); assert.deepEqual((await state()).supplies, ended.supplies);
        await page.setViewportSize({ width: 390, height: 844 });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.screenshot({ path: `${out}/${chapter}-ending-mobile.png` });
        await page.locator('[data-action=retry-era]').click();
        assert.equal(await page.locator('#player-expression').inputValue(), words);
        assert.deepEqual((await state()).supplies, ended.supplies);
        mode = 'malformed'; await page.locator('[data-action=speak]').click();
        if (chapter === 'wuzhang') {
            await page.waitForFunction(k => JSON.parse(localStorage.getItem(k)).speech?.status === 'failed', key);
            await page.locator('[data-action=revise]').click();
        } else await page.getByText(/物品时代判断未完整返回/).waitFor();
        assert.equal((await state()).end, null);
        mode = 'coherent'; await page.locator('#player-expression').fill('这是一件用灯与转轮显出图样的器具，并非魂魄。可以停下拆开看。');
        await page.locator('[data-action=speak]').click();
        if (chapter === 'wuzhang') {
            await page.waitForFunction(k => JSON.parse(localStorage.getItem(k)).speech?.status === 'ready', key);
            await page.locator('.game-scene').click({ position: { x: 24, y: 300 } });
            await page.locator('.game-scene').click({ position: { x: 24, y: 300 } });
            await page.locator('#player-expression').waitFor();
        } else await page.locator('[data-action=revise]').waitFor();
        assert.equal((await state()).end, null);
        results.push({ chapter, arrest: true, replyBeforeEnding: true, reload: true, retryKeepsInventory: true, malformedDoesNotArrest: true, coherentDoesNotArrest: true, mobile: true });
        await context.close();
    }
    assert.deepEqual(errors, []); writeFileSync(`${out}/browser-report.json`, JSON.stringify({ results, errors }, null, 2));
    console.log(JSON.stringify({ passed: true, results, errors }));
} finally { await browser.close(); await new Promise(ok => server.close(ok)); }
