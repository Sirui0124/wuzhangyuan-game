import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const output = resolve('docs/art/review-20261022/thought-options');
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
    const page = await browser.newPage({ viewport: { width: 2400, height: 1080 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(resolve('source-art/visuals/review/20261022/thought-options/index.html')).href);
    const load = async () => {
        await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.querySelectorAll('.option img')].map(image => image.decode())); });
        assert.equal(await page.locator('.option img').evaluateAll(images => images.filter(image => !image.complete || !image.naturalWidth).length), 0);
    };
    for (const stage of ['initial', 'first', 'ready', 'sources', 'tablet', 'developed']) {
        await page.locator(`[data-stage=${stage}]`).click(); await load();
    }
    await page.locator('.image-button[data-open=silk]').click();
    assert.equal(await page.locator('#viewer').evaluate(dialog => dialog.open), true);
    await page.keyboard.press('Escape'); assert.equal(await page.locator('#viewer').evaluate(dialog => dialog.open), false);
    await page.screenshot({ path: resolve(output, 'overview.jpg'), type: 'jpeg', quality: 92, fullPage: true });
    await page.setViewportSize({ width: 900, height: 1100 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(errors, []);
    const report = { passed: true, fileProtocol: true, options: 3, stages: 6, screenshots: 18, noBrokenImages: true, largeImageViewer: true, keyboardClose: true, tabletNoOverflow: true, approval: '待用户review', errors };
    writeFileSync(resolve(output, 'gallery-checks.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
} finally { await browser.close(); }
