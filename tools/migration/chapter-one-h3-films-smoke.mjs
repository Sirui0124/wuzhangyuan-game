import {chromium} from 'playwright';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {createStaticServer} from '../../GameStarter/web-demo/serve.mjs';
import {ChapterOneSession} from '../../GameStarter/web-demo/.build/GameStarter/web-demo/src/chapters/chapter-one/session.js';
const root=resolve('GameStarter/web-demo/.build'),read=n=>JSON.parse(readFileSync(resolve(root,'story',n),'utf8'));
const story=read('chapter-one.branch.json'),script=read('chapter-one.script.json'),flow=read('chapter-one.flow.json'),version=read('session-manifest.json').contentVersion;
function settle(g){for(let i=0;i<200;i++){const b=g.branch,d=b.dialogue;if(b.noticePending)g.branchAct('notice');else if(!b.atLastLine||d.pending||d.node.kind==='passage'||d.node.autoChoice)g.branchAct('next');else return;}throw Error('no stop');}
function fixture(scene){const g=new ChapterOneSession(script,flow,version,undefined,undefined,'offline',story);g.finishCinematic();settle(g);g.branchAct('ask','还有谁能帮忙处理军情？');settle(g);
 if(scene==='J02'){g.branchAct('choose','confirm_jiang');while(g.branch.line<3)g.branchAct('next');}
 else {g.branchAct('choose','meet');settle(g);g.branchAct('choose','concern_joint');settle(g);g.branchAct('offline',scene==='J04'?'INVITE_JIANG':'ENTER',scene==='J04'?'我带将军去见伯约。':'请将军入帐。');
  for(let i=0;i<100&&g.branch.dialogue.nodeId!==(scene==='J04'?'C01-JIANG-JOINT':'C01-END-LAMP');i++)g.branchAct('next');}
 console.log('fixture',scene,g.branch.dialogue.nodeId,g.branch.line);return g.serialize();}
const server=createStaticServer({root});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:'chrome',headless:true});const checks=[],errors=[];const out=resolve('outputs/ch01-h3-films');mkdirSync(out,{recursive:true});
try{for(const [scene,mode] of [['J02','ended'],['J04','ended'],['F02','ended'],['J04','skip'],['F02','skip']]){
 const ctx=await browser.newContext();await ctx.addInitScript(raw=>{if(!localStorage.getItem('wuzhang-chapter-session-v1'))localStorage.setItem('wuzhang-chapter-session-v1',raw);localStorage.setItem('wuzhang-runtime-mode-v1','offline');localStorage.setItem('wuzhang-ai-setup-v1','acknowledged');localStorage.setItem('wuzhang-voice-muted','1');},fixture(scene));
 const p=await ctx.newPage();p.setDefaultTimeout(90000);p.on('pageerror',e=>{errors.push(e.message);console.log('pageerror',e.message);});await p.goto(origin);await p.locator('[data-action=continue]').click();await p.locator('video').waitFor();
 async function finishVideo(){await p.locator('video').evaluate(v=>{v.muted=true;v.load();return v.play();});await p.waitForFunction(()=>document.querySelector('video')?.readyState>=2,null,{timeout:90000});assert.ok(await p.locator('video').evaluate(v=>v.duration>0&&!v.error));await p.locator('video').evaluate(v=>{v.currentTime=Math.max(0,v.duration-.2);return v.play();});}
 if(scene==='J02'){await finishVideo();await p.waitForFunction(()=>document.querySelector('video')?.src.includes('CH01-J02'));}
 const source=await p.locator('video').getAttribute('src');assert.ok(source.includes(`CH01-${scene}-h3-v6`));
 await p.screenshot({path:resolve(out,`${scene}-${mode}.png`)});
 if(mode==='skip')await p.locator('[data-cinema-action=skip]').click();else await finishVideo();
 const target=scene==='J02'?'C01-CONFIRMED-RETURN':scene==='J04'?'C01-END-JOINT':'C01-END-LAMP';await p.locator(`[data-node="${target}"]`).waitFor();
 assert.equal(await p.locator('video').count(),0);
 if(scene==='J04')assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('wuzhang-chapter-session-v1')).end),'safe');
 if(scene==='F02')assert.match(await p.locator('.ending-copy p').textContent(),/主灯却没有等到天明/);
 await p.reload();await p.locator('[data-action=continue]').click();await p.locator(`[data-node="${target}"]`).waitFor();assert.equal(await p.locator('video').count(),0);
 checks.push({scene,mode,source,target,passed:true});await ctx.close();
 }assert.deepEqual(errors,[]);writeFileSync(resolve(out,'checks.json'),JSON.stringify({passed:true,checks,errors},null,2));console.log(JSON.stringify({passed:true,checks,errors},null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));}
