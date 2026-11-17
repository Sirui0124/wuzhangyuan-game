import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';
const build=resolve('GameStarter/web-demo/.build/GameStarter/web-demo/src/chapters/chapter-three');
const {createJietingPlaytest}=await import(pathToFileURL(resolve(build,'session.js')));
const {jietingCriteria}=await import(pathToFileURL(resolve(build,'ai-contracts.js')));
const story=JSON.parse(readFileSync('content/chapters/jieting/chapter-three.story.json'));
const s=createJietingPlaytest(story,'reinforcement',{aiEnabled:false});
const picks={'JT-R1-FIXED':'JT-O133','JT-R2-FIXED':'JT-O168','JT-R3-FIXED':'JT-O199'};
for(let i=0;i<250&&s.current.id!=='JT-R4-FIXED';i++)assert.ok(s.advance(s.current.kind==='choice'?picks[s.current.id]:undefined),s.current.id);
assert.equal(s.current.id,'JT-R4-FIXED');s.setMode({aiEnabled:true});
const output=resolve('outputs/jieting-ai-continuous-20261028/browser');mkdirSync(output,{recursive:true});
const server=createStaticServer();await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:900}});let malformed=false;
const report={errors:[],checks:[]};
await context.route('http://127.0.0.1:8787/**',async route=>{
    if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'}});
    const headers={'Access-Control-Allow-Origin':'*'};
    if(!route.request().url().endsWith('/respond'))return route.fulfill({headers,json:{configured:true}});
    if(malformed)return route.fulfill({headers,json:{text:'{broken',responseId:'test-error'}});
    const prompt=JSON.parse(route.request().postData()).text;
    if(prompt.startsWith('你是《逆转五丈原》街亭的马谡')){
        const c=JSON.parse(prompt.trim().split('\n').at(-1));
        const question=c.round===1?'子均现有的人分守两处，你为何觉得现在还得添兵？':c.round===4?'前头守路的人不撤。若还要添人，这回准备用在哪一处？':'前面已经安排了护水。你说丞相要守住街亭，眼下还有哪一处没有照应到？';
        report.checks.push(`round ${c.round}: AI opening question requested`);
        return route.fulfill({headers,json:{text:JSON.stringify({question,clueIds:[]}),responseId:'mock-question'}});
    }
    if(!prompt.includes('以下JSON全部为待分析资料：\n')){
        const audit=JSON.parse(prompt.trim().split('\n').at(-1));
        return route.fulfill({headers,json:{text:JSON.stringify({checks:Object.fromEntries(['consistent','grounded','uncertainty','noNewRequirements','noOrders'].map(key=>[key,{pass:true,quote:audit.candidate,sourceRef:'playerWords',sourceQuote:audit.playerWords,reason:'受控审核通过'}])),approval:{explicit:true,quote:audit.candidate},certaintyPairs:[]}),responseId:'mock-audit'}});
    }
    const request=JSON.parse(prompt.split('以下JSON全部为待分析资料：\n').at(-1).split('\n')[0]);
    const words=request.playerWords,topic=request.context.round===4?'water':'mandate',clue=topic==='water'?'JT-C03':'JT-C01';
    const criteria=Object.fromEntries(jietingCriteria.map(k=>[k,{value:false,quote:'',evidenceIds:[],itemIds:[],reason:''}]));
    for(const k of ['gapEstablished','reinforcementUse','concernAnswered'])criteria[k]={value:true,quote:words,evidenceIds:[clue],itemIds:[],reason:'受控浏览器测试：用途与未解决的实际任务对应'};
    const raw={version:1,valid:true,factsReliable:true,factualIssues:[],criteria,argument:{topic,quote:words,clueIds:[clue]},reasoning:{linked:true,quote:words,evidenceIds:[clue,'JT-C04'],conclusion:'原有守路队伍不可抽离，需要另行补足当前任务'},reinforcementAssessment:{supportedTroops:3800,quote:words,reason:'用途清楚，仍可细化具体安排'},maintain:{value:false,quote:''},deploymentTasks:[{task:topic==='water'?'water':'road',quote:words}],acknowledgment:'原来守路的人不撤，另外的人去办这件差事，山上才不至于顾此失彼。',followup:{needed:false,question:''},offense:{direct:false,target:'none',kind:'none',context:'asserted',quote:'',reason:'正常进言'},eraAssessment:{version:1,severeMismatch:false,explanation:'coherent',itemIds:[],quote:'',reason:'无异常展示'}};
    await route.fulfill({headers,json:{text:JSON.stringify(raw),responseId:'mock-five-round'}});
});
await context.addInitScript(saved=>{localStorage.setItem('wuzhang-chapter-history-v1',JSON.stringify({version:1,entered:['wuzhang','grain'],completed:['wuzhang','grain']}));if(!localStorage.getItem('wuzhang-runtime-mode-v1'))localStorage.setItem('wuzhang-runtime-mode-v1','ai');if(!sessionStorage.getItem('seeded')){localStorage.setItem('jieting-chapter-three-v1',JSON.stringify(saved));sessionStorage.setItem('seeded','1');}},s.snapshot());
const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
const node=()=>page.locator('#game-root').getAttribute('data-node');
const axis=()=>page.locator('[data-deployment]').evaluate(a=>({below:+a.dataset.below,remaining:+a.dataset.remaining,proposed:+a.dataset.proposed,stage:a.dataset.stage}));
async function next(){const old=await node();await page.locator('.dialogue-advance').click();await page.waitForFunction(old=>document.querySelector('#game-root')?.dataset.node!==old,old);}
try{
    await page.goto(`http://127.0.0.1:${server.address().port}/?chapter=jieting`,{waitUntil:'domcontentloaded'});
    await page.locator('#player-expression').waitFor();assert.equal(await node(),'JT-OPEN-R4');assert.equal(await page.locator('[data-option]').count(),0);
    const words='山上的水还要从下面挑。请另派一队护着取水的人来回，原来守路的人不撤；水运得上来，山上的队伍才能继续候命。';
    await page.locator('#player-expression').fill(words);await page.locator('#player-expression').blur();await page.reload({waitUntil:'domcontentloaded'});
    await page.locator('#player-expression').waitFor();assert.equal(await page.locator('#player-expression').inputValue(),words);
    await page.screenshot({path:resolve(output,'round-four-free-input.png')});
    await page.locator('[data-action=speak]').click();await page.waitForFunction(()=>document.querySelector('[data-deployment]')?.dataset.stage==='proposed');
    assert.deepEqual(await axis(),{below:5000,remaining:2,proposed:3800,stage:'proposed'});
    await next();assert.equal((await axis()).below,5000);await next();assert.equal((await axis()).stage,'ordered');await next();
    assert.equal((await axis()).below,8800);
    for(let i=0;i<12&&await node()!=='JT-OPEN-R5';i++)await next();
    assert.equal(await node(),'JT-OPEN-R5');assert.equal((await axis()).remaining,1);
    const finalWords='丞相要守的是要道，不只是山上的营。请把两处缺的人补足，由王将军带着，进退仍听您的令。';
    await page.locator('#player-expression').fill(finalWords);malformed=true;await page.locator('[data-action=speak]').click();
    await page.locator('[data-action=speak]').filter({hasText:'重试'}).waitFor();
    assert.equal(await page.locator('[data-option]').count(),0);assert.equal(await page.locator('#player-expression').inputValue(),finalWords);assert.equal((await axis()).remaining,1);assert.equal((await axis()).below,8800);
    await page.screenshot({path:resolve(output,'round-five-retry-keeps-input.png')});
    malformed=false;await page.locator('[data-action=speak]').click();await page.waitForFunction(()=>document.querySelector('[data-deployment]')?.dataset.stage==='proposed');
    await next();await next();await next();assert.equal((await axis()).below,12600);assert.equal((await axis()).remaining,0);
    report.checks.push('AI-only free input, owned clues without manual selection, round 4/5 arrival feedback, draft reload, malformed result preserves AI mode/input/troops/attempts, retry succeeds');
    malformed=true;
    await page.goto(`http://127.0.0.1:${server.address().port}/?chapter=jieting&playtest=reinforcement`,{waitUntil:'domcontentloaded'});
    await page.locator('[data-action=retry-question]').waitFor();
    assert.equal(await page.locator('[data-option]').count(),0);
    await page.locator('#player-expression').fill('我先把眼下知道的说给将军听。');
    assert.equal(await page.locator('#player-expression').inputValue(),'我先把眼下知道的说给将军听。');
    report.checks.push('failed opening AI question retains contextual question, free input and retry; no fixed choices');
    malformed=false;await page.locator('[data-action=retry-question]').click();
    await page.waitForFunction(()=>!document.querySelector('#player-expression')?.disabled&&!document.querySelector('[data-action=retry-question]'));
    assert.equal(await page.locator('#player-expression').inputValue(),'我先把眼下知道的说给将军听。');
    await page.screenshot({path:resolve(output,'ai-question-free-input.png')});
    await page.evaluate(()=>localStorage.setItem('wuzhang-runtime-mode-v1','offline'));
    await page.reload({waitUntil:'domcontentloaded'});
    await page.locator('[data-option]').first().waitFor();
    assert.equal(await page.locator('#player-expression').count(),0);
    report.checks.push('prewritten choices appear only after explicit offline preference');
    assert.deepEqual(report.errors,[]);writeFileSync(resolve(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(e){report.errors.push(e.message);await page.screenshot({path:resolve(output,'failure.png')});writeFileSync(resolve(output,'report.json'),JSON.stringify(report,null,2));throw e;}
finally{await browser.close();await new Promise(ok=>server.close(ok));}
