import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from './server.mjs';
import { createAiService, createSigner } from './ai.mjs';
import { story, assessment } from './test-helpers.mjs';

let current=assessment(), fail=false, pause=false, release, calls=0;
const service=createAiService({storyLoader:async()=>story,signer:createSigner('browser-fixture'),model:async(input,signal)=>{
  calls++;
  if(pause){await new Promise(r=>release=r);signal?.throwIfAborted();}
  if(fail)throw Error('测试连接中断');
  if(input.system.includes('语义分类器'))return {text:JSON.stringify(current)};
  if(input.system.includes('校验魏延'))return {text:'{"valid":true}'};
  const c=JSON.parse(input.text);
  return {text:JSON.stringify({utterance:story.aiScenes.weiyan_final.routes[c.outcome].fallback})};
}});
const server=createServer({aiService:service,statusProvider:async()=>({configured:true,model:'controlled-test'})});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome',headless:true});
const origin=`http://127.0.0.1:${server.address().port}`;
const out=new URL('../../outputs/chapter-review/',import.meta.url);await mkdir(out,{recursive:true});
const results=[], errors=[];
async function click(p,s){await p.locator(s).click();await p.waitForTimeout(130);}
async function settle(p){for(let i=0;i<50;i++){const phase=await p.locator('#scene').getAttribute('data-phase');if(!['passage','reply'].includes(phase))return;await click(p,'[data-choice="next"]');}throw Error('跳转未停止');}
async function setup(known=true,branch='critical'){
  const ctx=await browser.newContext();const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
  await p.goto(origin);await p.waitForFunction(()=>document.querySelector('#scene').dataset.node);await settle(p);
  if(known){await p.locator('#input').fill('丞相不能见，还有谁能帮忙处理军情？');await click(p,'#submit');await settle(p);}else{await click(p,'[data-choice="enemy"]');await settle(p);}
  for(const id of ['meet','concern',branch]){await click(p,`[data-choice="${id}"]`);await settle(p);}
  assert.equal(await p.locator('#scene').getAttribute('data-phase'),'ai');
  assert.equal(await p.locator('#context-hint').isVisible(),known);assert.equal(await p.locator('#hints').count(),0);
  return {ctx,p};
}
async function submit(p,text){await p.locator('#input').fill(text);await p.locator('#submit').click();await p.waitForFunction(()=>document.querySelector('#question').getAttribute('aria-busy')==='false');}
try{
  for(const [name,known,branch,plan,target] of [
    ['invite',true,'critical','invite_jiang','E-COOP'],['relay',true,'front','relay_jiang','E-FORMAL'],
    ['self-critical',false,'critical','self_relay','E-DEATH'],['self-front',false,'front','self_relay','E-DEATH']]){
    const {ctx,p}=await setup(known,branch);
    if(name==='invite'){
      await p.screenshot({path:fileURLToPath(new URL('ai-input-desktop.png',out)),fullPage:true});
      await p.setViewportSize({width:390,height:844});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      await p.screenshot({path:fileURLToPath(new URL('ai-input-mobile.png',out)),fullPage:true});
      current=assessment();await submit(p,'容我想想');assert.equal(await p.locator('#scene').getAttribute('data-phase'),'ai');
    }
    const planText=plan==='invite_jiang'?'请伯约出来听报':plan==='relay_jiang'?'我拿军报请伯约看':'我自己转呈军报';
    current=assessment({enemy:'understood',enemyQuote:'魏军还没攻营',plan,planQuote:planText});
    await submit(p,`魏军还没攻营，${planText}。`);
    assert.equal(await p.locator('#scene').getAttribute('data-phase'),'reply');
    await p.reload();await p.waitForFunction(()=>document.querySelector('#scene').dataset.phase==='reply');await settle(p);
    if(target==='E-COOP'){await click(p,'[data-choice="stay"]');await settle(p);}
    if(target==='E-DEATH'){for(const id of ['wait','admit']){await click(p,`[data-choice="${id}"]`);await settle(p);}}
    assert.equal(await p.locator('#scene').getAttribute('data-ending'),target);
    if(target==='E-DEATH'){await click(p,'[data-choice="rewind"]');await settle(p);assert.equal(await p.locator('#scene').getAttribute('data-node'),'C01-GUARD-2');}
    results.push({name,ending:target,passed:true});await ctx.close();
  }
  const {ctx,p}=await setup();fail=true;
  await submit(p,'魏军还没攻营，请伯约出来听报。');assert.match(await p.locator('#notice').innerText(),/连接中断/);
  assert.equal(await p.locator('#input').inputValue(),'魏军还没攻营，请伯约出来听报。');
  await p.reload();await p.waitForFunction(()=>document.querySelector('#input').value.length>0);fail=false;
  for(const action of ['cancel','edit','back']){
    pause=true;const before=calls;await p.locator('#submit').click();await p.waitForFunction(()=>document.querySelector('#question').getAttribute('aria-busy')==='true');
    for(let i=0;calls===before&&i<100;i++)await p.waitForTimeout(20);assert.ok(calls>before);
    if(action==='edit')await p.locator('#input').fill('改过的原话');else await click(p,action==='cancel'?'#cancel':'#back');
    const at=await p.locator('#scene').getAttribute('data-node'), phase=await p.locator('#scene').getAttribute('data-phase');pause=false;release();await p.waitForTimeout(250);
    assert.equal(await p.locator('#scene').getAttribute('data-node'),at);
    assert.equal(await p.locator('#scene').getAttribute('data-phase'),phase);
  }
  await click(p,'#restart');await settle(p);assert.equal(await p.locator('#scene').getAttribute('data-node'),'C01-GUARD-1');await ctx.close();
  assert.deepEqual(errors,[]);
  await writeFile(new URL('browser-verification.json',out),JSON.stringify({version:story.version,passed:true,model:'controlled fixture',routes:results,checks:['有无伯约条件提示','两分支进入AI','追问与四条结果路线','刷新恢复回应和草稿','连接失败不推进','取消/改写/返回抛弃迟到回应','移动端无横向溢出','无旧线索列表'],errors},null,2));
  console.log('浏览器验证通过：4条路线，错误/刷新/取消/改写/返回及移动端。');
}finally{await browser.close();await new Promise(r=>server.close(r));}
