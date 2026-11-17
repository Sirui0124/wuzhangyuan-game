import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';
import { dialogueFixtures } from '../ai/dialogue-fixtures.mjs';
import { GrainSession } from '../../GameStarter/web-demo/.build/GameStarter/web-demo/src/chapters/chapter-two/session.js';
import { GAME_SAVE_KEY } from '../../GameStarter/web-demo/.build/GameStarter/web-demo/src/chapter-session.js';
import { GRAIN_SAVE_KEY } from '../../GameStarter/web-demo/.build/GameStarter/web-demo/src/chapters/chapter-two/navigation.js';

// Developer regression through isolated, normally derived saves. No first-play claims or live AI calls.
const output = resolve(process.env.SHARED_READING_OUTPUT ?? 'outputs/ch1-ch2-p1p2-integration-20261027/shared-reading');
mkdirSync(output, { recursive: true });
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const firstSave = readFileSync('outputs/ch1-ch2-p1p2-integration-20261027/interaction/verified/mid-dialogue-ask-guard-fixture.json','utf8');
const two = new GrainSession(read('content/chapters/grain/chapter-two.films.json'), undefined, read('content/chapters/grain/chapter-two.films-rubric.json'), true);
for(let i=0;i<100 && two.current.id!=='CH2-LY02-014';i++) assert.ok(two.advance(two.current.options?.[0]?.id));
assert.equal(two.current.id,'CH2-LY02-014');
const fixtures = [[1,GAME_SAVE_KEY,firstSave,'/'],[2,GRAIN_SAVE_KEY,JSON.stringify(two.state),'/?chapter=grain']];
const server=createStaticServer(); await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome',headless:true});
const results=[],errors=[];
try {
 for(const [chapter,key,save,url] of fixtures) {
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  await context.route('http://127.0.0.1:8787/**',r=>r.fulfill({json:{configured:true},headers:{'Access-Control-Allow-Origin':'*'}}));
  await context.addInitScript(({key,save})=>{localStorage.setItem(key,save);localStorage.setItem('wuzhang-runtime-mode-v1','ai-phone');localStorage.setItem('wuzhang-reduced-motion','1');},{key,save});
  const page=await context.newPage(); page.on('pageerror',e=>errors.push(e.message));
  const checkpoint=()=>page.evaluate(key=>{const s=JSON.parse(localStorage.getItem(key));return {node:s.node,phase:s.phase,section:s.section,lineIndex:s.lineIndex,visited:s.visited,completed:s.story?.completed};},key);
  async function reset(){await page.goto(`http://127.0.0.1:${server.address().port}${url}`);if(chapter===1)await page.locator('.game-menu [data-action=continue]').click();await page.locator('.game-scene').waitFor();}
  await reset(); const original=await checkpoint();
  await page.locator('.game-hud [data-action=save]').click();
  assert.equal(await page.locator('.save-leaf').count(),3,'both chapters expose auto plus two manual slots');
  assert.equal(await page.locator('[data-action=load-auto]').isEnabled(),true);
  await page.locator('[data-action=load-auto]').click();assert.deepEqual(await checkpoint(),original,'auto load cannot advance');
  await page.locator('.game-hud [data-action=save]').click();
  const font=await page.locator('.save-kind').first().evaluate(el=>{const s=getComputedStyle(el);return {font:s.fontSize,line:s.lineHeight,family:s.fontFamily};});
  await page.locator('[data-store-slot="1"]').click(); assert.deepEqual(await checkpoint(),original,'saving cannot advance');
  await page.keyboard.press('Escape'); assert.deepEqual(await checkpoint(),original,'closing save cannot advance');
  await page.locator('.game-hud [data-action=pause]').click();
  const actions=await page.locator('.pause-actions button').allTextContents();
  await page.screenshot({path:resolve(output,`chapter-${chapter}-pause.png`)});
  await page.locator('[data-action=resume-game]').click(); assert.deepEqual(await checkpoint(),original,'menu cannot advance');
  await page.evaluate(()=>{document.activeElement?.blur();document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',repeat:true,bubbles:true}));});
  assert.deepEqual(await checkpoint(),original,'repeated key cannot advance');
  await page.evaluate(()=>document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true})));
  assert.deepEqual(await checkpoint(),original,'IME commit cannot advance');
  // A real pointer drag must not be treated as a click, even when no text was selected.
  await page.mouse.move(720,180);await page.mouse.down();await page.mouse.move(790,180,{steps:3});await page.mouse.up();
  assert.deepEqual(await checkpoint(),original,'drag cannot advance');
  const text=page.locator(chapter===1?'#spoken-line':'.evidence-reading .dialogue-text').first();
  await text.evaluate(el=>{const range=document.createRange();range.selectNodeContents(el);const s=getSelection();s.removeAllRanges();s.addRange(range);});
  await page.locator('.game-scene').dispatchEvent('click',{button:0,detail:0});
  assert.deepEqual(await checkpoint(),original,'selected text cannot advance');
  await page.evaluate(()=>getSelection().removeAllRanges());
  await page.mouse.click(720,180); const afterClick=await checkpoint(); assert.notDeepEqual(afterClick,original,'screen tap advances');
  await reset();await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.press('Enter');assert.deepEqual(await checkpoint(),afterClick,'Enter and tap advance one identical step');
  await reset();await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.press('Space');assert.deepEqual(await checkpoint(),afterClick,'Space and tap advance one identical step');
  await page.locator('.game-hud [data-action=save]').click();await page.locator('[data-load-slot="1"]').click();assert.deepEqual(await checkpoint(),original,'manual load restores the same position');
  await page.setViewportSize({width:390,height:844});await page.locator('.game-hud [data-action=pause]').click();await page.locator('[data-action=pause-save]').click();
  assert.ok(await page.locator('.game-modal').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1&&r.top>=-1&&r.bottom<=innerHeight+1;}));
  await page.screenshot({path:resolve(output,`chapter-${chapter}-save-narrow.png`)});
  const manualBefore = await page.evaluate(key=>localStorage.getItem(key+':slot:1'),key);
  await page.locator('.modal-close').click();await page.locator('[data-action=pause-restart]').click();
  assert.deepEqual(await checkpoint(),original,'restart confirmation cannot advance');
  await page.locator('.modal-close').click();assert.deepEqual(await checkpoint(),original,'cancel restart preserves the position');
  await page.locator('[data-action=pause-restart]').click();await page.locator('[data-action=pause-restart-confirm]').click();
  assert.notDeepEqual(await checkpoint(),original,'confirmed restart starts a fresh chapter');
  assert.equal(await page.evaluate(key=>localStorage.getItem(key+':slot:1'),key),manualBefore,'manual slot survives restart');
  assert.ok(await page.evaluate(key=>localStorage.getItem(key+':before-new'),key),'restart retains a progress backup');
  results.push({chapter,checks:['save/load','menu/resume','IME/repeat','drag/selection','tap/Enter/Space-one-step','narrow-modal','restart/cancel/backup/manual-slot-preserved'],font,actions});
  await context.close();
 }
 assert.deepEqual(results[0].font,results[1].font,'same save typography');
 assert.deepEqual(results[0].actions,results[1].actions,'same pause actions');
 assert.deepEqual(errors,[]);
 writeFileSync(resolve(output,'verification.json'),JSON.stringify({passed:true,kind:'developer-regression',results,errors},null,2));
 console.log(JSON.stringify({passed:true,chapters:results.length,output}));
} catch(error) {
 writeFileSync(resolve(output,'failure.json'),JSON.stringify({passed:false,results,errors,error:String(error),stack:error.stack},null,2));throw error;
} finally {await browser.close();await new Promise(r=>server.close(r));}


