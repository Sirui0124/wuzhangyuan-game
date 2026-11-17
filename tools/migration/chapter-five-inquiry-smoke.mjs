import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createStaticServer} from '../../GameStarter/web-demo/serve.mjs';
const server=createStaticServer({root:resolve('GameStarter/web-demo/.build')});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`,key='jingzhou-chapter-five-v1:playtest:reports';
const browser=await chromium.launch({channel:'chrome',headless:true});const c=await browser.newContext({viewport:{width:1440,height:900}});
const p=await c.newPage(),errors=[],checks=[];p.on('pageerror',e=>errors.push(e.message));
await c.route('http://127.0.0.1:8787/**',r=>r.fulfill({headers:{'Access-Control-Allow-Origin':'*'},json:{configured:true}}));
let result={kind:'answer',dimension:'time'},failure=false,release,settled,resolveSettled,calls=0,lastPrompt='';
await p.route('**/api/game/respond',async r=>{
 calls++;lastPrompt=r.request().postDataJSON().text;
 const payload=result,bad=failure;
 if(release===true){settled=new Promise(r=>{resolveSettled=r;});await new Promise(r=>{release=r;});}
 try{await r.fulfill({status:bad?503:200,headers:{'Access-Control-Allow-Origin':'*'},json:bad?{error:'模拟服务暂时不可用'}:{text:JSON.stringify(payload)}});}catch{/* cancellation intentionally closes this request */}finally{resolveSettled?.();}
});
const count=()=>p.evaluate(key=>JSON.parse(localStorage.getItem(key)).actions.filter(a=>a.type==='ask').length,key);
async function send(question){await p.locator('#jz-inquiry').fill(question);await p.locator('[data-jz=custom-ask]').click();await p.locator('[data-jz=cancel-inquiry]').waitFor({state:'hidden'});}
try{
 await p.goto(origin+'/?chapter=jingzhou&playtest=reports');await p.locator('#spoken-line').waitFor();for(let i=0;i<4;i++)await p.locator('[data-jz=story-next]').click();await p.locator('[data-jz=begin]').click();
 const id=await p.locator('#game-root').getAttribute('data-active-report');
 await p.locator('#jz-inquiry').fill('你几时去的？');await p.reload();await p.locator('#jz-inquiry').waitFor();assert.equal(await p.locator('#jz-inquiry').inputValue(),'你几时去的？');
 result={kind:'multiple'};await send('什么时候去的，消息是谁传的，东西也拿来看看。');assert.equal(await count(),0);assert.match(await p.locator('.jz-status').innerText(),/先挑一件/);
 failure=true;await send('你几时去的？');assert.equal(await count(),0);assert.equal(await p.locator('#jz-inquiry').inputValue(),'你几时去的？');failure=false;
 result={kind:'answer',dimension:'time',reply:'这是假的，我承认了'};await send('你几时去的？');assert.equal(await count(),1);assert.match(await p.locator('.jz-question').innerText(),/你几时去的/);assert.equal((await p.locator('.jz-transcript').innerText()).includes('我承认了'),false);assert.equal(await p.locator('#jz-inquiry').inputValue(),'');
 result={kind:'unknown'};await send('告诉我谁是可靠的人。');assert.equal(await count(),1);assert.ok(lastPrompt.includes('你几时去的？'));
 checks.push('draft survives refresh; multiple questions, service failure and unavailable facts cost nothing; actual question persists and invented model dialogue is ignored');
 release=true;result={kind:'answer',dimension:'source'};
 await p.locator('#jz-inquiry').fill('那句话是谁告诉你的？');const cancelRequest=p.waitForRequest('**/api/game/respond');await p.locator('[data-jz=custom-ask]').click();await cancelRequest;
 assert.equal(await p.locator('[data-jz=judge]').first().isDisabled(),true);
 await p.locator('[data-jz=cancel-inquiry]').click();if(typeof release==='function')release();await settled;release=undefined;
 assert.equal(await count(),1);assert.equal(await p.locator('#jz-inquiry').inputValue(),'那句话是谁告诉你的？');checks.push('cancel preserves question and budget; verdict controls stay disabled during a request');
 release=true;
 const nextRequest=p.waitForRequest('**/api/game/respond');await p.locator('[data-jz=custom-ask]').click();await nextRequest;
 const other=await c.newPage();await other.goto(origin+'/story/chapter-five.reports.json');
 await other.evaluate(({key,id})=>{const s=JSON.parse(localStorage.getItem(key));s.actions.push({type:'judge',id,verdict:'pending'});localStorage.setItem(key,JSON.stringify(s));},{key,id});
 await p.waitForFunction(id=>document.querySelector('#game-root').dataset.activeReport!==id,id);
 if(typeof release==='function')release();await settled;release=undefined;assert.equal(await count(),1);
 await p.locator(`[data-jz=view][data-id=${id}]`).first().click();assert.equal(await p.locator('#jz-inquiry').inputValue(),'那句话是谁告诉你的？');await other.close();
 result={kind:'answer',dimension:'source'};await send('那句话是谁告诉你的？');assert.equal(await count(),2);
 await p.locator('[data-jz=suggest][data-dimension=source]').click();assert.equal(await count(),2);assert.ok((await p.locator('#jz-inquiry').inputValue()).length>0);result={kind:'answer',dimension:'source'};await p.locator('[data-jz=custom-ask]').click();await p.locator('[data-jz=cancel-inquiry]').waitFor({state:'hidden'});assert.equal(await count(),3);assert.equal(await p.locator('[data-jz=custom-ask]').isDisabled(),true);
 await p.reload();await p.locator('.jz-workspace').waitFor();await p.locator(`[data-jz=view][data-id=${id}]`).first().click();assert.equal(await p.locator('[data-jz=custom-ask]').isDisabled(),true);assert.equal(await p.locator('.jz-question').count(),3);
 checks.push('other-tab verdict cancels late response; pending soldier retains draft; suggestions only fill drafts; the same topic can consume all three questions and survives reload');
 const out=resolve('outputs/chapter-five-custom-inquiry-20261028');mkdirSync(out,{recursive:true});
 const metrics=[];
 for(const [width,height]of [[1440,900],[844,390],[667,375],[390,844]]){
  await p.setViewportSize({width,height});const m=await p.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,composer:document.querySelector('.jz-composer').getBoundingClientRect().height,transcript:document.querySelector('.jz-transcript').getBoundingClientRect().height}));assert.equal(m.overflow,false);assert.ok(m.transcript>90);metrics.push({width,height,...m});await p.screenshot({path:resolve(out,`custom-${width}x${height}.png`)});
 }
 await p.locator(`[data-jz=view][data-id=${id}]`).first().click();
 await p.evaluate(()=>localStorage.setItem('wuzhang-runtime-mode-v1','offline'));await p.reload();await p.locator('.jz-workspace').waitFor();assert.equal(await p.locator('[data-jz=custom-ask]').isDisabled(),false);await p.locator('[data-jz=suggest]').first().click();const beforeOffline=await count();await p.locator('[data-jz=custom-ask]').click();assert.equal(await count(),beforeOffline+1);
 assert.deepEqual(errors,[]);writeFileSync(resolve(out,'browser-verification.json'),JSON.stringify({passed:true,checks,metrics,calls,errors},null,2));console.log(JSON.stringify({passed:true,checks,metrics,calls,errors}));
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
