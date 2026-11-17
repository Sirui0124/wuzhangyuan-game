import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createStaticServer} from '../../GameStarter/web-demo/serve.mjs';
const build=resolve(process.env.GAME_BUILD||'GameStarter/web-demo/.build');
const story=JSON.parse(readFileSync(resolve(build,'story/chapter-seven.story.json')));
const out=resolve('outputs/chapter-seven-20261028');mkdirSync(out,{recursive:true});
const server=createStaticServer({root:build});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`,key='luofengpo-chapter-seven-v1',errors=[],checks=[],metrics=[];
const {JingzhouSession}=await import(pathToFileURL(resolve(build,'GameStarter/web-demo/src/chapters/chapter-five/session.js')));
const fifthStory=JSON.parse(readFileSync(resolve(build,'story/chapter-five.reports.json'))),fifth=new JingzhouSession(fifthStory,123);fifth.apply({type:'begin'});for(const id of fifth.order)fifth.apply({type:'judge',id,verdict:fifth.report(id).truth?'true':'false'});for(const id of fifth.candidates)fifth.apply({type:'select',id});fifth.apply({type:'finish'});
// A settled current save still reads the aftermath before showing the finale link.
while(fifth.aftermathPage<5)assert.equal(fifth.apply(fifth.aftermathPage===1?{type:'reply',reply:'stay'}:{type:'narrate',stage:'aftermath'}),true);
const browser=await chromium.launch({channel:'chrome',headless:true});
const correct={'PT-Q1':'when','PT-Q2':'trace','PT-Q3':'letter','PT-Q4':'living','PT-Q5':'alive','PT-Q6':'truth','PT-S0':'loss','PT-LOSS-CHOICE':'release','PT-RETREAT-CONFIRM':'confirm'};
async function context(unlocked=true){const c=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
 await c.route('http://127.0.0.1:8787/**',r=>r.fulfill({headers:{'Access-Control-Allow-Origin':'*'},json:{configured:false}}));
 if(unlocked)await c.addInitScript(saved=>{if(!sessionStorage.getItem('pt-smoke')){localStorage.setItem('jingzhou-chapter-five-v1',saved);sessionStorage.setItem('pt-smoke','1');}},JSON.stringify(fifth.snapshot()));
 const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));return{c,p};}
const node=p=>p.locator('main[data-node]').getAttribute('data-node');
async function playTo(p,target,choices={}){let i=0;while(await node(p)!==target){const id=await node(p),n=story.nodes.find(n=>n.id===id);assert.ok(n&&++i<200,id);if(n.kind==='choice')await p.locator(`[data-option="${choices[id]??correct[id]??n.options[0].id}"]`).click();else{assert.equal(n.kind,'line',id);await p.locator('[data-action=next]').click();}}}
try{
 const locked=await context(false);await locked.p.goto(origin+'/?chapter=luofengpo');await locked.p.locator('.chapter-map').waitFor();assert.equal(await locked.p.locator('[data-map-node=luofengpo] a:not([href*=playtest])').count(),0);await locked.p.locator('[data-map-node=luofengpo] a[href*=playtest]').click();await locked.p.locator('main[data-node]').waitFor();assert.equal(await node(locked.p),story.start);assert.equal(await locked.p.evaluate(key=>localStorage.getItem(key),key),null);assert.equal(await locked.p.evaluate(()=>JSON.parse(localStorage.getItem('wuzhang-chapter-history-v1')).completed.includes('luofengpo')),false);await locked.c.close();checks.push('formal chapter gate retained; map trial enters directly without changing formal save or completion');
 const {c,p}=await context();await p.goto(origin+'/?chapter=jingzhou');await p.locator('a[href="/?chapter=luofengpo"]').waitFor();await p.locator('a[href="/?chapter=luofengpo"]').click();await p.locator('main[data-node]').waitFor();checks.push('real completed fifth chapter continues to finale and supplies actual outcome');
 await playTo(p,'PT-OPEN-3');await p.screenshot({path:resolve(out,'chenjian-desktop.png')});
 const before=await node(p);await p.locator('[data-action=history]').click();assert.match(await p.locator('.game-modal').innerText(),/尚无本章结果/);await p.keyboard.press('Escape');assert.equal(await node(p),before);
 await p.locator('[data-action=save]').click();await p.locator('[data-action=save-slot][data-slot="1"]').click();await p.locator('[data-action=close-modal]').click();await p.locator('[data-action=next]').click();await p.locator('[data-action=save]').click();await p.locator('[data-action=load-slot][data-slot="1"]').click();assert.equal(await node(p),before);checks.push('history and save controls do not advance; manual save/load restores exact node');
 await playTo(p,'PT-END-INV2',{'PT-Q2':'accuse'});await p.locator('[data-action=retry]').click();assert.equal(await node(p),'PT-Q2');await playTo(p,'PT-Q6');await p.screenshot({path:resolve(out,'pangtong-choice-desktop.png')});
 for(const [width,height]of [[1440,900],[844,390],[667,375],[390,844]]){
  await p.setViewportSize({width,height});await p.waitForFunction(()=>{const a=[...document.querySelectorAll("[data-option]")];return a.every(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;});});const m=await p.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,buttons:[...document.querySelectorAll('[data-option]')].map(e=>{const b=e.getBoundingClientRect();return{height:b.height,top:b.top,bottom:b.bottom,width:b.width};}),font:parseFloat(getComputedStyle(document.querySelector('[data-option]')).fontSize)}));assert.equal(m.overflow,false);assert.ok(m.buttons.every(b=>b.height>=44));await p.locator('[data-option=rival]').scrollIntoViewIfNeeded();metrics.push({width,height,...m});await p.screenshot({path:resolve(out,`choice-${width}x${height}.png`)});
 }
 await p.setViewportSize({width:1440,height:900});await p.reload();await p.locator('main[data-node]').waitFor();assert.equal(await node(p),'PT-Q6');await playTo(p,'PT-S0');
 for(const [end,choices]of [['RETREAT',{}],['FEIGN',{'PT-S0':'feign'}],['DEATH',{'PT-LOSS-CHOICE':'blame'}],['FUTURE',{'PT-S0':'hope','PT-HOPE-CHOICE':'modest'}]]){
  await playTo(p,`PT-END-${end}`,choices);await p.screenshot({path:resolve(out,`ending-${end.toLowerCase()}.png`)});
  const saved=await p.evaluate(key=>localStorage.getItem(key),key);await p.reload();await p.locator('main[data-node]').waitFor();assert.equal(await p.evaluate(key=>localStorage.getItem(key),key),saved);
  if(end==='FUTURE'){
   const ledger=await p.evaluate(()=>JSON.parse(localStorage.getItem('wuzhang-achievements-v1')).unlocked);
   assert.equal(Object.keys(ledger).filter(k=>k.startsWith('luofengpo-')).length,4);assert.ok(Object.values(ledger).every(e=>e.times===1));
   await p.locator('[data-action=album]').click();await p.locator('.ending-album').waitFor();assert.equal(await p.locator('.album-card.unlocked').count(),4);await p.screenshot({path:resolve(out,'finale-album.png')});
   await p.locator('[data-album-action=card]').first().click();await p.locator('[data-album-action=close]').click();await p.locator('[data-map-node=luofengpo] a[href="/?chapter=luofengpo"]').click();await p.locator('main[data-node]').waitFor();assert.equal(await node(p),'PT-END-FUTURE');
   checks.push('four terminal cards persist in full-game album; reload does not double count; map continues saved finale');
  }
  await p.locator('[data-action=retry]').click();assert.equal(await node(p),'PT-S0');
 }
 checks.push('all four endings played through browser; each ending reloads, retries at final conversation; investigation failure retries locally');
 await p.locator('[data-action=pause]').click();await p.locator('[data-action=restart]').click();await p.locator('[data-action=restart-confirm]').click();await p.waitForFunction(start=>document.querySelector('main[data-node]')?.getAttribute('data-node')===start,story.start);assert.equal(await node(p),story.start);assert.ok(await p.evaluate(key=>localStorage.getItem(key+':before-new'),key));
 await p.evaluate(key=>localStorage.setItem(key,'{damaged'),key);await p.reload();await p.locator('main[data-node]').waitFor();await p.locator('[data-action=next]').click();assert.equal(await node(p),story.start);assert.equal(await p.evaluate(key=>localStorage.getItem(key),key),'{damaged');checks.push('restart backs up progress; damaged save is preserved and cannot silently advance');
 await c.close();
 const adopted=await context();await adopted.c.route('http://127.0.0.1:8828/result-test',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:`<button id="go">采用</button><script>document.querySelector('button').onclick=()=>{const nonce=crypto.randomUUID(),child=window.open('${origin}/chapter-result-import.html#nonce='+nonce);window.addEventListener('message',e=>{if(e.origin==='${origin}'&&e.data.type==='wzy-rescue-ready')child.postMessage({type:'wzy-rescue-result',nonce,result:{id:'12345678-1234-1234-1234-123456789abc',phase:'ended',revision:7,routes:['front','fu','huang','sha','ma','cheng','du','wang','sun'].map(id=>({id,status:id==='fu'?'saved':'failed',outcome:id==='fu'?'傅肜脱险。':'此路未能带回。'}))}},'${origin}');});}</script>`}));
 await adopted.p.goto('http://127.0.0.1:8828/result-test');const popup=adopted.p.waitForEvent('popup');await adopted.p.locator('#go').click();const result=await popup;await result.locator('#links:not([hidden])').waitFor();assert.match(await result.locator('#status').innerText(),/1条路线脱险/);await result.goto(origin+'/?chapter=luofengpo');await result.locator('main[data-node]').waitFor();await result.locator('[data-action=history]').click();assert.match(await result.locator('.game-modal').innerText(),/傅肜脱险/);await adopted.c.close();checks.push('cross-origin explicit adoption handshake, persisted outcome and actual finale history reading');
 assert.deepEqual(errors,[]);writeFileSync(resolve(out,'browser-verification.json'),JSON.stringify({passed:true,checks,metrics,errors},null,2));console.log(JSON.stringify({passed:true,checks,metrics,errors}));
}catch(error){for(const c of browser.contexts())for(const page of c.pages()){console.error(JSON.stringify({url:page.url(),body:(await page.locator('body').innerText()).slice(0,1800),errors}));}throw error;}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
