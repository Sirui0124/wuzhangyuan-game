import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';
const build=resolve('GameStarter/web-demo/.build');
const mod=path=>import(pathToFileURL(resolve(build,'GameStarter/web-demo/src',path)));
const read=name=>JSON.parse(readFileSync(resolve(build,'story',name),'utf8'));
const {chapterOnward}=await mod('game/chapter-onward.js');
const {GrainSession}=await mod('chapters/chapter-two/session.js');
const {parseJudgment}=await mod('chapters/chapter-two/open-dialogue.js');
const {JietingSession,createJietingPlaytest}=await mod('chapters/chapter-three/session.js');
const grain=read('chapter-two.films.json'),rubric=read('chapter-two.films-rubric.json'),third=read('chapter-three.story.json');
const cases=[];
for(const [good,action,early] of [[true,'A',false],[false,'A',false],[true,'B',false],[false,'B',false],[true,'A',true],[true,'C',false]]){
 const s=new GrainSession(grain,undefined,rubric,false);
 for(let i=0;i<180&&s.current.kind!=='finish';i++){
  const n=s.current;
  if(n.kind==='open'){
   const input='你先停手，我陪你把实情和各人责任如实报上去，但不保证免责。';
   s.submit(parseJudgment(JSON.stringify({valid:true,scores:Object.fromEntries(['trust','rigor','responsibility'].map((k,i)=>[k,{delta:good?2:i===1?0:2,quote:input,reason:'受控测试'}]))}),input,s.currentRubric));
  }
  const pick=n.id==='UI-N1'?(good?'N1-A':'N1-B'):n.id==='UI-N2'?(early?'N2-B':good?'N2-A':'N2-C'):n.id==='UI-N3'?(good?'N3-B':'N3-A'):n.id==='UI-N4'?'N4-B':n.id==='UI-N5'?'N5-'+action:n.id==='UI-EARLY'?'early-stop':n.id==='UI-FALLBACK'?'fallback-case':n.options?.[0]?.id;
  assert.equal(s.advance(n.kind==='choice'?pick:undefined),true,n.id);
 }
 assert.equal(s.current.kind,'finish');
 cases.push({chapter:'grain',ending:s.current.ending,key:'grain-chapter-two-films-v1',save:s.state,next:'jieting'});
}
const defaults={'JT-Q1':'JT-O018','JT-Q2':'JT-O031','JT-Q3':'JT-O093','JT-Q4':'JT-O111','JT-R1-FIXED':'JT-O132','JT-R2-FIXED':'JT-O167','JT-R3-FIXED':'JT-O198','JT-R4-FIXED':'r4-none','JT-R5-FIXED':'r5-none','JT-ROUTE-CHOICE':'JT-O228','JT-WITHDRAW-FIXED':'JT-O232','JT-WITHDRAW-REPLY':'withdraw-facts','JT-LAST-TASK':'JT-O251','JT-GUARD-CONFIRM':'guard-go','JT-LURE-METHOD':'JT-O278','JT-LURE-CONFIRM':'JT-O305','JT-LURE-SIGNAL':'lure-wait-signal','JT-RETREAT-CHOICE':'JT-O372'};
for(const mode of ['withdrawal','dead','lure']){
 const s=mode==='dead'?new JietingSession(third,undefined,{aiEnabled:false}):createJietingPlaytest(third,mode,{aiEnabled:false});
 const choices={...defaults,...(mode==='dead'?{'JT-R2-FIXED':'JT-O168','JT-R3-FIXED':'JT-O199'}:{})};
 for(let i=0;i<600&&s.current.kind!=='ending';i++)assert.equal(s.advance(s.current.kind==='choice'?(choices[s.current.id]??s.options[0]?.id):undefined),true,s.current.id);
 assert.equal(s.current.kind,'ending');
 cases.push({chapter:'jieting',ending:s.state.ending,key:'jieting-chapter-three-v1',save:s.snapshot(),next:'yiling'});
}
for(const ending of third.endings.filter(e=>!e.success))assert.equal(chapterOnward('jieting',ending.id),null);
assert.equal(chapterOnward('yiling','reception-loss'),null);
for(const ending of ['safe'])assert.equal(chapterOnward('wuzhang',ending).href,'/?chapter=grain');
const out=resolve('outputs/chapter-onward-20261028');mkdirSync(out,{recursive:true});
const server=createStaticServer({root:build});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({channel:'chrome',headless:true}),errors=[],checks=[];
try{
 for(const c of cases){
  const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
  await context.route('http://127.0.0.1:8787/**',r=>r.fulfill({headers:{'Access-Control-Allow-Origin':'*'},json:{configured:false}}));
  await context.addInitScript(c=>{if(!sessionStorage.getItem('seed')){localStorage.setItem(c.key,JSON.stringify(c.save));sessionStorage.setItem('seed','1');}localStorage.setItem('wuzhang-runtime-mode-v1','offline');},c);
  const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
  await p.goto(base+'/?chapter='+c.chapter);await p.locator('[data-action=onward]').click();
  await p.locator('[data-chapter-onward]').waitFor();const copy=await p.locator('.chapter-onward-copy').innerText();
  assert.equal(await p.locator('[data-chapter-onward]').getAttribute('href'),'/?chapter='+c.next);
  if(c.chapter==='grain')assert.match(copy,/根本的差距是国力/);
  if(c.chapter==='jieting'){assert.match(copy,/没有十足的把握/);assert.match(copy,c.ending==='hold-masu-dies'?/马谡却没能回来/:/马谡.*活/);}
  await p.screenshot({path:resolve(out,c.chapter+'-'+c.ending+'.png')});
  await p.locator('[data-action=close-modal]').click();assert.equal(await p.locator('[data-chapter-onward]').count(),0);
  await p.reload();await p.locator('[data-action=onward]').click();assert.equal(await p.locator('.chapter-onward-copy').innerText(),copy);
  await p.setViewportSize({width:844,height:390});await p.locator('[data-chapter-onward]').scrollIntoViewIfNeeded();
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await p.screenshot({path:resolve(out,c.chapter+'-'+c.ending+'-mobile.png')});
  await p.locator('[data-chapter-onward]').click();await p.waitForURL('**/?chapter='+c.next);
  await p.waitForFunction(()=>!document.querySelector('[data-chapter-onward]')&&document.querySelector('#game-root')?.children.length>0);
  assert.equal(new URL(p.url()).searchParams.get('chapter'),c.next);
  checks.push(`${c.chapter}/${c.ending}: copy, close, refresh, mobile and next chapter passed`);await context.close();
 }
 assert.deepEqual(errors,[]);writeFileSync(resolve(out,'verification.json'),JSON.stringify({passed:true,checks,errors},null,2));console.log(JSON.stringify({passed:true,checks,errors}));
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
