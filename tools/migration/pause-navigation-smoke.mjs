import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';
import { ChapterSession, GAME_SAVE_KEY } from '../../GameStarter/web-demo/.build/GameStarter/web-demo/src/chapter-session.js';
const read = file => JSON.parse(readFileSync(file, 'utf8'));
const output = resolve(process.argv[2] ?? 'outputs/pause-navigation-20261025'); mkdirSync(output, { recursive: true });
const flow = read('content/chapters/wuzhang/chapter-one.flow.json');
const game = new ChapterSession(read('content/chapters/wuzhang/chapter-one.script.json'), flow, read('GameStarter/web-demo/.build/story/session-manifest.json').contentVersion, undefined, undefined, 'offline');
const lines = () => { while(game.snapshot().phase === 'dialogue') game.nextLine(); };
game.finishCinematic(); lines();
const action = flow.actions.find(a => a.id === 'read-notice'); game.move(action.scene); game.act(action.id); lines();
const fixture = game.serialize();
const server = createStaticServer(); await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const errors = [], results = [];
async function pageWith(save) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await context.route('http://127.0.0.1:8787/health', route => route.fulfill({ json: { configured: false }, headers: { 'Access-Control-Allow-Origin': '*' } }));
    await context.route('http://127.0.0.1:8787/api/game/settings', route => route.fulfill({ json: { apiKey: '', baseUrl: 'https://example.test/v1', model: 'test' }, headers: { 'Access-Control-Allow-Origin': '*' } }));
    await context.addInitScript(({ save, key }) => {
        localStorage.setItem('wuzhang-runtime-mode-v1', 'offline'); localStorage.setItem('wuzhang-reduced-motion', '1');
        if(save && !localStorage.getItem(key))localStorage.setItem(key,save);
    }, { save, key: GAME_SAVE_KEY });
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    return page;
}
async function fontCheck(page, label) {
    const fonts = await page.locator('.game-hud nav button:not(.phone-launcher)').evaluateAll(nodes => nodes.map(node => ({ text: node.textContent, size: getComputedStyle(node).fontSize })));
    assert.ok(fonts.length > 0, label); assert.ok(fonts.every(font => font.size === '16px'), JSON.stringify(fonts));
    assert.equal(await page.locator('.game-hud [data-action=settings]').count(), 0);
    results.push({ label, fonts });
}
async function settingsRoundtrip(page) {
    await page.locator('[data-page=pause] [data-action=settings]').click(); await page.locator('[data-page=settings]').waitFor();
    await page.locator('[data-volume=music]').fill('27');
    assert.equal(await page.locator('[data-volume=music]').inputValue(),'27');
    await page.keyboard.press('Escape'); await page.locator('[data-page=pause]').waitFor();
}
async function videoPause(page, label) {
    await page.waitForFunction(() => document.querySelector('video')?.readyState >= 2);
    await page.locator('video').evaluate(v => { v.muted=true; return v.play(); });
    await page.waitForTimeout(650);
    await page.evaluate(() => { window.pauseTestVideo = document.querySelector('video'); });
    await page.locator('[data-action=pause]').click();
    const start = await page.locator('video').evaluate(v => v.currentTime);
    assert.equal(await page.locator('video').evaluate(v=>v.paused),true);
    await page.waitForTimeout(800);
    assert.ok(Math.abs(await page.locator('video').evaluate(v=>v.currentTime)-start)<.05);
    await settingsRoundtrip(page);
    assert.equal(await page.locator('video').evaluate(v=>v.paused),true);
    await page.screenshot({ path: resolve(output, `${label}-pause.png`) });
    await page.locator('[data-action=resume-game]').click();
    assert.equal(await page.evaluate(()=>window.pauseTestVideo===document.querySelector('video')),true);
    await page.waitForTimeout(500);
    assert.ok(await page.locator('video').evaluate(v=>v.currentTime)>start+.15);
    await page.locator('video').evaluate(v=>v.pause());
    const stopped = await page.locator('video').evaluate(v=>v.currentTime);
    await page.locator('[data-action=pause]').click(); await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    assert.equal(await page.locator('video').evaluate(v=>v.paused),true);
    assert.ok(Math.abs(await page.locator('video').evaluate(v=>v.currentTime)-stopped)<.05);
    results.push({ label, sameVideo: true, offsetPreserved: true, manualPausePreserved: true });
}
try {
    const scene = await pageWith(fixture);
    await scene.goto(base,{waitUntil:'domcontentloaded'}); await scene.locator('.game-menu [data-action=continue]').click();
    await fontCheck(scene,'scene');
    await scene.screenshot({path:resolve(output,'scene-hud.png')});
    const before = await scene.evaluate(key=>localStorage.getItem(key),GAME_SAVE_KEY);
    await scene.locator('[data-action=pause]').click(); await settingsRoundtrip(scene);
    await scene.screenshot({path:resolve(output,'scene-pause.png')});
    await scene.locator('[data-action=resume-game]').click();
    assert.equal(await scene.evaluate(key=>localStorage.getItem(key),GAME_SAVE_KEY),before);
    await scene.locator('.game-hud [data-action=notes]').click();
    await scene.locator('.workspace-screen').waitFor(); await fontCheck(scene,'thoughts');
    await scene.locator('[data-action=pause]').click(); await scene.keyboard.press('Escape');
    await scene.locator('.workspace-screen').waitFor();
    for (const width of [1366,390]) {
        await scene.setViewportSize({width,height:844}); await fontCheck(scene,`thoughts-${width}`);
        await scene.locator('[data-action=pause]').click();
        assert.ok(await scene.locator('[data-page=pause]').evaluate(el => el.getBoundingClientRect().right <= innerWidth));
        await scene.screenshot({path:resolve(output,`pause-${width}.png`)});
        await scene.locator('[data-action=resume-game]').click();
    }
    await scene.locator('[data-action=pause]').click(); await scene.locator('[data-action=pause-home]').click();
    await scene.locator('.game-menu').waitFor(); assert.equal(await scene.locator('[data-page=pause]').count(),0);
    assert.equal(await scene.evaluate(key=>localStorage.getItem(key),GAME_SAVE_KEY)!==null,true);
    await scene.context().close();
    const movie = await pageWith(); await movie.goto(base,{waitUntil:'domcontentloaded'}); await movie.locator('.game-menu [data-action=new]').click();
    await videoPause(movie,'chapter-one'); await movie.context().close();
    const grain = await pageWith(); await grain.goto(base+'/?chapter=grain',{waitUntil:'domcontentloaded'});
    await videoPause(grain,'chapter-two');
    for (let i=0;i<20 && !(await grain.locator('[data-option]').count());i++) {
        if(await grain.locator('[data-cinema-action=skip]').count())await grain.locator('[data-cinema-action=skip]').click();
        else if(await grain.locator('[data-action=next]').count())await grain.locator('[data-action=next]').click();
        else break;
    }
    await grain.locator('[data-option]').first().waitFor(); await fontCheck(grain,'chapter-two-choice');
    const node = await grain.locator('#game-root').getAttribute('data-node');
    await grain.locator('[data-action=pause]').click(); await grain.keyboard.press('Escape');
    assert.equal(await grain.locator('#game-root').getAttribute('data-node'),node);
    await grain.locator('[data-action=pause]').click(); await grain.locator('[data-action=pause-home]').click();
    await grain.locator('.game-menu').waitFor(); await grain.context().close();
    assert.deepEqual(errors,[]);
    writeFileSync(resolve(output,'verification.json'),JSON.stringify({passed:true,results,errors},null,2));
    console.log('PASS: uniform navigation fonts; scene, thought and choice pause; two-chapter video/settings/resume retains media, offset and manual pause; home navigation.');
} finally { await browser.close(); server.closeAllConnections(); await new Promise(ok=>server.close(ok)); }
