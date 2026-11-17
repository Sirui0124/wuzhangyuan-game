// Explicit opt-in smoke test: calls the configured model through the running review server.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const browser=await chromium.launch({channel:'chrome',headless:true});
const ctx=await browser.newContext(), p=await ctx.newPage();
const errors=[];p.on('pageerror',e=>errors.push(e.message));
async function click(s){await p.locator(s).click();await p.waitForTimeout(130);}
async function settle(){for(let i=0;i<40;i++){if(!['passage','reply'].includes(await p.locator('#scene').getAttribute('data-phase')))return;await click('[data-choice="next"]');}throw Error('跳转超限');}
try{
  await p.goto('http://127.0.0.1:8941/');await p.waitForFunction(()=>document.querySelector('#scene').dataset.node);await settle();
  await p.locator('#input').fill('丞相不能见，还有谁能帮忙处理军情？');await click('#submit');await settle();
  for(const id of ['meet','concern','front']){await click(`[data-choice="${id}"]`);await settle();}
  const text='敌人的骑兵还在营外，没有攻营。军报交给我，我拿去请伯约看，再把回令送回前营。';
  await p.locator('#input').fill(text);
  const responsePromise=p.waitForResponse(r=>r.url().endsWith('/api/ai/turn'),{timeout:65000});await click('#submit');
  const response=await responsePromise, result=await response.json();assert.equal(response.status(),200,JSON.stringify(result));assert.equal(result.outcome,'RELAY_JIANG');
  await p.waitForFunction(()=>document.querySelector('#scene').dataset.phase==='reply');
  assert.ok(!/我去请|军报给我/.test(result.reply),'魏延不能替玩家拿报请人');
  const out=new URL('../../outputs/chapter-review/',import.meta.url);
  await p.screenshot({path:fileURLToPath(new URL('ai-live-reply.png',out)),fullPage:true});
  await settle();assert.equal(await p.locator('#scene').getAttribute('data-ending'),'E-FORMAL');assert.deepEqual(errors,[]);
  const report={version:'2026-11-17-v3.3-ai',passed:true,live:true,text,outcome:result.outcome,reply:result.reply,replySource:result.replySource,ending:'E-FORMAL',errors};
  await writeFile(new URL('live-browser-verification.json',out),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await ctx.close();await browser.close();}
