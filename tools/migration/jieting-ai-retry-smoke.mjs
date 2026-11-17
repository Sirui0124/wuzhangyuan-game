import { addDialogueAuditReceipts } from '../../GameStarter/tests/expression-audit-fixture.mjs';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';

const output=resolve('outputs/masu-ai-diagnostic-20261027/browser');mkdirSync(output,{recursive:true});
const server=createStaticServer();await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:'chrome',headless:true});
const words='将军，正面和侧路都得守，五千人分在两处，人手就紧了。部队下山、重新列阵都要工夫，等告急再派恐怕迟援。请将军先增派些人下去，把守路的缺口补上。';
const saveKey='jieting-chapter-three-v1:playtest:reinforcement';
const evidence=['JT-C04','JT-C08'],criteria=['gapEstablished','reinforcementUse','concernAnswered','risk','route','reception','motive','means','withdrawal'];
const empty=()=>({value:false,quote:'',evidenceIds:[],itemIds:[],reason:''});
const raw=()=>({version:1,valid:true,factsReliable:true,factualIssues:[],maintain:{value:false,quote:''},
    criteria:Object.fromEntries(criteria.map(key=>[key,['gapEstablished','reinforcementUse','concernAnswered'].includes(key)?{value:true,quote:words,evidenceIds:evidence,itemIds:[],reason:'实际已有的守路缺口与下山列阵所需时间支持本次建议。'}:empty()])),
    deploymentTasks:[{task:'road',quote:words}],acknowledgment:'守路的缺口和下山列阵的工夫，你都想到了。这个办法可以商议。',followup:{needed:false,question:''},
    offense:{direct:false,target:'none',kind:'none',context:'asserted',intent:'argument',targetQuote:'',actQuote:'',quote:'',reason:'正常进言'},
    eraAssessment:{version:1,severeMismatch:false,explanation:'coherent',itemIds:[],quote:'',reason:'没有异常展示'}});
const report={mockedApi:true,polishCalls:0,judgeCalls:0,errors:[],checks:[]};
let page;
try{
    const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
    await context.addInitScript(()=>localStorage.setItem('wuzhang-runtime-mode-v1','ai'));
    await context.route('http://127.0.0.1:8787/**',async route=>{
        const path=new URL(route.request().url()).pathname;
        const headers={'Access-Control-Allow-Origin':'*'};
        if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:{...headers,'Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST,GET,OPTIONS'}});
        if(path==='/health')return route.fulfill({headers,json:{ok:true,configured:true}});
        assert.equal(path,'/api/game/respond');
        const text=route.request().postDataJSON().text;
        if(text.includes('你帮助玩家整理一段')){
            report.polishCalls++;
            if(report.polishCalls<=1)return route.fulfill({status:502,headers,json:{error:'模型连接失败，请检查代理和网络'}});
            return route.fulfill({headers,json:{text:JSON.stringify({status:'ok',text:words,evidenceIds:evidence,reason:''}),responseId:'polish-mock'}});
        }
        if(text.startsWith('核对一段'))return route.fulfill({headers,json:{text:JSON.stringify(addDialogueAuditReceipts({facts:true,intent:true,coverage:true,logic:true,items:true,reason:''},text)),responseId:'audit-mock'}});
        report.judgeCalls++;
        const input=JSON.parse(text.slice(text.lastIndexOf('\n')+1));
        assert.equal(input.context.nodeId,'JT-OPEN-R1');assert.equal(input.playerWords,words);assert.deepEqual(input.clueIds,evidence);
        if(report.judgeCalls===1)return route.fulfill({status:502,headers,json:{error:'模型未返回完整文字回复'}});
        return route.fulfill({headers,json:{text:report.judgeCalls===2?'not a complete JSON judgment':JSON.stringify(raw()),responseId:'judge-mock'}});
    });
    page=await context.newPage();page.on('pageerror',error=>report.errors.push(error.message));
    await page.goto(`${base}/?chapter=jieting&playtest=reinforcement`,{waitUntil:'domcontentloaded'});
    await page.locator('[data-node="JT-OPEN-R1"]').waitFor();
    const state=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),saveKey);
    const diagnostics=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key+':last-ai-error')),saveKey);
    const original=await state();
    await page.locator('[data-action=clue-items]').click();
    for(const id of evidence)await page.locator(`[data-select="${id}"]`).click();
    await page.locator('[data-action=clue-items]').click();
    const intact=async()=>{
        const saved=await state();assert.equal(saved.node,'JT-OPEN-R1');assert.deepEqual(saved.selected,evidence);
        assert.deepEqual(saved.scores,original.scores);assert.deepEqual(saved.roundResults,original.roundResults);
        assert.deepEqual(saved.judgments,[]);assert.equal(saved.ending,null);
        assert.equal(await page.evaluate(()=>localStorage.getItem('wuzhang-runtime-mode-v1')),'ai');
        assert.equal(await page.locator('[data-action=fixed-mode]').count(),0);assert.equal(await page.locator('[data-option]').count(),0);
    };
    await page.locator('[data-action=polish-expression]').click();
    await page.getByRole('button',{name:'重试润色',exact:true}).waitFor();await intact();
    assert.equal((await diagnostics()).action,'polish');assert.equal(report.judgeCalls,0);
    assert.equal((await state()).draft,'');
    await page.screenshot({path:resolve(output,'polish-retry.png')});report.checks.push('polish failure retains selected clues and offers polish retry without switching AI off');
    await page.getByRole('button',{name:'重试润色',exact:true}).click();
    await page.waitForFunction(text=>document.querySelector('#player-expression')?.value===text,words);
    await page.getByRole('button',{name:'确认说出 ↗',exact:true}).waitFor();
    await intact();assert.equal((await state()).draft,words);
    await page.locator('[data-action=speak]').click();
    await page.getByRole('button',{name:'重试说出 ↗',exact:true}).waitFor();await intact();
    assert.equal((await state()).draft,words);assert.equal((await diagnostics()).action,'speak');assert.equal((await diagnostics()).input,words);
    await page.screenshot({path:resolve(output,'speech-retry.png')});report.checks.push('HTTP error preserves polished draft, clues, scores and mode; retries the same Ma Su request');
    await page.locator('[data-action=speak]').click();
    await page.getByRole('button',{name:'重试说出 ↗',exact:true}).waitFor();await intact();assert.equal((await state()).draft,words);
    report.checks.push('malformed model output remains retryable, with no invented progress or fixed-choice redirect');
    await page.locator('[data-action=speak]').click();await page.locator('.dialogue-advance').waitFor();
    const accepted=await state();assert.equal(accepted.pendingJudgment.outcome,'great');assert.equal(accepted.judgments.length,1);
    assert.deepEqual(accepted.roundResults,original.roundResults);assert.deepEqual(accepted.scores,original.scores);
    assert.equal(accepted.transcript.filter(row=>row.speaker==='我'&&row.text===words).length,1);
    assert.equal(await page.locator('#spoken-line').textContent(),raw().acknowledgment);
    await page.screenshot({path:resolve(output,'speech-accepted.png')});
    report.checks.push('successful retry adopts one NPC reply; actual military order and arrival remain later story events');
    assert.deepEqual(report.errors,[]);writeFileSync(resolve(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
    await context.close();
}catch(error){report.errors.push(error.message);await page?.screenshot({path:resolve(output,'failure.png')}).catch(()=>{});writeFileSync(resolve(output,'report.json'),JSON.stringify(report,null,2));throw error;}
finally{await browser.close();await new Promise(ok=>server.close(ok));}
