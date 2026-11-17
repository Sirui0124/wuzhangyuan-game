import { chromium } from 'playwright';
import { createStaticServer } from '../../../GameStarter/web-demo/serve.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const root=resolve('.'), out=resolve('video/production/CH01-opening-fix-20261025/audit');
const read=p=>JSON.parse(readFileSync(resolve(root,p)));
const config=read('GameStarter/web-demo/public/cinematics.json');
const before=read('video/production/CH01-opening-fix-20261025/audit/cinematics-before.json');
const integration=read('video/production/CH01-opening-fix-20261025/integration.json');
const manifest=read('GameStarter/web-demo/public/video/media-manifest.json');
const a=structuredClone(config),b=structuredClone(before);a.opening.shift();b.opening.shift();assert.deepEqual(a,b);
const server=createStaticServer({root:resolve(root,'GameStarter/web-demo/.build')});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:900}});
const errors=[], missing=[],result={passed:false,errors,missing,subjectiveListening:false};
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()===404)missing.push(r.url());});
try{
 const bytes=Buffer.from(await(await fetch(base+integration.opening.src)).arrayBuffer());
 result.servedSha256=createHash('sha256').update(bytes).digest('hex');
 assert.equal(result.servedSha256,integration.sha256);
 assert.equal(result.servedSha256,manifest.clips.find(x=>x.url===integration.opening.src).sha256);
 await page.goto(base);await page.locator('[data-action=new]').click();
 await page.waitForFunction(src=>document.querySelector('video')?.getAttribute('src')===src,config.opening[0].src);
 await page.locator('video').evaluate(v=>v.addEventListener('ended',()=>window.__openingEnded={duration:v.duration,rate:v.playbackRate,width:v.videoWidth,height:v.videoHeight,audio:v.webkitAudioDecodedByteCount,error:v.error?.message??null},{once:true}));
 await page.waitForFunction(()=>window.__openingEnded,undefined,{timeout:70000});
 result.opening=await page.evaluate(()=>window.__openingEnded);
 assert.equal(result.opening.rate,1);assert.equal(result.opening.error,null);assert.ok(result.opening.audio>0);
 assert.equal(result.opening.width*9,result.opening.height*16);
 await page.waitForFunction(()=>document.querySelector('video')?.getAttribute('src')?.includes('SC03'));
 result.nextVideo=await page.locator('video').getAttribute('src');
 await page.screenshot({path:resolve(out,'opening-to-sc03.png')});
 try{
  const live='http://127.0.0.1:8812';
  const liveConfig=await(await fetch(live+'/cinematics.json')).json();
  assert.equal(liveConfig.opening[0].src,integration.opening.src);
  const liveBytes=Buffer.from(await(await fetch(live+integration.opening.src)).arrayBuffer());
  result.liveSha256=createHash('sha256').update(liveBytes).digest('hex');
  assert.equal(result.liveSha256,integration.sha256);
 }catch(e){result.liveCheckError=e.message;throw e;}
 assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);result.passed=true;
}finally{
 writeFileSync(resolve(out,'browser-verification.json'),JSON.stringify(result,null,2));
 await browser.close();await new Promise(ok=>server.close(ok));
}
console.log(JSON.stringify(result));
