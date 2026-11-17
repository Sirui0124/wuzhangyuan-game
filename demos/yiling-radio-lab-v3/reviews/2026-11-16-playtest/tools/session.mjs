import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
const {chromium}=createRequire(import.meta.url)('playwright');
const base=path.resolve('demos/yiling-radio-lab-v3/reviews/2026-11-16-playtest/evidence');
export async function openRun(name,seedOffset=0){
 const dir=path.join(base,name);await fs.mkdir(dir,{recursive:true});
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 const page=await context.newPage(),events=[],api=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',async r=>{if(r.url().endsWith('/api/message'))try{api.push({status:r.status(),text:r.request().postDataJSON()?.text,response:await r.json()});}catch{}});
 const flush=()=>fs.writeFile(path.join(dir,'transcript.json'),JSON.stringify({name,seedOffset,events,api,errors},null,2));
 const observe=async()=>{const text=await page.locator('body').innerText();events.push({kind:'observation',at:new Date().toISOString(),text});await flush();return text;};
 const click=async selector=>{events.push({kind:'click',selector});await page.locator(selector).click({timeout:10000});return observe();};
 const say=async text=>{events.push({kind:'say',text});await page.locator('#words').fill(text);await page.locator('#send').click();await page.waitForFunction(()=>!document.querySelector('#send')?.disabled,{},{timeout:65000});return observe();};
 const shot=async name=>{const target=path.join(dir,name+'.png');await page.screenshot({path:target});return target;};
 const finish=async()=>{const state=await page.evaluate(()=>window.radioQA.state);await fs.writeFile(path.join(dir,'final-state.json'),JSON.stringify(state,null,2));await shot('final');await flush();await browser.close();return {archived:true,name,seed:state.world.initialSeed,periods:state.world.history.length,ended:state.world.ended,saved:Object.keys(state.world.saved).length,complete:Object.values(state.world.fronts).filter(f=>f.result==='complete').length,camp:state.world.camp,grain:state.world.stock,losses:state.world.losses,eaten:state.world.eaten,relief:state.world.relief,requests:api.length,errors};};
 await page.goto('http://127.0.0.1:8952/?qa=1');
 for(let n=0;n<seedOffset;n++){if(await page.locator('#begin').count())await page.locator('#begin').click();await page.locator('#menu').click();await page.locator('#restart').click();await page.locator('#new-seed').click();}
 return {name,dir,page,observe,click,say,shot,finish};
}
