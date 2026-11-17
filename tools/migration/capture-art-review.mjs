// Capture deterministic display samples in an isolated browser. No player saves are read.
import { chromium } from 'playwright';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const server = createStaticServer();
await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, reducedMotion: 'reduce' });
await page.addInitScript(() => localStorage.setItem('wuzhang-reduced-motion', '1'));
const samples = {};
const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('wuzhang-chapter-session-v1')));
const click = async action => {
  const current = await state();
  const sceneAction = (action === 'next' && current?.phase === 'dialogue') || (action === 'revise' && current?.phase === 'reply') || (action === 'reply' && current?.phase === 'spoken');
  if (sceneAction) {
    if (action === 'reply') await page.waitForFunction(() => { const current = JSON.parse(localStorage.getItem('wuzhang-chapter-session-v1')); return current?.phase === 'spoken' && current.speech?.status === 'ready'; });
    return page.locator('.game-scene').click({ position: { x: 24, y: (page.viewportSize()?.height ?? 600) * .4 } });
  }
  return page.locator(`[data-action="${action}"]`).first().click();
};
const read = async () => { let n = 0; while ((await state())?.phase === 'dialogue' && n++ < 160) await click('next'); if (n >= 160) throw new Error('Dialogue did not advance'); };
const act = async (id, scene) => { if ((await state()).scene !== scene) await page.locator(`[data-move="${scene}"]`).click(); await page.locator(`[data-scene-action="${id}"]`).click(); await read(); };
const focus = async id => { await click('notes-list'); await page.locator(`[data-focus-note="${id}"]`).click(); };
const connect = async (a, b) => { await focus(a); await page.locator(`[data-connect="${a}"]`).click(); await focus(b); await page.locator(`[data-connect="${b}"]`).click(); };
const capture = async id => {
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all(Array.from(document.images).map(i => i.decode().catch(() => {}))); });
  samples[id] = await page.locator('#game-root').innerHTML();
};
try {
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.locator('.game-menu').waitFor();
  await click('new'); await page.locator('[data-cinema-action=skip]').click(); await read();
  await capture('camp');
  await act('read-notice', 'camp_gate'); await act('meet-first-scout', 'report_post');
  await page.locator('[data-scene-action=intercept-first]').click(); await capture('dialogue'); await read();
  await act('deliver-first', 'camp_gate'); await act('stand-watch', 'camp_gate');
  await page.locator('[data-cinema-action=skip]').click(); await read();
  await click('rewind'); await read();
  for (const [id, scene] of [['ask-guard', 'camp_gate'], ['ask-relay', 'jiangwei_tent_front'], ['ask-scout', 'report_post']]) await act(id, scene);
  await click('begin-thinking');
  await connect('C02', 'C03'); await connect('I01', 'C04');
  await connect('R01', 'C06'); await connect('C06', 'C07'); await click('center-notes');
  await capture('thoughts');
  await click('follow-plan'); await read(); await act('intercept-weiyan', 'report_post');
  await focus('R01'); await focus('C08'); await capture('expression');
  const dir = resolve('GameStarter/web-demo/public/art-review'); mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, 'scenes.json'), JSON.stringify({ version: '20261022', viewport: { width: 1600, height: 1000 }, samples }, null, 2));
  console.log('Captured four real game screens for visual review. Player data unchanged.');
} finally { await browser.close(); server.closeAllConnections(); await new Promise(ok => server.close(ok)); }
