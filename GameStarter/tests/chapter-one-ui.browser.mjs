import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createStaticServer} from '../web-demo/serve.mjs';
import {ChapterOneSession} from '../web-demo/.build/GameStarter/web-demo/src/chapters/chapter-one/session.js';
const read=name=>JSON.parse(readFileSync(resolve('content/chapters/wuzhang',name),'utf8'));
const story=read('chapter-one.branch.json'),script=read('chapter-one.script.json'),flow=read('chapter-one.flow.json');
const manifest=JSON.parse(readFileSync('GameStarter/web-demo/.build/story/session-manifest.json','utf8'));
const out=resolve('outputs/restored-chapter-one-ui');mkdirSync(out,{recursive:true});
const server=createStaticServer({root:resolve('GameStarter/web-demo/.build')});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome',headless:true}),errors=[],checks=[];
try {
 for(const width of [1440,844,390]) {
  const height=width===844?390:width===390?844:900;
  const g=new ChapterOneSession(script,flow,manifest.contentVersion,undefined,undefined,'ai',story);g.finishCinematic();
  const ctx=await browser.newContext({viewport:{width,height}});
  await ctx.addInitScript(raw=>{
   if(!localStorage.getItem('wuzhang-chapter-session-v1'))localStorage.setItem('wuzhang-chapter-session-v1',raw);
   localStorage.setItem('wuzhang-runtime-mode-v1','ai');localStorage.setItem('wuzhang-ai-setup-seen-v1','1');localStorage.setItem('wuzhang-voice-muted','1');localStorage.setItem('wuzhang-ai-voice-enabled','0');
  },g.serialize());
  await ctx.route('http://127.0.0.1:8787/**',r=>r.fulfill({headers:{'Access-Control-Allow-Origin':'*'},json:{configured:true}}));
  const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
  await p.goto(`http://127.0.0.1:${server.address().port}`);await p.locator('[data-action=continue]').click();
  for(let i=0;i<8&&!await p.locator('[data-branch=notice]').count();i++){await p.locator('.dialogue-advance').click();await p.waitForTimeout(150);}
  await p.locator('[data-branch=notice]').waitFor();await p.screenshot({path:resolve(out,`notice-hotspot-${width}.png`)});
  await p.keyboard.press('Space');assert.equal(await p.locator('[data-branch=notice]').count(),1);
  await p.locator('[data-branch=notice]').click();await p.waitForTimeout(750);
  assert.equal(await p.locator('.branch-clue-gained').count(),0);assert.match(await p.locator('#spoken-line').textContent(),/不得擅入/);
  await p.screenshot({path:resolve(out,`notice-reading-${width}.png`)});
  await p.locator('.dialogue-advance').click();await p.waitForTimeout(150);assert.match(await p.locator('.branch-clue-gained').textContent(),/帐前禁令/);
  for(let i=0;i<8&&await p.locator('.dialogue-advance').count();i++){await p.locator('.dialogue-advance').click();await p.waitForTimeout(150);}
  await p.locator('#branch-input').waitFor();
  assert.equal(await p.locator('[data-branch=choose]').count(),2);
  const style=await p.locator('#branch-input').evaluate(el=>({bg:getComputedStyle(el).backgroundColor,border:getComputedStyle(el).borderWidth,font:getComputedStyle(el).fontSize,height:el.clientHeight,line:parseFloat(getComputedStyle(el).lineHeight)}));
  assert.equal(style.bg,'rgba(0, 0, 0, 0)');assert.equal(style.border,'0px');assert.ok(style.height>=style.line*2.5-1);
  assert.equal(style.font,await p.locator('.expression-current-reply p').evaluate(el=>getComputedStyle(el).fontSize));
  await p.screenshot({path:resolve(out,`guard-${width}.png`)});
  await p.locator('[data-clue-picker]').click();assert.equal(await p.locator('[data-clue-detail=branch-order]').count(),1);assert.equal(await p.locator('[data-clue-detail=branch-jiang]').count(),0);
  await p.locator('[data-clue-detail=branch-order] summary').click();await p.locator('[data-action=insert-clue]').click();
  assert.match(await p.locator('#branch-input').inputValue(),/不得擅入/);
  assert.equal(await p.locator('[data-node=C01-GUARD-1]').count(),1);
  await p.locator('[data-branch=clear]').click();assert.equal(await p.locator('#branch-input').inputValue(),'');
  if(width===390)await p.setViewportSize({width:844,height:390});
  await p.locator('[data-action=records]').click();assert.equal(await p.getByText('眼前所见',{exact:true}).count(),0);assert.equal(await p.getByText('他回头看了看帐帘，把声音压低了些。',{exact:true}).count(),0);
  checks.push({width,height,style,noticeReadAndAwarded:true,cluePopover:true,noStageNarration:true});await ctx.close();
 }
 assert.deepEqual(errors,[]);writeFileSync(resolve(out,'checks.json'),JSON.stringify({checks,errors},null,2));console.log('第一章告示与恢复界面检查通过',checks.map(c=>`${c.width}×${c.height}`));
} finally {await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
