import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';
const build=resolve(process.env.GAME_BUILD??'GameStarter/web-demo/.build');
const load=name=>import(pathToFileURL(resolve(build,'GameStarter/web-demo/src',name)).href);
const {GrainSession}=await load('chapters/chapter-two/session.js');
const {fixedJudgment}=await load('chapters/chapter-two/film-dialogue.js');
const {createJietingPlaytest}=await load('chapters/chapter-three/session.js');

const out=resolve('outputs/release-fixes-20261027/continuity-browser');mkdirSync(out,{recursive:true});
const read=path=>JSON.parse(readFileSync(path,'utf8'));
const story=read('content/chapters/grain/chapter-two.films.json'),rubric=read('content/chapters/grain/chapter-two.films-rubric.json');
const third=read('content/chapters/jieting/chapter-three.story.json');
const grainKey='grain-chapter-two-films-v1',thirdKey='jieting-chapter-three-v1';
const grain=new GrainSession(story,undefined,rubric,false);
for(let i=0;i<200&&grain.current.kind!=='open';i++)assert.ok(grain.advance(grain.current.options?.[0]?.id));
assert.equal(grain.current.kind,'open');const manual=JSON.stringify(grain.state);
const old=JSON.stringify({...grain.state,version:story.version+'-old-test'});
const thirdOld=createJietingPlaytest(third,'reinforcement',{aiEnabled:false,phoneAllowed:false}).snapshot();thirdOld.version='jieting-20261026-1a640d464f8a';
const server=createStaticServer({root:build});await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({channel:'chrome',headless:true});
const checks=[],errors=[];
async function isolated(seeds,{failBackup=false,failRead=false,viewport={width:1440,height:900}}={}) {
    const context=await browser.newContext({viewport,reducedMotion:'reduce'});
    await context.route('**/*',route=>{
        const url=new URL(route.request().url());
        if(url.origin===base)return route.continue();
        if(url.hostname==='127.0.0.1'&&url.pathname==='/health')return route.fulfill({headers:{'Access-Control-Allow-Origin':base},json:{configured:false}});
        return route.abort();
    });
    await context.addInitScript(({seeds,failBackup,failRead,grainKey})=>{
        const get=Storage.prototype.getItem,set=Storage.prototype.setItem;
        if(!sessionStorage.getItem('save-review-seeded')){sessionStorage.setItem('save-review-seeded','1');for(const[k,v]of Object.entries(seeds))localStorage.setItem(k,v);}
        localStorage.setItem('wuzhang-runtime-mode-v1','offline');localStorage.setItem('wuzhang-reduced-motion','1');
        window.reviewFailBackup=failBackup;window.reviewFailRead=failRead;
        window.reviewRaw=k=>get.call(localStorage,k);
        Storage.prototype.getItem=function(k){if(this===localStorage&&k===grainKey&&window.reviewFailRead)throw new Error('isolated read failure');return get.call(this,k);};
        Storage.prototype.setItem=function(k,v){if(this===localStorage&&k.startsWith(grainKey+':recovery:')&&window.reviewFailBackup)throw new Error('isolated backup quota failure');return set.call(this,k,v);};
    },{seeds,failBackup,failRead,grainKey});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    return {context,page};
}
const raw=(page,key=grainKey)=>page.evaluate(k=>window.reviewRaw(k),key);
const backups=page=>page.evaluate(key=>Object.keys(localStorage).filter(k=>k.startsWith(key+':recovery:')).map(k=>({key:k,raw:window.reviewRaw(k)})),grainKey);
async function run(name,seeds,options,exercise){const{context,page}=await isolated(seeds,options);try{await exercise(page);checks.push(name);await page.screenshot({path:resolve(out,name+'.png'),fullPage:true});}catch(error){await page.screenshot({path:resolve(out,name+'-failure.png'),fullPage:true});throw error;}finally{await context.close();}}
try{
    await run('malformed-json-preserved-and-manual-recovery',{[grainKey]:'{ broken JSON\n',[grainKey+':slot:1']:manual},{},async page=>{
        await page.goto(base+'/?chapter=grain');await page.getByText('保留旧进度',{exact:true}).waitFor();
        assert.equal(await raw(page),'{ broken JSON\n');assert.equal((await backups(page))[0].raw,'{ broken JSON\n');
        await page.screenshot({path:resolve(out,'malformed-json-recovery-dialog.png'),fullPage:true});
        await page.keyboard.press('Escape');await page.getByText('保留旧进度',{exact:true}).waitFor();
        assert.equal(await page.locator('video').count(),0);
        await page.reload();await page.getByText('保留旧进度',{exact:true}).waitFor();assert.equal((await backups(page)).length,1);
        await page.locator('[data-action="save"]:visible').last().click();assert.equal(await page.locator('[data-store-slot]').count(),0);
        await page.locator('[data-load-slot="1"]').click();await page.locator('[data-fixed-speech]').first().waitFor();
        assert.equal(JSON.parse(await raw(page)).node,grain.current.id);assert.equal((await backups(page))[0].raw,'{ broken JSON\n');
    });
    await run('backup-failure-blocks-overwrite-and-retry-recovers',{[grainKey]:old,[grainKey+':slot:1']:manual},{failBackup:true,viewport:{width:844,height:390}},async page=>{
        await page.goto(base+'/?chapter=grain');await page.getByText(/备份还没有保存成功/).waitFor();
        assert.equal(await raw(page),old);assert.equal((await backups(page)).length,0);assert.equal(await page.locator('[data-action="restart-recovered"]').count(),0);
        await page.screenshot({path:resolve(out,'backup-failure-dialog-landscape.png'),fullPage:true});
        await page.locator('[data-action="save"]:visible').last().click();await page.locator('[data-load-slot="1"]').click();
        await page.getByText(/旧进度备份尚未完成/).waitFor();assert.equal(await raw(page),old);
        await page.locator('[data-action="close-modal"]').click();await page.evaluate(()=>window.reviewFailBackup=false);
        await page.locator('[data-action="retry-save-recovery"]').click();await page.getByText(/原记录已另存备份/).waitFor();
        await page.locator('[data-action="restart-recovered"]').click();await page.locator('video').waitFor();
        assert.equal(JSON.parse(await raw(page)).node,story.start);assert.equal((await backups(page))[0].raw,old);
    });
    await run('read-failure-keeps-original',{[grainKey]:manual},{failRead:true},async page=>{
        await page.goto(base+'/?chapter=grain');await page.getByText(/暂时无法读取本机进度/).waitFor();
        assert.equal(await raw(page),manual);assert.equal(await page.locator('video').count(),0);assert.equal((await backups(page)).length,0);
    });
    await run('third-previous-version-manual-migrates',{[thirdKey+':slot:1']:JSON.stringify(thirdOld)},{},async page=>{
        await page.goto(base+'/?chapter=jieting');await page.locator('[data-action="save"]').click();await page.locator('[data-load-slot="1"]').click();
        await page.waitForFunction(id=>document.querySelector('#game-root')?.dataset.node===id,thirdOld.node);
        const restored=JSON.parse(await raw(page,thirdKey));assert.equal(restored.version,third.version);assert.equal(restored.node,thirdOld.node);
        assert.equal(await raw(page,thirdKey+':slot:1'),JSON.stringify(thirdOld));
    });
    const reading=new GrainSession(story,undefined,rubric,false);
    for(let i=0;i<200&&reading.current.id!=='CH2-LY02-014';i++){
        if(reading.current.kind==='open')reading.submit(fixedJudgment(reading.current.round,0,reading.currentRubric).judgment);
        assert.ok(reading.advance(reading.current.options?.[0]?.id));
    }
    assert.equal(reading.current.id,'CH2-LY02-014');
    await run('second-reading-tap-and-menu-controls',{[grainKey]:JSON.stringify(reading.state)},{viewport:{width:844,height:390}},async page=>{
        await page.goto(base+'/?chapter=grain');await page.locator('.evidence-scene').waitFor();
        const unchanged=async()=>assert.equal(await page.locator('#game-root').getAttribute('data-node'),reading.current.id);
        await page.locator('[data-action="records"]').click();await unchanged();await page.locator('[data-action="close-modal"]').click();await unchanged();
        await page.locator('[data-action="notes"]').click();await page.mouse.click(20,120);await unchanged();await page.keyboard.press('Escape');await unchanged();
        await page.locator('[data-action="pause"]').click();await unchanged();await page.locator('[data-action="pause-save"]').click();await unchanged();
        await page.locator('[data-store-slot="1"]').click();await unchanged();assert.equal(JSON.parse(await raw(page,grainKey+':slot:1')).node,reading.current.id);
        await page.locator('[data-action="close-modal"]').click();await unchanged();await page.locator('[data-action="resume-game"]').click();await unchanged();
        await page.mouse.click(20,120);await page.waitForFunction(id=>document.querySelector('#game-root')?.dataset.node===id,reading.current.next);
    });
    const choice=new GrainSession(story,undefined,rubric,false);choice.advance();choice.advance();assert.equal(choice.current.kind,'choice');
    await run('second-choice-waits-for-option',{[grainKey]:JSON.stringify(choice.state)},{viewport:{width:844,height:390}},async page=>{
        await page.goto(base+'/?chapter=grain');await page.locator('[data-option]').first().waitFor();
        await page.mouse.click(20,120);assert.equal(await page.locator('#game-root').getAttribute('data-node'),choice.current.id);
        await page.locator('[data-option]').first().click();await page.waitForFunction(id=>document.querySelector('#game-root')?.dataset.node===id,choice.current.options[0].next);
    });
    await run('compatible-backup-can-be-restored',{[grainKey]:JSON.stringify(choice.state),[grainKey+':recovery:1']:manual},{},async page=>{
        await page.goto(base+'/?chapter=grain');await page.locator('[data-action="save"]').click();
        await page.getByText('旧进度备份（1）',{exact:true}).click();await page.locator('[data-load-backup]').click();
        await page.locator('[data-fixed-speech]').first().waitFor();assert.equal(JSON.parse(await raw(page)).node,grain.current.id);
        assert.equal((await backups(page))[0].raw,manual);
    });
    grain.submit(fixedJudgment('O1',0,grain.currentRubric).judgment);const firstInput=grain.state.judgments[grain.current.id].input;grain.advance();
    for(let i=0;i<200&&grain.current.kind!=='open'&&grain.current.kind!=='finish';i++)assert.ok(grain.advance(grain.current.options?.[0]?.id));
    assert.equal(grain.current.round,'O2');
    await run('second-history-follows-the-scene-order',{[grainKey]:JSON.stringify(grain.state)},{},async page=>{
        await page.goto(base+'/?chapter=grain');await page.locator('[data-action="records"]').click();
        const text=await page.locator('.dialogue-stream').innerText(),later='我去魏国，求他们放我回来';
        assert.ok(text.includes(firstInput)&&text.includes(later));assert.ok(text.indexOf(firstInput)<text.indexOf(later));
        assert.equal(text.split(firstInput).length-1,1);
    });
    assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,checks,errors},null,2));
    writeFileSync(resolve(out,'checks.json'),JSON.stringify({passed:true,checks,errors},null,2));
}catch(error){writeFileSync(resolve(out,'checks.json'),JSON.stringify({passed:false,checks,errors,error:error.message},null,2));throw error;}
finally{await browser.close();server.closeAllConnections();await new Promise(ok=>server.close(ok));}
