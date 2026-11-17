import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';
const output = resolve('docs/art/review-20261022/thought-options'); mkdirSync(output, { recursive: true });
const server = createStaticServer({ root: resolve('GameStarter/web-demo/.build') });
await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1600, height: 1080 }, reducedMotion: 'reduce' });
const base = `http://127.0.0.1:${server.address().port}`, errors = [], missing = [], checks = [], metrics = {};
page.on('pageerror', e => errors.push(e.message)); page.on('response', r => { if (r.status() === 404) missing.push(r.url()); });
const capture = async name => {
    await page.evaluate(async () => { await document.fonts.ready; });
    await page.mouse.move(5, 82);
    await page.locator('#game-root').screenshot({ path: resolve(output, `${name}.png`) });
};
const stage = async value => { await page.locator('#design-stage').selectOption(value); await page.waitForFunction(() => document.querySelector('.reasoning-timeline')?.getBoundingClientRect().height > 0); };
try {
    await page.goto(`${base}/thought-options.html?theme=mist&stage=developed`);
    await page.locator('[data-thought-result=R01]').waitFor();
    await page.evaluate(() => { localStorage.setItem('wuzhang-chapter-session-v1', 'player-save-sentinel'); });
    for (const theme of ['mist', 'silk', 'night']) {
        await page.locator(`[data-theme=${theme}]`).click();
        for (const sample of ['initial', 'first', 'developed', 'ready']) {
            await stage(sample);
            if (sample !== 'initial') await page.locator('.reasoning-curve').first().waitFor({ state: 'attached' });
            if (sample === 'ready') await page.locator('.thought-action').scrollIntoViewIfNeeded();
            await capture(`${theme}-${sample}`);
        }
        await stage('developed');
        assert.equal(await page.locator('.reasoning-curve:not(.continuation-curve)').count(), 4);
        assert.equal(await page.locator('.continuation-curve').count(), 2);
        assert.ok(await page.locator('[data-thought-result=R01]').evaluate(e => e.getBoundingClientRect().bottom < document.querySelector('#game-root').getBoundingClientRect().bottom - 20), `${theme}: second understanding should fit in the desktop frame`);
        assert.equal(await page.locator('.outcome-kicker:visible,.thought-record-state:visible,.working-clue>small:visible').count(), 0);
        const fonts = await page.locator('.reasoning-heading h1,.working-clue-title,.thought-outcome h2,.outcome-insight,.think-button,.reasoning-footer>button').evaluateAll(nodes => [...new Set(nodes.map(n => getComputedStyle(n).fontSize))].sort());
        assert.ok(fonts.every(size => ['14px', '20px', '28px'].includes(size)), `${theme} unexpected font ${fonts}`);
        metrics[theme] = { fonts, actualEvidenceCurves: 4, carriedUnderstandingCurves: 2 };
        await page.locator('[data-thought-node=C02] .working-clue-title').hover();
        assert.equal(await page.locator('.reasoning-curve.is-related').count(), 1);
        await page.locator('[data-thought-node=C02] .working-clue-title').click();
        assert.ok(await page.locator('.inventory-detail blockquote').count());
        await capture(`${theme}-sources`);
        await page.setViewportSize({ width: 900, height: 1080 }); await capture(`${theme}-tablet`);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        assert.ok(await page.locator('.workspace-layout').evaluate(e => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.width > 400; }));
        await page.setViewportSize({ width: 1600, height: 1080 });
        await page.locator('.inventory-tab').click();
        checks.push(`${theme}: 真实依据曲线、关系高亮、来源查看、三档字号及900px布局`);
    }
    await page.locator('[data-theme=mist]').click(); await stage('initial');
    await page.locator('[data-action=think]').click(); assert.equal(await page.locator('[data-thought-result=I01]').count(), 1);
    await page.locator('[data-action=open-inventory]').first().click();
    await page.locator('[data-inventory-item=C04]').click(); await page.locator('[data-place-evidence=C04]').click();
    await page.locator('.inventory-tab').click(); await page.locator('[data-action=think]').click();
    assert.equal(await page.locator('[data-thought-result=R01]').count(), 1);
    await page.locator('[data-action=revise-thought]').click(); assert.equal(await page.locator('[data-thought-result=R01]').count(), 0);
    await page.locator('[data-thought-result=I01]').focus(); await page.keyboard.press('Enter');
    assert.ok(await page.locator('.inventory-detail .source-links button').count());
    await page.keyboard.press('Escape'); assert.equal(await page.locator('#thought-inventory').count(), 0);
    assert.equal(await page.evaluate(() => localStorage.getItem('wuzhang-chapter-session-v1')), 'player-save-sentinel');
    await page.locator('#design-reset').click(); assert.equal(await page.locator('[data-thought-result]').count(), 0);
    await page.locator('#design-transparency').fill('70');
    assert.equal(await page.locator('.thought-landscape').evaluate(e => getComputedStyle(e).opacity), '0.7');
    assert.equal(await page.locator('#design-transparency-value').innerText(), '70%');
    await page.locator('[data-theme=night]').click();
    assert.equal(await page.locator('#design-transparency').inputValue(), '86');
    await page.locator('[data-theme=mist]').click();
    assert.equal(await page.locator('#design-transparency').inputValue(), '70');
    await page.locator('#design-fullscreen').click(); assert.ok(await page.locator('body').evaluate(e => e.classList.contains('design-focus')));
    await page.keyboard.press('Escape'); assert.equal(await page.locator('.design-controls').isVisible(), true);
    checks.push('真实思考、补充线索、撤回、键盘查看来源、重置与专注模式；每套透景程度独立可调；玩家存档不变');
    assert.deepEqual(errors, []); assert.deepEqual(missing, []);
    writeFileSync(resolve(output, 'checks.json'), JSON.stringify({ passed: true, checks, metrics, errors, missing }, null, 2));
    console.log(JSON.stringify({ passed: true, checks, metrics, errors, missing }, null, 2));
} catch (error) { await page.screenshot({ path: resolve(output, 'failure.png') }); throw error; }
finally { await browser.close(); server.closeAllConnections(); await new Promise(ok => server.close(ok)); }
