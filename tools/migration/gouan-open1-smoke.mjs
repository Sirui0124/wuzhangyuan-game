import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';
const server=createStaticServer(); await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:1366,height:768}});
const errors=[]; page.on('pageerror',e=>errors.push(e.message));
const key='grain-chapter-two-open1-playtest-v1', output='outputs/chapter-two-review-20261023';
let behavior='success', values=[2,2,2], calls=0;
await page.route('**/api/game/respond',async route=>{
    calls++;
    const payload=route.request().postDataJSON();
    const words=JSON.parse(payload.text.slice(payload.text.indexOf('{"rubric":'))).playerWords;
    if(behavior==='delay') await new Promise(ok=>setTimeout(ok,700));
    const text=behavior==='bad' ? '{}' : JSON.stringify({valid:true,scores:Object.fromEntries(['trust','rigor','responsibility'].map((k,i)=>[k,{delta:values[i],quote:words,reason:'模拟逐维度理由'}]))});
    await route.fulfill({json:{text,responseId:'test'}}).catch(()=>{});
});
const state=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
async function send(text){await page.locator('#player-expression').fill(text);await page.locator('[data-action=speak]').click();}
try {
    await page.goto(base+'/chapter-two.html?playtest=open1');
    await page.locator('#player-expression').waitFor();
    assert.equal(await page.locator('[data-action=speak]').isDisabled(),true);
    await page.locator('#player-expression').fill('我去核记录，再如实报。');await page.reload();
    assert.equal(await page.locator('#player-expression').inputValue(),'我去核记录，再如实报。');
    behavior='bad';await page.locator('[data-action=speak]').click();await page.getByRole('status').filter({hasText:'评分未完整'}).waitFor();
    assert.deepEqual((await state()).judgments,{});
    behavior='success';await page.locator('[data-action=speak]').click();await page.locator('[data-action=revise]').waitFor();
    assert.equal(Object.keys((await state()).judgments).length,1);
    await page.reload();await page.locator('[data-action=revise]').click();
    values=[-2,0,-1];await send('你自己想清楚，否则我把你交出去。');await page.locator('[data-action=revise]').waitFor();
    assert.equal(Object.keys((await state()).judgments).length,1);
    assert.equal((await state()).judgments['CH2-LY03-018'].scores.trust.delta,-2);
    await page.screenshot({path:output+'/open1-reply.png'});
    await page.locator('[data-action=revise]').click();behavior='delay';await send('让我再去查一查。');await page.locator('[data-action=cancel-speech]').click();
    await page.waitForTimeout(900);assert.equal((await state()).judgments['CH2-LY03-018'].scores.trust.delta,-2);
    await page.setViewportSize({width:390,height:844});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:output+'/open1-mobile.png'});
    await page.locator('[data-action=keep]').click();await page.locator('[data-action=next]').click();
    assert.equal(await page.locator('#game-root').getAttribute('data-node'),'CH2-PREFIX-END');
    assert.deepEqual(errors,[]);
    const result={passed:true,calls,checks:['draft restore','invalid response no commit','successful judgment','reply restore','replacement scores','late response cancellation','390px width','flow endpoint'],errors};
    writeFileSync(output+'/open1-browser.json',JSON.stringify(result,null,2)); console.log(JSON.stringify(result));
} finally {await browser.close();await new Promise(ok=>server.close(ok));}
