import {chromium} from 'playwright';
import {createStaticServer} from '../../GameStarter/web-demo/serve.mjs';
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const out='outputs/winding-map-20261027';mkdirSync(out,{recursive:true});
const server=createStaticServer({root:resolve(process.env.MAP_BUILD??'GameStarter/web-demo/.build')});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome',headless:true}),checks=[];
try{
 const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await context.route('http://127.0.0.1:8787/**',r=>r.fulfill({headers:{'Access-Control-Allow-Origin':'*'},json:{configured:false}}));
 await context.addInitScript(()=>localStorage.setItem('wuzhang-runtime-mode-v1','offline'));
 await page.goto('http://127.0.0.1:'+server.address().port+'/?view=chapters');await page.locator('.map-stage').waitFor();
 for(const [width,height] of [[1440,900],[1238,765],[1024,768],[762,900],[390,844]]){
  await page.setViewportSize({width,height});await page.evaluate(()=>document.fonts.ready);
  const measure=await page.locator('.map-stage').evaluate(e=>{
   const r=e.getBoundingClientRect(),nodes=[...e.querySelectorAll('[data-map-node]')].map(n=>{const b=n.getBoundingClientRect();return {id:n.dataset.mapNode,x:b.x-r.x,y:b.y-r.y,right:b.right-r.x,bottom:b.bottom-r.y};});
   const svg=[...e.querySelectorAll(':scope>svg')].find(n=>getComputedStyle(n).display!=='none');
   const pathCoords=selector=>[...svg.querySelector(selector).getAttribute('d').matchAll(/[MC]([^MC]+)/g)].map(m=>m[1].trim().split(/[ ,]+/).map(Number).slice(-2));
   return {width:r.width,height:r.height,nodes,coords:pathCoords('.map-route-shadow'),openCoords:pathCoords('.map-route-open'),plannedCoords:pathCoords('.map-route-planned')};
  });
  for(const n of measure.nodes)assert.ok(n.x>=0&&n.right<=measure.width+1&&n.y>=0&&n.bottom<=measure.height+1,JSON.stringify({width,n}));
  for(let i=0;i<measure.nodes.length;i++)for(let j=i+1;j<measure.nodes.length;j++){const a=measure.nodes[i],b=measure.nodes[j];assert.ok(a.right<=b.x||b.right<=a.x||a.bottom<=b.y||b.bottom<=a.y,'node overlap at '+width);}
  for(let i=0;i<measure.nodes.length;i++){const n=measure.nodes[i],[x,y]=measure.coords[i];assert.ok(Math.abs(n.x-x/1000*measure.width)<1&&Math.abs(n.y-y/1000*measure.height)<1,'route endpoint mismatch '+n.id);}
  assert.equal(await page.locator('.map-stage svg:visible .map-route-arrows').count(),5);
  assert.equal(await page.locator('.map-stage svg:visible .map-route-arrows.is-planned').count(),2);
  assert.equal(measure.openCoords.length,4,'Open route reaches the fourth chapter');
  assert.equal(measure.plannedCoords.length,3,'Two planned legs remain after Yiling');
  assert.deepEqual(measure.openCoords.at(-1),measure.coords[3]);
  assert.deepEqual(measure.plannedCoords[0],measure.coords[3]);
  await page.locator('.map-stage').screenshot({path:out+'/map-'+width+'.png'});
  if(width===1440)await page.screenshot({path:out+'/page-desktop.png'});
  for(const id of ['wuzhang','grain','jieting','yiling']){
   const button=page.locator('[data-map-node='+id+'] .map-chapter-action');await button.scrollIntoViewIfNeeded();
   assert.ok(await button.evaluate(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.left>=0&&r.right<=innerWidth+1&&!!hit&&e.contains(hit);}),'button not reachable '+id+' at '+width);
  }
  await page.evaluate(()=>document.querySelector('.archive-map').scrollTop=0);checks.push({width,nodeBounds:true,noOverlaps:true,endpointsAligned:true,buttonsReachable:true});
 }
 await page.evaluate(()=>{localStorage.setItem('grain-chapter-two-completed-v1','true');localStorage.setItem('jieting-chapter-three-completed-v1','true');localStorage.setItem('yiling-chapter-four-completed-v1','true');});await page.reload();await page.locator('.map-stage').waitFor();
 for(const id of ['grain','jieting','yiling']){const b=page.locator('[data-map-node='+id+'] .map-chapter-action');assert.match(await b.innerText(),/重玩这一章/);assert.equal(await b.getAttribute('href'),'/?chapter='+id+'&restart=1');}
 assert.deepEqual(errors,[]);writeFileSync(out+'/verification.json',JSON.stringify({passed:true,checks,replayStateCorrect:true,errors},null,2));console.log('PASS: five widths, no node overlap, curve endpoints align, all playable buttons reachable, replay states correct.');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
