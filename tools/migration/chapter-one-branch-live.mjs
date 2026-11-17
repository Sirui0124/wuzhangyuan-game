// Opt-in real model check; isolated browser storage, actual formal HTTP endpoint.
import {chromium} from 'playwright';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {createStaticServer} from '../../GameStarter/web-demo/serve.mjs';
import {ChapterOneSession} from '../../GameStarter/web-demo/.build/GameStarter/web-demo/src/chapters/chapter-one/session.js';
const root=resolve('GameStarter/web-demo/.build');
const read=file=>JSON.parse(readFileSync(resolve(root,'story',file),'utf8'));
const g=new ChapterOneSession(read('chapter-one.script.json'),read('chapter-one.flow.json'),read('session-manifest.json').contentVersion,undefined,undefined,'ai',read('chapter-one.branch.json'));
function advance(){for(let i=0;i<150;i++){const b=g.branch,d=b.dialogue;if(!b.atLastLine||d.pending||d.node.kind==='passage')g.branchAct('next');else return;}}
g.finishCinematic();advance();g.branchAct('ask','还有谁能帮忙处理军情？');advance();for(const id of ['meet','concern','front']){g.branchAct('choose',id);advance();}
const server=createStaticServer({root});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const ctx=await browser.newContext({viewport:{width:1440,height:900}});
 await ctx.addInitScript(raw=>{if(!localStorage.getItem('wuzhang-chapter-session-v1'))localStorage.setItem('wuzhang-chapter-session-v1',raw);localStorage.setItem('wuzhang-runtime-mode-v1','ai');localStorage.setItem('wuzhang-ai-voice-enabled','0');localStorage.setItem('wuzhang-voice-muted','1');},g.serialize());
 const p=await ctx.newPage();await p.goto(origin);await p.locator('[data-action="continue"]').click();await p.locator('#branch-input').waitFor();
 const text='敌人的骑兵在营外，还没攻营。将军先回去，我把军报送给伯约，请他看过，再将回令送回前营。';await p.locator('#branch-input').fill(text);
 const received=p.waitForResponse(r=>r.url().endsWith('/api/chapter-one/turn'),{timeout:65000});await p.locator('[data-branch-form] button[type="submit"]').click();const response=await received,result=await response.json();assert.equal(response.status(),200,JSON.stringify(result));assert.equal(result.outcome,'RELAY_JIANG');
 await p.locator('[data-branch="next"]').waitFor();await p.locator('[data-branch="next"]').click();
 const out=resolve('outputs/chapter-one-integration');mkdirSync(out,{recursive:true});await p.screenshot({path:resolve(out,'formal-ai-live.png')});
 for(let i=0;i<150;i++){if(!await p.locator('[data-branch="next"]').count())break;await p.locator('[data-branch="next"]').click();await p.waitForTimeout(90);}
 assert.equal(await p.locator('.branch-scene').getAttribute('data-ending'),'E-FORMAL');
 writeFileSync(resolve(out,'live-verification.json'),JSON.stringify({passed:true,version:g.branch.story.version,text,outcome:result.outcome,reply:result.reply,replySource:result.replySource,ending:'E-FORMAL'},null,2));console.log(JSON.stringify({passed:true,outcome:result.outcome,reply:result.reply,replySource:result.replySource}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
