import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';

const build = resolve(process.argv[2] ?? 'GameStarter/web-demo/.build');
const output = resolve(process.argv[3] ?? 'outputs/thought-final-20261023');
mkdirSync(output, { recursive: true });
const { ChapterSession } = await import(pathToFileURL(resolve(build, 'GameStarter/web-demo/src/chapter-session.js')));
const json = file => JSON.parse(readFileSync(resolve(build, file), 'utf8'));
const script = json('story/chapter-one.script.json'), flow = json('story/chapter-one.flow.json'), version = json('story/session-manifest.json').contentVersion;
const session = new ChapterSession(script, flow, version);
const read = () => { let count = 0; while (session.snapshot().phase === 'dialogue' && count++ < 200) session.nextLine(); assert.ok(count < 200); };
const act = id => { const action = flow.actions.find(item => item.id === id); if (session.snapshot().scene !== action.scene) session.move(action.scene); assert.ok(session.act(id)); read(); };
session.finishCinematic(); read(); ['read-notice', 'meet-first-scout'].forEach(act); session.chooseScout('a'); read(); act('intercept-first');
session.setFocus('我来转呈信息'); session.setDraft('将军，敌军尚未攻营，还不必强闯。帐内确实不许进入，我现在替您转呈，绝不耽误军情。'); await session.confirmExpression(); session.acknowledgeReply(); read();
['deliver-first', 'stand-watch'].forEach(act); session.finishCinematic(); read(); session.rewind(); read(); ['ask-guard', 'ask-relay', 'ask-scout'].forEach(act); assert.ok(session.beginThinking());
assert.equal(session.snapshot().thinking.history.length, 0);
const initialFixture = session.serialize(), key = 'wuzhang-chapter-session-v1';

const server = createStaticServer({ root: build }); await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const browser = await chromium.launch({ headless:true, channel:'chrome' });
try {
 for (const width of [1366,900]) {
  const context = await browser.newContext({viewport:{width,height:768}});
  const page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(({key,fixture})=>localStorage.setItem(key,fixture),{key,fixture:initialFixture});
  await page.goto(`http://127.0.0.1:${server.address().port}`); await page.locator('[data-action=continue]').click();
  const click=action=>page.locator(`[data-action="${action}"]`).filter({visible:true}).first().click();
  const add=async ids=>{await click('open-inventory');for(const id of ids)await page.locator(`[data-place-evidence="${id}"]`).click();await page.keyboard.press('Escape');};
  await click('think'); await page.waitForTimeout(1650);
  assert.equal(await page.locator('[data-thought-result]').count(),0,'Partial insight is not a question answer');
  await add(['C04']);await click('think');await page.waitForTimeout(1650);
  assert.equal(await page.locator('[data-thought-result=R01]').count(),1);
  assert.equal(await page.locator('[data-thought-question=recipient]').count(),0);
  assert.equal(await page.locator('.reasoning-curve[data-to=R01]').count(),3);
  await click('close-notes');await click('notes');
  assert.equal(await page.locator('[data-action=continue-thought]').count(),1,'Close/reopen preserves pending continuation');
  await click('continue-thought');assert.equal(await page.locator('[data-thought-question=recipient]').count(),1);
  await add(['C06','C07']);await click('think');await page.waitForTimeout(1650);
  assert.equal(await page.locator('[data-thought-result]').count(),2);
  assert.equal(await page.locator('[data-action=think]').count(),0,'No free reasoning after the final answer');
  assert.equal(await page.locator('[data-action=follow-plan]').count(),1);
  assert.equal(await page.locator('.working-clue-title').first().evaluate(el=>getComputedStyle(el).fontSize),'16px');
  assert.equal(await page.locator('.outcome-title').first().evaluate(el=>getComputedStyle(el).fontSize),'20px');
  await page.screenshot({path:resolve(output,`final-${width}.png`)});
  assert.deepEqual(errors,[]);
  await click('follow-plan');assert.equal(await page.locator('[data-thought-result]').count(),0);
  await context.close();
 }
 console.log('PASS: partial insight, one answer, 3 source lines, explicit continue, reopen, action, 1366/900 fonts and runtime');
} finally {await browser.close(); await new Promise(ok=>server.close(ok));}
