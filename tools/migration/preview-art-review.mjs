import { chromium } from 'playwright';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const output = resolve('outputs/art-review-mindmap-20261022'); mkdirSync(output, { recursive: true });
const server = createStaticServer(); await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1600, height: 1320 } });
const specimen = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [], missing = [];
const fontEvidence = [];
for (const tab of [page, specimen]) { tab.on('pageerror', e => errors.push(e.message)); tab.on('response', r => { if (r.status() === 404) missing.push(r.url()); }); }
const ready = async tab => tab.evaluate(async () => { await document.fonts.ready; await Promise.all(Array.from(document.images).map(i => i.decode())); });
try {
    await page.goto(base + '/art-review.html'); await page.locator('iframe').waitFor();
    await specimen.goto(base + '/art-review.html');
    for (const scene of ['thoughts', 'expression', 'dialogue', 'camp']) {
        await page.locator(`[data-scene=${scene}]`).click();
        for (const style of ['cinnabar', 'jade', 'night']) {
            await page.locator(`[data-style=${style}]`).click();
            const html = await page.locator('iframe').getAttribute('srcdoc');
            await specimen.setContent(html, { waitUntil: 'networkidle' });
            await ready(specimen);
            await specimen.locator('img').evaluateAll(images => images.forEach(i => i.classList.add('is-ready')));
            assert.equal(await specimen.locator('html').getAttribute('data-art-style'), style);
            assert.equal(await specimen.locator('html').getAttribute('data-art-font'), 'kai');
            await specimen.screenshot({ path: resolve(output, `${style}-${scene}.png`) });
            if (scene === 'thoughts' || scene === 'expression') {
                assert.equal(await specimen.locator('.thought-note').count(), scene === 'thoughts' ? 8 : 5);
                assert.equal(await specimen.locator('.thought-lines path').count(), scene === 'thoughts' ? 7 : 5);
                const overlaps = await specimen.evaluate(() => {
                    const range = document.createRange(); range.selectNodeContents(document.querySelector('.thought-center h1'));
                    const heading = range.getBoundingClientRect();
                    const body = document.querySelector('#player-expression')?.getBoundingClientRect();
                    return [...document.querySelectorAll('.thought-note')].filter(note => {
                        const a = note.getBoundingClientRect();
                        return [heading, body].filter(Boolean).some(b => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top);
                    }).map(note => note.dataset.node);
                });
                assert.deepEqual(overlaps, [], 'Notes must not collide with the central question or speech');
                if (scene === 'expression') assert.ok(await specimen.locator('textarea').evaluate(input => input.scrollHeight <= input.clientHeight + 1), 'The complete speech must fit without clipping');
            }
            if (scene === 'thoughts' && style === 'cinnabar') {
                const client = await specimen.context().newCDPSession(specimen);
                await client.send('DOM.enable'); await client.send('CSS.enable');
                const { root } = await client.send('DOM.getDocument');
                const { nodeId } = await client.send('DOM.querySelector', { nodeId: root.nodeId, selector: '.note-summary span' });
                const { fonts } = await client.send('CSS.getPlatformFontsForNode', { nodeId });
                assert.ok(fonts.some(font => /kai|楷/i.test(font.familyName)), 'Chinese notes must actually render in KaiTi');
                fontEvidence.push(...fonts.map(font => ({ family: font.familyName, glyphs: font.glyphCount })));
                await client.detach();
            }
        }
    }
    await page.locator('[data-scene=expression]').click(); await page.locator('[data-style=cinnabar]').click();
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: resolve(output, 'review-desktop.png'), fullPage: true });
    await page.locator('[data-font=song]').click();
    assert.equal(await page.frameLocator('iframe').locator('html').getAttribute('data-art-font'), 'song');
    await specimen.setContent(await page.locator('iframe').getAttribute('srcdoc'), { waitUntil: 'networkidle' });
    await ready(specimen); await specimen.screenshot({ path: resolve(output, 'cinnabar-expression-song.png') });
    await page.locator('[data-font=kai]').click();
    await page.locator('#compare').click(); assert.equal(await page.locator('iframe').count(), 3);
    await page.waitForLoadState('networkidle'); await page.screenshot({ path: resolve(output, 'three-versions.png'), fullPage: true });
    await page.locator('#original').click(); assert.equal(await page.locator('iframe').count(), 1);
    assert.equal(await page.frameLocator('iframe').locator('html').getAttribute('data-art-style'), null);
    await page.locator('[data-style=jade]').click();
    await page.setViewportSize({ width: 768, height: 1100 }); await page.waitForLoadState('networkidle');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: resolve(output, 'review-tablet.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(await page.evaluate(() => Object.keys(localStorage)), []);
    assert.deepEqual(errors, []); assert.deepEqual(missing, []);
    writeFileSync(resolve(output, 'checks.json'), JSON.stringify({ passed: true, variants: 3, scenes: 4, fontEvidence, errors, missing, storageWrites: 0 }, null, 2));
    console.log('Verified curved layouts, actual KaiTi glyphs, KaiTi/Song switching, 3 variants × 4 scenes, responsive review and no game save writes.');
} finally { await browser.close(); server.closeAllConnections(); await new Promise(ok => server.close(ok)); }
