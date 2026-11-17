import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const model=JSON.parse(fs.readFileSync(path.join(root,'camp-layout.json'),'utf8'));
const geometry=[];
for(const file of ['camp-exterior.obj','main-tent-ritual.obj','main-tent-council.obj']){
 const lines=fs.readFileSync(path.join(root,file),'utf8').split('\n'),verts=lines.filter(l=>l.startsWith('v ')),faces=lines.filter(l=>l.startsWith('f '));
 assert(verts.length>0&&faces.length>0);for(const v of verts)assert(v.slice(2).split(' ').every(n=>Number.isFinite(Number(n))));
 for(const f of faces){const ix=f.slice(2).split(' ').map(Number);assert(ix.length===3);assert(new Set(ix).size===3);assert(ix.every(n=>n>=1&&n<=verts.length));}
 geometry.push({file,vertices:verts.length,triangles:faces.length,indicesValid:true});
}
const count=prefix=>model.objects.filter(o=>o.name.startsWith(prefix)&&o.name.endsWith('-bowl')).length;
assert.equal(count('LARGE-'),7);assert.equal(count('SMALL-'),49);assert.equal(count('MAIN-LIFE-LAMP'),1);assert.equal(count('DESK-AUX-LAMP'),1);
// Check a 1.2 m walking corridor along the front, sides and rear against fixed lamps and the desk.
const route=[[0,0],[0,-.75],[-5.9,-.75],[-5.9,-11.9],[5.9,-11.9],[5.9,-.75]],lamps=model.objects.filter(o=>o.layer==='interior'&&o.name.endsWith('-bowl')&&!o.name.startsWith('DESK'));
let minClearance=Infinity;
for(let i=1;i<route.length;i++){const a=route[i-1],b=route[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);for(let t=0;t<=length;t+=.02){const x=a[0]+(b[0]-a[0])*t/length,z=a[1]+(b[1]-a[1])*t/length;
 for(const l of lamps){const xs=l.vertices.map(v=>v[0]),zs=l.vertices.map(v=>v[2]),cx=(Math.max(...xs)+Math.min(...xs))/2,cz=(Math.max(...zs)+Math.min(...zs))/2,r=(Math.max(...xs)-Math.min(...xs))/2;minClearance=Math.min(minClearance,Math.hypot(x-cx,z-cz)-r);}
 const dx=Math.max(-5.2-x,0,x+2.4),dz=Math.max(-5.45-z,0,z+4.15);minClearance=Math.min(minClearance,Math.hypot(dx,dz));
}}
assert(minClearance>=.6,`Walking corridor blocked at ${minClearance}`);
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:1});
const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url())});
await page.goto(pathToFileURL(path.join(root,'index.html')).href);await page.waitForFunction(()=>window.__spatialState?.visibleObjects>0);
const screenshots=[];
for(const camera of model.cameras){await page.locator(`#cameras button[data-id="${camera.id}"]`).click();const state=await page.evaluate(()=>window.__spatialState);assert.equal(state.glError,0);assert(state.visibleObjects>0);await page.locator('.stage').screenshot({path:path.join(root,`preview-${camera.id==='report'?'report-dialogue':camera.id}.png`)});screenshots.push(state);}
await page.locator('#cameras button[data-id="overview"]').click();const before=await page.evaluate(()=>window.__spatialState.visibleObjects);await page.locator('#cutaway').check();assert((await page.evaluate(()=>window.__spatialState.visibleObjects))<before);
await page.locator('[data-tab="maps"]').click();await page.locator('#view-maps svg').first().screenshot({path:path.join(root,'camp-plan.png')});await page.locator('#view-maps svg').nth(1).screenshot({path:path.join(root,'main-tent-plan.png')});
await page.setViewportSize({width:390,height:844});let overflow=false;for(const tab of ['3d','maps','evidence','handoff']){await page.locator(`[data-tab="${tab}"]`).click();overflow ||= await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);}
assert(!overflow);assert.equal(errors.length,0);assert.equal(requests.length,0);
const result={browser:'Chrome via Playwright, headless',localFileLoaded:true,geometry,lamps:{large:7,small:49,main:1,deskAuxiliary:1},corridor:{widthMeters:1.2,minimumFixedObstacleClearanceMeters:Number(minClearance.toFixed(3)),scope:'fixed lamp footprints and desk; no animated body/camera sweep'},screenshots,cutawayTogglePassed:true,errors,remoteRequests:requests,mobileHorizontalOverflow:overflow,notValidated:['Blender/Cocos import','photometric lighting','character animation or costume','historical reconstruction','full video frame-by-frame continuity']};fs.writeFileSync(path.join(root,'validation.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));await browser.close();
