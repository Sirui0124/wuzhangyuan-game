import {chromium} from 'playwright';
import {createServer} from '../server.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const out=fileURLToPath(new URL('../../../outputs/yiling-field-demo-20261103/',import.meta.url));mkdirSync(out,{recursive:true});
const server=createServer({config:async()=>({apiKey:''})});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:'chrome',headless:true});const errors=[],events=[];
try{const page=await browser.newPage({viewport:{width:1440,height:1050},reducedMotion:'reduce'});page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(5000);await page.goto(base);await page.locator('#begin').click();
 for(const [id,r]of [[1,'sha'],[2,'sha'],[3,'fu'],[4,'fu'],[5,'cheng']]){await page.locator('#squad-'+id).click();await page.locator('#route-'+r).click();}
 await page.locator('#speed').click();await page.locator('#speed').click();await page.locator('#pause').click();let battleShot=false;
 const start=Date.now();while(Date.now()-start<100000){
  if(await page.locator('#result-modal').isVisible())break;
  if(await page.locator('#event-modal').isVisible()){events.push(await page.locator('#event-speaker').innerText());await page.locator('#sample').click();await page.locator('#send').click();await page.locator('#accept-plan').click();}
  const info=await page.evaluate(()=>({idle:[...document.querySelectorAll('.squad[data-phase=idle]')].map(e=>Number(e.dataset.squad)),routes:[...document.querySelectorAll('.route:not(.saved):not(.lost)')].map(e=>({id:e.dataset.route,count:document.querySelectorAll(`.squad[data-target=${e.dataset.route}][data-phase=moving],.squad[data-target=${e.dataset.route}][data-phase=working]`).length}))}));
  for(const id of info.idle){const priority={sha:160,fu:183,cheng:205,huang:240};info.routes.sort((a,b)=>(a.count*100+priority[a.id])-(b.count*100+priority[b.id]));if(!info.routes.length)break;const r=info.routes[0];await page.locator('#squad-'+id).click();await page.locator('#route-'+r.id).click();r.count++;}
  if(!battleShot&&events.length>=2){await page.screenshot({path:out+'05-实际行军与损伤.png',fullPage:true});battleShot=true;}
  await page.waitForTimeout(150);
 }
 assert.equal(await page.locator('#result-title').innerText(),'这一次，他们都回来了');assert.deepEqual(errors,[]);assert.equal(events.length,5);await page.screenshot({path:out+'06-完整试玩全救结算.png',fullPage:true});const report={result:await page.locator('#result-title').innerText(),clock:await page.locator('#clock').innerText(),events,errors,method:'浏览器从全新存档真实点击派兵、4倍速推进、处理自动触发的四次人物对话和一次追兵事件；离线参考说法。未注入战局。'};writeFileSync(out+'natural-run-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));}
