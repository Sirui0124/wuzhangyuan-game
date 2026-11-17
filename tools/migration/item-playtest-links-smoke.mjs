import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const base = 'http://127.0.0.1:8812';
const output = resolve('outputs/item-playtest-links-20261026');
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  await context.route('http://127.0.0.1:8787/**', route => route.fulfill({
    headers: { 'Access-Control-Allow-Origin': '*' }, json: { configured: false },
  }));
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(base);
  const mainKeys = ['wuzhang-chapter-session-v1', 'grain-chapter-two-films-v1'];
  await page.evaluate(keys => keys.forEach(key => localStorage.setItem(key, 'untouched-main-save')), mainKeys);
  await page.goto(`${base}/?playtest=item-cup`);
  await page.locator('[data-action=pick-up-cup]').click();
  const cupReceipt = page.locator('.item-receipt').filter({ hasText: '破旧的酒杯' });
  await cupReceipt.waitFor();
  assert.equal(await cupReceipt.getAttribute('data-receipt-destination'), 'bag');
  assert.equal(await page.locator('[data-action=pick-up-cup]').count(), 0);
  assert.equal(await page.locator('#game-notice').innerText(), '');
  assert.ok(await cupReceipt.evaluate(node => node.getAnimations()[0].effect.getKeyframes().some(frame => String(frame.transform).includes('scale(.8)') || String(frame.transform).includes('scale(0.8)'))));
  await cupReceipt.waitFor({ state: 'detached' });
  await page.locator('[data-action=bag]').click();
  await page.getByRole('heading', { name: '破旧的酒杯', exact: true }).waitFor();
  await page.screenshot({ path: resolve(output, 'cup.png') });
  await page.reload();
  await page.locator('[data-action=pick-up-cup]').waitFor();

  await page.goto(`${base}/?playtest=item-headscarf`);
  await page.locator('.dialogue-box, [data-story-film]').first().waitFor();
  for (let i = 0; i < 12 && !await page.locator('.item-receipt').count(); i++) {
    if (await page.locator('[data-film-confirm]:visible').count()) await page.locator('[data-film-confirm]').click();
    else if (await page.locator('[data-cinema-action=skip]:visible').count()) await page.locator('[data-cinema-action=skip]').click();
    else await page.locator('.dialogue-box').click();
    await page.waitForTimeout(100);
  }
  await page.locator('.item-receipt').filter({ hasText: '姜维赠予的头巾' }).waitFor();
  await page.screenshot({ path: resolve(output, 'headscarf.png') });
  await page.locator('[data-action=bag]').click();
  await page.getByRole('heading', { name: '姜维赠予的头巾', exact: true }).waitFor();
  await page.reload();
  await page.locator('.dialogue-box, [data-story-film]').first().waitFor();

  await page.goto(`${base}/?chapter=grain&playtest=item-candlestick`);
  await page.locator('[data-action=own-tent]').click();
  await page.locator('[data-action=take-candlestick]').click();
  await page.locator('.item-receipt').filter({ hasText: '军帐里的蜡烛台' }).waitFor();
  assert.equal(await page.locator('.game-modal').count(), 0);
  await page.screenshot({ path: resolve(output, 'candlestick.png') });
  await page.locator('[data-action=bag]').click();
  await page.getByRole('heading', { name: '军帐里的蜡烛台', exact: true }).waitFor();
  await page.reload();
  await page.locator('[data-action=own-tent]').click();
  await page.locator('[data-action=take-candlestick]').waitFor();
  assert.deepEqual(await page.evaluate(keys => keys.map(key => localStorage.getItem(key)), mainKeys), mainKeys.map(() => 'untouched-main-save'));
  assert.deepEqual(errors, []);
  console.log('Three direct links: acquisition, inventory, reload reset and main-save isolation passed.');
} finally { await browser.close(); }
