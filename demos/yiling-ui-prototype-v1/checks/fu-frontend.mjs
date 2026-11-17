import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const dir=new URL(`../../../outputs/yiling-fu-frontend/${Date.now()}/`,import.meta.url);await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const passed=[],errors=[];
const clone=x=>structuredClone(x);
const capacity={甲:700,乙:800,丙:600,丁:400};
function session(id='fu-ui-contract'){
 return {scenarioId:id,revision:0,round:0,phase:'deceived_and_bereaved',view:{schemaVersion:1,scenarioId:id,frontId:'fu',revision:0,tacticalRoundId:'round-1',phase:'planning',crisis:{value:99,delta:0,reasons:[]},withdrawal:{probability:0,eligible:false,blockers:['危机尚未降低'],status:'holding'}},messages:[{id:'1',speaker:'傅肜',text:'吴人说陛下遇害，我身边的人也都战死了。',kind:'dialogue',round:0}],units:Object.fromEntries(Object.entries(capacity).map(([u,men])=>[u,{men,deployed:0,status:'营中待命',at:'camp',task:null}])),pendingOrders:[],facts:{},suggestions:['你还在后阵吗？','你为什么不肯撤？','陛下的消息，你是听谁说的？'],nextSendAt:0};
}
const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
let s=session(),failChat=true,dropRound=false,appliedRounds=0;
const calls=[],cache=new Map();
await page.route('**/api/fu/**',async route=>{
 const path=new URL(route.request().url()).pathname.split('/').at(-1),body=route.request().postDataJSON();calls.push({path,body:clone(body)});
 const answer=(value,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(value)});
 if(path==='session'){if(!body.scenarioId&&calls.filter(x=>x.path==='session').length>1)s=session('fu-ui-new');return answer({ok:true,session:s});}
 if(path==='chat'&&failChat){failChat=false;return answer({ok:false,error:'模型服务暂不可用，原文保留。'},502);}
 if(cache.has(body.requestId))return answer(cache.get(body.requestId));
 if(body.expectedRevision!==s.revision)return answer({ok:false,error:'会话已更新',session:s},409);
 await new Promise(resolve=>setTimeout(resolve,120));
 if(path==='chat'){s.messages.push({id:'q-'+s.revision,speaker:'我',text:body.text,kind:'question',round:s.round},{id:'a-'+s.revision,speaker:'傅肜',text:'我还在后阵。你方才说的消息，是谁带回来的？',kind:'dialogue',round:s.round});s.nextSendAt=Date.now()+10000;}
 if(path==='orders'){s.pendingOrders=body.orders;s.messages.push({id:'o-'+s.revision,speaker:'军侯',text:'军令已收，待本轮执行。',kind:'order',round:s.round});s.nextSendAt=Date.now()+10000;}
 if(path==='round'){
  appliedRounds++;s.round++;
  if(s.phase==='safe'){s.phase='home';s.suggestions=['这一仗的事，你想怎样告诉陛下？','先歇一歇吧。'];s.view.crisis={value:0,delta:0,reasons:['傅肜已归营']};}
  else{s.view.crisis={value:61,delta:-38,reasons:['替代撤路已通：危机降低20','持续受困：危机增加2']};s.view.withdrawal={probability:.25,eligible:true,blockers:[],status:'eligible'};s.view.lastResolution={roundId:'round-'+s.round,resolutionId:'r-'+s.round,outcome:'holding',probability:.36,crisis:59};}
 }
 s.revision++;s.view.revision=s.revision;const value={ok:true,session:clone(s)};cache.set(body.requestId,value);
 if(path==='round'&&dropRound){dropRound=false;return route.abort('connectionfailed');}
 return answer(value);
});
async function check(name,fn){await fn();passed.push(name);console.log('PASS',name);}
try{
 await page.goto('http://127.0.0.1:8956/');await page.locator('#close-info').click();
 await page.evaluate(()=>{const key='yiling-ui-prototype-v1',old=JSON.parse(localStorage.getItem(key));old.logs.push({id:999,who:'旧傅肜',text:'旧版演示不能混入',front:'fu',kind:'report',at:Date.now()});old.queue.push({type:'answer',front:'fu',text:'旧队列不能执行',due:Date.now()-1000});localStorage.setItem(key,JSON.stringify(old));});await page.reload();await page.locator('[data-contact="fu"]').click();await page.waitForFunction(()=>document.querySelector('#fu-crisis').textContent.includes('99'));
 await check('读取独立会话，旧傅肜日志和到期队列不参与真实营救',async()=>{
  assert(!(await page.locator('#log').innerText()).includes('旧版演示'));await page.waitForTimeout(700);assert(!(await page.locator('#log').innerText()).includes('旧队列'));assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('yiling-ui-prototype-v1')).queue.filter(x=>x.front==='fu').length),1);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('yiling-fu-runtime-v1')).scenarioId),'fu-ui-contract');
 });
 await check('建议来自会话，点击只填草稿；失败保留原文，以同一请求ID重试',async()=>{
  assert.equal(await page.locator('[data-suggestion]:visible').count(),3);assert(await page.locator('#suggest').isHidden());await page.locator('[data-suggestion]').first().click();assert(await page.locator('#suggestions').isVisible());assert.equal(await page.locator('#draft').inputValue(),'你还在后阵吗？');assert.equal(calls.filter(x=>x.path==='chat').length,0);await page.locator('#send').click();await page.waitForFunction(()=>!document.querySelector('#fu-retry').hidden);assert.equal(await page.locator('#draft').inputValue(),'你还在后阵吗？');await page.locator('#fu-retry').click();await page.waitForFunction(()=>document.querySelector('#draft').value==='');const chats=calls.filter(x=>x.path==='chat');assert.equal(chats.length,2);assert.deepEqual(chats[0].body,chats[1].body);assert((await page.locator('#log').innerText()).includes('方才说的消息'));assert.equal(s.round,0);
 });
 await check('结束本轮不被聊天冷却阻挡，重复点击只发一个请求；地图仅显示危机数值',async()=>{
  assert(await page.locator('#send').isDisabled());assert(await page.locator('#fu-end-round').isEnabled());await page.locator('#fu-end-round').dispatchEvent('click');await page.locator('#fu-end-round').dispatchEvent('click');await page.waitForFunction(()=>document.querySelector('#fu-crisis strong').textContent==='61');assert.equal(appliedRounds,1);assert.equal(await page.locator('#command-panel #fu-crisis,.crisis-values,.crisis-reasons,.pending-summary').count(),0);assert.equal(s.round,1);await page.setViewportSize({width:1280,height:720});await page.waitForTimeout(150);await page.screenshot({path:fileURLToPath(new URL('compact-desktop.png',dir))});const fit=await page.evaluate(()=>Object.fromEntries(['.conversation','.composer','.reports','.command-launch','.fu-status','.conversation-head','.filter-bar','#conflict'].map(s=>[s,document.querySelector(s).getBoundingClientRect().toJSON()])));assert(fit['.composer'].bottom<=fit['.conversation'].bottom,JSON.stringify(fit));await page.setViewportSize({width:1440,height:900});await page.waitForTimeout(150);await page.screenshot({path:fileURLToPath(new URL('map-and-composer-desktop.png',dir)),fullPage:true});
 });
 await check('回执丢失后刷新读取新版本，仍用原请求ID重试，不重复结算',async()=>{
  dropRound=true;await page.locator('#fu-end-round').click();await page.waitForFunction(()=>!document.querySelector('#fu-retry').hidden);const request=calls.filter(x=>x.path==='round').at(-1).body;assert.equal(appliedRounds,2);await page.reload();await page.waitForFunction(()=>!document.querySelector('#fu-retry').hidden);await page.locator('#fu-retry').click();await page.waitForFunction(()=>document.querySelector('#fu-retry').hidden);assert.deepEqual(calls.filter(x=>x.path==='round').at(-1).body,request);assert.equal(appliedRounds,2);
 });
 await check('已脱险后可护送归营，归营后不再推进，旧档和旧演示保留',async()=>{
  s.phase='safe';s.suggestions=['总算出来了，你伤得重吗？','先回营歇一歇吧。'];s.view.withdrawal.status='withdrawn';s.view.crisis.value=0;await page.locator('#fu-refresh').click();await page.waitForFunction(()=>document.querySelector('#fu-end-round').textContent==='护送归营');assert((await page.locator('#suggestions').innerText()).includes('你伤得重吗'));assert(await page.locator('#fu-map-status').isVisible());assert.equal(await page.locator('.place.army-fu').count(),0);await page.locator('#fu-end-round').click();await page.waitForFunction(()=>document.querySelector('#fu-end-round').textContent==='已归营');assert(await page.locator('#fu-end-round').isDisabled());assert.equal(await page.locator('#fu-crisis strong').innerText(),'0');assert((await page.locator('#suggestions').innerText()).includes('怎样告诉陛下'));assert((await page.locator('#fu-network').innerText()).includes('已归营'));assert((await page.locator('.place.army-fu small').innerText()).includes('接应营'));await page.locator('#reset').click();await page.locator('#confirm-new-fu').click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('yiling-fu-runtime-v1')).history.length===2);await page.waitForFunction(()=>document.querySelector('#log').textContent.includes('吴人说'));assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('yiling-fu-runtime-v1')).history.length),2);assert(await page.evaluate(()=>JSON.parse(localStorage.getItem('yiling-ui-prototype-v1')).logs.some(x=>x.id===999)));
 });
 await check('傅肜专用岗位可复诵，军令入列而不立即推进；小屏可输入并查看危机',async()=>{
  await page.locator('#mode-toggle').click();await page.locator('#order-unit').selectOption('甲');await page.locator('#draft').fill('甲队出动100人，探查撤路，绕行南侧路。');await page.locator('#send').click();assert.equal(await page.locator('.roster-row').count(),4);assert.equal(await page.locator('#command-panel #preview').count(),0);assert((await page.locator('#preview').innerText()).includes('探查撤路'));await page.locator('#send').click();await page.waitForFunction(()=>document.querySelector('#log').textContent.includes('军令已收'));assert.equal(s.pendingOrders[0].action,'scout');assert.equal(s.round,0);assert.equal(s.units.甲.status,'营中待命');await page.setViewportSize({width:1280,height:720});await page.waitForTimeout(150);assert(await page.locator('.composer').evaluate(e=>e.getBoundingClientRect().bottom<=e.closest('.conversation').getBoundingClientRect().bottom));await page.screenshot({path:fileURLToPath(new URL('compact-dispatch.png',dir))});await page.setViewportSize({width:390,height:844});assert(await page.locator('#command-panel').isHidden());assert(await page.locator('#draft').isVisible());assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:fileURLToPath(new URL('mobile.png',dir)),fullPage:true});await page.locator('#mode-toggle').click();assert.equal(await page.locator('#mode-toggle').getAttribute('aria-pressed'),'false');assert(await page.locator('#command-panel').isHidden());await page.locator('#mode-toggle').click();assert(await page.locator('#command-panel').isHidden());await page.locator('#open-situation').click();assert(await page.locator('#command-panel').isVisible());assert(await page.locator('#fu-crisis').isVisible());const end=await page.locator('#fu-end-round').boundingBox();assert(end.y>=0&&end.y+end.height<=844);await page.screenshot({path:fileURLToPath(new URL('mobile-crisis.png',dir)),fullPage:true});
 });
 assert.deepEqual(errors,[]);await writeFile(new URL('verification.json',dir),JSON.stringify({passed,errors,scope:'前端受控API契约验证，不代表真实模型或概率数值验收'},null,2));
}finally{await browser.close();}
