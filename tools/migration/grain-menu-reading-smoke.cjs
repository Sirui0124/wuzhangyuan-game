const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),ts=require('typescript');
const {chromium}=require('playwright');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,f);
const {GrainSession}=require('../../GameStarter/web-demo/src/chapters/chapter-two/session.ts');
const story=JSON.parse(fs.readFileSync('content/chapters/grain/chapter-two.films.json'));
const rubric=JSON.parse(fs.readFileSync('content/chapters/grain/chapter-two.films-rubric.json'));
const fixture=new GrainSession(story,undefined,rubric,false);
while(fixture.current.id!=='CH2-LY03-002')assert.ok(fixture.advance(fixture.current.options?.[0]?.id));
const KEY='grain-chapter-two-films-v1',base='http://127.0.0.1:8812',out=path.resolve('outputs/grain-menu-reading-20261026');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[],results=[];
 try{
 const ctx=await browser.newContext({viewport:{width:1440,height:900}});
 await ctx.route('http://127.0.0.1:8787/health',r=>r.fulfill({json:{configured:false},headers:{'Access-Control-Allow-Origin':'*'}}));
 await ctx.addInitScript(()=>localStorage.setItem('wuzhang-runtime-mode-v1','offline'));
 const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
 await p.goto(base+'/?chapter=grain');await p.locator('.cinema-screen').waitFor();
 assert.equal(await p.locator('#game-root').getAttribute('data-node'),'V01');results.push('fresh entry begins at V01');
 await p.evaluate(({key,state})=>localStorage.setItem(key,JSON.stringify(state)),{key:KEY,state:fixture.state});
 await p.reload();await p.locator('.evidence-scene').waitFor();
 assert.equal(await p.locator('#game-root').getAttribute('data-node'),'CH2-LY03-002');
 assert.equal(await p.getByRole('button',{name:'读完继续'}).count(),0);results.push('existing entry resumes saved letter; old continue button removed');
 await p.locator('[data-action=pause]').click();await p.locator('[data-action=pause-save]').click();
 await p.locator('[data-store-slot="1"]').click();assert.ok((await p.locator('[data-page=saves]').innerText()).includes('已保存'));
 const slot=await p.evaluate(k=>localStorage.getItem(k+':slot:1'),KEY);assert.equal(JSON.parse(slot).node,'CH2-LY03-002');
 await p.locator('[data-store-slot="1"]').click();assert.equal(await p.locator('[data-store-slot="1"]').innerText(),'确认覆盖');
 await p.keyboard.press('Escape');await p.locator('[data-page=pause]').waitFor();
 assert.equal(await p.evaluate(k=>localStorage.getItem(k+':slot:1'),KEY),slot);
 await p.screenshot({path:path.join(out,'pause-menu.png')});
 await p.locator('[data-action=resume-game]').click();assert.equal(await p.locator('#game-root').getAttribute('data-node'),'CH2-LY03-002');
 await p.locator('[data-action=notes]').click();await p.mouse.click(700,350);assert.equal(await p.locator('#game-root').getAttribute('data-node'),'CH2-LY03-002');
 await p.keyboard.press('Escape');await p.mouse.click(700,350);await p.waitForFunction(()=>document.querySelector('#game-root').dataset.node==='V10');
 results.push('screen/paper click advances exactly once; inventory and save controls do not advance');
 await p.locator('[data-action=pause]').click();await p.locator('[data-action=pause-save]').click();await p.locator('[data-load-slot="1"]').click();
 await p.locator('.evidence-scene').waitFor();assert.equal(await p.locator('[data-page=pause]').count(),0);
 await p.locator('.evidence-reading .dialogue-text').click();await p.waitForFunction(()=>document.querySelector('#game-root').dataset.node==='V10');
 await p.locator('[data-action=pause]').click();await p.locator('[data-action=pause-restart]').click();
 await p.keyboard.press('Escape');await p.locator('[data-page=pause]').waitFor();assert.equal(await p.locator('#game-root').getAttribute('data-node'),'V10');
 await p.locator('[data-action=pause-restart]').click();await p.locator('[data-action=pause-restart-confirm]').click();
 await p.waitForFunction(()=>document.querySelector('#game-root').dataset.node==='V01');
 assert.equal(JSON.parse(await p.evaluate(k=>localStorage.getItem(k+':before-new'),KEY)).node,'V10');
 assert.equal(await p.evaluate(k=>localStorage.getItem(k+':slot:1'),KEY),slot);
 assert.ok(await p.locator('video').evaluate(v=>v.currentTime)<2);results.push('restart cancellation preserves progress; confirmed replay backs up V10, retains slots and restarts V01');
 // A save submenu must preserve the paused media element and offset.
 await p.waitForFunction(()=>document.querySelector('video')?.readyState>=2);
 await p.locator('video').evaluate(v=>{v.muted=true;v.currentTime=2;return v.play()});
 await p.locator('[data-action=pause]').click();const time=await p.locator('video').evaluate(v=>v.currentTime);
 await p.evaluate(()=>window.testMedia=document.querySelector('video'));
 await p.locator('[data-action=pause-save]').click();await p.locator('[data-store-slot="2"]').click();
 assert.equal(await p.locator('video').evaluate(v=>v.paused),true);
 assert.ok(Math.abs(await p.locator('video').evaluate(v=>v.currentTime)-time)<.1);
 await p.keyboard.press('Escape');await p.locator('[data-action=resume-game]').click();
 assert.equal(await p.evaluate(()=>window.testMedia===document.querySelector('video')),true);
 results.push('video save submenu pauses playback and resumes the same element');
 await p.locator('[data-action=pause]').click();await p.locator('[data-action=pause-save]').click();await p.locator('[data-load-slot="1"]').click();
 await p.locator('.evidence-scene').waitFor();await p.keyboard.press('Space');await p.waitForFunction(()=>document.querySelector('#game-root').dataset.node==='V10');
 // Explicit new-run URL consumes restart once and keeps manual saves.
 await p.goto(base+'/?chapter=grain&restart=1');await p.waitForFunction(()=>document.querySelector('#game-root')?.dataset.node==='V01');
 assert.ok(!p.url().includes('restart='));assert.equal(await p.evaluate(k=>localStorage.getItem(k+':slot:1'),KEY),slot);
 await p.locator('[data-action=pause]').click();await p.setViewportSize({width:390,height:844});
 await p.screenshot({path:path.join(out,'mobile-menu.png')});
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 results.push('keyboard reading and explicit restart URL work; mobile menu fits');
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({passed:true,results,errors},null,2));console.log(JSON.stringify({passed:true,results}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});

