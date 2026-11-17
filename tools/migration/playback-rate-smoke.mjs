import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';

const server = createStaticServer();
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
async function setup(page, version = 'test-v1', storage = 'test-player') {
    await page.goto(base + '/video-review.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(async ({ version, storage }) => {
        const { CinematicPlayer } = await import('/GameStarter/web-demo/src/cinematics.js');
        const config = await fetch('/cinematics.json').then(r => r.json());
        document.body.innerHTML = '<div id="host"></div>';
        window.rateTest = { CinematicPlayer, config, player: new CinematicPlayer(version, storage), finished: 0 };
    }, { version, storage });
}
async function mount(page, key, group = 'opening', count = 1) {
    await page.evaluate(({ key, group, count }) => {
        const test = window.rateTest;
        test.player.mount(document.querySelector('#host'), key, test.config[group].slice(0, count), 'test', () => test.finished++);
        document.querySelector('video').muted = true;
    }, { key, group, count });
}
async function check(page, rate) {
    await page.waitForFunction(rate => {
        const video = document.querySelector('video');
        return video?.readyState >= 2 && video.playbackRate === rate;
    }, rate);
    assert.equal(await page.locator('[data-cinema-rate][aria-pressed=true]').getAttribute('data-cinema-rate'), String(rate));
}
try {
    const page = await browser.newPage();
    await setup(page);
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    await page.route('**/video/current/**', async route => { await gate; await route.continue(); });
    await mount(page, 'opening', 'opening', 2);
    assert.deepEqual(await page.locator('[data-cinema-rate]').allTextContents(), ['1×', '1.25×', '1.5×', '2×']);
    // A choice made before metadata arrives must not be reset by the load handler.
    await page.locator('[data-cinema-rate="1.25"]').click(); release();
    await check(page, 1.25);
    const first = await page.locator('video').getAttribute('src');
    await page.locator('video').evaluate(async video => { video.currentTime = video.duration - .1; await video.play(); });
    await page.waitForFunction(first => document.querySelector('video')?.getAttribute('src') !== first, first);
    await check(page, 1.25);
    await page.locator('[data-cinema-action=skip]').click();
    await mount(page, 'new-story'); await check(page, 1.25);
    await setup(page, 'new-content-version', 'second-chapter-player');
    await mount(page, 'second-chapter', 'chapterPreview'); await check(page, 1.25);
    await page.locator('[data-cinema-rate="1.5"]').click(); await check(page, 1.5);
    await page.locator('[data-cinema-rate="2"]').click(); await check(page, 2);
    await setup(page, 'another-version'); await mount(page, 'refreshed'); await check(page, 2);
    await page.locator('[data-cinema-rate="1"]').click(); await check(page, 1);
    await setup(page); await mount(page, 'reset-by-user'); await check(page, 1);
    await page.close();

    const legacy = await browser.newPage();
    await legacy.addInitScript(() => localStorage.setItem('legacy-player', JSON.stringify({ version: 'old', completed: [], active: { key: 'old-film', index: 0, time: 3, rate: 1.5 } })));
    await setup(legacy, 'updated-content', 'legacy-player'); await mount(legacy, 'new-film'); await check(legacy, 1.5);
    await legacy.close();
    console.log(JSON.stringify({ passed: true, cases: ['four rates', 'selection before metadata', 'preloaded next clip', 'new story', 'chapter and content change', 'reload', 'explicit reset to 1x', 'legacy preference migration'] }));
} finally { await browser.close(); server.close(); }
