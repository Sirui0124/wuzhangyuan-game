import {chromium} from 'playwright';
import {createStaticServer} from '../../GameStarter/web-demo/serve.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const out='outputs/video-integration-20261025',root=resolve(out,'build');
const {GrainSession}=await import(pathToFileURL(root+'/GameStarter/web-demo/src/chapters/chapter-two/session.js'));
const {parseJudgment}=await import(pathToFileURL(root+'/GameStarter/web-demo/src/chapters/chapter-two/open-dialogue.js'));
const story=JSON.parse(readFileSync(root+'/story/chapter-two.films.json')),rubric=JSON.parse(readFileSync(root+'/story/chapter-two.films-rubric.json'));
const input='你先停手，我陪你把实情和各人责任如实报上去，但不保证免责。';
const response={valid:true,scores:Object.fromEntries(['trust','rigor','responsibility'].map(k=>[k,{delta:2,quote:input,reason:'接口测试'}]))};
function saveAt(id){
 const s=new GrainSession(story,undefined,rubric,false);
 for(let i=0;i<180&&s.current.id!==id;i++){
  if(s.current.kind==='open')s.submit(parseJudgment(JSON.stringify(response),input,s.currentRubric));
  assert.ok(s.advance(s.current.options?.[0]?.id));
 }
 assert.equal(s.current.id,id);return s.state;
}
const server=createStaticServer({root});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,channel:'chrome'});
try{
 const results=[];
 for(const [id,cancel] of [['CH2-LY03-018',true],['CH2-O2-INPUT',false]]){
  const context=await browser.newContext({viewport:{width:1366,height:768}}),page=await context.newPage();let requests=0;
  await page.addInitScript(({state})=>{localStorage.setItem('wuzhang-runtime-mode-v1','ai');localStorage.setItem('grain-chapter-two-films-v1',JSON.stringify(state));},{state:saveAt(id)});
  await page.route('**/health',r=>r.fulfill({json:{configured:true}}));
  await page.route('**/api/game/respond',async r=>{
   requests++;const prompt=r.request().postDataJSON().text;
   assert.ok(prompt.includes(cancel?'尚未核实真实缺粮原因':'第二次交谈'));
   if(cancel){await r.abort();return;}
   await r.fulfill({json:{text:JSON.stringify(response)}});
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/?chapter=grain`);
  await page.locator('#player-expression').fill(input);assert.equal(requests,0);assert.equal(await page.locator('.grain-listener').count(),0);
  if(cancel){
   // Hold the response so cancellation is tested while the listener is mounted.
   await page.unroute('**/api/game/respond');await page.route('**/api/game/respond',r=>{requests++;return new Promise(resolve=>{setTimeout(()=>{void r.abort().catch(()=>{});resolve();},1200);});});
  }
  await page.locator('[data-action=speak]').click();await page.locator('.grain-listener video').waitFor();
  const v=page.locator('.grain-listener video');assert.equal(await v.evaluate(v=>v.loop),false);assert.equal(await v.evaluate(v=>v.muted),true);
  if(cancel){await page.locator('.grain-listener [data-action=cancel-speech]').click();await page.waitForTimeout(1500);assert.equal(await page.locator('#player-expression').inputValue(),input);assert.equal(await page.locator('.grain-listener').count(),0);}
  else{await page.locator('#spoken-line').waitFor({timeout:25000});assert.equal(await page.locator('#game-root').getAttribute('data-node'),id);assert.match(await page.locator('#spoken-line').innerText(),/接下来怎么做，你来定/);await page.screenshot({path:out+'/browser/o2-after-listener.png'});await page.locator('[data-action=next]').first().click();assert.equal(await page.locator('#game-root').getAttribute('data-node'),'UI-N5');}
  results.push({id,cancel,requests,passed:true});await context.close();
 }
 writeFileSync(out+'/browser/listener-results.json',JSON.stringify({passed:true,results,model:'mocked; no live API calls'},null,2));console.log(JSON.stringify(results));
}finally{await browser.close();await new Promise(r=>server.close(r));}
