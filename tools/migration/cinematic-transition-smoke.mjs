import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';

const out = resolve('outputs/cinematic-transition'); mkdirSync(out, { recursive: true });
const server = createStaticServer({ root: resolve('GameStarter/web-demo/.build') });
await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], checks = []; page.on('pageerror', e => errors.push(e.message));
const finishClip = async () => {
  await page.waitForFunction(() => document.querySelector('video')?.readyState >= 2);
  await page.locator('video').evaluate(async v => { v.currentTime = v.duration - .15; await v.play(); });
};
try {
  await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: 'domcontentloaded' });
  await page.locator('.game-menu').waitFor();
  await page.evaluate(async () => {
    const { CinematicPlayer } = await import('/GameStarter/web-demo/src/cinematics.js');
    window.Player = CinematicPlayer;
    window.clips = (await (await fetch('/cinematics.json')).json()).opening;
    document.body.innerHTML = '<div id="test-host"></div>';
    window.host = document.querySelector('#test-host');
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = '/cinematics.css'; document.head.append(css);
    window.player = new CinematicPlayer('transition-test', 'transition-test');
  });
  let release;
  const gate = new Promise(ok => { release = ok; });
  await page.route('**/*transition-delay*', async route => { await gate; await route.continue(); });
  await page.evaluate(() => {
    window.completed = 0;
    player.mount(host, 'test', [clips[0], { ...clips[1], src: clips[1].src + '?transition-delay' }], 'opening', () => window.completed++);
  });
  await page.waitForFunction(() => document.querySelector('video')?.currentTime > .05);
  const queued = await page.evaluate(() => ({ paused: player.prepared.video.paused, time: player.prepared.video.currentTime, connected: player.prepared.video.isConnected }));
  assert.deepEqual(queued, { paused: true, time: 0, connected: false });
  await page.locator('[data-cinema-rate="1.5"]').click();
  await page.locator('video').evaluate(v => { v.muted = true; });
  await finishClip();
  await page.locator('.cinema-transition-frame').waitFor();
  await page.waitForTimeout(250);
  const held = await page.locator('.cinema-transition-frame').evaluate(c => {
    const pixels = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let lit = 0; for (let i = 0; i < pixels.length; i += 40) if (pixels[i] + pixels[i + 1] + pixels[i + 2] > 30) lit++;
    const a = c.getBoundingClientRect(), b = document.querySelector('video').getBoundingClientRect();
    return { lit, aligned: a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height, ready: document.querySelector('video').readyState };
  });
  assert.ok(held.lit > 1000); assert.equal(held.aligned, true); assert.equal(held.ready, 0);
  await page.screenshot({ path: resolve(out, 'held-frame-under-delayed-loading.png') });
  checks.push('下一段请求被阻塞时，上一段真实画面持续覆盖播放器，无黑屏；预加载不播放声音');
  release();
  await page.locator('.cinema-transition-frame').waitFor({ state: 'detached' });
  await page.waitForFunction(() => document.querySelector('video')?.currentTime > .05);
  const resumed = await page.locator('video').evaluate(v => ({ muted: v.muted, rate: v.playbackRate, src: v.currentSrc }));
  assert.equal(resumed.muted, true); assert.equal(resumed.rate, 1.5); assert.match(resumed.src, /transition-delay/);
  await page.locator('[data-cinema-action=toggle]').click();
  assert.equal(await page.locator('video').evaluate(v => v.paused), true);
  await page.locator('[data-cinema-action=toggle]').click();
  await finishClip(); await page.waitForFunction(() => window.completed === 1);
  checks.push('下一段提交首帧后撤去末帧覆盖，保持倍速和静音；暂停、恢复及自然结束正常');

  // A different group can be mounted synchronously by the completion callback.
  await page.evaluate(() => {
    player.mount(host, 'group-one', [clips[0]], 'opening', () => {
      player.mount(host, 'group-two', [clips[1]], 'opening', () => window.completed++);
      window.crossGroupHeld = !!host.querySelector('.cinema-transition-frame');
    });
  });
  await finishClip(); await page.waitForFunction(() => window.crossGroupHeld === true);
  await page.locator('.cinema-transition-frame').waitFor({ state: 'detached' });
  await page.locator('[data-cinema-action=skip]').click();
  assert.equal(await page.evaluate(() => window.completed), 2);
  assert.equal(await page.locator('.cinema-transition-frame').count(), 0);
  checks.push('跨播放组切换也继承画面，跳过只执行一次并清理覆盖层');

  // Slow-loading next clip can still be skipped; late decode cannot resume the abandoned player.
  let releaseSkip; const skipGate = new Promise(ok => { releaseSkip = ok; });
  await page.route('**/*skip-delay*', async route => { await skipGate; await route.continue(); });
  await page.evaluate(() => player.mount(host, 'skip-loading', [clips[0], { ...clips[1], src: clips[1].src + '?skip-delay' }], 'opening', () => window.completed++));
  await finishClip(); await page.locator('.cinema-transition-frame').waitFor();
  await page.locator('[data-cinema-action=skip]').click(); releaseSkip();
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => window.completed), 3);
  assert.equal(await page.locator('.cinema-transition-frame').count(), 0);
  assert.equal(await page.locator('video').count(), 0);
  assert.equal(await page.evaluate(() => player.mounted), null);
  checks.push('加载等待中可跳过，迟到的解码回调不会恢复已退出的视频');
  assert.deepEqual(errors, []);
  writeFileSync(resolve(out, 'checks.json'), JSON.stringify({ passed: true, checks, held, resumed, errors }, null, 2));
  console.log(checks);
} finally { await browser.close(); server.close(); }
