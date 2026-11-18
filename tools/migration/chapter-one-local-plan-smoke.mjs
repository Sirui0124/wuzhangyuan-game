import {chromium} from 'playwright';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {createStaticServer} from '../../GameStarter/web-demo/serve.mjs';
import {ChapterOneSession} from '../../GameStarter/web-demo/.build/GameStarter/web-demo/src/chapters/chapter-one/session.js';
const read=f=>JSON.parse(readFileSync('content/chapters/wuzhang/'+f,'utf8'));
const out='outputs/ch01-review-20261118/local-plan';mkdirSync(out,{recursive:true});
function settle(g){for(let i=0;i<120;i++){const b=g.branch,d=b.dialogue;if(b.noticePending)g.branchAct('notice');else if(!b.atLastLine||d.pending||d.node.kind==='passage'||d.node.autoChoice)g.branchAct('next');else return;}}
function seed(known){const g=new ChapterOneSession(read('chapter-one.script.json'),read('chapter-one.flow.json'),'local-review',undefined,undefined,'ai',read('chapter-one.branch.json'));g.finishCinematic();settle(g);g.branchAct(known?'ask':'choose',known?'还有谁能处理军情？':'enemy');settle(g);for(const id of ['meet','concern_joint']){g.branchAct('choose',id);settle(g);}return g.serialize();}
const server=createStaticServer({root:resolve('GameStarter/web-demo/.build')});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({channel:'chrome',headless:true}),checks=[],errors=[];
async function advance(p){for(let i=0;i<120;i++){if(await p.locator('[data-cinema-action=skip]').count())await p.locator('[data-cinema-action=skip]').click();else if(await p.locator('.dialogue-advance').count())await p.locator('.dialogue-advance').click();else return;await p.waitForTimeout(70);}}
async function saved(p){return p.evaluate(()=>{const s=JSON.parse(localStorage.getItem('wuzhang-chapter-session-v1'));return {draft:s.branch.draft,...JSON.parse(s.branch.graph).current};});}
try{
 for(const [name,known,offline,text,expected] of [
  ['network',true,false,'我去请伯约来听报。','E-FORMAL'],
  ['negated',true,false,'不能让将军进去。',null],
  ['offline',true,true,'我自己转呈军报，有回令便送回前营。','E-DEATH'],
  ['no-clue',false,true,'我去请伯约来听报。',null],
 ]){
  const ctx=await browser.newContext({viewport:{width:844,height:390}});
  await ctx.addInitScript(({raw,offline})=>{if(!localStorage.getItem('wuzhang-chapter-session-v1'))localStorage.setItem('wuzhang-chapter-session-v1',raw);localStorage.setItem('wuzhang-runtime-mode-v1',offline?'offline':'ai');localStorage.setItem('wuzhang-ai-setup-v1','acknowledged');},{raw:seed(known),offline});
  await ctx.route('http://127.0.0.1:8787/**',r=>r.fulfill({headers:{'Access-Control-Allow-Origin':'*'},json:{configured:true}}));
  let requests=0;await ctx.route('**/api/chapter-one/turn',r=>{requests++;return r.abort('failed');});
  const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(origin);await p.locator('[data-action=continue]').click();
  if(offline)await p.locator('[data-branch=local-input]').click();
  await p.locator('#branch-input').fill(text);const before=await saved(p);
  await p.locator('[data-branch-form] button[type=submit]').click();
  if(!offline){await p.locator('[data-branch=local-check]').waitFor();assert.match(await p.locator('#branch-status').textContent(),/暂时连不上AI服务/);await p.locator('[data-branch=local-check]').click();}
  assert.deepEqual((await saved(p)).audit,before.audit);assert.equal((await saved(p)).exchange.length,0);
  if(expected){
   await p.locator('[data-branch=local-confirm]').waitFor();
   await p.locator('[data-branch=local-confirm]').scrollIntoViewIfNeeded();await p.screenshot({path:`${out}/${name}-preview.png`,fullPage:true});
   // Any edit invalidates the confirmation immediately; recheck the exact original before committing.
   await p.locator('#branch-input').fill('还没想好。');assert.equal(await p.locator('[data-branch=local-confirm]').count(),0);
   await p.locator('#branch-input').fill(text);await p.locator('[data-branch-form] button[type=submit]').click();
   await p.locator('[data-branch=local-confirm]').click();
   const after=await saved(p);assert.equal(after.audit.at(-1).type,'offline');assert.equal(after.audit.at(-1).text,text);
   await p.reload();await p.locator('[data-action=continue]').click();await advance(p);
   const ending=await p.locator('.branch-scene').getAttribute('data-ending');
   if(ending!==expected){await p.screenshot({path:`${out}/unexpected.png`,fullPage:true});console.log(JSON.stringify({node:await p.locator('.branch-scene').getAttribute('data-node'),ending}));}
   assert.equal(ending,expected);
  }else{
   assert.equal(await p.locator('[data-branch=local-confirm]').count(),0);assert.equal((await saved(p)).draft,text);
   await p.locator('[data-branch=use-fixed]').click();assert.equal(await p.locator('[data-outcome=INVITE_JIANG]').count(),known?1:0);
  }
  assert.equal(requests,offline?0:1);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await p.screenshot({path:`${out}/${name}.png`,fullPage:true});checks.push({name,requests,expected,passed:true});await ctx.close();
 }
 assert.deepEqual(errors,[]);writeFileSync(`${out}/browser-results.json`,JSON.stringify({passed:true,checks,errors},null,2));console.log(checks);
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
