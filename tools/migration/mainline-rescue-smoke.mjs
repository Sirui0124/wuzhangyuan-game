import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';
const out = resolve('outputs/mainline-rescue-20261028'); mkdirSync(out, { recursive: true });
const ai = async (kind, input) => {
  if (kind === 'assess') return { orders: input.orders.map(o => ({ id: o.id, evidence: [], reason: '按现有军令接应。' })) };
  if (kind === 'report') return { text: '各路信使已回营，按本轮实际接应结果汇报。', messages: input.changes.map(c => ({ id: c.id, message: c.outcome || '这一趟已经回报，仍需安排下一轮接应。' })) };
  throw new Error('测试不调用真实模型');
};
const server = createStaticServer({ rescueOptions: { ai, saveDir: resolve(out, 'test-saves') } });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [], checks = [];
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message)); page.setDefaultTimeout(15000);
  await page.goto(origin + '/?chapter=yiling');
  await page.frameLocator('iframe').locator('[data-action=start]').waitFor(); checks.push('fresh campaign can enter Yiling early');
  for (const playtest of ['story', 'reception']) {
    await page.goto(origin + '/?chapter=yiling&playtest=' + playtest);
    await page.frameLocator('iframe').locator('[data-action=start]').waitFor();
    assert.equal(await page.locator('#spoken-line').count(), 0);
  }
  assert.equal((await page.request.get(origin + '/story/chapter-four.story.json')).status(), 404);
  checks.push('retired story/reception links use multi-route rescue and the 240-person story is no longer published');
  await page.evaluate(() => {
    localStorage.setItem('wuzhang-runtime-mode-v1', 'offline');
    localStorage.setItem('wuzhang-chapter-history-v1', JSON.stringify({version:1,entered:['jieting'],completed:['jieting']}));
    localStorage.setItem('yiling-chapter-four-v1', 'preserved-old-fourth-chapter');
    localStorage.setItem('yiling-rescue-demo-session-v2', 'preserved-independent-demo');
  });
  await page.goto(origin + '/?chapter=yiling');
  let frame = page.frameLocator('iframe');
  await frame.locator('[data-action=start]').click();
  await frame.locator('.campaign-header').waitFor();
  const firstId = await page.evaluate(() => localStorage.getItem('yiling-rescue-campaign-session-v1'));
  assert.match(firstId, /^[\da-f-]{36}$/);
  assert.equal(await page.evaluate(() => localStorage.getItem('yiling-chapter-four-v1')), 'preserved-old-fourth-chapter');
  assert.equal(await page.evaluate(() => localStorage.getItem('yiling-rescue-demo-session-v2')), 'preserved-independent-demo');
  await frame.locator('[data-target=liu]').click();
  await frame.locator('[data-action=camp-advance]').click();
  await frame.locator('[data-camp-route=front]').click();
  await frame.locator('[data-action=close-sheet]').click();
  await page.reload(); frame = page.frameLocator('iframe');
  await frame.locator('.campaign-header').waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('yiling-rescue-campaign-session-v1')), firstId);
  checks.push('formal rescue starts with its own server save; reload preserves it and both old versions remain untouched');
  for (const [width, height] of [[1440,900],[844,390]]) {
    await page.setViewportSize({ width, height });
    await frame.locator('[data-screen=map]').first().click();
    await page.screenshot({ path: resolve(out, `map-${width}.png`) });
    assert.equal(await frame.locator('body').evaluate(el => el.scrollWidth <= innerWidth + 1), true);
    await frame.locator('[data-screen=camp]').click();
  }
  await page.setViewportSize({width:1440,height:900});
  for (let round=1; round<=6; round++) {
    await frame.locator('[data-screen=map]').first().click();
    await frame.locator('[data-action=preview]').click();
    await frame.locator('[data-action=commit]').click();
    await frame.locator('#scene-dialog [data-action=next]').click();
  }
  await frame.locator('[data-action=campaign-next]').waitFor();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('wuzhang-chapter-history-v1')).completed.includes('yiling'));
  const result = await page.evaluate(() => JSON.parse(localStorage.getItem('wzy:chapter-results:v1')).yiling);
  assert.equal(result.ending, 'multi-route-rescue'); assert.equal(result.people.length, 9);
  assert.equal(result.rescued, null); assert.equal(result.people.find(p=>p.name==='黄权').fate, 'unknown');
  await page.screenshot({path:resolve(out,'rescue-ending.png')});
  await page.reload(); frame=page.frameLocator('iframe');
  await frame.locator('[data-action=campaign-next]').click();
  await page.waitForURL(/chapter=jingzhou/);
  await page.locator('#spoken-line').waitFor();
  checks.push('six real API rounds settle nine routes, publish verified outcomes and unlock Jingzhou; ending survives reload');
  while (await page.locator('[data-jz=story-next]').count()) await page.locator('[data-jz=story-next]').click();
  await page.locator('[data-jz=begin]').click();
  const story=JSON.parse(readFileSync('content/chapters/jingzhou/chapter-five.reports.json','utf8'));
  while (await page.locator('.jz-workspace').count()) {
    const id=await page.locator('#game-root').getAttribute('data-active-report');
    const report=story.reports.find(r=>r.id===id);
    await page.locator(`[data-jz=judge][data-verdict=${report.truth?'true':'false'}]`).click();
    await page.locator('[data-jz=confirm]').click();
  }
  assert.match(await page.locator('.jz-score-line').innerText(), /判断正确 6 条/);
  await page.locator('[data-jz=story-next]').click(); await page.locator('[data-reply=people]').click();
  while (await page.locator('[data-jz=story-next]').count()) await page.locator('[data-jz=story-next]').click();
  await page.locator('[data-phase=ending]').waitFor();
  await page.screenshot({path:resolve(out,'jingzhou-ending.png')});
  assert.ok(await page.evaluate(()=>localStorage.getItem('jingzhou-chapter-five-v1')));
  assert.equal(await page.evaluate(()=>localStorage.getItem('jingzhou-chapter-five-v1:playtest:reports')),null);
  await page.locator('.ending-primary').click(); await page.waitForURL(/chapter=luofengpo/);
  await page.waitForFunction(()=>document.querySelector('#game-root')?.dataset.chapter==='luofengpo');
  const history = await page.evaluate(async()=> (await import('/GameStarter/web-demo/src/campaign/collect.js')).collectCampaign());
  assert.equal(history.results[3].people.length,9); assert.equal(history.results[4].people[0].fate,'saved');
  checks.push('mainline Jingzhou uses six verdicts and the latest epilogue, then enters the finale with both formal results');
  await page.evaluate(async()=> (await import('/GameStarter/web-demo/src/chapters/progression.js')).startNewChapterProgress());
  assert.equal(await page.evaluate(()=>localStorage.getItem('yiling-rescue-campaign-session-v1')),null);
  await page.goto(origin+'/?chapter=yiling'); await page.frameLocator('iframe').locator('[data-action=start]').waitFor();
  checks.push('new campaign backs up and clears the formal rescue pointer; Yiling remains available early');
  assert.deepEqual(errors,[]);
  writeFileSync(resolve(out,'verification.json'),JSON.stringify({checks,errors,result},null,2));
  console.log(JSON.stringify({checks,errors}));
} finally { await browser.close(); server.closeAllConnections(); await new Promise(r=>server.close(r)); }
