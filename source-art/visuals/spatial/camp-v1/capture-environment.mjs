import {chromium} from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import {pathToFileURL,fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const cameras=JSON.parse(fs.readFileSync(path.join(root,'environment-cameras.json'),'utf8'));
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1100},deviceScaleFactor:1});
await page.goto(pathToFileURL(path.join(root,'index.html')).href);
await page.waitForFunction(()=>window.__spatialState);
await page.addStyleTag({content:'.hud{display:none}.stage{width:1536px;height:864px;min-height:864px}header,main{max-width:none;padding:0}#labels{display:none}'});
for(const camera of cameras){
 await page.evaluate(c=>select(c),camera);
 await page.locator('.stage').screenshot({path:path.join(root,camera.file)});
 console.log(camera.file,await page.evaluate(()=>window.__spatialState));
}
await browser.close();
