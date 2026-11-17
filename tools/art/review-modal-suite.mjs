import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';
const output = resolve('docs/art/review-20261022/modal-suite'); mkdirSync(output, { recursive: true });
const server = createStaticServer({ root: resolve('GameStarter/web-demo/.build') });
await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1600, height: 1080 }, reducedMotion: 'reduce' });
const base = `http://127.0.0.1:${server.address().port}`, errors = [], missing = [], serviceRequests = [], checks = [];
page.on('pageerror', e => errors.push(e.message));
page.on('response', r => { if (r.status() === 404) missing.push(r.url()); });
page.on('request', r => { if (/\/api\//.test(r.url())) serviceRequests.push(r.url()); });
const select = async name => { await page.locator(`.suite-controls [data-page=${name}]`).click(); await page.locator(`.folio-dialog[data-page=${name}]`).waitFor(); };
const capture = async name => {
    if (process.argv.includes('--verify-only')) return;
    await page.locator('#suite-status').evaluate(e => e.classList.remove('visible'));
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(image => image.decode().catch(() => {}))); });
    await page.mouse.move(5, 90); await page.locator('#suite-stage').screenshot({ path: resolve(output, `${name}.png`) });
};
try {
    await page.goto(`${base}/modal-suite.html?theme=dark&page=settings`);
    await page.locator('.folio-dialog').waitFor();
    await page.evaluate(() => { localStorage.setItem('wuzhang-chapter-session-v1', 'player-save-sentinel'); });
    for (const theme of ['dark', 'light']) {
        await page.locator(`[data-theme=${theme}]`).click();
        await select('settings'); await page.locator('[data-volume=music]').fill('60');
        if (await page.locator('[role=switch]').getAttribute('aria-checked') === 'true') await page.locator('[role=switch]').click();
        for (const tab of ['settings', 'saves', 'history', 'thought']) {
            await select(tab); await capture(`${theme}-${tab}`);
            assert.ok(await page.locator('.folio-dialog').evaluate(e => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; }), `${theme} ${tab}: panel within viewport`);
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
            assert.equal(await page.locator('.folio-header h1').evaluate(e => getComputedStyle(e).fontSize), '28px');
        }
        await select('settings');
        await page.locator('[data-volume=music]').fill('35');
        assert.equal(await page.locator('[data-volume=music]+output').textContent(), '35%');
        await page.locator('[role=switch]').click(); assert.equal(await page.locator('[role=switch]').getAttribute('aria-checked'), 'true');
        const thumb = await page.locator('[role=switch]').evaluate(e => { const style = getComputedStyle(e, '::after'), r = e.getBoundingClientRect(); return { left: parseFloat(style.left), transform: style.transform, width: parseFloat(style.width), parent: r.width }; });
        assert.ok(thumb.left + thumb.width <= thumb.parent, `${theme}: toggle knob baseline bounds`);
        await page.locator('summary').click(); await page.locator('[aria-label="API Key"]').fill('design-only-placeholder');
        await page.getByRole('button', { name: '保存并测试连接', exact: true }).click();
        assert.ok((await page.locator('#suite-status').innerText()).includes('不保存密钥'));
        await capture(`${theme}-service`);
        await page.locator('#scene-strength').fill('65');
        assert.equal(await page.locator('#suite-stage').evaluate(e => e.style.getPropertyValue('--scene-alpha')), '0.65');
        const transparent = await page.locator('.folio-dialog').evaluate(e => getComputedStyle(e).backgroundColor);
        assert.ok(transparent.includes('0.35'), `transparency should alter panel, got ${transparent}`);
        await page.locator('#scene-strength').fill(theme === 'dark' ? '36' : '22');
        await select('saves');
        await page.setViewportSize({ width: 900, height: 1080 }); await capture(`${theme}-tablet`);
        for (const width of [900, 390]) {
            await page.setViewportSize({ width, height: 1080 });
            for (const tab of ['settings', 'saves', 'history', 'thought']) {
                await select(tab);
                assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${theme} ${tab} ${width}: document overflow`);
                assert.ok(await page.locator('.folio-body').evaluate(e => e.scrollWidth <= e.clientWidth + 2), `${theme} ${tab} ${width}: inner overflow`);
            }
        }
        await capture(`${theme}-mobile-thought`);
        await page.setViewportSize({ width: 1600, height: 1080 });
        checks.push(`${theme}: 四页真实截图、字号、音量/开关、服务折叠、可调透景、900/390px无横向溢出`);
    }
    await select('saves'); await page.locator('[data-save="2"]').click();
    assert.equal(await page.locator('.save-leaf.is-empty').count(), 0);
    await page.locator('[data-save="1"]').click(); await page.getByRole('button', { name: '确认覆盖', exact: true }).click();
    await page.locator('[data-load="0"]').click(); await page.keyboard.press('Escape'); assert.equal(await page.locator('.confirmation').count(), 0);
    await select('history'); const before = await page.locator('.history-scroll').evaluate(e => e.scrollTop); await page.locator('[data-action=latest]').click();
    assert.ok(await page.locator('.history-scroll').evaluate((e, before) => e.scrollTop > before, before));
    await select('thought'); assert.equal(await page.locator('.mind-links path').count(), 4);
    await page.locator('[data-node=C02]').hover(); assert.equal(await page.locator('.mind-links path.is-related').count(), 1);
    await page.locator('[data-node=C02]').focus(); await page.keyboard.press('Enter'); assert.ok(await page.locator('.mind-detail blockquote').count());
    await page.keyboard.press('Escape'); assert.equal(await page.locator('.mind-detail').count(), 0);
    for (const id of ['C06', 'C07']) { await page.locator('[data-action=inventory]').first().click(); await page.locator(`[data-place=${id}]`).click(); }
    await page.locator('[data-action=think]').click(); assert.equal(await page.locator('[data-node=R02]').count(), 1);
    await page.locator('[data-action=undo]').click(); assert.equal(await page.locator('[data-node=R02]').count(), 0);
    assert.equal(await page.evaluate(() => localStorage.getItem('wuzhang-chapter-session-v1')), 'player-save-sentinel');
    await page.locator('.folio-close').click(); assert.equal(await page.locator('.folio-dialog').count(), 0);
    await page.locator('[data-action=reopen]').click(); assert.equal(await page.locator('.folio-dialog').count(), 1);
    await page.locator('#suite-focus').click(); assert.ok(await page.locator('body').evaluate(e => e.classList.contains('suite-focus'))); await page.keyboard.press('Escape');
    checks.push('档位留存/覆盖/取消、历史滚动、真实线索及推理/撤回、来源键盘查看、关闭/恢复/专注、玩家存档字节不变');
    assert.deepEqual(errors, []); assert.deepEqual(missing, []); assert.deepEqual(serviceRequests, []);
    writeFileSync(resolve(output, 'checks.json'), JSON.stringify({ passed: true, checks, errors, missing, serviceRequests }, null, 2));
    console.log(JSON.stringify({ passed: true, checks, errors, missing, serviceRequests }, null, 2));
} catch (error) { await page.screenshot({ path: resolve(output, 'failure.png') }); throw error; }
finally { await browser.close(); server.closeAllConnections(); await new Promise(ok => server.close(ok)); }
