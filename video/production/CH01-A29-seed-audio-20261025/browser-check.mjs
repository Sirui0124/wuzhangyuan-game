import {chromium} from 'playwright';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const out='video/production/CH01-A29-seed-audio-20261025/';
const edit=JSON.parse(readFileSync(out+'edit.json','utf8'));
const base='http://127.0.0.1:8812';
const browser=await chromium.launch({headless:true,channel:'chrome'});
const context=await browser.newContext({viewport:{width:1366,height:768}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
const save=JSON.parse(readFileSync('outputs/scout-handoff-20261025/checkpoint.json','utf8'));
await page.addInitScript(save=>{localStorage.setItem('wuzhang-chapter-session-v1',JSON.stringify(save));localStorage.setItem('wuzhang-runtime-mode-v1','offline');localStorage.setItem('wuzhang-reduced-motion','1');},save);
await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('[data-action=continue]').click();await page.locator('[data-cinema-action=skip]').click();await page.locator('[data-scene-action=intercept-first]').click();
await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2);
assert.match(await page.locator('video').getAttribute('src'),/A29-seed-audio-20261025/);
await page.waitForFunction(()=>document.querySelector('video')?.currentTime>=7,{},{timeout:20000});await page.screenshot({path:out+'browser-7s.png'});
const media=await page.locator('video').evaluate(v=>({src:v.currentSrc,duration:v.duration,error:v.error?.message,subtitles:v.querySelector('track')?.src}));
await page.locator('[data-film-confirm]').waitFor({state:'visible',timeout:40000});
await page.locator('[data-film-confirm]').click();await page.locator('#player-expression').waitFor();
const res=await fetch(base+new URL(media.src).pathname);const bytes=Buffer.from(await res.arrayBuffer());assert.equal(createHash('sha256').update(bytes).digest('hex'),edit.sha256);assert.deepEqual(errors,[]);
const report={passed:true,media,naturalPlaybackEnded:true,nextPhase:'expression',servedSha256:edit.sha256,errors,humanListeningReview:false};writeFileSync(out+'browser-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close()}
