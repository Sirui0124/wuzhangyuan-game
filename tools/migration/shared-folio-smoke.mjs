import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createStaticServer} from '../../GameStarter/web-demo/serve.mjs';
import {GrainSession} from '../../GameStarter/web-demo/.build/GameStarter/web-demo/src/chapters/chapter-two/session.js';
import {fixedJudgment} from '../../GameStarter/web-demo/.build/GameStarter/web-demo/src/chapters/chapter-two/film-dialogue.js';
const output=resolve(process.env.FOLIO_OUTPUT ?? 'outputs/shared-folio-20261026');mkdirSync(output,{recursive:true});
const server=createStaticServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome',headless:true});const errors=[],checks=[];
try{
 const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1,reducedMotion:'reduce'});
 await context.route('http://127.0.0.1:8787/**',r=>r.fulfill({json:{configured:false,apiKey:'',model:'',baseUrl:''},headers:{'Access-Control-Allow-Origin':'*'}}));
 await context.addInitScript(()=>{localStorage.setItem('wuzhang-runtime-mode-v1','offline');localStorage.setItem('wuzhang-reduced-motion','1');});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const base=`http://127.0.0.1:${server.address().port}`;
 async function shot(name,width=1440,height=900){
  await page.setViewportSize({width,height});await page.evaluate(()=>document.fonts.ready);
  await page.evaluate(async()=>{const i=new Image();i.src='/ui/folio-cover-neutral-v1.png';await i.decode();});
  const modal=page.locator('.game-modal.xuan-panel');
  assert.ok(await modal.evaluate(el=>{const r=el.getBoundingClientRect(),b=el.querySelector('.folio-body');return r.top>=0&&r.bottom<=innerHeight+1&&r.right<=innerWidth+1&&b.scrollWidth<=b.clientWidth+1&&getComputedStyle(el).backgroundImage.includes('folio-cover-neutral');}));
  await modal.screenshot({path:resolve(output,`${name}-${width}.png`)});checks.push(`${name} ${width}`);
 }
 await page.goto(base+'/?chapter=jieting&playtest=reinforcement');
 for(const action of ['notes','situation','records','bag','save']){
  await page.setViewportSize({width:1440,height:900});
  await page.locator(`.game-hud [data-action=${action}]`).click();await shot('chapter-three-'+action);await shot('chapter-three-'+action,390,844);await page.locator('.modal-close').click();
 }
 await page.setViewportSize({width:1440,height:900});await page.locator('[data-action=pause]').click();await page.locator('.pause-actions [data-action=settings]').click();await shot('chapter-three-settings');await page.keyboard.press('Escape');await page.locator('[data-action=resume-game]').click();
 // A real completed second-chapter state reaches the formerly native confirm path.
 const read=p=>JSON.parse(readFileSync(p,'utf8'));
 const s=new GrainSession(read('content/chapters/grain/chapter-two.films.json'),undefined,read('content/chapters/grain/chapter-two.films-rubric.json'),false);
 for(let i=0;i<250&&s.current.kind!=='finish';i++){if(s.current.kind==='open')s.submit(fixedJudgment(s.current.round,0,s.currentRubric).judgment);assert.ok(s.advance(s.current.options?.[0]?.id));}
 assert.equal(s.current.kind,'finish');
 await page.evaluate(save=>localStorage.setItem('grain-chapter-two-films-v1',save),JSON.stringify(s.state));
 await page.goto(base+'/?chapter=grain');let native=0;page.on('dialog',async d=>{native++;await d.dismiss();});
 await page.locator('[data-action=restart]').waitFor({state:'visible'});
 const before=await page.evaluate(()=>localStorage.getItem('grain-chapter-two-films-v1'));
 await page.locator('[data-action=restart]').click();await shot('chapter-two-restart');await page.locator('.modal-close').click();await page.locator('[data-action=resume-game]').click();
 assert.equal(native,0);assert.equal(await page.evaluate(()=>localStorage.getItem('grain-chapter-two-films-v1')),before);
 assert.deepEqual(errors,[]);writeFileSync(resolve(output,'verification.json'),JSON.stringify({passed:true,checks,nativeConfirmReplaced:true,savePreserved:true,errors},null,2));console.log('PASS: third-chapter shared dialogs and second-chapter restart confirmation, desktop/narrow layouts, save preservation.');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
