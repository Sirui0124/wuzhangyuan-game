import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { createStaticServer } from '../web-demo/serve.mjs';
import { dialogueFixtures } from '../../tools/ai/dialogue-fixtures.mjs';
import { GrainSession } from '../web-demo/.build/GameStarter/web-demo/src/chapters/chapter-two/session.js';

const output = resolve('outputs/personality-integration-20261027'); mkdirSync(output, { recursive: true });
const server = createStaticServer(); await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const errors = [], reports = [];
async function contextFor(key, state) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await context.route('http://127.0.0.1:8787/**', route => route.fulfill({ json: { configured: false }, headers: { 'Access-Control-Allow-Origin': '*' } }));
    await context.addInitScript(({ key, state }) => {
        localStorage.setItem('wuzhang-runtime-mode-v1', 'offline');
        if (!sessionStorage.getItem('seeded')) {
            if (key) localStorage.setItem(key, JSON.stringify(state));
            sessionStorage.setItem('seeded', '1');
        }
    }, { key, state });
    const page = await context.newPage(); page.setDefaultTimeout(12000);
    page.on('pageerror', error => errors.push(error.message));
    return { context, page };
}
const openPersonality = async page => {
    await page.locator('[data-action=pause]').click();
    await page.locator('[data-action=pause-personality]').click();
    await page.locator('[data-personality-status]').waitFor();
};
try {
    const fixture = await dialogueFixtures(resolve('GameStarter/web-demo/.build'));
    const { context: firstContext, page: first } = await contextFor('wuzhang-chapter-session-v1', JSON.parse(fixture.first().serialize()));
    await first.goto(base); await first.locator('[data-action=continue]').click();
    await openPersonality(first);
    assert.equal(await first.locator('[data-personality-status]').getAttribute('data-personality-status'), 'locked');
    assert.equal(await first.locator('.personality-scale-marker').count(), 0);
    await first.screenshot({ path: resolve(output, 'locked-desktop.png') });
    await first.keyboard.press('Escape'); await first.locator('[data-action=pause-personality]').waitFor();
    await first.keyboard.press('Escape'); assert.equal(await first.locator('.personality-panel').count(), 0);
    assert.equal(await first.evaluate(() => JSON.parse(localStorage.getItem('wzy:personality:v1')).chapters.wuzhang.events.length), 0);
    reports.push('第一章真实菜单可打开锁定页，教学零分，Escape逐层返回');
    await firstContext.close();

    const story = JSON.parse(readFileSync('content/chapters/grain/chapter-two.films.json'));
    const session = new GrainSession(story);
    for (let i = 0; i < 80 && session.current.id !== 'UI-N1'; i++) assert.ok(session.advance(session.current.options?.[0]?.id));
    assert.equal(session.current.id, 'UI-N1');
    const { context: choiceContext, page: choice } = await contextFor('grain-chapter-two-films-v1', session.state);
    await choice.goto(`${base}/?chapter=grain`);
    await choice.locator('[data-option=N1-B]').click();
    const ledger = await choice.evaluate(() => JSON.parse(localStorage.getItem('wzy:personality:v1')));
    assert.equal(ledger.chapters.grain.events.length, 1); assert.equal(ledger.chapters.grain.events[0].optionId, 'N1-B');
    await choice.locator('video').waitFor();
    const time = await choice.locator('video').evaluate(video => video.currentTime);
    await openPersonality(choice); assert.equal(await choice.locator('video').evaluate(video => video.paused), true);
    await choice.locator('[data-action=resume-game]').click();
    const restoredTime = await choice.locator('video').evaluate(video => video.currentTime);
    assert.ok(restoredTime >= time && restoredTime < time + 3);
    reports.push('第二章实际选项写入人格；打开页面暂停影片，返回保留播放位置');
    await choiceContext.close();

    const { context: demoContext, page: demo } = await contextFor('wzy:personality:v1', { sentinel: 'formal-record-preserved' });
    await demo.goto(`${base}/?chapter=grain&playtest=personality&view=personality`);
    await demo.locator('.personality-name').filter({ hasText: '诸葛亮' }).waitFor();
    assert.equal(await demo.locator('.personality-scale-marker').count(), 4);
    assert.match(await demo.locator('.personality-preview-note').textContent(), /试玩示例/);
    assert.equal(await demo.evaluate(() => JSON.parse(localStorage.getItem('wzy:personality:v1')).sentinel), 'formal-record-preserved');
    await demo.screenshot({ path: resolve(output, 'result-desktop.png') });
    await demo.setViewportSize({ width: 390, height: 844 });
    assert.ok(await demo.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await demo.screenshot({ path: resolve(output, 'result-mobile.png') });
    await demo.locator('[data-personality-detail=death-history] summary').click();
    assert.match(await demo.locator('.personality-history').textContent(), /初次教学经历，不计人格/);
    await demo.reload(); await demo.locator('.personality-name').waitFor();
    assert.match(await demo.locator('.personality-preview-note').textContent(), /试玩示例/);
    const before = await demo.evaluate(() => JSON.parse(localStorage.getItem('wzy:personality:v1:playtest:personality:grain')));
    await demo.keyboard.press('Escape'); await demo.locator('[data-action=pause-restart]').click();
    await demo.locator('[data-action=pause-restart-confirm]').click();
    const after = await demo.evaluate(() => JSON.parse(localStorage.getItem('wzy:personality:v1:playtest:personality:grain')));
    assert.equal(after.chapters.grain.events.length, 0);
    assert.deepEqual(after.chapters.wuzhang, before.chapters.wuzhang);
    assert.deepEqual(after.deaths, before.deaths);
    assert.equal(after.unlocked, true);
    reports.push('结果示例四维齐全，桌面/手机无横向溢出，刷新保留示例标记，重玩只清当前章，死亡留档与正式存档保留');
    await demoContext.close();
    assert.deepEqual(errors, []);
    writeFileSync(resolve(output, 'browser-report.json'), JSON.stringify({ reports, errors }, null, 2));
    console.log(JSON.stringify({ reports, errors }, null, 2));
} finally { await browser.close(); await new Promise(ok => server.close(ok)); }
