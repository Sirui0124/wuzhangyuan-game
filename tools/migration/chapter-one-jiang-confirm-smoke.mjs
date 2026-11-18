import {chromium} from 'playwright';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {createStaticServer} from '../../GameStarter/web-demo/serve.mjs';
import {ChapterOneSession} from '../../GameStarter/web-demo/.build/GameStarter/web-demo/src/chapters/chapter-one/session.js';
const root=resolve('GameStarter/web-demo/.build');
const read=n=>JSON.parse(readFileSync(resolve(root,'story',n),'utf8'));
const story=read('chapter-one.branch.json'),script=read('chapter-one.script.json'),flow=read('chapter-one.flow.json'),version=read('session-manifest.json').contentVersion;
const make=()=>new ChapterOneSession(script,flow,version,undefined,undefined,'offline',story);
function settle(g){for(let i=0;i<200;i++){const b=g.branch,d=b.dialogue;if(b.noticePending)g.branchAct('notice');else if(!b.atLastLine||d.pending||d.node.kind==='passage')g.branchAct('next');else return;}throw Error('剧情未停止');}
function hub(known){const g=make();g.finishCinematic();settle(g);g.branchAct(known?'ask':'choose',known?'还有谁能帮忙处理军情？':'enemy');settle(g);return g;}
const server=createStaticServer({root});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`,out=resolve('outputs/jiang-confirm-20261118');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});const errors=[],checks=[];
async function advance(p){for(let i=0;i<150;i++){if(await p.locator('[data-cinema-action=skip]').count()){await p.locator('[data-cinema-action=skip]').click();await p.locator('[data-node=\"C01-JIANG-CONFIRM\"]').waitFor();assert.equal(await p.locator('#spoken-line').textContent(),'前营有报来了？');continue;}if(!await p.locator('.dialogue-advance').count())return;await p.locator('.dialogue-advance').click();await p.waitForTimeout(75);}throw Error('UI未停止');}
async function choose(p,id){await p.locator(`[data-choice="${id}"]`).click();await advance(p);}
try{
 for(const [known,width,height] of [[false,1440,900],[true,1440,900],[true,844,390]]){
  const ctx=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
  await ctx.addInitScript(raw=>{
   if(!localStorage.getItem('wuzhang-chapter-session-v1'))localStorage.setItem('wuzhang-chapter-session-v1',raw);
   localStorage.setItem('wuzhang-runtime-mode-v1','offline');localStorage.setItem('wuzhang-ai-setup-v1','acknowledged');
   localStorage.setItem('wuzhang-voice-muted','1');localStorage.setItem('wuzhang-ai-voice-enabled','0');
  },hub(known).serialize());
  const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(origin);await p.locator('[data-action="continue"]').click();
  await p.locator('[data-node="C01-GUARD-NEXT"]').waitFor();
  assert.equal(await p.locator('[data-choice="confirm_jiang"]').count(),known?1:0);
  if(known){
   const button=p.locator('[data-choice="confirm_jiang"]');await button.scrollIntoViewIfNeeded();
   const box=await button.boundingBox();assert.ok(box.y>=0&&box.y+box.height<=height+1);
   await p.screenshot({path:resolve(out,`entry-${width}.png`)});
   await button.click();await advance(p);await p.locator('[data-node="C01-CONFIRMED-RETURN"]').waitFor();
   await p.reload();await p.locator('[data-action="continue"]').click();await p.locator('[data-node="C01-CONFIRMED-RETURN"]').waitFor();
   for(const id of ['meet','concern','front'])await choose(p,id);
   await p.getByRole('button',{name:'带将军去见伯约',exact:true}).click();await advance(p);
   assert.equal(await p.locator('.branch-scene').getAttribute('data-node'),'C01-REPORT');
   await choose(p,'stay');assert.equal(await p.locator('.branch-scene').getAttribute('data-ending'),'E-COOP');
  }
  checks.push({known,width,height,passed:true});await ctx.close();
 }
 if(process.argv.includes('--live')){
  const text='魏军还没攻营。伯约已经答应接报，我带将军过去。';
  for(const agreed of [false,true]){
   const g=hub(true);if(agreed){g.branchAct('choose','confirm_jiang');settle(g);}
   for(const id of ['meet','concern','front']){g.branchAct('choose',id);settle(g);}
   const d=g.branch.dialogue;
   const response=await fetch(origin+'/api/chapter-one/turn',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:story.version,nodeId:d.nodeId,audit:d.audit,requestId:`jiang-confirm-${agreed}-${Date.now()}`,text}),signal:AbortSignal.timeout(60000)});
   const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));
   assert.equal(result.outcome,agreed?'INVITE_JIANG':'ASK');
   checks.push({live:true,agreed,text,outcome:result.outcome,reply:result.reply,replySource:result.replySource});
  }
 }
 assert.deepEqual(errors,[]);writeFileSync(resolve(out,'checks.json'),JSON.stringify({passed:true,checks,errors},null,2));console.log(JSON.stringify({passed:true,checks,errors},null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));}
