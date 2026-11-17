import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { dialogueFixtures } from '../ai/dialogue-fixtures.mjs';
import { GrainSession } from '../../GameStarter/web-demo/.build/GameStarter/web-demo/src/chapters/chapter-two/session.js';
const base='http://127.0.0.1:8812', output=resolve('outputs/item-system-settings-20261026');
mkdirSync(output,{recursive:true});
const f=await dialogueFixtures(resolve('GameStarter/web-demo/.build'));
const first=await f.authorized();first.buyItem('batteries');
const story=JSON.parse(readFileSync('GameStarter/web-demo/.build/story/chapter-two.films.json'));
const second=new GrainSession(story);
for(let i=0;i<story.nodes.length&&second.current.id!=='CH2-LY02-ACT01';i++)assert.ok(second.advance(second.current.options?.[0]?.id));
assert.ok(second.takeCandlestick());
for(let i=0;i<story.nodes.length&&second.current.kind!=='open';i++)assert.ok(second.advance(second.current.options?.[0]?.id));
assert.equal(second.current.kind,'open');second.unlockPhone();
const browser=await chromium.launch({headless:true,channel:'chrome'}), errors=[];
try {
  const context=await browser.newContext({viewport:{width:1366,height:1000}});
  await context.route('http://127.0.0.1:8787/**',route=>route.fulfill({headers:{'Access-Control-Allow-Origin':'*'},json:new URL(route.request().url()).pathname==='/health'?{configured:true}:{apiKey:'fixture-only',baseUrl:'https://example.test/v1',model:'fixture'}}));
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  await page.evaluate(({first,second})=>{
    localStorage.setItem('wuzhang-runtime-mode-v1','ai-phone');localStorage.setItem('wuzhang-phone-enabled-v1','1');
    localStorage.setItem('wuzhang-chapter-session-v1',first);localStorage.setItem('grain-chapter-two-films-v1',second);
    localStorage.setItem('wuzhang-reduced-motion','1');
  },{first:first.serialize(),second:JSON.stringify(second.state)});
  const settings=async()=>{await page.locator('[data-action=pause]').click();await page.locator('[data-action=settings]').click();await page.locator('#api-status').filter({hasText:'本机配置已读取'}).waitFor({state:'attached'});};
  const resume=async()=>{await page.locator('[data-action=close-modal]').click();await page.locator('[data-action=resume-game]').click();};
  for(const [chapter,url,key,wallet,item] of [
    ['first',base,'wuzhang-chapter-session-v1','¥36.10','姜维赠予的头巾'],
    ['second',base+'/?chapter=grain','grain-chapter-two-films-v1','¥20','军帐里的蜡烛台'],
  ]){
    await page.goto(url);if(chapter==='first')await page.locator('[data-action=continue]').click();
    const before=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
    await settings();await page.locator('#game-phone-enabled').uncheck();
    assert.ok(await page.locator('#game-item-system-enabled').isChecked());await resume();
    assert.equal(await page.locator('[data-action=supplies]').count(),0);await page.locator('[data-action=bag]').click();
    await page.getByRole('heading',{name:item,exact:true}).waitFor();await page.locator('[data-action=close-modal]').click();
    await settings();await page.locator('#game-item-system-enabled').uncheck();
    assert.ok(await page.locator('#game-phone-enabled').isDisabled());assert.equal(await page.locator('#game-phone-enabled').isChecked(),false);
    await page.screenshot({path:resolve(output,`${chapter}-disabled.png`)});await resume();
    assert.equal(await page.locator('[data-action=bag]').count(),0);assert.equal(await page.locator('[data-action=supplies]').count(),0);
    await page.reload();if(chapter==='first')await page.locator('[data-action=continue]').click();
    const after=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
    for(const field of ['worldItems','purchases','rewards','penalties','consumed'])assert.deepEqual(after.supplies[field],before.supplies[field],`${chapter} ${field}`);
    assert.deepEqual(after.phone.messages,before.phone.messages);
    await settings();await page.locator('#game-item-system-enabled').check();
    assert.equal(await page.locator('#game-phone-enabled').isChecked(),false);
    await page.locator('#game-phone-enabled').check();await resume();
    await page.locator('[data-action=bag]').click();await page.getByRole('heading',{name:item,exact:true}).waitFor();await page.locator('[data-action=close-modal]').click();
    await page.locator('[data-action=supplies]').click();assert.equal(await page.locator('.phone-wallet strong').innerText(),wallet);
    await page.locator('[data-action=close-modal]').click();
    assert.deepEqual((await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key)).supplies.rewards,before.supplies.rewards);
  }
  await page.goto(base);
  const homeSave=await page.evaluate(()=>localStorage.getItem('wuzhang-chapter-session-v1'));
  await page.locator('[data-action=settings]').click();
  await page.locator('#api-status').filter({hasText:'本机配置已读取'}).waitFor({state:'attached'});
  await page.locator('#game-item-system-enabled').uncheck();
  assert.equal(await page.evaluate(()=>localStorage.getItem('wuzhang-chapter-session-v1')),homeSave);
  await page.locator('#game-item-system-enabled').check();
  assert.equal(await page.evaluate(()=>localStorage.getItem('wuzhang-chapter-session-v1')),homeSave);
  // A system-off playtest still opens safely, with acquisition hidden.
  await page.evaluate(()=>localStorage.setItem('wuzhang-item-system-enabled-v1','0'));
  await page.goto(base+'/?chapter=grain&playtest=item-candlestick');await page.locator('[data-action=pause]').waitFor();
  assert.equal(await page.locator('[data-action=own-tent]').count(),0);
  await settings();await page.locator('#game-item-system-enabled').check();await resume();await page.locator('[data-action=own-tent]').waitFor();
  assert.deepEqual(errors,[]);
  console.log('PASS: both chapters; master/phone independence; disabled phone; saved inventory, purchases, wallet and chat; reload and re-enable; no duplicate rewards; tent acquisition visibility.');
} finally {await browser.close();}
