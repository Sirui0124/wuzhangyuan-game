import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const browser=await chromium.launch({channel:'chrome',headless:true}),rows=[];
try{
 for(const [width,height] of [[1440,900],[1280,720],[681,688],[390,844]]){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();
  await page.goto('http://127.0.0.1:8954/?qa=1');await page.locator('#begin').click();
  for(const view of ['frontline','dispatch']){
   await page.getByRole('link',{name:view==='frontline'?'前线联络':'出兵调遣',exact:true}).click();
   const geometry=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,mapHeight:document.querySelector('.map').getBoundingClientRect().height}));
   assert.ok(!geometry.overflow);assert.ok(geometry.mapHeight>=180);assert.ok(await page.locator('#words').isVisible());
   await page.screenshot({path:fileURLToPath(new URL(`${view}-${width}.png`,import.meta.url)),fullPage:true});rows.push({width,height,view,...geometry});
  }
  await context.close();
 }
 await fs.writeFile(new URL('layout.json',import.meta.url),JSON.stringify(rows,null,2));console.log(JSON.stringify(rows));
}finally{await browser.close();}
