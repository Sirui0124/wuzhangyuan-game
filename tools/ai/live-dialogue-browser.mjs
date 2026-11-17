// Isolated browser storage, real configured AI. Explicit paid-call opt-in required.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {writeFileSync,mkdirSync} from 'node:fs';
import {dialogueFixtures} from './dialogue-fixtures.mjs';
import {createStaticServer} from '../../GameStarter/web-demo/serve.mjs';
if(!process.argv.includes('--live'))throw Error('Pass --live to call the configured real AI');
const root=resolve(process.argv[2]),fixtures=await dialogueFixtures(root),output=resolve('outputs/ai-dialogue-20261022/browser');mkdirSync(output,{recursive:true});
const server=createStaticServer({root});await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1600,height:1000},reducedMotion:'reduce'});
const key='wuzhang-chapter-session-v1',errors=[],calls=[],checks=[];page.on('pageerror',e=>errors.push(e.message));
page.on('response',async response=>{if(response.url().endsWith('/api/game/respond')&&response.request().method()==='POST')calls.push(await response.json());});
const state=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
const click=async action=>{
 const s=await state();
 if((action==='next'&&s?.phase==='dialogue')||(action==='reply'&&s?.phase==='spoken')||(action==='revise'&&s?.phase==='reply'))return page.locator('.game-scene').click({position:{x:24,y:300}});
 return page.locator(`[data-action="${action}"]`).first().click();
};
async function load(session){await page.goto(base);await page.evaluate(({key,raw})=>{localStorage.setItem(key,raw);localStorage.setItem('wuzhang-reduced-motion','1');},{key,raw:session.serialize()});await page.reload();await click('continue');}
async function waitForStatus(field,status){await page.waitForFunction(({key,field,status})=>JSON.parse(localStorage.getItem(key))?.[field]?.status===status,{key,field,status},{timeout:120000});}
async function polish(words){await page.locator('#expression-focus').fill(words);await click('generate-expression');await waitForStatus('composition','ready');return page.locator('#player-expression').inputValue();}
async function speak(){await click('speak');await waitForStatus('speech','ready');return (await state()).speech.npcTurn;}
try{
 await load(fixtures.first());const words='将军，先别惊扰丞相，等到明早再报吧。';const polished=await polish(words);assert.match(polished,/明早/);await page.screenshot({path:resolve(output,'01-polish-own-words.png')});
 const rejection=await speak();assert.equal(rejection.classification.code,'R1-RETRY');assert.equal((await state()).story.history.length,0);await click('reply');assert.equal((await state()).phase,'reply');assert.ok((await page.locator('body').innerText()).includes(rejection.reply.text));await page.screenshot({path:resolve(output,'02-npc-refusal.png')});
 await page.reload();await click('continue');assert.equal((await state()).speech.npcTurn.reply.text,rejection.reply.text);assert.equal((await state()).phase,'reply');await click('revise');assert.equal(await page.locator('#expression-focus').inputValue(),words);checks.push({test:'Real polish preserves delay, real NPC refuses, reply persists on reload and revision retains original words',polished,rejection});
 const improved=await polish('营门尚未突破，眼下不必强闯。今夜帐内有禁令，不能进去。不等明早，我现在替您转呈，绝不耽误军情。');assert.doesNotMatch(improved,/帐内有事|闲人/);const acceptance=await speak();assert.equal(acceptance.classification.code,'ok');assert.equal((await state()).story.flags.FIRST_TRANSFER_ACCEPTED,undefined);await click('reply');assert.equal((await state()).story.current,'A-40B');assert.ok((await page.locator('body').innerText()).includes(acceptance.reply.text));await page.screenshot({path:resolve(output,'03-npc-acceptance.png')});await click('next');assert.equal((await state()).story.flags.FIRST_TRANSFER_ACCEPTED,true);assert.equal((await state()).story.flags.REPORT_CLOSED,undefined);checks.push({test:'Complete player wording is accepted only after explicit speech; NPC text appears in the actual story row',improved,acceptance});
 await load(await fixtures.authorized());await page.locator('#player-expression').waitFor({state:'visible'});
 // Enter the player's own speech directly; the removed reference control is not a setup path.
 await page.locator('#player-expression').fill('往日敌骑闻号即退，今夜不退还随我军调动换向，可能在试探我军反应。姜维已亲口答应接报。我们现在当面去找他交接急报，不必进丞相帐。');
 const second=await speak();assert.equal(second.classification.code,'ok');await click('reply');while((await state()).story.current!=='W07')await click('next');assert.ok((await page.locator('body').innerText()).includes(second.reply.text));assert.equal((await state()).story.flags.FORMAL_REPORT_RECEIVED,undefined);assert.equal((await state()).story.flags.REPORT_CLOSED,undefined);await page.screenshot({path:resolve(output,'04-second-round-response.png')});checks.push({test:'Authorized second round uses generated NPC line while report events remain uncompleted',second});
 assert.deepEqual(errors,[]);writeFileSync(resolve(output,'checks.json'),JSON.stringify({passed:true,checks,apiCalls:calls.length,calls,errors},null,2));console.log(JSON.stringify({passed:true,checks:checks.length,apiCalls:calls.length}));
}catch(error){await page.screenshot({path:resolve(output,'failure.png')});writeFileSync(resolve(output,'checks.json'),JSON.stringify({passed:false,error:error.message,checks,calls,errors,state:await state()},null,2));throw error;}
finally{await browser.close();server.closeAllConnections();await new Promise(ok=>server.close(ok));}
