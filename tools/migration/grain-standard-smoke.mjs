import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';
const server=createStaticServer();await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const base=`http://127.0.0.1:${server.address().port}`,out='outputs/chapter-two-review-20261023';
const book=JSON.parse(readFileSync(out+'/standard-live.json'));
const expected=book.sheets[0].data.slice(0,53).filter(r=>r[4]).map(r=>r[4]);
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1366,height:768}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const key='grain-chapter-two-prefix-v1';
const product={id:'shop-11111111-2222-4333-8444-555555555555',name:'饮用水',price:300,icon:'物',ability:'供饮用。',boundary:'不能治疗伤势。',source:'',quote:'独立估价',date:'2026-10-25',priceKind:'estimate',searchState:'empty',sources:[],why:'日常饮用',request:'买水'};
const headers={'Access-Control-Allow-Origin':base,'Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST, OPTIONS'};
await page.route('**/api/game/**',async route=>{
 if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});
 const path=new URL(route.request().url()).pathname;
 if(path.endsWith('/phone/guard'))return route.fulfill({headers,json:{blocked:false}});
 if(path.endsWith('/shop/confirm'))return route.fulfill({headers,json:{product}});
 if(path.endsWith('/shop'))return route.fulfill({headers,json:{message:'一瓶饮用水。',products:[product]}});
 if(path.endsWith('/respond')){const payload=route.request().postDataJSON(),text=payload.text,words='这瓶水给你。你救过我，我记着。';return route.fulfill({headers,json:{text:text.includes('评分员')?JSON.stringify({valid:true,scores:Object.fromEntries(['trust','rigor','responsibility'].map((k,i)=>[k,{delta:i===0?1:0,quote:words,reason:'分项依据'}])),gift:{ids:[product.id],quote:'这瓶水给你。'}}):'我在。'}});}
 return route.continue();
});
try{
 await page.goto(base+'/chapter-two.html');await page.waitForURL('**/?chapter=grain');
 for(let i=0;i<100;i++){
  await page.locator('[data-action=next],[data-cinema-action=skip],[data-option],#player-expression').first().waitFor();
  if(await page.locator('#player-expression').count())break;
  if(await page.locator('[data-cinema-action=skip]').count())await page.locator('[data-cinema-action=skip]').click();
  else if(await page.locator('[data-option]').count()){assert.equal(await page.locator('[data-option]').count(),2);await page.locator('[data-option]').first().click();}
  else await page.locator('[data-action=next]').click();
 }
 await page.locator('#player-expression').waitFor();
 const saved=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
 assert.ok(saved.visited.includes('CH2-LY02-009A'));
 assert.deepEqual(saved.supplies.rewards,['gouan-action']);
 await page.locator('[data-action=clue-items]').click();
 assert.deepEqual(await page.locator('.inventory-name').allTextContents(),expected);
 await page.getByRole('button',{name:'交接记录：六月初二领到粮',exact:true}).click();
 assert.match(await page.locator('.game-modal').innerText(),/领粮日期：六月初二 于永安城 督卫苟安/);
 assert.doesNotMatch(await page.locator('.game-modal').innerText(),/原定日|等待/);
 await page.locator('[data-action=close-modal]').click();
 await page.screenshot({path:out+'/standard-clues.png'});
 await page.locator('[data-action=supplies]').click();assert.equal(await page.locator('.phone-wallet').innerText(),'¥20');
 await page.locator('#shopping-query').fill('买水');await page.locator('[data-action=search-supplies]').click();
 await page.locator('[data-buy-offer]').click();await page.locator('[data-attach-item]').waitFor();
 assert.equal(await page.locator('.phone-wallet').innerText(),'¥17');await page.locator('[data-attach-item]').click();
 await page.screenshot({path:out+'/standard-phone.png'});
 await page.reload();await page.locator('[data-action=supplies]').click();assert.equal(await page.locator('.phone-wallet').innerText(),'¥17');
 await page.locator('[data-action=close-modal]').click();
 await page.locator('#player-expression').fill('这瓶水给你。你救过我，我记着。');await page.locator('[data-action=speak]').click();
 await page.locator('[data-action=revise]').waitFor();assert.match(await page.locator('#spoken-line').innerText(),/东西我收下了/);
 const after=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);assert.deepEqual(after.gifts,[product.id]);assert.deepEqual(after.supplies.consumed,[product.id]);
 await page.screenshot({path:out+'/standard-reply.png'});
 await page.reload();assert.match(await page.locator('#spoken-line').innerText(),/东西我收下了/);
 await page.locator('[data-action=revise]').click();await page.setViewportSize({width:390,height:844});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:out+'/standard-mobile.png'});
 assert.deepEqual(errors,[]);writeFileSync(out+'/standard-check.json',JSON.stringify({passed:true,clues:expected,phone:'20 -> 17 -> refresh 17',giftConsumed:true,errors},null,2));console.log('PASS: standard shell, whole prefix, live-sheet clues, source quotes, shared phone purchase, grant once, gift consumption, refresh, mobile.');
}catch(e){await page.screenshot({path:out+'/standard-error.png'});console.log(await page.locator('body').innerText());throw e;}finally{await browser.close();await new Promise(ok=>server.close(ok));}
