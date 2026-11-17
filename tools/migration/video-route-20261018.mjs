import {chromium} from 'playwright';
import {createStaticServer} from '../../GameStarter/web-demo/serve.mjs';
import {chapter,NarrativeEngine,preset,tutorialInput} from '../../GameStarter/tests/narrative/weiyan-fixture.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const version=JSON.parse(readFileSync('GameStarter/web-demo/.build/story/manifest.json')).contentVersion;
const engine=new NarrativeEngine(chapter,version,preset);tutorialInput(engine);
const save=engine.save();
const server=createStaticServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`,report={passed:false,mockedAI:true,errors:[]};let browser,page;
try{
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
 page=await browser.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 await page.route('**/api/game/respond',async route=>{
  const data=JSON.parse(route.request().postDataJSON().text);
  const text=data.kind==='classify'?JSON.stringify({requestId:data.requestId,choice:'WAIT_OUTSIDE',reason:'本地播放路由测试'}):JSON.stringify({'决策分类':'帐外等候','回应的话':data.immutableAnchor});
  await route.fulfill({json:{text},headers:{'Access-Control-Allow-Origin':'*'}});
 });
 await page.goto(base);
 await page.evaluate(save=>localStorage.setItem('wuzhang-white-demo-v1',JSON.stringify({save,savedAt:new Date().toISOString()})),save);
 await page.goto(base+'/?play=1');
 await page.locator('[data-action=open-composer]').click();
 await page.locator('#draft').fill('我现在去帐门传报，请将军稍候。');
 await page.locator('[data-action=submit]').click();
 await page.locator('.dialogue').waitFor();
 await page.waitForFunction(()=>!document.querySelector('[data-action=cancel-response]'));
 for(let n=0;n<18;n++){
  if(await page.locator('[data-cinematic=accountability]').count())break;
  await page.locator('.dialogue').click();
 }
 await page.locator('[data-cinematic=accountability]').waitFor();
 report.accountabilitySrc=await page.locator('video').getAttribute('src');
 assert.match(report.accountabilitySrc,/EN02B-A-accountability/);
 await page.locator('[data-action=continue-teaching]').waitFor({timeout:40000});
 assert.equal(await page.locator('#ending-title').innerText(),'这一次，你死了');
 report.death=JSON.parse(JSON.parse(await page.evaluate(()=>localStorage.getItem('wuzhang-white-demo-v1'))).save).flags['loop.result'];
 assert.equal(report.death,'tutorial_execution');
 assert.equal(await page.locator('[data-campaign=video]').count(),0);
 await page.locator('[data-action=continue-teaching]').click();
 await page.getByText('你又站在告示前。告示旁多了两名小兵：守帐卒甲守着帐门，传令卒乙正整理文书。',{exact:true}).waitFor();
 // The existing save policy commits only after the revival narration is confirmed.
 for(let n=0;n<12 && await page.locator('.dialogue .speech').count();n++) await page.locator('.dialogue').click();
 const after=JSON.parse(JSON.parse(await page.evaluate(()=>localStorage.getItem('wuzhang-white-demo-v1'))).save);
 assert.equal(after.flags['loop.result'],'none');assert.equal(after.flags['loop.player_alive'],true);
 report.revival=true;assert.deepEqual(report.errors,[]);report.passed=true;console.log(JSON.stringify(report));
}catch(error){report.failure=String(error);report.body=await page?.locator('body').innerText();throw error;}finally{writeFileSync('video/review/20261018-integration/browser-route.json',JSON.stringify(report,null,2));await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
