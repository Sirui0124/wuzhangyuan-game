import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';
import { dialogueFixtures } from '../ai/dialogue-fixtures.mjs';
import { GrainSession } from '../../GameStarter/web-demo/.build/GameStarter/web-demo/src/chapters/chapter-two/session.js';
const f=await dialogueFixtures(resolve('GameStarter/web-demo/.build'));
const story=JSON.parse(readFileSync('content/chapters/grain/chapter-two.playable.json'));
const output=resolve('outputs/world-items-20261025');mkdirSync(output,{recursive:true});
const server=createStaticServer();await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,channel:'chrome'});
const errors=[];
async function pageFor(mode,key,state){
    const page=await browser.newPage({viewport:{width:1366,height:900},reducedMotion:'reduce'});
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('http://127.0.0.1:8787/**',route=>{
        const path=new URL(route.request().url()).pathname;
        return route.fulfill({headers:{'Access-Control-Allow-Origin':'*'},json:path==='/health'?{configured:mode!=='offline'}:{apiKey:'',baseUrl:'',model:''}});
    });
    await page.addInitScript(({mode,key,state})=>{
        localStorage.setItem('wuzhang-runtime-mode-v1',mode);
        localStorage.setItem('wuzhang-phone-enabled-v1',mode==='ai'?'0':'1');
        localStorage.setItem('wuzhang-reduced-motion','1');localStorage.setItem('wuzhang-voice-muted','1');
        if(!sessionStorage.getItem('seeded')){localStorage.setItem(key,state);sessionStorage.setItem('seeded','1');}
    },{mode,key,state});return page;
}
const close=page=>page.locator('[data-action=close-modal]').click();
try{
    const camp=await f.thoughts();camp.closeNotes();camp.move('camp_gate');
    const page=await pageFor('offline','wuzhang-chapter-session-v1',camp.serialize());
    await page.goto(base);await page.locator('[data-action=continue]').click();
    await page.locator('[data-action=pick-up-cup]').click();
    await page.locator('#game-notice').filter({hasText:'破旧的酒杯'}).waitFor();
    assert.equal(await page.locator('[data-action=pick-up-cup]').count(),0);
    await page.locator('[data-action=bag]').click();await page.getByRole('heading',{name:'破旧的酒杯',exact:true}).waitFor();
    assert.equal(await page.locator('[data-sell-world-item]').count(),0);
    await page.screenshot({path:resolve(output,'01-offline-inventory.png')});await close(page);
    await page.reload();await page.locator('[data-action=continue]').click();await page.locator('[data-action=bag]').click();await page.getByRole('heading',{name:'破旧的酒杯',exact:true}).waitFor();
    await page.close();
    const gift=await f.thoughts();gift.think();gift.continueThought();gift.placeThought('C06');gift.think();gift.followPlan();
    while(gift.snapshot().lineIndex<gift.currentSection().rows.length-1)gift.nextLine();
    const gp=await pageFor('offline','wuzhang-chapter-session-v1',gift.serialize());await gp.goto(base);await gp.locator('[data-action=continue]').click();
    for(let i=0;i<12&&!await gp.locator('.world-item-receipt').count();i++){
        if(await gp.locator('[data-film-confirm]:visible').count())await gp.locator('[data-film-confirm]').click();
        else if(await gp.locator('[data-cinema-action=skip]:visible').count())await gp.locator('[data-cinema-action=skip]').click();
        else await gp.locator('.dialogue-box').click();
    }
    await gp.locator('.world-item-receipt').filter({hasText:'姜维递来一条头巾'}).waitFor();await gp.screenshot({path:resolve(output,'05-jiang-gift-text.png')});await gp.close();
    const first=await f.authorized();const sale=await pageFor('ai-phone','wuzhang-chapter-session-v1',first.serialize());
    await sale.goto(base);await sale.locator('[data-action=continue]').click();await sale.locator('[data-action=supplies]').click();
    await sale.locator('[data-sell-world-item=jiang-headscarf]').click();await sale.locator('[data-cancel-sale]').click();
    assert.equal(await sale.locator('.phone-wallet strong').innerText(),'¥50');
    await sale.locator('[data-sell-world-item=jiang-headscarf]').click();await sale.screenshot({path:resolve(output,'02-sale-confirmation.png')});
    await sale.locator('[data-confirm-sale=jiang-headscarf]').click();assert.equal(await sale.locator('.phone-wallet strong').innerText(),'¥70');
    assert.equal(await sale.locator('[data-sell-world-item=jiang-headscarf]').count(),0);
    await sale.reload();await sale.locator('[data-action=continue]').click();await sale.locator('[data-action=supplies]').click();assert.equal(await sale.locator('.phone-wallet strong').innerText(),'¥70');await sale.close();
    for(const mode of ['ai','ai-phone']){
        const s=new GrainSession(story);while(s.current.id!=='CH2-LY02-ACT01')assert.ok(s.advance(s.current.options?.[0]?.id));
        const p=await pageFor(mode,'grain-chapter-two-prefix-v1',JSON.stringify(s.state));await p.goto(base+'/?chapter=grain');
        await p.locator('[data-action=own-tent]').click();await p.locator('[data-action=take-candlestick]').click();await p.getByText('案上的蜡烛台已收进物品栏。',{exact:true}).waitFor();
        await p.screenshot({path:resolve(output,`03-${mode}-tent.png`)});await close(p);await p.locator('[data-action=bag]').click();await p.getByRole('heading',{name:'军帐里的蜡烛台',exact:true}).waitFor();await close(p);
        for(let i=0;i<40&&await p.locator('#player-expression').count()===0;i++)await p.locator('[data-action=next]').click();
        await p.locator('#player-expression').waitFor();assert.equal(await p.locator('[data-action=own-tent]').count(),0);
        if(mode==='ai'){assert.equal(await p.locator('[data-action=supplies]').count(),0);}
        else{await p.locator('[data-action=supplies]').click();await p.locator('[data-sell-world-item=tent-candlestick]').click();await p.locator('[data-confirm-sale=tent-candlestick]').click();assert.equal(await p.locator('.phone-wallet strong').innerText(),'¥30');await close(p);}
        await p.setViewportSize({width:390,height:844});await p.locator('[data-action=bag]').click();assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        await p.screenshot({path:resolve(output,`04-${mode}-mobile-bag.png`)});await p.close();
    }
    assert.deepEqual(errors,[]);writeFileSync(resolve(output,'browser.json'),JSON.stringify({passed:true,errors,checks:['offline pickup and reload','read-only bag','sale retain/confirm','20 yuan sale reload','own tent optional pickup','phone-disabled inventory','10 yuan sale','390px bag']},null,2));console.log('World item browser checks passed');
}finally{await browser.close();await new Promise(ok=>server.close(ok));}
