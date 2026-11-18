import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';
import { dialogueFixtures } from '../ai/dialogue-fixtures.mjs';
import { jiangDutyMigration } from '../../GameStarter/web-demo/.build/GameStarter/web-demo/src/chapters/chapter-one/jiang-duty-migration.js';

const out = resolve('outputs/release-stability/browser'); mkdirSync(out, {recursive:true});
const fixtures = await dialogueFixtures(resolve('GameStarter/web-demo/.build'));
const legacy = fixtures.first().snapshot();
legacy.contentVersion = jiangDutyMigration.from;
const server = createStaticServer(); await new Promise(ok => server.listen(0,'127.0.0.1',ok));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({channel:'chrome',headless:true});
const errors = [], checks = [], key = 'wuzhang-chapter-session-v1';
try {
  for (const sample of [{name:'broken-json',raw:'{ broken JSON\n'}, {name:'incompatible',raw:'{"schema":1,"version":"old"}'},
    {name:'backup-quota',raw:JSON.stringify(legacy),blocked:true}, {name:'null-record',raw:'null'},
    {name:'legacy-save',raw:JSON.stringify(legacy),valid:true}]) {
    const context = await browser.newContext({viewport:{width:1440,height:900}});
    await context.route('http://127.0.0.1:8787/**',r=>r.fulfill({headers:{'Access-Control-Allow-Origin':'*'},json:{configured:false}}));
    await context.addInitScript(({key,sample})=>{
      if(!sessionStorage.getItem('initialized')) {
        localStorage.setItem('wuzhang-runtime-mode-v1','offline');
        localStorage.setItem('wuzhang-ai-setup-seen-v1','1');
        localStorage.setItem(key,sample.raw);sessionStorage.setItem('initialized','1');
      }
      if(sample.blocked) {
        const original=Storage.prototype.setItem;
        Storage.prototype.setItem=function(k,v){if(k.startsWith(key+':recovery:'))throw new DOMException('full','QuotaExceededError');return original.call(this,k,v);};
      }
    },{key,sample});
    const page = await context.newPage(); page.on('pageerror',e=>errors.push(e.message));
    const inspect=()=>page.evaluate(key=>({raw:localStorage.getItem(key),backups:Object.keys(localStorage).filter(k=>k.startsWith(key+':recovery:')).map(k=>localStorage.getItem(k))}),key);
    await page.goto(origin);
    await page.locator('.game-menu').waitFor();
    assert.equal((await inspect()).raw,sample.raw,sample.name);
    await page.locator('[data-action=continue]').click();
    if (sample.valid) {
      await page.locator('[data-cinema-action=skip]').click();
      await page.locator('.branch-scene').waitFor();
      const current=await inspect();
      assert.deepEqual(current.backups,[sample.raw]);
      assert.ok(JSON.parse(current.raw).branch);
      await page.reload();
      await page.locator('[data-action=continue]').click();
      await page.locator('.branch-scene').waitFor();
      assert.deepEqual((await inspect()).backups,[sample.raw]);
    } else {
      const warning=sample.blocked?/未能备份/:/原记录已保留/;
      await page.locator('.menu-warning').filter({hasText:warning}).waitFor();
      const preserved={raw:sample.raw,backups:sample.blocked?[]:[sample.raw]};
      assert.deepEqual(await inspect(),preserved);
      await page.reload();
      await page.locator('[data-action=continue]').click();
      await page.locator('.menu-warning').filter({hasText:warning}).waitFor();
      assert.deepEqual(await inspect(),preserved);
    }
    checks.push(`${sample.name}: exact source preserved across initialization, controls and reload`);
    await context.close();
    console.log(checks.at(-1));
  }
  const config=JSON.parse(readFileSync('GameStarter/web-demo/.build/cinematics.json'));
  const expected=[...new Set(Object.values(config).flat().map(c=>c.subtitles.split('/').pop()))].sort();
  const published=readdirSync('GameStarter/web-demo/.build/video/subtitles').filter(n=>n.endsWith('.vtt')).sort();
  assert.deepEqual(published,expected);checks.push(`published subtitles match all ${expected.length} active references exactly`);
  const context=await browser.newContext();
  await context.route('http://127.0.0.1:8787/**',r=>r.fulfill({headers:{'Access-Control-Allow-Origin':'*'},json:{configured:false}}));
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  let fail=true;
  await page.route('**/*stability-error*',r=>fail?r.abort('failed'):r.continue());
  await page.goto(origin);await page.locator('.game-menu').waitFor();
  await page.evaluate(async clip=>{
    const {CinematicPlayer}=await import('/GameStarter/web-demo/src/cinematics.js');
    document.body.innerHTML='<div id="test-host"></div>';
    window.testPlayer=new CinematicPlayer('stability');window.finished=0;
    testPlayer.mount(document.querySelector('#test-host'),'failure',[{...clip,src:clip.src+'?stability-error'}],'story',()=>window.finished++);
  },config.prologue[0]);
  await page.waitForFunction(()=>document.querySelector('.cinema-screen')?.dataset.mediaState==='error');
  assert.match(await page.locator('#video-status').textContent(),/重试/);
  await page.locator('video').evaluate(v=>{v.dispatchEvent(new Event('volumechange'));v.dispatchEvent(new Event('ended'));});
  assert.equal(await page.evaluate(()=>window.finished),0);
  assert.equal(await page.locator('track').evaluate(t=>t.track.mode),'hidden');
  fail=false;await page.locator('[data-cinema-action=retry]').click();
  await page.waitForFunction(()=>document.querySelector('.cinema-screen')?.dataset.mediaState==='ready');
  assert.equal(await page.locator('#video-status').textContent(),'');
  await page.evaluate(()=>testPlayer.dispose());assert.equal(await page.locator('video').count(),0);
  checks.push('media failure retains retry and hidden subtitles; late ended cannot finish; retry recovers and disposal releases video');
  await context.close();
  assert.deepEqual(errors,[]);
  writeFileSync(resolve(out,'verification.json'),JSON.stringify({checks,errors},null,2));
  console.log(JSON.stringify({checks,errors}));
}finally{await browser.close();server.closeAllConnections();await new Promise(ok=>server.close(ok));}
