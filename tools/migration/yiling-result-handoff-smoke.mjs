import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {createState,resolveRound,nextRound,publicView} from '../../demos/yiling-rescue/.build/engine.js';
// Uses the running local apps, but only fresh browser storage and intercepted API fixtures.
const state=createState('12345678-1234-1234-1234-123456789abc','result-handoff');
while(state.phase!=='ended'){resolveRound(state,[],[]);nextRound(state);}
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const c=await browser.newContext(),p=await c.newPage(),errors=[];
 c.on('page',page=>page.on('pageerror',e=>errors.push(e.message)));
 await c.addInitScript(()=>{if(location.port==='8828')localStorage.setItem('yiling-rescue-demo-session-v2','12345678-1234-1234-1234-123456789abc');});
 await c.route('http://127.0.0.1:8828/api/**',r=>r.fulfill({json:r.request().url().includes('/health')?{configured:false}:{state:publicView(state)}}));
 await p.goto('http://127.0.0.1:8828/');await p.locator('[data-action=show-ending]').click();
 const pending=p.waitForEvent('popup');await p.locator('[data-action=adopt-result]').click();const popup=await pending;
 await popup.locator('#links:not([hidden])').waitFor();assert.match(await popup.locator('#status').innerText(),/已采用本轮结果/);
 const stored=await popup.evaluate(()=>JSON.parse(localStorage.getItem('wzy:chapter-results:v1')).yiling);
 assert.equal(stored.people.length,9);assert.equal(stored.people.find(p=>p.name==='黄权').fate,'unknown');assert.deepEqual(errors,[]);
 const report={passed:true,checks:['actual rescue ending button, actual sender module and receiver page handshake','complete nine routes, surrender remains unknown rather than dead','fresh isolated browser storage; no user save or server state modified'],errors};
 writeFileSync('outputs/chapter-seven-20261028/yiling-handoff-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
