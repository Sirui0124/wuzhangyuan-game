import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';

const out = resolve('outputs/review-rebuild-20261029/browser'); mkdirSync(out, {recursive:true});
const server = createStaticServer(); await new Promise(ok => server.listen(0,'127.0.0.1',ok));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({channel:'chrome',headless:true});
const errors = [], checks = [], key = 'jieting-chapter-three-v1';
try {
  for (const sample of [{name:'broken-json',raw:'{ broken JSON\n'}, {name:'incompatible',raw:'{"schema":1,"version":"old"}'},
    {name:'backup-quota',raw:'{ original bytes',blocked:true}, {name:'null-record',raw:'null'}]) {
    const context = await browser.newContext({viewport:{width:1440,height:900}});
    await context.route('http://127.0.0.1:8787/**',r=>r.fulfill({headers:{'Access-Control-Allow-Origin':'*'},json:{configured:false}}));
    await context.addInitScript(({key,sample})=>{
      if(!sessionStorage.getItem('initialized')) {
        localStorage.setItem('wuzhang-runtime-mode-v1','offline');
        localStorage.setItem('wuzhang-chapter-history-v1',JSON.stringify({version:1,entered:['jieting'],completed:[]}));
        localStorage.setItem(key,sample.raw);sessionStorage.setItem('initialized','1');
      }
      if(sample.blocked) {
        const original=Storage.prototype.setItem;
        Storage.prototype.setItem=function(k,v){if(k.startsWith(key+':recovery:'))throw new DOMException('full','QuotaExceededError');return original.call(this,k,v);};
      }
    },{key,sample});
    const page = await context.newPage(); page.on('pageerror',e=>errors.push(e.message));
    await page.goto(origin+'/?chapter=jieting');await page.locator('#game-root[data-node]').waitFor();
    const inspect=()=>page.evaluate(key=>({raw:localStorage.getItem(key),backups:Object.keys(localStorage).filter(k=>k.startsWith(key+':recovery:')).map(k=>localStorage.getItem(k))}),key);
    const value=await inspect();
    if(sample.blocked){assert.equal(value.raw,sample.raw);assert.deepEqual(value.backups,[]);}
    else{assert.deepEqual(value.backups,[sample.raw]);assert.equal(JSON.parse(value.raw).schema,1);}
    const node=await page.locator('#game-root').getAttribute('data-node');
    await page.locator('[data-action=notes]').click();await page.locator('[data-action=close-modal]').click();
    assert.equal(await page.locator('#game-root').getAttribute('data-node'),node);
    await page.locator('[data-action=save]').click();await page.locator('[data-action=close-modal]').click();
    assert.equal(await page.locator('#game-root').getAttribute('data-node'),node);
    await page.screenshot({path:resolve(out,sample.name+'.png')});
    await page.reload();await page.locator('#game-root[data-node]').waitFor();
    const restored=await inspect();assert.deepEqual(restored.backups,value.backups);
    if(sample.blocked) assert.equal(restored.raw,sample.raw);
    else {
      const narrative=raw=>JSON.parse(raw);
      assert.deepEqual(narrative(restored.raw),narrative(value.raw));
    }
    checks.push(`${sample.name}: exact source preserved across initialization, controls and reload`);
    await context.close();
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
  },Object.values(config).flat().find(c=>c.id==='CH2-V10'));
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
