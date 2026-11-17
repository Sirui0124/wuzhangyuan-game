import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync,readFileSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';
const output=resolve('outputs/jieting-deployment-ui-20261027/browser');mkdirSync(output,{recursive:true});
const build=resolve('GameStarter/web-demo/.build');
const {createJietingPlaytest}=await import(pathToFileURL(resolve(build,'GameStarter/web-demo/src/chapters/chapter-three/session.js')));
const story=JSON.parse(readFileSync(resolve(build,'story/chapter-three.story.json')));
const server=createStaticServer();await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:'chrome',headless:true});
const report={errors:[],checks:[],layouts:[],snapshots:[]};let page;
async function fixture(online=false,saved){
    const context=await browser.newContext({viewport:{width:1440,height:900}});
    await context.route('http://127.0.0.1:8787/**',route=>route.fulfill({headers:{'Access-Control-Allow-Origin':'*'},json:{configured:online}}));
    await context.addInitScript(({online,saved})=>{
        localStorage.setItem('wuzhang-chapter-history-v1',JSON.stringify({version:1,entered:['wuzhang','grain'],completed:['wuzhang','grain']}));
        localStorage.setItem('wuzhang-runtime-mode-v1',online?'ai':'offline');localStorage.setItem('wuzhang-reduced-motion','0');
        if(saved&&!sessionStorage.getItem('seeded')){localStorage.setItem('jieting-chapter-three-v1',JSON.stringify(saved));sessionStorage.setItem('seeded','1');}
    },{online,saved});
    const page=await context.newPage();page.on('pageerror',error=>report.errors.push(error.message));
    await page.goto(`${base}/?chapter=jieting${saved?'':'&playtest=reinforcement'}`,{waitUntil:'domcontentloaded'});
    await page.locator('[data-deployment]').waitFor();return{context,page};
}
const state=page=>page.locator('[data-deployment]').evaluate(axis=>({below:+axis.dataset.below,above:+axis.dataset.above,proposed:+axis.dataset.proposed,remaining:+axis.dataset.remaining,stage:axis.dataset.stage}));
const frame=page=>page.locator('#game-root').evaluate(root=>({node:root.dataset.node,page:root.dataset.readingPage}));
async function advance(page,pick){const before=await frame(page);await page.locator(pick?`[data-option="${pick}"]`:'.dialogue-advance').click();await page.waitForFunction(before=>{const root=document.querySelector('#game-root');return root?.dataset.node!==before.node||root?.dataset.readingPage!==before.page;},before);}
async function until(page,predicate){for(let i=0;i<180;i++){if(await predicate())return;await advance(page);}throw Error('Did not reach requested deployment event');}
async function shot(page,name){
    await page.locator('.deployment-below').evaluate(async bar=>{await Promise.all(bar.getAnimations().map(animation=>animation.finished.catch(()=>{})));});
    const actual=await page.locator('[data-deployment]').evaluate(axis=>({ratio:axis.querySelector('.deployment-below').getBoundingClientRect().width/axis.querySelector('.deployment-track').clientWidth,expected:+axis.dataset.below/25000}));
    assert.ok(Math.abs(actual.ratio-actual.expected)<.01,JSON.stringify(actual));
    await page.screenshot({path:resolve(output,name+'.png')});report.snapshots.push(name);
}
async function layout(page,name){
    const value=await page.locator('[data-deployment]').evaluate(axis=>{
        const r=axis.getBoundingClientRect(), objective=axis.querySelector('.deployment-objective'), o=objective.getBoundingClientRect();
        const fonts=[...axis.querySelectorAll('span,strong')].map(n=>parseFloat(getComputedStyle(n).fontSize));
        const content=document.querySelector('.workspace-layout')??document.querySelector('.dialogue-box'), c=content.getBoundingClientRect();
        const identity=document.querySelector('.character-identity')?.getBoundingClientRect();
        return{viewport:[innerWidth,innerHeight],width:r.width,left:r.left,right:r.right,top:r.top,bottom:r.bottom,noHorizontalOverflow:axis.scrollWidth<=axis.clientWidth+1,
            marks:[...axis.querySelectorAll('[data-mark]')].map(n=>+n.dataset.mark),objective:objective.textContent,objectiveCentered:Math.abs((o.left+o.right-r.left-r.right)/2)<2,
            outsideScrollingContent:!axis.closest('.workspace-layout,.dialogue-box,.jieting-dialogue-stack'),contentBelow:c.top>=r.bottom-1,contentHasNoHorizontalOverflow:content.scrollWidth<=content.clientWidth+1,
            identityOutsideAxis:!identity||identity.top>=r.bottom, fontRange:[Math.min(...fonts),Math.max(...fonts)],thresholdPosition:parseFloat(getComputedStyle(axis.querySelector('.is-threshold')).left)/axis.querySelector('.deployment-ticks').clientWidth};
    });
    assert.ok(value.noHorizontalOverflow&&value.left>=-1&&value.right<=value.viewport[0]+1&&value.top>=0&&value.bottom<=value.viewport[1],JSON.stringify(value));
    assert.deepEqual(value.marks,[0,5000,10000,15000,20000,25000]);assert.ok(Math.abs(value.thresholdPosition-.4)<.02);
    assert.equal(value.objective,'目标：尽可能多地让马谡把兵分到山下');
    assert.ok(value.objectiveCentered&&value.outsideScrollingContent&&value.contentBelow&&value.contentHasNoHorizontalOverflow&&value.identityOutsideAxis,JSON.stringify(value));
    assert.ok(value.fontRange[1]-value.fontRange[0]<=4,JSON.stringify(value));
    const earlier=report.layouts.find(l=>l.viewport[0]===value.viewport[0]&&l.viewport[1]===value.viewport[1]);
    if(earlier)assert.deepEqual([value.top,value.left,value.width],[earlier.top,earlier.left,earlier.width],'The same dock position is used in online, fixed-choice and dialogue scenes');
    assert.doesNotMatch(await page.locator('[data-deployment]').innerText(),/距山下两万|争取：|目标已达成/);report.layouts.push({name,...value});
}
try{
    const f=await fixture();page=f.page;
    assert.deepEqual(await state(page),{below:5000,above:20000,proposed:0,remaining:5,stage:'idle'});
    await layout(page,'initial-1440');await shot(page,'initial-fixed-1440');
    await page.setViewportSize({width:1366,height:768});await layout(page,'initial-1366');await shot(page,'initial-fixed-1366');
    await page.setViewportSize({width:1100,height:650});await layout(page,'initial-1100');await shot(page,'initial-fixed-1100');
    await page.setViewportSize({width:390,height:844});await layout(page,'initial-390');await shot(page,'initial-fixed-390');
    await page.setViewportSize({width:1366,height:768});
    await advance(page,'JT-O132');assert.deepEqual(await state(page),{below:5000,above:20000,proposed:5000,remaining:4,stage:'proposed'});
    await until(page,async()=> (await state(page)).stage==='ordered');assert.equal((await state(page)).below,5000);await shot(page,'ordered-not-arrived');
    await page.setViewportSize({width:390,height:844});await layout(page,'ordered-390');await shot(page,'ordered-390');
    await page.setViewportSize({width:1366,height:768});
    await until(page,async()=> (await frame(page)).node==='JT-151');
    await advance(page);assert.equal((await state(page)).below,5000,'An inner reading page does not count arrival');
    await advance(page);assert.deepEqual(await state(page),{below:10000,above:15000,proposed:0,remaining:4,stage:'arrived'});
    assert.equal(await page.locator('[data-deployment]').evaluate(axis=>axis.classList.contains('is-troops-updated')),true);
    assert.equal(await page.locator('.deployment-below').evaluate(bar=>getComputedStyle(bar).animationName),'jieting-troops-shift');
    await shot(page,'first-arrival-10000');
    await page.reload({waitUntil:'domcontentloaded'});await page.locator('[data-deployment]').waitFor();
    // Fixture URLs deliberately restart. The normal save/reload path is checked below instead.
    assert.equal((await state(page)).below,5000);
    await advance(page,'JT-O132');await until(page,async()=> (await state(page)).below===10000);
    await until(page,async()=> (await frame(page)).node==='JT-R2-FIXED');
    assert.equal((await state(page)).remaining,4);await advance(page,'JT-O167');
    await until(page,async()=> (await frame(page)).node==='JT-R3-FIXED');assert.equal((await state(page)).below,15000);assert.equal((await state(page)).remaining,3);
    await advance(page,'JT-O198');await until(page,async()=> (await state(page)).below===20000);
    assert.deepEqual(await state(page),{below:20000,above:5000,proposed:0,remaining:0,stage:'goal'});
    await shot(page,'allocation-20000');await page.setViewportSize({width:390,height:844});await layout(page,'allocation-390');await shot(page,'allocation-390');
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('jieting-chapter-three-v1:playtest:reinforcement')));
    const restored=await fixture(false,saved);await restored.page.reload({waitUntil:'domcontentloaded'});await restored.page.locator('[data-deployment]').waitFor();
    assert.deepEqual(await state(restored.page),{below:20000,above:5000,proposed:0,remaining:0,stage:'goal'});await restored.context.close();
    report.checks.push('fixed choice preview, actual order, two-page arrival, three outcomes to 20000/5000, animation and main save restore');
    await f.context.close();
    const g=await fixture(true);page=g.page;assert.equal((await state(page)).remaining,5);
    await layout(page,'online-1440');await shot(page,'online-1440');
    await page.setViewportSize({width:1366,height:768});await layout(page,'online-1366');await shot(page,'online-1366');
    await page.setViewportSize({width:390,height:844});await layout(page,'online-390');await shot(page,'online-390');
    assert.equal(await page.locator('[data-action=clue-items],[data-select],.thought-detail-popover').count(),0);
    await page.locator('#player-expression').fill('军令已经说明，先守住要道。');
    assert.deepEqual(await state(page),{below:5000,above:20000,proposed:0,remaining:5,stage:'idle'});
    report.checks.push('online and 390px layout keeps expression usable without retired clue UI; drafting does not change deployment');
    await g.context.close();assert.deepEqual(report.errors,[]);
    writeFileSync(resolve(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}catch(error){report.errors.push(error.message);await page?.screenshot({path:resolve(output,'failure.png')}).catch(()=>{});writeFileSync(resolve(output,'report.json'),JSON.stringify(report,null,2));throw error;}
finally{await browser.close();await new Promise(ok=>server.close(ok));}
