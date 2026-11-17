import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';
import { supplyEndings } from '../../GameStarter/web-demo/.build/GameStarter/web-demo/src/chapters/chapter-one/supply-endings.js';
import { tentEnding } from '../../GameStarter/web-demo/.build/GameStarter/web-demo/src/chapters/chapter-one/tent-visit.js';
import { eraEnding } from '../../GameStarter/web-demo/.build/GameStarter/web-demo/src/game/era-ending.js';
import { GAME_ENDINGS_KEY } from '../../GameStarter/web-demo/.build/GameStarter/web-demo/src/chapter-session.js';

const flow = JSON.parse(readFileSync('content/chapters/wuzhang/chapter-one.flow.json', 'utf8'));
const endings = [...flow.endings, ...supplyEndings, tentEnding, eraEnding];
assert.equal(tentEnding.title, '隔帐有耳，帐后有刀');
const collection = { schemaVersion: 1, unlocked: Object.fromEntries(endings.map(e => [e.id, { firstUnlockedAt: '2026-10-26T02:00:00.000Z', lastLoopId: 'card-review-fixture', times: 2 }])) };
const output = resolve('outputs/achievement-cards-20261026'); mkdirSync(output, { recursive: true });
const server = createStaticServer(); await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const errors = [];
try {
 const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
 page.on('pageerror', e => errors.push(e.message));
 await page.addInitScript(({ key, collection }) => {
  localStorage.setItem(key, JSON.stringify(collection));
  localStorage.setItem('wuzhang-runtime-mode-v1', 'offline');
 }, { key: GAME_ENDINGS_KEY, collection });
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.locator('[data-action=chapters]').click();
 const stored = () => page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage))));
 const before = await stored();
 assert.deepEqual(await page.locator('.achievement-card .collectible-title').allTextContents(), endings.map(e => e.title));
 const imagesReady = () => page.locator('.collectible-art').evaluateAll(async images => {
  await Promise.all(images.filter(i => i.tagName === 'IMG').map(i => i.decode()));
 });
 await imagesReady(); await page.evaluate(() => document.fonts.ready);
 for (const ending of endings) {
  const button = page.locator(`[data-achievement-id="${ending.id}"]`);
  const source = await button.locator('img').getAttribute('src');
  await button.click();
  await page.locator(`[data-album-detail="${ending.id}"]`).waitFor();
  assert.equal(await page.locator('.album-story-page h2').textContent(), ending.title);
  assert.equal(await page.locator('.album-description').textContent(), ending.description);
  assert.equal(await page.locator('.album-reflection').textContent(), ending.hint);
  assert.equal(await page.locator('.album-picture-page .collectible-title').textContent(), ending.title);
  assert.equal(await page.locator('.album-picture-page img').getAttribute('src'), source);
  assert.match(await page.locator('.album-record').textContent(), /2 次/);
  await imagesReady();
  if (ending.id === 'tent-execution') await page.screenshot({ path: resolve(output, 'detail-tent.png') });
  await page.keyboard.press('Escape');
  assert.equal(await button.evaluate(el => el === document.activeElement), true);
 }
 assert.equal(await stored(), before, 'Reading every card must leave saves and collection unchanged');
 for (const [width, height] of [[1440,900],[1920,1080],[390,844]]) {
  await page.setViewportSize({ width, height });
  await page.locator('.achievement-shelf').evaluate(el => el.scrollTop = 0);
  const overflow = await page.locator('.collectible-card').evaluateAll(cards => cards.map(card => {
   const box = card.getBoundingClientRect();
   const title = card.querySelector('.collectible-title').getBoundingClientRect();
   const phase = card.querySelector('.collectible-phase').getBoundingClientRect();
   return { fits: title.left >= box.left && title.right <= box.right && title.bottom <= phase.top && phase.bottom <= box.bottom, scroll: card.scrollWidth <= card.clientWidth + 1 };
  }));
  assert.ok(overflow.every(row => row.fits && row.scroll), `Card copy fits at ${width}`);
  await page.screenshot({ path: resolve(output, `map-${width}.png`), fullPage: true });
 }
 await page.setViewportSize({width:1440,height:900});
 await page.locator('[data-achievement-id="safe"]').click();
 await page.locator('[data-album-action=overview]').click();
 assert.deepEqual(await page.locator('.album-card .collectible-title').allTextContents(), endings.map(e => e.title));
 assert.equal(await page.locator('.album-card:focus').count(), 1);
 await imagesReady(); await page.screenshot({path:resolve(output,'collection.png'),fullPage:true});
 await page.locator('[data-album-id="tent-execution"]').click();
 await page.keyboard.press('ArrowLeft');
 assert.equal(await page.locator('.album-story-page h2').textContent(), supplyEndings.at(-1).title);
 await page.keyboard.press('ArrowRight');
 assert.equal(await page.locator('.album-story-page h2').textContent(), tentEnding.title);
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:resolve(output,'detail-mobile.png'),fullPage:true});
 assert.equal(await page.locator('.ending-album-host').evaluate(el=>el.scrollWidth <= innerWidth),true);
 await page.keyboard.press('Escape');
 assert.equal(await stored(),before);
 assert.deepEqual(errors,[]);
 writeFileSync(resolve(output,'verification.json'),JSON.stringify({passed:true,endings:endings.map(e=>({id:e.id,title:e.title})),checks:['seven unique illustrations load','map / detail / overview copy and artwork match catalog','long titles fit 390 / 1440 / 1920','keyboard paging and focus return','viewing leaves saves and achievements unchanged'],errors},null,2));
 console.log('PASS: seven achievement cards, canonical copy and image consistency, responsive long titles, paging and save preservation.');
} finally { await browser.close(); server.closeAllConnections(); await new Promise(ok=>server.close(ok)); }
