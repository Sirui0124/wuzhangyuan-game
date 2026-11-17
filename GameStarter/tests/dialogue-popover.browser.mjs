import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createStaticServer } from '../web-demo/serve.mjs';

const draft = process.env.NARRATIVE_DRAFT ? resolve(process.env.NARRATIVE_DRAFT) : '';
const output = resolve(process.env.NARRATIVE_UI_OUTPUT || 'outputs/dialogue-popover-20261117'); mkdirSync(output, { recursive: true });
const server = createStaticServer({ root: resolve('GameStarter/web-demo/.build'), onRequest: draft ? (req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname;
    const local = path === '/' ? resolve(draft, 'GameStarter/web-demo/public/index.html') : path === '/narrative.css' ? resolve(draft, 'GameStarter/web-demo/public/narrative.css') : path.endsWith('.js') && path.startsWith('/GameStarter/') ? resolve(draft, 'GameStarter/web-demo/.build', path.slice(1)) : '';
    if (!local) return false;
    if (!existsSync(local)) { res.writeHead(404); res.end(); return true; }
    res.setHeader('Content-Type', path === '/' ? 'text/html; charset=utf-8' : path.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8'); res.end(readFileSync(local)); return true;
} : undefined });
await new Promise(done => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [], phoneRequests = [], results = [];
try {
    for (const viewport of [{ width:1440,height:900 }, { width:390,height:844 }, { width:844,height:390 }]) {
        for (const [chapter, query] of [['wuzhang', '?playtest=weiyan-second'], ['grain', '?chapter=grain&playtest=open1'], ['jieting', '?chapter=jieting&playtest=reinforcement']]) {
            const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
            await context.addInitScript(() => {
                localStorage.setItem('wuzhang-runtime-mode-v1', 'ai-phone'); // Old preference must not revive the phone.
                localStorage.setItem('wuzhang-chapter-history-v1', JSON.stringify({ version: 1, entered: ['wuzhang', 'grain', 'jieting'], completed: ['wuzhang', 'grain'] }));
                localStorage.setItem('wuzhang-voice-muted', '1');
            });
            await context.route('**/*', async route => {
                const url = new URL(route.request().url());
                if (/\/api\/game\/(shop|phone)/.test(url.pathname)) phoneRequests.push(url.pathname);
                if (url.origin === base) return route.continue();
                if (url.pathname === '/health') return route.fulfill({ headers: { 'Access-Control-Allow-Origin': '*' }, json: { configured: true } });
                return route.abort();
            });
            const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
            console.log('Checking',chapter,viewport);
            page.on('pageerror',e=>console.log('PAGE ERROR',e.message));
            await page.goto(base + '/' + query, {waitUntil:'domcontentloaded'});
            console.log('DOM ready');
            await page.locator('#player-expression').waitFor().catch(async e=>{await page.screenshot({path:resolve(output,'failure.png')});console.log((await page.locator('body').innerText()).slice(0,1000));throw e;});
            assert.equal(await page.locator('.phone-panel,.thought-inventory,.reasoning-timeline,[data-action="notes"],[data-action="clue-items"],[data-action="supplies"]').count(), 0);
            await page.locator('#player-expression').fill('先把眼前的军情说清，再请将军定夺。');
            assert.equal(await page.locator('#player-expression').inputValue(), '先把眼前的军情说清，再请将军定夺。');
            assert.equal(await page.locator('.dialogue-clues').isVisible(), false);
            await page.locator('[data-clue-picker]').click();
            await page.locator('.dialogue-clues:popover-open').waitFor();
            const details = page.locator('.dialogue-clues details');
            const count = await details.count();
            assert.ok(count >= 2, `${chapter} needs acquired clues`);
            for (let i=0;i<2;i++) {
                const item = details.nth(i);
                await item.locator('summary').click();
                const add = item.locator('[data-action="insert-clue"]');
                if (await add.isEnabled()) await add.click();
                await page.locator('.dialogue-clues:popover-open').waitFor();
            }
            assert.ok(await page.locator('.clue-reference').count() >= 2);
            assert.equal(await page.locator('#player-expression').inputValue(), '先把眼前的军情说清，再请将军定夺。');
            await page.screenshot({ path:resolve(output, `${chapter}-${viewport.width}-details.png`) });
            await page.locator('[data-clue-close]').click();
            await page.screenshot({ path:resolve(output, `${chapter}-${viewport.width}-references.png`) });
            await page.locator('[data-clue-preview]').first().click();
            assert.equal(await page.locator('.dialogue-clues details[open]').count(),1);
            const metrics = await page.evaluate(() => {
                const css = s => getComputedStyle(document.querySelector(s));
                const input = document.querySelector('#player-expression');
                const style = getComputedStyle(input);
                const panel = document.querySelector('.dialogue-clues').getBoundingClientRect();
                return { fonts:['.clue-references','.expression-current-reply p','.dialogue-clues p'].map(s=>css(s).fontSize), height:input.clientHeight, line:parseFloat(style.lineHeight), panel:{left:panel.left,right:panel.right,top:panel.top,bottom:panel.bottom}, screen:{w:innerWidth,h:innerHeight} };
            });
            assert.equal(new Set(metrics.fonts).size,1,JSON.stringify(metrics));
            assert.ok(metrics.height >= metrics.line*2.5-1,JSON.stringify(metrics));
            assert.ok(metrics.panel.left>=0 && metrics.panel.right<=metrics.screen.w && metrics.panel.top>=0 && metrics.panel.bottom<=metrics.screen.h,JSON.stringify(metrics));
            await page.keyboard.press('Escape');
            assert.equal(await page.locator('.dialogue-clues').isVisible(),false);
            await page.locator('[data-clue-picker]').click();
            await page.locator('#player-expression').click();
            assert.equal(await page.locator('.dialogue-clues').isVisible(),false);
            const before = await page.locator('.clue-reference').count();
            await page.locator('[data-action="remove-clue"]').first().click();
            assert.equal(await page.locator('.clue-reference').count(),before-1);
            await page.locator('[data-action="clear-expression"]').click();
            assert.equal(await page.locator('#player-expression').inputValue(),'');
            assert.equal(await page.locator('.clue-reference').count(),0);
            await page.locator('#player-expression').fill('先把眼前的军情说清，再请将军定夺。');
            await page.locator('[data-action="speak"]').scrollIntoViewIfNeeded();
            assert.ok(await page.locator('[data-action="speak"]').isEnabled());
            assert.ok(await page.locator('[data-action="speak"]').isVisible());
            await page.screenshot({ path: resolve(output, `${chapter}-${viewport.width}.png`) });
            results.push({ chapter, viewport, passed: true });
            await context.close();
        }
    }
    assert.deepEqual(errors, []); assert.deepEqual(phoneRequests, []);
    writeFileSync(resolve(output, 'checks.json'), JSON.stringify({ results, errors, phoneRequests }, null, 2));
    console.log(JSON.stringify({ results, errors, phoneRequests }, null, 2));
} finally { await browser.close(); server.closeAllConnections(); await new Promise(done => server.close(done)); }
