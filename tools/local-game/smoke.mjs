// Uses an isolated browser profile. A temporary, uniquely named compiler error exercises rollback.
import { chromium } from 'playwright';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';
import { root, origin, health } from './config.mjs';
const exec = promisify(execFile);
const output = resolve(root, 'outputs/local-game-access');
await mkdir(output, { recursive: true });
await exec(process.execPath, [resolve(root, 'tools/local-game/launch.mjs'), '--no-open'], { windowsHide: true });
async function until(predicate, label, timeout = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const value = await predicate(); if (value) return value;
    await delay(350);
  }
  throw new Error(`Timeout: ${label}`);
}
await until(async () => (await health()).phase === 'ready', 'initial build');
const original = await health();
await exec(process.execPath, [resolve(root, 'tools/local-game/launch.mjs'), '--no-open'], { cwd: root, windowsHide: true });
assert.equal((await health()).pid, original.pid, 'Repeated launch must reuse its service');
const browser = await chromium.launch({ headless: true, channel: process.env.SMOKE_BROWSER_CHANNEL || 'chrome' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const hub = await context.newPage(), game = await context.newPage(), review = await context.newPage();
const errors = [], missing = [], checks = ['Repeated launch reuses the same process'];
for (const page of [hub, game, review]) {
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() === 404) missing.push(response.url()); });
}
const fixture = resolve(root, 'GameStarter/web-demo/src', `local_smoke_${randomUUID().replaceAll('-', '')}.ts`);
let created = false;
try {
  await hub.goto(`${origin}/local/`);
  await until(async () => await hub.locator('#state').innerText() === '本地最新构建已就绪', 'hub status');
  await hub.screenshot({ path: resolve(output, 'desktop.png'), fullPage: true });
  await hub.setViewportSize({ width: 390, height: 844 });
  assert.ok(await hub.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await hub.screenshot({ path: resolve(output, 'mobile.png'), fullPage: true });
  await hub.setViewportSize({ width: 1440, height: 1000 });
  await game.goto(origin);
  await game.locator('[data-action=new]').waitFor();
  const saveBefore = await game.evaluate(() => JSON.stringify(localStorage));
  await review.goto(`${origin}/art-review.html?style=cinnabar&scene=thoughts&font=kai`);
  await review.locator('iframe').waitFor();
  assert.ok(await review.locator('iframe').getAttribute('srcdoc'));
  checks.push('Desktop/mobile hub, playable main menu and mindmap review load');
  const movies = await (await fetch(`${origin}/cinematics.json`)).json();
  const clip = Object.values(movies).flat()[0].src;
  const range = await fetch(origin + clip, { headers: { Range: 'bytes=0-31' } });
  assert.equal(range.status, 206); assert.equal((await range.arrayBuffer()).byteLength, 32);
  checks.push('Video range streaming works through the managed server');

  await writeFile(fixture, 'const broken: string = 123; export {};\n', { flag: 'wx' }); created = true;
  await until(async () => (await health()).phase === 'error', 'failed build');
  assert.equal((await health()).current.id, original.current.id);
  assert.equal((await fetch(origin)).status, 200);
  await until(async () => (await hub.locator('#state').innerText()) === '本次更新未成功', 'hub error status');
  await hub.screenshot({ path: resolve(output, 'failed-update.png'), fullPage: true });
  checks.push('Real TypeScript error leaves the last successful game available');

  await unlink(fixture); created = false;
  await until(async () => { const status = await health(); return status.phase === 'ready' && status.current.id !== original.current.id; }, 'automatic recovery');
  await game.getByRole('button', { name: '刷新到新版' }).waitFor({ timeout: 15000 });
  assert.equal(await game.evaluate(() => JSON.stringify(localStorage)), saveBefore);
  assert.equal(await game.locator('script[data-version]').getAttribute('data-version'), original.current.id);
  await game.screenshot({ path: resolve(output, 'update-notice.png'), fullPage: true });
  await game.getByRole('button', { name: '刷新到新版' }).click();
  await game.locator('[data-action=new]').waitFor();
  assert.equal(await game.locator('script[data-version]').getAttribute('data-version'), (await health()).current.id);
  checks.push('Fixing source automatically rebuilds; update notification waits for manual refresh and preserves storage');
  assert.deepEqual(errors, []); assert.deepEqual(missing, []);
  await writeFile(resolve(output, 'checks.json'), JSON.stringify({ passed: true, checks, errors, missing }, null, 2));
  console.log(JSON.stringify({ passed: true, checks, errors, missing }, null, 2));
} finally {
  if (created) await unlink(fixture);
  await browser.close();
}
