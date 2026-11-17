import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';

// Developer component regression, not a simulated-player session or an audio review.
const out = resolve(process.env.CH2_MEDIA_OUTPUT || 'outputs/ch2-p1p2-repairs-20261026/media'); mkdirSync(out, { recursive: true });
const compiled = resolve(process.env.CH2_MEDIA_COMPILED || 'outputs/ch2-p1p2-repairs-20261026/visual-compiled');
const frozen = resolve('outputs/ch2-simulated-playtest-20261026/infrastructure/frozen-build');
const movies = JSON.parse(readFileSync('GameStarter/web-demo/public/cinematics.json', 'utf8')).chapterTwo;
const fixture = '<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/cinematics.css"><div id="test-host"></div>';
const server = createStaticServer({ root: frozen, onRequest(req, res) {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname === '/media-repair-fixture') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(fixture); return true; }
    if (pathname === '/cinematics.css') { res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8' }); res.end(readFileSync('GameStarter/web-demo/public/cinematics.css')); return true; }
    if (pathname.startsWith('/GameStarter/') && pathname.endsWith('.js')) {
        const file = resolve(compiled, '.' + pathname);
        if (file.startsWith(compiled) && existsSync(file)) {
            const js = readFileSync(file, 'utf8').replace(/(from\s+['"])(\.[^'"]+)(['"])/g, (_, a, b, c) => `${a}${b.endsWith('.js') ? b : b + '.js'}${c}`);
            res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' }); res.end(js); return true;
        }
    }
    return false;
} });
await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [], checks = [], subtitleWindows = []; page.on('pageerror', e => errors.push(e.message));
const base = `http://127.0.0.1:${server.address().port}`;
const mount = async (id, suffix = '') => page.evaluate(({ clip, suffix }) => {
    player.dispose();
    player.mount(host, clip.id + suffix, [{ ...clip, src: clip.src + suffix }], 'chapter-two', () => {});
    host.querySelector('video').muted = true;
}, { clip: movies.find(c => c.id === id), suffix });
const ready = () => page.waitForFunction(() => host.querySelector('.cinema-screen')?.dataset.mediaState === 'ready' && host.querySelector('video').textTracks[0]?.cues?.length > 0);
try {
    await page.goto(base + '/media-repair-fixture');
    await page.evaluate(async () => {
        const { createCharacterModule } = await import('/GameStarter/web-demo/src/characters/module.js');
        const { chapterTwoCharacters } = await import('/GameStarter/web-demo/src/chapters/chapter-two/characters.js');
        window.host = document.querySelector('#test-host');
        window.people = createCharacterModule({ root: host, portraits: {}, enabled: true });
        window.grainProgress = (id, visited, kind = 'video') => chapterTwoCharacters({ current: { id, kind, speaker: '' }, state: { visited } });
    });
    for (const [node, visited, unlocked] of [['V24', ['V02', 'V23'], 'old-woman'], ['V27', ['V02', 'V23', 'V24', 'V26'], 'military-clerk']]) {
        await page.evaluate(({ node, visited }) => people.sync(grainProgress(node, visited)), { node, visited });
        assert.equal(await page.locator('.character-identity').count(), 0, `${node}: no previous person's identity plaque`);
        await page.locator('[data-character-open]').click();
        assert.equal(await page.locator(`[data-character-select="${unlocked}"]`).count(), 1);
        await page.keyboard.press('Escape');
        await page.evaluate(({ node, visited }) => people.sync(grainProgress(node, visited)), { node, visited });
        assert.equal(await page.locator('.character-identity').count(), 0);
    }
    await page.evaluate(() => people.sync(grainProgress('O1', ['V02'], 'open')));
    assert.equal(await page.locator('.character-identity strong').textContent(), '苟安');
    await page.evaluate(() => people.sync({ chapter: 'wuzhang', entered: ['A-19'], completed: [], visible: true }));
    assert.equal(await page.locator('.character-identity strong').textContent(), '斥候');
    await page.evaluate(() => people.sync({ chapter: 'jieting', entered: ['JT-008'], completed: [], visible: true }));
    assert.equal(await page.locator('.character-identity strong').textContent(), '王平');
    await page.evaluate(() => people.dispose());
    checks.push('Second-chapter video identities suppressed across dossier open/close and repeat sync; unlocks retained; explicit Gou An and chapter-one/three fallback preserved.');

    await page.evaluate(async () => {
        const { CinematicPlayer } = await import('/GameStarter/web-demo/src/cinematics.js');
        window.player = new CinematicPlayer('media-repair', 'media-repair');
        window.events = []; host.addEventListener('cinema-diagnostic', event => events.push(event.detail));
    });
    await page.evaluate(clip => { player.prepareNext(clip); window.preparedVideo = player.prepared.video; }, movies.find(c => c.id === 'CH2-V10'));
    await page.waitForFunction(() => preparedVideo.readyState >= 2);
    const preloaded = await page.evaluate(() => ({ paused: preparedVideo.paused, time: preparedVideo.currentTime, connected: preparedVideo.isConnected }));
    assert.deepEqual(preloaded, { paused: true, time: 0, connected: false });
    await page.evaluate(clip => { player.dispose(false, true); player.mount(host, 'preloaded', [clip], 'chapter-two', () => {}); host.querySelector('video').muted = true; }, movies.find(c => c.id === 'CH2-V10'));
    assert.equal(await page.evaluate(() => host.querySelector('video') === preparedVideo), true);
    await ready();
    checks.push('Single determined successor preloads without playback and survives explicit handoff disposal; mount reuses the same video.');

    let release; const gate = new Promise(ok => { release = ok; });
    await page.route('**/*first-frame-delay*', async route => { await gate; await route.continue(); });
    await page.evaluate(() => { player.dispose(); host.innerHTML = '<p>李丰的信</p>'; });
    await mount('CH2-V10', '?first-frame-delay');
    await page.waitForFunction(() => host.querySelector('track')?.readyState === 2);
    assert.equal(await page.locator('track').evaluate(t => t.track.mode), 'hidden');
    assert.equal(await page.locator('.cinema-screen').getAttribute('data-media-state'), 'loading');
    assert.equal(await page.locator('[data-cinema-action=retry]').isVisible(), false);
    await page.screenshot({ path: resolve(out, 'first-frame-loading.png') });
    release(); await ready();
    assert.equal(await page.locator('track').evaluate(t => t.track.mode), 'showing');
    checks.push('During a deliberately delayed media request, time-zero subtitles remain hidden and loading is not labelled as failure; first presented frame enables subtitles.');

    let fail = true;
    await page.route('**/*recoverable-error*', route => fail ? route.abort('failed') : route.continue());
    await mount('CH2-V10', '?recoverable-error');
    await page.waitForFunction(() => host.querySelector('.cinema-screen')?.dataset.mediaState === 'error');
    assert.equal(await page.locator('[data-cinema-action=retry]').isVisible(), true);
    assert.match(await page.locator('#video-status').textContent(), /重试/);
    fail = false; await page.locator('[data-cinema-action=retry]').click(); await ready();
    checks.push('A real blocked request produces the failure/retry state; retry reloads successfully without marking the film complete.');

    // Boundary injection only: deliberately deliver first-frame/playing after error.
    // This verifies event-order safety, not a claim that a corrupt source file was observed.
    await page.evaluate(clip => {
        player.dispose();
        const proto = HTMLVideoElement.prototype;
        window.savedFrameRequest = proto.requestVideoFrameCallback;
        window.savedFrameCancel = proto.cancelVideoFrameCallback;
        window.pendingFrames = [];
        proto.requestVideoFrameCallback = function(callback) { pendingFrames.push({ video: this, callback }); return pendingFrames.length; };
        proto.cancelVideoFrameCallback = () => {};
        window.boundaryFinished = 0;
        player.mount(host, 'late-frame-boundary', [clip], 'chapter-two', () => window.boundaryFinished++);
        host.querySelector('video').muted = true;
    }, movies.find(c => c.id === 'CH2-V10'));
    await page.waitForFunction(() => host.querySelector('video').readyState >= 2 && host.querySelector('track')?.readyState === 2);
    const lateEventState = await page.evaluate(() => {
        const video = host.querySelector('video'); video.dispatchEvent(new Event('error'));
        const message = host.querySelector('#video-status').textContent;
        for (const entry of pendingFrames) if (entry.video === video) entry.callback(performance.now(), {});
        for (const event of ['playing', 'waiting', 'timeupdate', 'volumechange', 'ended']) video.dispatchEvent(new Event(event));
        const result = { state: host.querySelector('.cinema-screen').dataset.mediaState,
            message: host.querySelector('#video-status').textContent, originalMessage: message,
            subtitleMode: video.querySelector('track').track.mode, retryVisible: !host.querySelector('[data-cinema-action=retry]').hidden, completed: boundaryFinished };
        HTMLVideoElement.prototype.requestVideoFrameCallback = savedFrameRequest;
        HTMLVideoElement.prototype.cancelVideoFrameCallback = savedFrameCancel;
        return result;
    });
    assert.equal(lateEventState.state, 'error'); assert.equal(lateEventState.message, lateEventState.originalMessage);
    assert.equal(lateEventState.subtitleMode, 'hidden'); assert.equal(lateEventState.retryVisible, true); assert.equal(lateEventState.completed, 0);
    await page.locator('[data-cinema-action=retry]').click(); await ready();
    checks.push('Developer event-order injection: error followed by delayed first-frame/playing/waiting/timeupdate/volumechange stays failed with retry; a fresh retry mount clears the failure flag. This is not a corrupt-media reproduction.');

    for (const [id, start, end, shotAt, expected] of [
        ['CH2-V21b', 18, 22, 19.8, '我就给了你一个往下查的理由'],
        ['CH2-V24', 38, 45, 40.4, '今日怪你误了粮，明日怪我办事不力'],
    ]) {
        await mount(id); await ready();
        const cues = await page.locator('track').evaluate(t => Array.from(t.track.cues).map(c => ({ start: c.startTime, end: c.endTime, text: c.text })));
        await page.evaluate(async ({ start, end }) => {
            const video = host.querySelector('video'); video.pause(); video.playbackRate = 1;
            await new Promise(ok => { video.addEventListener('seeked', ok, { once: true }); video.currentTime = start - .1; });
            window.cueSamples = []; window.sampleDone = false;
            const timer = setInterval(() => {
                const t = video.querySelector('track');
                cueSamples.push({ time: video.currentTime, readyState: t.readyState, mode: t.track.mode, active: Array.from(t.track.activeCues ?? []).map(c => c.text) });
                if (video.currentTime >= end) { clearInterval(timer); video.pause(); window.sampleDone = true; }
            }, 80);
            await video.play();
        }, { start, end });
        await page.waitForFunction(at => host.querySelector('video')?.currentTime >= at, shotAt);
        await page.screenshot({ path: resolve(out, `${id}-continuous-caption.png`) });
        await page.waitForFunction(() => window.sampleDone === true);
        const samples = await page.evaluate(() => cueSamples);
        const stable = samples.filter(s => s.time >= start && s.time <= end && !cues.some(c => Math.abs(s.time - c.start) < .12 || Math.abs(s.time - c.end) < .12));
        assert.ok(stable.length > (end - start) * 5);
        for (const sample of stable) {
            assert.equal(sample.readyState, 2); assert.equal(sample.mode, 'showing');
            assert.deepEqual(sample.active, cues.filter(c => sample.time >= c.start && sample.time < c.end).map(c => c.text));
        }
        assert.ok(samples.some(s => s.active.includes(expected)));
        assert.ok(samples.some(s => s.time > start && s.time < shotAt && s.active.length === 0), 'The reported timestamp interval includes an authored cue gap');
        subtitleWindows.push({ id, start, end, cues, samples, passed: true });
    }
    checks.push('V21b 18–22s and V24 38–45s played continuously at 1×; loaded/showing native tracks followed authored cue timing, including the recorded gaps. Audio was not reviewed.');
    assert.deepEqual(errors, []);
    const diagnostics = await page.evaluate(() => player.getDiagnostics());
    assert.ok(diagnostics.some(d => d.event === 'first-frame'));
    assert.ok(diagnostics.some(d => d.event === 'error' && d.errorCode !== null));
    writeFileSync(resolve(out, 'verification.json'), JSON.stringify({ passed: true, kind: 'developer component regression', audio: '未试听；不代表台词、停顿或音画同步已通过听审。', checks, preloaded, lateEventState, subtitleWindows, diagnostics, errors }, null, 2));
    console.log(JSON.stringify({ passed: true, checks: checks.length, output: resolve(out, 'verification.json') }));
} finally { await browser.close(); server.closeAllConnections(); await new Promise(ok => server.close(ok)); }
