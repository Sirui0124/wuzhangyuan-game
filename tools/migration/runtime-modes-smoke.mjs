import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';
import { secondComplete } from '../../GameStarter/tests/dialogue-lines.mjs';
const server = createStaticServer(); await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, reducedMotion: 'reduce' });
let configured = true;
const errors = [], calls = []; page.on('pageerror', e => errors.push(e.message));
const output = resolve('outputs/runtime-modes-20261025'); mkdirSync(output, { recursive: true });
await page.addInitScript(() => { localStorage.setItem('wuzhang-reduced-motion', '1'); localStorage.setItem('wuzhang-voice-muted', '1'); });
try {
    await page.route('http://127.0.0.1:8787/**', async route => {
        const request = route.request(), path = new URL(request.url()).pathname;
        const headers = { 'Access-Control-Allow-Origin': base, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        calls.push(path);
        if (path === '/health') return route.fulfill({ headers, json: { configured } });
        if (path.endsWith('/settings')) return route.fulfill({ headers, json: { apiKey: configured ? 'fixture-only' : '', baseUrl: 'https://example.test/v1', model: 'fixture' } });
        if (path.endsWith('/guard')) return route.fulfill({ headers, json: { blocked: false } });
        if (path.endsWith('/respond')) {
            const req = request.postDataJSON();
            if (req.text.includes('spokenTurns')) {
                const source = JSON.parse(req.text.slice(req.text.lastIndexOf('\n资料：') + 4));
                return route.fulfill({ headers, json: { text: JSON.stringify({ fatal: { type: 'none', quote: '' }, checks: Object.fromEntries(source.checks.map(c => [c.id, source.current])), unsupported: '' }) } });
            }
            return route.fulfill({ headers, json: { text: '可以先回看你已取得的线索。' } });
        }
        throw new Error('Unexpected API call: ' + path);
    });
    await page.goto(base + '/?playtest=weiyan-second');
    await page.locator('#player-expression').waitFor();
    assert.equal(await page.locator('[data-action=supplies]').count(), 1);
    assert.equal(await page.evaluate(() => localStorage.getItem('wuzhang-runtime-mode-v1')), null);
    await page.locator('[data-action=settings]').click();
    assert.equal(await page.locator('#game-ai-enabled').isChecked(), true);
    assert.equal(await page.locator('#game-phone-enabled').isChecked(), true);
    await page.screenshot({ path: resolve(output, '01-default-ai-phone-settings.png') });
    await page.locator('#game-phone-enabled').uncheck();
    await page.locator('[data-action=close-modal]').click();
    assert.equal(await page.locator('[data-action=supplies],[data-action=items]').count(), 0);
    assert.equal(await page.locator('[data-action=generate-expression]').innerText(), '润色表达');
    await page.locator('[data-action=settings]').click(); await page.locator('#game-phone-enabled').check();
    await page.screenshot({ path: resolve(output, '02-ai-phone-settings.png') });
    await page.locator('[data-action=close-modal]').click();
    await page.locator('[data-action=supplies]').click();
    await page.locator('#shopping-query').fill('我想问问现在知道哪些情况');
    await page.locator('[data-action=search-supplies]').click();
    await page.getByText('可以先回看你已取得的线索。', { exact: true }).waitFor();
    assert.ok(calls.includes('/api/game/phone/guard')); assert.ok(calls.includes('/api/game/respond'));
    await page.locator('[data-action=close-modal]').click(); await page.locator('[data-action=settings]').click();
    await page.locator('#game-ai-enabled').uncheck();
    assert.equal(await page.locator('#game-phone-enabled').isChecked(), false);
    await page.locator('[data-action=close-modal]').click();
    const before = calls.filter(p => !p.endsWith('/settings') && p !== '/health').length;
    await page.locator('#player-expression').fill(secondComplete); await page.locator('[data-action=speak]').click();
    await page.waitForFunction(() => document.querySelector('.speech-box') && !document.querySelector('[data-action=cancel-speech]'));
    await page.locator('.game-scene').click({ position: { x: 24, y: 400 } });
    await page.screenshot({ path: resolve(output, '03-offline-reply.png') });
    assert.equal(calls.filter(p => !p.endsWith('/settings') && p !== '/health').length, before);
    await page.reload(); await page.locator('[data-action=menu]').first().waitFor();
    assert.equal(await page.locator('[data-action=supplies]').count(), 0);
    assert.equal(await page.evaluate(() => localStorage.getItem('wuzhang-runtime-mode-v1')), 'offline');
    // The isolated first-conversation entry also uses the existing fixed alternatives offline.
    await page.goto(base + '/?chapter=grain&playtest=open1'); await page.locator('[data-fixed-speech="0"]').waitFor();
    assert.equal(calls.filter(p => !p.endsWith('/settings') && p !== '/health').length, before);
    // A new isolated page verifies that the AI mode still uses its real adapter contract.
    await page.goto(base + '/?playtest=weiyan-first'); await page.locator('#player-expression').waitFor();
    await page.locator('[data-action=settings]').click(); await page.locator('#game-ai-enabled').check(); await page.locator('[data-action=close-modal]').click();
    await page.locator('#player-expression').fill('我这就转呈。'); await page.locator('[data-action=speak]').click();
    await page.waitForFunction(() => document.querySelector('.speech-box') && !document.querySelector('[data-action=cancel-speech]'));
    assert.ok(calls.filter(p => p.endsWith('/respond')).length >= 2);
    // Auto fallback never becomes a saved opt-out. Reconnecting restores the user's phone preference.
    await page.evaluate(() => { localStorage.removeItem('wuzhang-runtime-mode-v1'); localStorage.removeItem('wuzhang-phone-enabled-v1'); });
    configured = false;
    await page.goto(base + '/?playtest=weiyan-second'); await page.locator('#player-expression').waitFor();
    assert.equal(await page.locator('[data-action=supplies]').count(), 0);
    assert.equal(await page.locator('[data-action=generate-expression]').innerText(), '整理参考句');
    assert.equal(await page.evaluate(() => localStorage.getItem('wuzhang-runtime-mode-v1')), null);
    configured = true;
    await page.reload(); await page.locator('[data-action=supplies]').waitFor();
    await page.locator('[data-action=settings]').click(); await page.locator('#game-phone-enabled').uncheck();
    await page.locator('[data-action=close-modal]').click();
    configured = false; await page.reload(); await page.locator('#player-expression').waitFor();
    assert.equal(await page.locator('[data-action=generate-expression]').innerText(), '整理参考句');
    assert.equal(await page.evaluate(() => localStorage.getItem('wuzhang-runtime-mode-v1')), 'ai');
    configured = true; await page.reload(); await page.locator('#player-expression').waitFor();
    assert.equal(await page.locator('[data-action=generate-expression]').innerText(), '润色表达');
    assert.equal(await page.locator('[data-action=supplies]').count(), 0);
    assert.deepEqual(errors, []);
    console.log('PASS: Chrome default AI+phone, unconfigured fallback, reconnect restoration and explicit phone opt-out persist; three-mode settings, phone opt-in/out, guarded phone conversation, offline local judgment with zero model/phone/voice calls, persisted choice, chapter-two offline fixed choices, AI adapter preserved.');
} finally { await browser.close(); server.closeAllConnections(); await new Promise(ok => server.close(ok)); }
