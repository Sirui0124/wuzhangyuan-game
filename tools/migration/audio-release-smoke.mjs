import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';
const output = resolve('outputs/release-fixes-20261027'); mkdirSync(output, { recursive: true });
const server = createStaticServer({ ...(process.env.GAME_BUILD ? { root: resolve(process.env.GAME_BUILD) } : {}), onRequest: async (req, res) => {
    if (req.url !== '/audio-test') return false;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/cinematics.css"><main id="test-host"></main>'); return true;
} });
await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
const report = { checks: [], errors: [], paidApiRequests: 0, androidHardwareTest: false };
async function context(options = {}) {
    const ctx = await browser.newContext(options);
    await ctx.route('http://127.0.0.1:8787/**', route => route.fulfill({ headers: { 'Access-Control-Allow-Origin': '*' }, json: { configured: false, apiKey: '', baseUrl: 'https://example.test/v1', model: 'test' } }));
    await ctx.addInitScript(() => {
        try { localStorage.setItem('wuzhang-runtime-mode-v1', 'offline'); localStorage.setItem('wuzhang-ai-voice-enabled', '0'); } catch { /* The initial about:blank document has no storage origin. */ }
        window.audioSources = [];
        const create = AudioContext.prototype.createBufferSource;
        AudioContext.prototype.createBufferSource = function () {
            const source = create.call(this), item = { source, ctx: this, started: false, stopAt: Infinity, offset: 0 };
            audioSources.push(item);
            const start = source.start.bind(source), stop = source.stop.bind(source);
            source.start = (...args) => { item.started = true; item.offset = args[1] ?? 0; return start(...args); };
            source.stop = (...args) => { item.stopAt = args[0] ?? this.currentTime; return stop(...args); };
            return source;
        };
        window.activeMusic = () => audioSources.filter(r => r.started && r.source.loop && r.stopAt > r.ctx.currentTime);
    });
    ctx.on('page', page => page.on('pageerror', e => report.errors.push(e.message)));
    return ctx;
}
try {
    for (const chapter of ['grain', 'jieting']) {
        const ctx = await context({ viewport: { width: 667, height: 375 }, isMobile: true, hasTouch: true });
        const page = await ctx.newPage();
        await page.goto(base + (chapter === 'grain' ? '/?chapter=grain&playtest=item-candlestick' : '/?chapter=jieting'));
        await page.waitForFunction(() => activeMusic().length === 1);
        const before = await page.evaluate(() => audioSources.filter(s => s.started && !s.source.loop).length);
        if (chapter === 'grain') {
            await page.locator('[data-action=own-tent]').tap(); await page.waitForTimeout(110);
            await page.locator('[data-action=take-candlestick]').tap();
        } else await page.locator('.dialogue-text').first().tap();
        await page.waitForTimeout(200);
        const after = await page.evaluate(() => audioSources.filter(s => s.started && !s.source.loop).length);
        assert.ok(after > before, `${chapter} interaction starts a sound`);
        await page.waitForTimeout(1000);
        await page.locator('[data-action=pause]').tap();
        assert.equal(await page.evaluate(() => activeMusic().length), 0);
        await page.locator('[data-action=resume-game]').tap(); await page.waitForFunction(() => activeMusic().length === 1);
        assert.ok(await page.evaluate(() => activeMusic()[0].offset) > .8);
        await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
        assert.equal(await page.evaluate(() => activeMusic().length), 0);
        await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
        await page.waitForFunction(() => activeMusic().length === 1);
        report.checks.push(`${chapter}: music, interaction cue, pause offset and background suspension passed`);
        await ctx.close();
    }
    const ctx = await context({ viewport: { width: 667, height: 375 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage(); await page.goto(base + '/audio-test');
    await page.evaluate(async () => {
        const { CinematicPlayer } = await import('/GameStarter/web-demo/src/cinematics.js');
        const config = await fetch('/cinematics.json').then(r => r.json());
        window.testPlayer = new CinematicPlayer('audio-release', 'audio-release-progress', true);
        window.finishedFilms = 0;
        window.testPlayer.mount(document.querySelector('#test-host'), 'test', [config.opening[0]], 'test', () => { window.finishedFilms++; });
    });
    await page.waitForFunction(() => document.querySelector('video')?.currentTime > .1);
    await page.locator('[data-cinema-action=sound]').tap(); assert.equal(await page.locator('video').evaluate(v => v.muted), true);
    assert.equal(await page.locator('[data-cinema-action=sound]').isVisible(), true);
    await page.locator('[data-cinema-action=sound]').tap(); assert.equal(await page.locator('video').evaluate(v => v.muted), false);
    await page.locator('.cinema-volume input').fill('37'); assert.equal(await page.locator('video').evaluate(v => v.volume), .37);
    const controls = await page.locator('.cinema-controls button,.cinema-controls input').evaluateAll(nodes => nodes.filter(n => !n.hidden).map(n => { const r = n.getBoundingClientRect(); return { label: n.getAttribute('aria-label') ?? n.textContent, x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; }));
    assert.ok(controls.every(r => r.x >= 0 && r.y >= 0 && r.right <= 667.5 && r.bottom <= 375.5), JSON.stringify(controls));
    assert.ok(controls.every(r => r.height >= 44), JSON.stringify(controls));
    await page.screenshot({ path: resolve(output, 'audio-landscape-667.png') });
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('pagehide')); });
    const held = await page.locator('video').evaluate(v => v.currentTime);
    await page.waitForTimeout(350);
    assert.equal(await page.locator('video').evaluate(v => v.paused), true);
    assert.ok(Math.abs(await page.locator('video').evaluate(v => v.currentTime) - held) < .02);
    assert.equal(await page.evaluate(() => finishedFilms), 0);
    await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('pageshow')); });
    await page.waitForFunction(held => document.querySelector('video').currentTime > held + .1, held);
    assert.equal(await page.evaluate(() => finishedFilms), 0);
    await page.locator('[data-cinema-action=toggle]').tap();
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
    assert.equal(await page.locator('video').evaluate(v => v.paused), true);
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.querySelector('video').dispatchEvent(new Event('ended')); });
    assert.equal(await page.evaluate(() => finishedFilms), 0);
    await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
    const saved = JSON.parse(await page.evaluate(() => localStorage.getItem('wuzhang-film-audio-v1'))); assert.equal(saved.volume, 37);
    await page.evaluate(async () => { const { GameAudio } = await import('/GameStarter/web-demo/src/audio.js'); window.extraAudio = new GameAudio(); extraAudio.setVolume('film', 25); });
    assert.equal(await page.locator('video').evaluate(v => v.volume), .25);
    report.controls = controls;
    report.checks.push('667x375: mute/unmute, film volume persistence/live settings, reachable touch controls, background offset, no hidden completion, manual pause preserved');
    await ctx.close();
    const fallbackCtx = await context({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
    await fallbackCtx.addInitScript(() => {
        const original = HTMLMediaElement.prototype.play; let reject = true;
        HTMLMediaElement.prototype.play = function () { if (reject && this instanceof HTMLVideoElement && !this.muted) { reject = false; return Promise.reject(new DOMException('test autoplay policy', 'NotAllowedError')); } return original.call(this); };
    });
    const fallback = await fallbackCtx.newPage(); await fallback.goto(base + '/?chapter=grain');
    await fallback.waitForFunction(() => { const v = document.querySelector('video'); return v?.currentTime > .1 && v.muted; });
    await fallback.locator('[data-cinema-action=sound]').tap();
    assert.equal(await fallback.locator('video').evaluate(v => v.muted), false);
    assert.equal(await fallback.evaluate(() => activeMusic().length), 0);
    report.actualGameControls = [];
    for (const viewport of [{width:667,height:375},{width:844,height:390},{width:932,height:430}]) {
        await fallback.setViewportSize(viewport);
        await fallback.waitForFunction(() => Math.abs(document.querySelector('.cinema-screen').getBoundingClientRect().height - (visualViewport?.height ?? innerHeight)) < 1);
        const controls = await fallback.locator('.cinema-controls button,.cinema-controls input').evaluateAll(nodes => nodes.filter(n => !n.hidden).map(n => { const r = n.getBoundingClientRect(); return { label: n.getAttribute('aria-label') ?? n.textContent, x:r.x, right:r.right, y:r.y, bottom:r.bottom, height:r.height }; }));
        report.actualGameControls.push({viewport,controls});
        assert.ok(controls.every(r => r.x >= 0 && r.y >= 0 && r.right <= viewport.width+.5 && r.bottom <= viewport.height+.5 && r.height >= 44), JSON.stringify({viewport,controls}));
        await fallback.screenshot({path:resolve(output,`audio-game-landscape-${viewport.width}.png`)});
    }
    report.checks.push('controlled audible-autoplay rejection falls back to muted playback and user tap enables sound; chapter film has no game BGM');
    await fallbackCtx.close();
    assert.deepEqual(report.errors, []); report.passed = true;
} finally { writeFileSync(resolve(output, 'audio-browser-verification.json'), JSON.stringify(report, null, 2)); await browser.close(); server.closeAllConnections(); await new Promise(ok => server.close(ok)); }
console.log(JSON.stringify(report, null, 2));
