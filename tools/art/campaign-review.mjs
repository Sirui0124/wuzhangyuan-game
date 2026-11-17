import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {createStaticServer} from '../../GameStarter/web-demo/serve.mjs';
const output=resolve('outputs/campaign-style-20261117');mkdirSync(output,{recursive:true});
const server=createStaticServer();await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[],missing=[],results=[];
try {
 for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:844,height:390}]){
  const context=await browser.newContext({viewport,reducedMotion:'reduce'});
  await context.addInitScript(()=>{localStorage.setItem('wuzhang-runtime-mode-v1','ai');localStorage.setItem('wuzhang-voice-muted','1');localStorage.setItem('wuzhang-chapter-history-v1',JSON.stringify({version:1,entered:['wuzhang','grain','jieting','jingzhou'],completed:['wuzhang','grain','jieting']}));});
  await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin===base)return route.continue();if(u.pathname==='/health')return route.fulfill({headers:{'Access-Control-Allow-Origin':'*'},json:{configured:true}});return route.abort();});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()===404)missing.push(r.url());});
  for(const [name,query] of [['menu',''],['wuzhang','?playtest=weiyan-second'],['grain','?chapter=grain&playtest=open1'],['jieting','?chapter=jieting&playtest=reinforcement']]){
   await page.goto(base+'/'+query);
   await page.locator(name==='menu'?'.game-menu':'#player-expression').waitFor();
   if(name!=='menu'){
    const input=page.locator('#player-expression');await input.fill('先把眼前的军情说清，再请将军定夺。');await input.focus();
    assert.equal(await input.inputValue(),'先把眼前的军情说清，再请将军定夺。');
    const metrics=await input.evaluate(e=>{const s=getComputedStyle(e);return {font:s.fontSize,color:s.color,background:s.backgroundImage,width:e.getBoundingClientRect().width};});
    assert.ok(metrics.background.includes('material-atlas'));assert.equal(metrics.font,'20px');
    await page.locator('[data-action=speak]').scrollIntoViewIfNeeded();assert.ok(await page.locator('[data-action=speak]').isEnabled());results.push({name,viewport,metrics});
   }
   await page.screenshot({path:resolve(output,`${name}-${viewport.width}.png`)});
   if(name==='menu'){
    await page.locator('[data-action=settings]').click();await page.locator('.game-modal').waitFor();await page.screenshot({path:resolve(output,`settings-${viewport.width}.png`)});
   }
   if(name==='wuzhang'){
    await page.locator('[data-action=pause]').click();await page.locator('[data-page=pause]').waitFor();await page.screenshot({path:resolve(output,`pause-${viewport.width}.png`)});
    await page.locator('[data-action=resume-game]').click();assert.equal(await page.locator('#player-expression').inputValue(),'先把眼前的军情说清，再请将军定夺。');
   }
  }
  await page.goto(base+'/?chapter=jingzhou&playtest=reports');
  await page.locator('#spoken-line').waitFor();
  while(await page.locator('[data-jz=story-next]').count())await page.locator('[data-jz=story-next]').click();
  await page.locator('[data-jz=begin]').click();await page.locator('#jz-inquiry').fill('军报是在何时送来的？');
  assert.ok((await page.locator('#jz-inquiry').evaluate(e=>getComputedStyle(e).backgroundImage)).includes('material-atlas'));
  await page.screenshot({path:resolve(output,`jingzhou-${viewport.width}.png`)});
  if(viewport.width===1440){
   await page.goto(base+'/');await page.locator('[data-action=new]').click();await page.locator('[data-action=new-confirmed]').click();await page.locator('[data-cinema-action=skip]').click();await page.locator('.game-scene').waitFor();
   if(!await page.locator('.dialogue-box').count())await page.locator('[data-scene-action=read-notice]').click();
   await page.locator('.dialogue-box').waitFor();
   const styles=()=>page.locator('.dialogue-box').evaluate(e=>{const fields=['color','fontFamily','fontSize','lineHeight','padding','width','height','background','border','bottom','left','right'];return [null,'::before','::after'].map(p=>{const s=getComputedStyle(e,p);return Object.fromEntries([...fields,'backgroundImage','opacity'].map(k=>[k,s[k]]));});});
   const after=await styles();await page.screenshot({path:resolve(output,'opening-preserved.png')});
   await page.locator('link[href="/narrative.css"]').evaluate(e=>e.sheet.disabled=true);
   assert.deepEqual(await styles(),after,'Opening dialogue and ink wash retain all measured styles');
   results.push({name:'opening-dialogue-unchanged',passed:true});
  }
  await context.close();
 }
 assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
 writeFileSync(resolve(output,'checks.json'),JSON.stringify({results,errors,missing},null,2));console.log(JSON.stringify({cases:results.length,errors,missing,output}));
}finally{await browser.close();server.closeAllConnections();await new Promise(ok=>server.close(ok));}

