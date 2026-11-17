import {chromium} from 'playwright';
import {createStaticServer} from '../../GameStarter/web-demo/serve.mjs';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
const server=createStaticServer({root:resolve(process.env.CH2_SMOKE_BUILD || 'GameStarter/web-demo/.build')});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`,out=process.env.CH2_SMOKE_OUTPUT || 'outputs/video-integration-20261025/browser';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),results=[];
try{
 for(const route of ['E1','E2','E3','E4-early','E4-late','E5']){
  const context=await browser.newContext({viewport:{width:1366,height:768}}),page=await context.newPage(),errors=[];
  // Isolated developer context: satisfy the chapter access prerequisite without altering plot facts.
  await page.addInitScript(()=>{
   localStorage.setItem('wuzhang-runtime-mode-v1','offline');
   localStorage.setItem('wuzhang-chapter-history-v1',JSON.stringify({version:1,entered:['wuzhang'],completed:['wuzhang']}));
  });
  page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/?chapter=grain',{waitUntil:'domcontentloaded',timeout:30000});
  const low=['E2','E4-late'].includes(route);const seen=[];
  for(let i=0;i<180;i++){
   await page.waitForFunction(()=>document.querySelector('[data-cinema-action=skip],[data-option],[data-action=next],[data-fixed-speech],[data-action=restart],[data-phase=material]')).catch(async e=>{await page.screenshot({path:out+'/failure.png'});writeFileSync(out+'/failure.json',JSON.stringify({route,seen,errors,text:await page.locator('body').innerText()}));throw e;});
   const id=await page.locator('#game-root').getAttribute('data-node');seen.push(id);writeFileSync(out+'/progress.json',JSON.stringify({route,id,seen}));
   if(id?.startsWith('END-'))break;
   if(await page.locator('[data-cinema-action=skip]').count()){
    const v=page.locator('video');await v.waitFor();
    await page.waitForFunction(()=>{const v=document.querySelector('video');return v&&v.readyState>=1;},{},{timeout:30000}).catch(async e=>{throw new Error(id+' '+JSON.stringify(await page.locator('video').evaluate(v=>({src:v.src,error:v.error?.message,ready:v.readyState})))+' '+e.message)});
    if(id==='V01'&&route==='E1'){
     await page.waitForTimeout(600);await page.screenshot({path:out+'/opening.png'});
     const before=id;await page.keyboard.press('Space');assert.equal(await page.locator('#game-root').getAttribute('data-node'),before);
    }
    await page.locator('[data-cinema-action=skip]').click();continue;
   }
   if(await page.locator('[data-fixed-speech]').count()){
    await page.locator(`[data-fixed-speech="${low&&id==='CH2-LY03-018'?'1':'0'}"]`).click();continue;
   }
   if(await page.locator('[data-option]').count()){
    const target=id==='UI-N1'?(low?'N1-B':'N1-A'):id==='UI-N2'?(route==='E4-early'?'N2-B':low?'N2-C':'N2-A'):id==='UI-N3'?(low?'N3-A':'N3-B'):id==='UI-N4'?'N4-B':id==='UI-N5'?'N5-'+(route==='E5'?'C':['E3','E4-late'].includes(route)?'B':'A'):id==='UI-EARLY'?'early-stop':id==='UI-FALLBACK'?'fallback-case':null;
    if(route==='E1'&&id==='UI-N2')await page.screenshot({path:out+'/ordinary-choice.png'});
    console.log(route,id,target);await (target?page.locator(`[data-option="${target}"]`):page.locator('[data-option]').first()).click();continue;
   }
   if(id==='CH2-LY02-014'&&route==='E1'){
    assert.match(await page.locator('.evidence-reading').innerText(),/六月初二/);await page.screenshot({path:out+'/document.png'});await page.reload({waitUntil:'domcontentloaded'});await page.locator('.evidence-reading').waitFor();assert.equal(await page.locator('#game-root').getAttribute('data-node'),id);
   }
   if(id==='CH2-LY09-P02'&&route==='E1')await page.screenshot({path:out+'/placeholder.png'});
   if(id==='UI-SEND'&&route==='E1'){await page.locator('#letter-draft').fill('如实报告粮情与全部责任；完整原件随附，撤回原先计划。');await page.screenshot({path:out+'/letter.png'});}
   if(await page.locator('[data-action=next]').count())await page.locator('[data-action=next]').first().click();
   else await page.keyboard.press('Space');
  }
  const end=await page.locator('#game-root').getAttribute('data-node');
  assert.equal(end,'END-'+route);assert.deepEqual(errors,[]);
  await page.screenshot({path:out+'/'+route+'.png'});results.push({route,end,steps:seen.length,errors});await context.close();
 }
 writeFileSync(out+'/results.json',JSON.stringify({passed:true,routes:results,audiovisualHumanReview:false},null,2));console.log(JSON.stringify(results));
}catch(e){console.error(e);throw e;}finally{await browser.close();await new Promise(r=>server.close(r));}
