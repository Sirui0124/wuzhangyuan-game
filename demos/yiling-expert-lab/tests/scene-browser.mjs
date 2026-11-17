import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from '../server.mjs';
import {createSceneServer} from '../scene-server.mjs';

const output=new URL('../../../outputs/yiling-scene-integration-20261106/',import.meta.url);
await mkdir(output,{recursive:true});
const out=name=>fileURLToPath(new URL(name,output));
const checks=[],errors=[],badResponses=[];
const backend=createServer({config:async()=>({apiKey:'test'}),model:async(_,input)=>{
 const c=JSON.parse(input.text);if(c.question==='测试断线')throw Error('测试连接失败');
 return {text:JSON.stringify({reply:'我出山口时，傅将军还守着后阵。前队已到营的消息尚未送回，可以随接替的人一道带去。',kind:'answer',factsUsed:['fact-1']})};
}});
await new Promise(r=>backend.listen(0,'127.0.0.1',r));
const server=createSceneServer({backend:`http://127.0.0.1:${backend.address().port}`});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome',headless:true});
let page,sizes;
try{
 page=await browser.newPage({viewport:{width:1600,height:1000},reducedMotion:'reduce'});
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&!r.url().includes('/api/action'))badResponses.push(r.url()+':'+r.status());});
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.waitForFunction(()=>document.querySelector('#troops').textContent.includes('可调 5队'));
 const world=()=>page.evaluate(async()=>{const {storyId}=JSON.parse(sessionStorage.getItem('yiling-story-campaign-session-v1'));return (await (await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({storyId,action:'story-tick'})})).json()).world;});
 const view=async key=>{await page.locator(`#view-nav [data-view=${key}]`).click();await page.waitForFunction(k=>document.querySelector('#scene-stage').dataset.view===k&&document.querySelector('#scene-stage').getAttribute('aria-busy')==='false',key);};
 const route=id=>page.locator(`#route-cards [data-route=${id}]`);
 const readIntro=async()=>{for(let i=0;i<25&&await page.locator('#next').isVisible();i++){await page.locator('#next').click();await page.waitForFunction(()=>!document.querySelector('#next').disabled);}};
 const choose=async()=>{await page.locator('#choices-show').click();await page.locator('#options button').first().click();await page.locator('#review').waitFor({state:'visible'});};
 const dispatch=async()=>{await page.locator('#execute').click();await page.locator('#event').waitFor({state:'hidden'});};
 const until=async(predicate)=>{const end=Date.now()+35000;while(Date.now()<end){const w=await world();if(predicate(w))return w;await new Promise(r=>setTimeout(r,200));}throw Error('等待接应状态超时');};
 const noOverflow=async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.equal((await world()).clock,0);assert.equal((await world()).availableSquads,5);
 assert.equal(await page.locator('#route-cards button').count(),4);await noOverflow();
 await page.screenshot({path:out('camp-desktop.png'),fullPage:true});
 for(const key of ['river','east','south','imperial','overview']){await view(key);assert.equal(await page.locator(key==='overview'?'#overview-map>img':'#landscape').evaluate(i=>i.naturalWidth),1672);await page.screenshot({path:out(`${key}-desktop.png`),fullPage:true});}
 assert.equal((await world()).clock,0);assert.equal((await world()).availableSquads,5);assert.equal(await page.locator('#report-notice').textContent(),'可先听报，再定安排。');
 checks.push('六张原尺寸精修场景载入；四路入口常驻；看场景不发令、不制造回报');
 await page.locator('#map-labels [data-scene=fu]').focus();await page.waitForTimeout(1100);assert.equal(await page.evaluate(()=>document.activeElement.dataset.scene),'fu');
 await page.locator('#map-labels [data-scene=fu]').press('Enter');await page.locator('#event').waitFor({state:'visible'});assert.equal(await page.locator('#scene-image').getAttribute('src'),'/art/scenes/camp.webp');
 const first=await page.locator('#spoken').innerText();await page.keyboard.press('Escape');await page.locator('#event').waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>document.activeElement.dataset.scene),'fu');
 assert.equal(await page.locator('#scene-stage').getAttribute('data-view'),'overview');assert.equal((await world()).paused,true);
 await view('camp');await page.locator('#view-nav [data-view=camp]').press('ArrowRight');await page.waitForFunction(()=>document.querySelector('#scene-stage').dataset.view==='river');
 await page.locator('#toggle-labels').click();assert.equal(await page.locator('#toggle-labels').getAttribute('aria-pressed'),'false');
 await page.reload();await page.waitForFunction(()=>document.querySelector('#troops').textContent.includes('可调 5队'));assert.equal(await page.locator('#scene-stage').getAttribute('data-view'),'river');assert.equal(await page.locator('#toggle-labels').getAttribute('aria-pressed'),'false');
 await page.locator('#toggle-labels').click();await page.locator('#fullscreen').click();assert.equal(await page.evaluate(()=>!!document.fullscreenElement),true);assert.ok(await page.locator('#view-nav').evaluate(e=>e.getBoundingClientRect().bottom<=innerHeight));await page.locator('#fullscreen').click();
 checks.push('地图键盘焦点不随轮询丢失；方向键、Esc返回、标记开关、全屏和刷新视角恢复正常');
 await route('fu').click();assert.equal(await page.locator('#spoken').innerText(),first);assert.equal(await page.locator('#camp-interface').evaluate(e=>e.inert),true);
 await page.locator('#close-event').press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'next');
 await page.screenshot({path:out('fu-dialogue.png'),fullPage:true});
 const oldText=await page.locator('#spoken').textContent();await page.locator('#hero').click({position:{x:350,y:110}});assert.notEqual(await page.locator('#spoken').textContent(),oldText);await readIntro();
 const before=await world();await page.locator('#question').fill('测试断线');await page.locator('#ask').click();await page.waitForFunction(()=>document.querySelector('#event-message').textContent.includes('测试连接失败'));assert.equal(await page.locator('#question').inputValue(),'测试断线');assert.equal((await world()).routes.fu.questionCount,0);
 for(const text of ['他知道前队回营了吗？','接替的人怎样撤？']){await page.locator('#question').fill(text);const response=page.waitForResponse(r=>r.url().endsWith('/api/action')&&r.request().postData()?.includes('story-ask'));await page.locator('#ask').click();assert.equal((await response).status(),200);await page.waitForFunction(()=>!document.querySelector('#ask').disabled);}
 assert.equal((await world()).clock,before.clock);assert.equal((await world()).availableSquads,5);assert.equal(await page.locator('#ask-box').isVisible(),false);
 await page.locator('#choices-show').click();await page.screenshot({path:out('fu-choice.png'),fullPage:true});
 sizes=await page.evaluate(()=>({dialogue:getComputedStyle(document.querySelector('#spoken')).fontSize,speaker:getComputedStyle(document.querySelector('#speaker')).fontSize,choice:getComputedStyle(document.querySelector('.options strong')).fontSize,nav:getComputedStyle(document.querySelector('#close-event')).fontSize}));
 assert.equal(sizes.dialogue,'24px');assert.equal(sizes.speaker,'22px');assert.equal(sizes.choice,'20px');assert.equal(sizes.nav,'16px');
 await page.locator('#options button').first().click();await page.locator('#review').waitFor({state:'visible'});assert.equal((await world()).availableSquads,5);await dispatch();assert.equal((await world()).availableSquads,4);await page.locator('#speed').click();
 checks.push('营中听报与屏幕点击续读；问讯失败留稿；两问不走时、不派兵；提案需确认；对白24/说话人22/选项20/导航16px');
 await route('cheng').click();await readIntro();await choose();await dispatch();
 await route('huang').click();await readIntro();await choose();await page.locator('#execute').click();await page.waitForFunction(()=>document.querySelector('#event-message').textContent.includes('船队正在另一路'));assert.equal((await world()).availableSquads,3);assert.equal((await world()).routes.huang.status,'camp');await page.locator('#close-event').click();assert.equal((await world()).paused,true);
 await route('sha').click();await readIntro();await choose();await dispatch();await until(w=>w.routes.cheng.status==='done'&&w.routes.fu.status==='done'&&w.routes.sha.status==='done');assert.equal((await world()).saved,3);
 await page.waitForFunction(()=>document.querySelector('#report-notice').textContent.includes('新回报'));await view('overview');await page.screenshot({path:out('actual-reports.png'),fullPage:true});
 await route('huang').click();await dispatch();await until(w=>w.routes.huang.status==='report');let w=await world();assert.equal(w.saved,3);assert.equal(w.paused,true);assert.equal(w.boats,1);assert.equal(w.availableSquads,5);
 await route('huang').click();await page.screenshot({path:out('huang-contact.png'),fullPage:true});await readIntro();w=await world();assert.equal(w.routes.huang.stageId,'transport');assert.equal(w.saved,3);
 await choose();await dispatch();await until(w=>w.saved===4);await page.locator('#finish').waitFor({state:'visible'});assert.equal((await world()).availableSquads,5);assert.equal((await world()).boats,1);
 for(const id of ['fu','cheng','sha','huang']){await route(id).click();assert.ok((await page.locator('#spoken').innerText()).length>0);await readIntro();}
 await page.waitForFunction(()=>document.querySelector('#report-notice').textContent.includes('四路人员已归营'));
 checks.push('船队冲突反馈；黄权联络不计获救、读报后二次渡运；四路五次调遣完结；实际回报与资源释放一致');
 await view('imperial');await page.reload();await page.waitForFunction(()=>document.querySelector('#finish').hidden===false);assert.equal((await world()).saved,4);assert.equal((await world()).paused,true);assert.equal(await page.locator('#scene-stage').getAttribute('data-view'),'imperial');
 await page.setViewportSize({width:390,height:844});await view('overview');await noOverflow();await page.screenshot({path:out('mobile-overview.png'),fullPage:true});
 await route('cheng').click();await noOverflow();assert.equal(await page.locator('#spoken').evaluate(e=>getComputedStyle(e).fontSize),'24px');assert.equal(await page.locator('#close-event').evaluate(e=>getComputedStyle(e).fontSize),'16px');await page.screenshot({path:out('mobile-dialogue.png'),fullPage:true});
 await page.locator('#close-event').click();await page.setViewportSize({width:1280,height:720});await view('camp');await noOverflow();await page.screenshot({path:out('laptop-camp.png'),fullPage:true});
 checks.push('完成后刷新保持结果并暂停；390px与1280×720布局无横向溢出；窄屏对白保持24px');
 // Simulate one missing full-size scene, then verify retry recovers the same view without an order.
 const failure=await browser.newPage({viewport:{width:1280,height:900}});failure.on('pageerror',e=>errors.push(e.message));
 await failure.route('**/art/scenes/east.webp',r=>r.abort());await failure.goto(`http://127.0.0.1:${server.address().port}`);await failure.waitForFunction(()=>document.querySelector('#troops').textContent.includes('可调 5队'));await failure.locator('#view-nav [data-view=east]').click();await failure.locator('#scene-error').waitFor({state:'visible'});assert.equal(await failure.locator('#scene-stage').getAttribute('data-view'),'camp');
 await failure.unroute('**/art/scenes/east.webp');await failure.locator('#retry-scene').click();await failure.waitForFunction(()=>document.querySelector('#scene-stage').dataset.view==='east');assert.equal(await failure.locator('#scene-error').isVisible(),false);await failure.close();checks.push('图片加载失败保留原视角，重试后恢复');
 assert.deepEqual(errors,[]);assert.deepEqual(badResponses,[]);
 const provenance=JSON.parse(await readFile(new URL('../public/art/scenes/provenance.json',import.meta.url),'utf8'));
 await writeFile(out('verification.json'),JSON.stringify({date:'2026-11-06',passed:true,scope:'Scene frontend with actual story engine and mocked AI for repeatable UI checks. Not a new real-model review.',checks,errors,badResponses,sizes,art:provenance.entries.map(e=>({view:e.view,bytes:e.bytes,imageSize:e.imageSize})),newUIUserReview:'pending'},null,2));
 console.log(JSON.stringify({passed:true,checks,errors,badResponses,sizes}));
}catch(e){await writeFile(out('browser-failure.txt'),e.stack);if(page)await page.screenshot({path:out('browser-failure.png'),fullPage:true}).catch(()=>{});throw e;}
finally{await browser.close();await new Promise(r=>server.close(r));await new Promise(r=>backend.close(r));}
