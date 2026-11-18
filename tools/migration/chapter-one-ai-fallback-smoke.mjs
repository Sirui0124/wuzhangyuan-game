// Failure recovery uses isolated browser storage and the real branch service with controlled model outputs.
import {chromium} from 'playwright';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {createStaticServer} from '../../GameStarter/web-demo/serve.mjs';
import {createAiService,createSigner} from '../../GameStarter/server/chapter-one-ai.mjs';
import {Dialogue} from '../../GameStarter/web-demo/.build/GameStarter/web-demo/src/chapters/chapter-one/branch-engine.js';
import {ChapterOneSession} from '../../GameStarter/web-demo/.build/GameStarter/web-demo/src/chapters/chapter-one/session.js';
const read=f=>JSON.parse(readFileSync('content/chapters/wuzhang/'+f,'utf8')),story=read('chapter-one.branch.json');
const out='outputs/ch01-review-20261118';mkdirSync(out,{recursive:true});
function settle(g){for(let i=0;i<120;i++){const b=g.branch,d=b.dialogue;if(b.noticePending)g.branchAct('notice');else if(!b.atLastLine||d.pending||d.node.kind==='passage'||d.node.autoChoice)g.branchAct('next');else return;}}
function seed(known){const g=new ChapterOneSession(read('chapter-one.script.json'),read('chapter-one.flow.json'),'fallback-review',undefined,undefined,'ai',story);g.finishCinematic();settle(g);g.branchAct(known?'ask':'choose',known?'还有谁能处理军情？':'enemy');settle(g);for(const id of ['meet','concern_joint']){g.branchAct('choose',id);settle(g);}return g.serialize();}
const service=createAiService({Dialogue,storyLoader:async()=>story,signer:createSigner('fallback-browser'),model:async input=>{
 if(input.system.includes('语义分类器'))return {text:JSON.stringify({enemy:'missing',enemyQuote:'',plan:'none',planQuote:'',unsupportedClaim:false,claimQuote:'',offense:'none',offenseQuote:''})};
 throw Error('测试措辞后备');
}});
const server=createStaticServer({root:resolve('GameStarter/web-demo/.build')});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({channel:'chrome',headless:true}),checks=[];
async function advance(p){for(let i=0;i<120;i++){if(await p.locator('[data-cinema-action=skip]').count())await p.locator('[data-cinema-action=skip]').click();else if(await p.locator('.dialogue-advance').count())await p.locator('.dialogue-advance').click();else return;await p.waitForTimeout(70);}}
async function saved(p){return p.evaluate(()=>{const s=JSON.parse(localStorage.getItem('wuzhang-chapter-session-v1'));return {draft:s.branch.draft,...JSON.parse(s.branch.graph).current};});}
try{
 for(const known of [false,true]){
  const ctx=await browser.newContext({viewport:{width:844,height:390}});
  await ctx.addInitScript(raw=>{localStorage.setItem('wuzhang-chapter-session-v1',raw);localStorage.setItem('wuzhang-runtime-mode-v1','ai');localStorage.setItem('wuzhang-ai-setup-v1','acknowledged');},seed(known));
  await ctx.route('http://127.0.0.1:8787/**',r=>r.fulfill({headers:{'Access-Control-Allow-Origin':'*'},json:{configured:true}}));
  let fail=false,calls=0;
  await ctx.route('**/api/chapter-one/turn',async route=>{calls++;if(fail)return route.fulfill({status:502,json:{error:'测试连接失败，原话已保留。'}});return route.fulfill({json:await service(route.request().postDataJSON())});});
  const p=await ctx.newPage();await p.goto(origin);await p.locator('[data-action=continue]').click();
  await p.locator('#branch-input').fill('我还没想好。');await p.locator('[data-branch-form] button[type=submit]').click();await p.locator('.dialogue-advance').waitFor();await advance(p);
  assert.equal((await saved(p)).exchange.length,1);
  fail=true;const draft='这份草稿尚未确认，请保留。';await p.locator('#branch-input').fill(draft);const before=await saved(p);
  await p.locator('[data-branch-form] button[type=submit]').click();await p.locator('[data-branch=use-fixed]').waitFor();
  assert.match(await p.locator('[data-branch-form] button[type=submit]').textContent(),/重试/);
  assert.deepEqual((await saved(p)).audit,before.audit);assert.equal((await saved(p)).exchange.length,1);
  await p.locator('[data-branch=use-fixed]').click();assert.equal(await p.locator('[data-branch=offline]').count(),known?3:2);assert.equal(await p.locator('[data-outcome=INVITE_JIANG]').count(),known?1:0);
  await p.locator('[data-branch=use-free]').click();assert.equal(await p.locator('#branch-input').inputValue(),draft);
  assert.equal((await saved(p)).exchange.length,1);assert.deepEqual((await saved(p)).audit,before.audit);
  await p.locator('[data-branch=use-fixed]').click();await p.screenshot({path:`${out}/failure-fixed-${known}.png`});
  const callsBefore=calls;await p.locator(`[data-outcome=${known?'INVITE_JIANG':'SELF_RELAY'}]`).click();await advance(p);
  assert.equal(calls,callsBefore);const ending=await p.locator('.branch-scene').getAttribute('data-ending');assert.equal(ending,known?'E-FORMAL':'E-DEATH');
  checks.push({known,ending,draftPreserved:true,roundsPreserved:1,noAiRequestOnFixed:true});await ctx.close();
 }
 writeFileSync(`${out}/failure-fallback-browser.json`,JSON.stringify({passed:true,checks},null,2));console.log(checks);
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
