import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile,mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createStaticServer} from '../../../GameStarter/web-demo/serve.mjs';
import {publishCommandMap} from '../publish.mjs';
import {fresh} from '../campaign-engine.mjs';
const workspace=fileURLToPath(new URL('../../../',import.meta.url));
const out=resolve(workspace,'outputs/eight-front-events-browser-20261118');await mkdir(out,{recursive:true});
publishCommandMap(resolve(workspace,'GameStarter/web-demo/.build'));
const directory=await mkdtemp(join(tmpdir(),'wzy-eight-ui-'));
const routeModel=async({input})=>input.classification?{replies:[{speaker:input.authority.availableSpeakers[0],text:'收到。同行的人还要照应，接应消息以眼前回报为准。'}],claims:{status:input.authority.status,searchVerified:input.authority.searchVerified,planAccepted:input.authority.planAccepted,stages:input.authority.stages.map(({id,status})=>({id,status})),...(input.authority.knowledge?{knowledge:input.authority.knowledge}:{}),...(input.authority.crisis?{crisis:input.authority.crisis}:{})},factRefs:['status']}:{outcome:'DIALOGUE_ONLY',checks:{waitForVerifiedSearch:false,rearEscort:false,keepCover:false},quotes:[]};
const server=createStaticServer({commandOptions:{directory,routeModel,reportModel:false,eventModel:false}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:'msedge',headless:true}),checks=[],errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});page.on('pageerror',e=>errors.push(e.message));
 const saveKey='yiling-command-chapter-v1';
 await page.goto(origin+'/?chapter=yiling');
 await page.locator('[data-cinema-action=skip]').click();
 const commandFrame=await page.locator('iframe').elementHandle();
 assert.match(await commandFrame.getAttribute('src'),/\/yiling-command\/.*chapter=yiling/);
 const frame=await commandFrame.contentFrame();
 await frame.locator('.map-first .army-sha.unread').waitFor();
 assert.equal(await frame.locator('.front-alert').count(),3);
 assert.equal(await frame.locator('.front-urgency,.army-marker small').count(),0);
 assert.equal(await frame.locator('.work').isVisible(),false);
 await page.screenshot({path:join(out,'first-three-routes.png')});
 assert.equal(await frame.locator('#contacts button').count(),0);
 assert.equal(await frame.locator('#fu-end-round').isDisabled(),true);
 const marker=id=>frame.locator('#places [data-front='+id+']');
 const film=frame.locator('#story-film video');
 const reading=frame.locator('#story-reading');
 async function readStory(id){
  await marker(id).click();
  await reading.waitFor();
  assert.match(await frame.locator('#story-crisis').innerText(),/危机度 \d+/);
  for(const field of ['history','text','current'])assert.ok((await frame.locator('#story-'+field).innerText()).length>0);
  await frame.locator('#story-image').evaluate(image=>image.decode());
 }
 await page.setViewportSize({width:390,height:667});
 await readStory('fu');
 assert.equal(await film.count(),0);
 await frame.locator('#close-story').click();
 assert.deepEqual(await frame.locator('#contacts button').evaluateAll(list=>list.map(b=>b.dataset.front)),['fu']);
 assert.equal(await frame.locator('.front-alert').count(),2);
 assert.equal(await frame.locator('[data-urgency=fu]').isVisible(),true);
 assert.equal(await frame.locator('#fu-end-round').isEnabled(),true);
 assert.ok(await frame.locator('#log').evaluate(log=>log.clientHeight>=40));
 for(const id of ['camp','sha']){
  assert.ok(await marker(id).locator('.front-alert').evaluate(el=>{
   const b=el.getBoundingClientRect();
   return document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)?.closest('button')===el.closest('button');
  }),id+' unread alert must remain reachable');
 }
 await page.screenshot({path:join(out,'first-contact-mobile.png')});
 await page.setViewportSize({width:1440,height:900});
 await readStory('camp');
 await frame.locator('#close-story').click();
 await marker('sha').click();
 await film.waitFor();
 assert.equal(await reading.isHidden(),true);
 await frame.waitForFunction(()=>document.fullscreenElement?.id==='story-film');
 assert.ok(await film.evaluate(v=>v.offsetWidth===innerWidth && v.offsetHeight===innerHeight));
 await film.evaluate(video=>video.pause());
 await page.waitForFunction(()=>Object.keys(localStorage).some(key=>key.startsWith('wzy-film-focus:')));
 await frame.locator('#story-skip').click();
 await reading.waitFor();
 await frame.waitForFunction(()=>!document.fullscreenElement);
 await page.waitForFunction(()=>!Object.keys(localStorage).some(key=>key.startsWith('wzy-film-focus:')));
 await frame.locator('#close-story').click();
 await readStory('sha');
 assert.equal(await film.count(),0);
 assert.equal(await frame.locator('#story-replay').isVisible(),true);
 // An embedded browser may deny native fullscreen. Replay must still fill its viewport.
 await frame.evaluate(()=>Object.defineProperty(document,'fullscreenEnabled',{value:false,configurable:true}));
 await frame.locator('#story-replay').click();
 assert.ok(await film.evaluate(v=>{
  const b=v.getBoundingClientRect();
  return !document.fullscreenElement && b.x===0 && b.y===0 && b.width===innerWidth && b.height===innerHeight;
 }));
 await film.evaluate(async video=>{
  if(!Number.isFinite(video.duration))await new Promise((resolve,reject)=>{
   video.addEventListener('loadedmetadata',resolve,{once:true});
   video.addEventListener('error',reject,{once:true});
  });
  video.currentTime=video.duration-.3;
  await video.play();
 });
 await reading.waitFor();
 await frame.evaluate(()=>delete document.fullscreenEnabled);
 await page.route('**/CH04-shamoke-v4-20261119.mp4',route=>route.abort());
 await frame.locator('#story-replay').click();
 await reading.waitFor();
 await page.unroute('**/CH04-shamoke-v4-20261119.mp4');
 await frame.locator('#story-talk').click();
 await frame.locator('#contacts [data-front=sha]').waitFor();
 const initialId=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).id,saveKey);
 assert.equal(await page.evaluate(()=>localStorage.getItem('yiling-shared-campaign-v1')),null);
 const initialResponse=await page.request.post(origin+'/api/yiling-command/session',{data:{scenarioId:initialId}});
 const untouched=(await initialResponse.json()).session;
 assert.equal(untouched.revision,0);
 assert.equal(untouched.round,0);
 assert.equal(untouched.reserve,2000);
 checks.push('开局三处仅有名字和叹号。点开一路即出现该路危机和对话选项。沙摩柯初访原生全屏，重访显示图文，可以重播。暂停保留声音占用，跳过、播完或加载失败均回到图文');
 // Run the wider campaign regression against the same isolated save.
 const board=page.frameLocator('iframe');
 await page.reload();
 await board.locator('.roster-row').waitFor();
 const id=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).id,saveKey);
 const session=async()=>{const r=await page.request.post(origin+'/api/yiling-command/session',{data:{scenarioId:id}});assert.equal(r.status(),200);return(await r.json()).session;};
 async function rejected(path,payload){const before=await session(),r=await page.request.post(origin+'/api/yiling-command/'+path,{data:{scenarioId:id,requestId:crypto.randomUUID(),expectedRevision:before.revision,...payload}});assert.equal(r.status(),400);assert.match((await r.json()).error,/尚未|未收到|未开放/);assert.equal((await session()).revision,before.revision);}
 assert.equal(await board.locator('#contacts button').count(),3);assert.equal((await session()).roundLimit,8);const initial=await session();assert.match(initial.routeVersion,/v4$/);
 function assessmentCheck(s){for(const f of Object.values(s.fronts)){for(const key of ['progress','work','executions'])assert.equal(Object.hasOwn(f,key),false,'v4 must not expose '+key);if(f.status==='locked')continue;assert.equal(f.urgency,f.assessment.urgency);assert.equal(typeof f.assessment.eligible,'boolean');assert.ok(Array.isArray(f.assessment.reasons));assert.ok(Number.isFinite(f.assessment.probability));for(const stage of f.stages||[]){assert.equal(Object.hasOwn(stage,'progress'),false);assert.equal(Object.hasOwn(stage,'work'),false);assert.equal(stage.urgency,stage.assessment.urgency);if(stage.status!=='holding')assert.equal(stage.urgency,0);}}}
 assessmentCheck(initial);
 await rejected('chat',{front:'huang',text:'请报军情。'});await rejected('orders',{orders:[{unit:'new',target:'ma',action:'rescue',men:100,rush:true,via:'normal'}]});checks.push('未开放路线问话与军令被拒绝，版本未变');
 async function dispatch(text){if(await board.locator('#mode-toggle').getAttribute('aria-pressed')==='false')await board.locator('#mode-toggle').click();await board.locator('#order-unit').selectOption('auto');await board.locator('#order-target').selectOption('auto');await board.locator('#draft').fill(text);await board.locator('#send').click();await board.locator('#preview').waitFor({state:'visible'});await board.locator('#send').click();await board.locator('#preview').waitFor({state:'hidden'});assert.equal(await board.locator('#feedback').innerText(),'');}
 async function end(n){await board.locator('#fu-end-round').click();await board.locator('#round-report').waitFor({state:'visible'});assert.match(await board.locator('#round-report-title').innerText(),new RegExp(`第${n}轮`));const snapshot=await session();assessmentCheck(snapshot);for(const f of snapshot.lastReport.fronts){assert.equal(f.after,snapshot.fronts[f.id].urgency);for(const stage of f.stages||[]){const saved=snapshot.fronts[f.id].stages.find(x=>x.id===stage.id);assert.equal(stage.urgency,saved.urgency);assert.match(await board.locator('[data-report-front='+f.id+']').innerText(),new RegExp('危机 '+stage.urgency));}}await board.locator('#round-report button').click();for(const [id,f]of Object.entries(snapshot.fronts))if(f.status==='holding'){const contact=board.locator('#contacts [data-front='+id+']');const urgency=board.locator('[data-urgency='+id+'] strong');if(await contact.count())assert.equal(await urgency.innerText(),String(f.urgency));else assert.equal(await urgency.count(),0);}}
 async function chat(front){
  if(!await board.locator('#contacts [data-front='+front+']').count()){
   await board.locator('#places .unread[data-front='+front+']').click();
   await board.locator('#close-story').click();
  }
  await board.locator('#contacts [data-front='+front+']').click();await board.locator('#draft').fill('现在情况怎样？');await board.locator('#send').click();await board.locator('#log .entry').last().filter({hasText:'同行的人'}).waitFor();}
 await end(1);const eventState=await session();assert.ok(eventState.crisisEvents?.length);const eventText=await readFile(join(directory,id+'.json'),'utf8');const eventHistory=structuredClone(eventState.crisisEvents);await page.reload();await board.locator('.roster-row').waitFor();assert.deepEqual((await session()).crisisEvents,eventHistory);assert.equal(await readFile(join(directory,id+'.json'),'utf8'),eventText);await board.locator('#review-round').click();for(const event of eventHistory)assert.ok((await board.locator('#round-report-body').innerText()).includes(event.text),'persisted event text must appear in report');await page.screenshot({path:join(out,'persisted-events.png')});await board.locator('#round-report button').click();checks.push('无人有效响应的事件实际结算并持久化，刷新及重看不重抽且正文保留');await end(2);assert.ok((await session()).fronts.sha.urgency>=initial.fronts.sha.urgency);checks.push('v4无progress/work/executions，高危无响应危机不下降，军报/地图/assessment数值一致');
 assert.equal(await board.locator('#contacts button').count(),3);assert.equal(await board.locator('.front-alert').count(),2);assert.equal(await board.locator('#order-target option').count(),6);await chat('ma');assert.equal((await session()).fronts.ma.located,false);checks.push('第二轮结报后马良、程畿开放，问话不授予实地找到');
 await dispatch('甲队接应马良，急行军；派400人接应程畿，急行军');await end(3);
 let current=await session();assert.ok(current.fronts.ma.located);assert.ok(current.messages.some(m=>m.front==='cheng'&&/接应船/.test(m.text)));await chat('cheng');await end(4);
 assert.equal(await board.locator('#contacts button').count(),5);assert.equal(await board.locator('.front-alert').count(),3);assert.equal(await board.locator('#order-target option').count(),9);checks.push('第四轮结报后杜路刘宁、王甫、黄权开放，早期实地接应正确');
 for(const id of ['ma','cheng','du','wang','huang']){
  await board.locator('#places [data-front='+id+']').click();
  await board.locator('#story-reading').waitFor();
  assert.equal(await board.locator('#story-film video').count(),0);
  assert.match(await board.locator('#story-crisis').innerText(),/危机度 \d+/);
  for(const field of ['history','text','current'])assert.ok((await board.locator('#story-'+field).innerText()).length>0);
  await board.locator('#story-image').evaluate(image=>image.decode());
  await board.locator('#close-story').click();
 }
 assert.equal(await board.locator('#contacts button').count(),8);
 checks.push('随轮次出现的五路均可由地图点位查看图文与实时危机度');
 await chat('huang');await dispatch('派600人渡运黄权，急行军；派300人接应杜路刘宁，急行军；派200人接应王甫，急行军');await end(5);current=await session();assert.ok(current.messages.some(m=>m.front==='huang'&&/渡运|渡口/.test(m.text)));assert.ok(current.fronts.du.notified);assert.ok(current.fronts.wang.located);
 for(const [width,height] of [[1440,900],[1280,600],[800,450],[390,667]]){await page.setViewportSize({width,height});await page.waitForTimeout(80);for(const id of ['#draft','#send','#fu-end-round']){const b=await board.locator(id).boundingBox();assert.ok(b&&b.y>=0&&b.y+b.height<=height+1,`${width}x${height} clips ${id}`);}assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:join(out,`layout-${width}.png`)});checks.push(`${width}×${height}八路输入和结束本轮完整显示`);}
 await page.setViewportSize({width:1440,height:900});await end(6);await end(7);await end(8);current=await session();assert.equal(current.round,8);assert.equal(current.ended,true);assert.equal(current.endReason,'deadline');assert.equal(current.fronts.sha.status,'holding');assert.equal(await board.locator('#fu-end-round').isDisabled(),true);
 const ending=board.locator('#ending-report[open]');
 await ending.waitFor();
 assert.equal(await ending.getByRole('tab').count(),9);
 await ending.locator('[data-ending-step="1"]').click();
 assert.match(await ending.locator('[data-ending-count]').innerText(),/^02/);
 await ending.locator('[data-ending-close]').click();
 await board.locator('#review-round').click();assert.equal(await board.locator('.crisis-row').count(),8);assert.match(await board.locator('.report-end').innerText(),/十六时辰/);for(const [id,f]of Object.entries(current.fronts)){const row=board.locator('.crisis-row').filter({hasText:({sha:'沙摩柯',camp:'冯习',fu:'傅肜',ma:'马良',cheng:'程畿',du:'杜路',wang:'王甫',huang:'黄权'})[id]});if(f.status==='safe')assert.match(await row.innerText(),/已脱险 · 返程中/);if(f.status==='holding')assert.match(await row.innerText(),/尚未撤出|仍受困|尚未脱险/);}assert.doesNotMatch(await board.locator('.report-end').innerText(),/八路人员均已脱险/);checks.push('截止按真实safe/home/holding分别展示，未完成路线不误报全救');await page.screenshot({path:join(out,'eight-route-report-desktop.png')});
 await page.setViewportSize({width:390,height:667});await board.locator('#round-report').evaluate(el=>{el.scrollTop=el.scrollHeight;});assert.ok(await board.locator('#round-report').evaluate(el=>el.scrollTop>0));await board.locator('#round-report button').scrollIntoViewIfNeeded();const bottom=await board.locator('#round-report button').boundingBox();assert.ok(bottom&&bottom.y>=0&&bottom.y+bottom.height<=667);await page.screenshot({path:join(out,'eight-route-report-mobile-bottom.png')});await board.locator('#round-report button').click();checks.push('第八轮按实际状态截止，八路军报可滚动且阅毕按钮可达');assert.deepEqual(errors,[]);
 await page.waitForFunction(id=>{
  const result=JSON.parse(localStorage.getItem('wzy:chapter-results:v1')||'{}').yiling;
  return result?.status==='completed'&&result.source.startsWith('yiling-command:'+id+':');
 },id);
 const formalResult=await page.evaluate(()=>JSON.parse(localStorage.getItem('wzy:chapter-results:v1')).yiling);
 assert.equal(formalResult.ending,'eight-front-deadline');
 checks.push('正式入口结算写入第四章经历，按本局回报记录去向');
 const legacy=fresh({seed:123,rules:'eight-v3'});assert.match(legacy.routeVersion,/v3$/);const legacyPath=join(directory,legacy.scenarioId+'.json'),legacyText=JSON.stringify(legacy);await writeFile(legacyPath,legacyText);await page.evaluate(legacyId=>localStorage.setItem('yiling-shared-campaign-v1',JSON.stringify({id:legacyId,history:[legacyId]})),legacy.scenarioId);
 for(const query of ['', '?campaign=1', '?campaign=1&chapter=yiling']){
  await page.goto(origin+'/yiling-command/index.html'+query);await page.waitForURL(/\/?\?chapter=yiling/);await page.frameLocator('iframe').locator('.roster-row').first().waitFor();
  const formalId=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).id,saveKey);const formalResponse=await page.request.post(origin+'/api/yiling-command/session',{data:{scenarioId:formalId}});assert.match((await formalResponse.json()).session.routeVersion,/v4$/);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('yiling-shared-campaign-v1')).id),legacy.scenarioId);assert.equal(await readFile(legacyPath,'utf8'),legacyText);
 }
 checks.push('发布版直接访问军图的三种地址均进入正式章节；旧v3指针与文件保留，正式局仍为v4');
 await writeFile(join(out,'checks.json'),JSON.stringify({scope:'actual v4 crisis/events engine in isolated temporary save; controlled route AI; not a full-rescue balance test',checks,errors,final:{round:current.round,status:Object.fromEntries(Object.entries(current.fronts).map(([f,r])=>[f,r.status]))}},null,2));console.log(checks);
}finally{await browser.close();await new Promise(r=>server.close(r));}
