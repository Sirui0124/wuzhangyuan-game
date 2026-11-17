import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,'../..');
console.log('Launching browser');
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
const report={checkedAt:new Date().toISOString(),checks:[],errors};
try {
  console.log('Opening offline inventory');
  await page.goto(pathToFileURL(resolve(here,'素材资产清单.html')).href,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#heroes .card');
  assert.equal(await page.locator('#heroes .card').count(),3);
  console.log('Checking identity images');
  await page.locator('#heroes img').evaluateAll(imgs=>imgs.forEach(img=>img.loading='eager'));
  await page.waitForFunction(()=>[...document.querySelectorAll('#heroes img')].every(img=>img.complete&&img.naturalWidth>0),{timeout:15000});
  report.checks.push('file:// 离线页面打开，三位核心人物的六张对照图加载成功');
  await page.locator('#character').selectOption('weiyan');
  await page.locator('#type').selectOption('视频');
  const count=await page.locator('#count').innerText();
  assert(!count.startsWith('找到 0 '));
  await page.locator('#rows button').first().click();
  await page.waitForSelector('dialog[open] video');
  await page.waitForFunction(()=>{const v=document.querySelector('dialog video');return v.readyState>=1||v.error},{timeout:20000});
  const video=await page.locator('video').evaluate(v=>({duration:v.duration,width:v.videoWidth,error:v.error?.message||null}));
  assert(!video.error);assert(video.duration>0);report.checks.push('人物+视频筛选与一段本地视频的元数据加载成功');report.sampleVideo=video;
  await page.locator('#close').click();await page.waitForSelector('video',{state:'detached'});
  await page.locator('#reset').click();
  await page.locator('#search').fill('不存在的素材__000');
  assert((await page.locator('#rows').innerText()).includes('没有符合'));
  await page.locator('#reset').click();await page.locator('#next').click();assert((await page.locator('#page').innerText()).startsWith('2 /'));
  report.checks.push('空搜索、分页、重置与关闭预览均正常');
  await page.setViewportSize({width:800,height:1000});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  report.checks.push('800px 窗口无整页横向溢出');
  for(const name of ['GameStarter/web-demo/visual-assets.json','GameStarter/web-demo/public/video/media-manifest.json','GameStarter/web-demo/build.mjs','GameStarter/web-demo/tsconfig.json','GameStarter/packaging/windows/stage-payload.mjs','GameStarter/packaging/windows/electron-builder.config.cjs']) {
    assert(!readFileSync(resolve(root,name),'utf8').includes('asset-library'));
  }
  report.checks.push('游戏清单、构建入口、编译配置与 Windows 打包入口未引用准备目录；未执行安装包构建');
  assert.equal(errors.length,0);report.status='passed';
} catch(error){report.status='failed';report.failure=error.stack;process.exitCode=1}
finally {writeFileSync(resolve(here,'browser-validation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close()}
