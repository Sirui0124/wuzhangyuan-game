import {createRequire} from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';
import {accepted,prepared,input,finish,chapter,NarrativeEngine,tutorialInput} from './weiyan-fixture.mjs';
const require=createRequire(import.meta.url);
const {ApiJudge}=require('../../.narrative-build/GameStarter/assets/scripts/narrative/judge.js');
const {GameApi}=require('../../.narrative-build/GameStarter/assets/scripts/GameApi.js');
const {classifyWeiyan}=require('../../.narrative-build/GameStarter/assets/scripts/narrative/weiyan.js');
const {WEIYAN_TUTORIAL_PROMPT}=require('../../.narrative-build/GameStarter/assets/scripts/narrative/weiyan-first.js');
const {WEIYAN_PROMPT}=require('../../.narrative-build/GameStarter/assets/scripts/narrative/weiyan-second.js');
const cards=['scout_statement','jiangwei_authorization'];
const apiPort=(choice,calls=[])=>new ApiJudge({async respond(payload){const p=JSON.parse(payload.text);calls.push(p);return {text:JSON.stringify(p.kind==='classify'?{requestId:p.requestId,choice,planQuote:p.playerText,reason:'test',effects:[{type:'setFlag',flag:'loop.player_alive',value:false}]}:{'决策分类':p.decisionCategory,'回应的话':'军情须及时上达。'+p.immutableAnchor})};}});
test('three-choice adapter uses only actual evidence and present utterance, no memory; arbitrary model effects are ignored',async()=>{
 const calls=[],e=await prepared(false,apiPort('WAIT_OUTSIDE',calls));input(e);
 const r=await e.submitFreeInput('propose_wait',cards,'营门未破，我立即到帐门请姜将军出来听急报。');assert.equal(r.result.status,'accept');
 assert.deepEqual(calls[0].presentedEvidence.map(e=>e.id).sort(),['entry_notice',...cards].sort());assert.deepEqual(Object.keys(calls[0]).sort(),['kind','instructions','requestId','playerText','presentedEvidence','engineFacts'].sort());
 assert.equal(calls[1].fixedDecision,'accepted_second');assert.match(calls[0].instructions,/EXECUTE/);assert.equal(e.snapshot().flags['loop.player_alive'],true);assert.equal(e.snapshot().flags['loop.result'],'none');finish(e);assert.equal(e.interactions().nodeId,'v07.handoff');
});
for(const phase of ['first','second'])for(const [choice,status,next] of [['ENTER_TENT','need_plan',phase==='first'?'tutorial.failure':'ending.lamp_failure'],['EXECUTE','out_of_scope','weiyan.execution']])test(`${phase}: ${choice} has a distinct authored world outcome`,async()=>{
 const e=phase==='first'?new NarrativeEngine(chapter,'branches',apiPort(choice)):await prepared(false,apiPort(choice));phase==='first'?tutorialInput(e):input(e);
 const r=await e.submitFreeInput('propose_wait',phase==='first'?['scout_statement']:cards,'测试原话');assert.equal(r.result.status,status);finish(e);assert.equal(e.interactions().nodeId,next);finish(e);
 assert.equal(e.snapshot().flags['loop.result'],choice==='EXECUTE'?'execution':'lamp_failure');assert.equal(e.snapshot().flags['loop.player_alive'],choice!=='EXECUTE');assert.equal(e.snapshot().flags['progress.tutorial_completed'],phase==='second');
 if(choice==='EXECUTE'){assert.equal(e.snapshot().flags['loop.execution_reason'],'provocation');assert.equal(e.snapshot().flags['loop.report_status'],'none');}
});
test('missing or unsubmitted second evidence never opens the input',async()=>{
 const e=await prepared();e.enterScene('report_post');e.selectCharacter('weiyan');
 for(const ids of [['scout_statement','scout_statement']]){assert.equal(e.tryPresentEvidence(ids),false);assert.equal(e.interactions().freeInput,null);}
});
test('renderer failure uses authored conclusion; effects wait for confirmation',async()=>{
 const e=await prepared(false,{async judge(r){return accepted(r);},async renderReply(){throw Error('wording timeout');}});input(e);assert.equal((await e.submitFreeInput('propose_wait',cards,'我立即去请姜将军接报')).kind,'judged');assert.match(e.currentLine().text,/马上接报/);assert.equal(e.snapshot().flags['loop.result'],'none');finish(e);assert.equal(e.snapshot().flags['loop.result'],'none');finish(e);assert.equal(e.snapshot().flags['loop.result'],'safe');
});
test('cancelled judge or renderer cannot write a late decision and draft remains editable',async()=>{
 for(const renderer of [false,true]){let done,request;const e=await prepared(false,renderer?{async judge(r){return accepted(r);},renderReply(){return new Promise(resolve=>done=resolve);}}:{judge(r){request=r;return new Promise(resolve=>done=resolve);}});input(e);const before=e.snapshot().revision;const p=e.submitFreeInput('propose_wait',cards,'保留草稿');await new Promise(resolve=>setImmediate(resolve));e.cancelFreeInput();done(renderer?'编造文本':accepted(request));assert.equal((await p).kind,'stale');assert.equal(e.snapshot().revision,before);assert.equal(e.snapshot().flags['loop.result'],'none');assert.equal(e.snapshot().drafts['weiyan.negotiate'],'保留草稿');}
});
test('valid contextual wording is retained without keyword-based rewriting',async()=>{
 const lead='不必入帐，你立刻隔帘请姜将军接报。';
 const e=await prepared(false,new ApiJudge({async respond(payload){const p=JSON.parse(payload.text);return {text:JSON.stringify(p.kind==='classify'?{requestId:p.requestId,choice:'WAIT_OUTSIDE',reason:'立即隔帘接报'}:{'决策分类':p.decisionCategory,'回应的话':lead+p.immutableAnchor})};}}));
 input(e);const r=await e.submitFreeInput('propose_wait',cards,'丞相禁止任何人入帐。我立刻隔帘请姜将军接报定夺，由他担责。');
 assert.equal(r.result.status,'accept');assert(e.currentLine().text.startsWith(lead));
});
test('transport timeout and cancellation abort the request in bounded time',async()=>{
 const original=globalThis.fetch;let aborted=false;globalThis.fetch=async(url,options)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>{aborted=true;reject(new DOMException('aborted','AbortError'));},{once:true}));
 try{await assert.rejects(new GameApi().respond({text:'test'},undefined,15),/回应超时/);assert(aborted);const c=new AbortController(),p=new GameApi().respond({text:'test'},c.signal,1000);c.abort();await assert.rejects(p,/aborted/);}finally{globalThis.fetch=original;}
});

test('generated anchor is never duplicated',async()=>{
 const e=await prepared(false,new ApiJudge({async respond(payload){const p=JSON.parse(payload.text);return {text:JSON.stringify(p.kind==='classify'?{requestId:p.requestId,choice:'WAIT_OUTSIDE',planQuote:p.playerText,reason:'及时接报'}:{'决策分类':p.decisionCategory,'回应的话':p.immutableAnchor+p.immutableAnchor})};}}));input(e);await e.submitFreeInput('propose_wait',cards,'我立即去帐门请姜将军接报');assert.equal((e.currentLine().text.match(/哼，那就叫他马上接报/g)||[]).length,1);
});

test('JSON reply must echo the AI decision and retain the authored conclusion',async()=>{
 for(const bad of [p=>({'决策分类':'震怒处斩','回应的话':'军情须及时上达。'+p.immutableAnchor}),p=>({'决策分类':p.decisionCategory,'回应的话':'我现在就入帐！'}),p=>({'决策分类':p.decisionCategory,'回应的话':'军情须及时上达。'+p.immutableAnchor,extra:true})]){
  let anchor;const e=await prepared(false,new ApiJudge({async respond(payload){const p=JSON.parse(payload.text);if(p.kind==='render')anchor=p.immutableAnchor;return {text:JSON.stringify(p.kind==='classify'?{requestId:p.requestId,choice:'WAIT_OUTSIDE',planQuote:p.playerText,reason:'及时接报'}:bad(p))};}}));input(e);const r=await e.submitFreeInput('propose_wait',cards,'我立即到帐外请姜将军接急报');assert.equal(r.result.status,'accept');assert.equal(e.currentLine().text,anchor);
 }
});

test('plan quote grounding is judged in the prompt; code does not override the AI verdict',async()=>{
 const e=await prepared(false,new ApiJudge({async respond(payload){const p=JSON.parse(payload.text);return {text:JSON.stringify(p.kind==='classify'?{requestId:p.requestId,choice:'WAIT_OUTSIDE',planQuote:'我立即去请姜将军接报',reason:'model verdict'}:{lead:''})};}}));input(e);const r=await e.submitFreeInput('propose_wait',cards,'将军命我拦你，不准入帐');assert.equal(r.result.status,'accept');assert.equal(r.result.explanation,'model verdict');finish(e);assert.equal(e.interactions().nodeId,'v07.handoff');
 for(const prompt of [WEIYAN_TUTORIAL_PROMPT,WEIYAN_PROMPT])assert.match(prompt,/planQuote必须逐字摘录playerText/);
});

test('for identical player text the model choice alone selects each of the three outcomes',async()=>{
 for(const [choice,expected] of [['WAIT_OUTSIDE','accept'],['ENTER_TENT','need_plan'],['EXECUTE','out_of_scope']]){
  const e=await prepared(false,apiPort(choice));input(e);const r=await e.submitFreeInput('propose_wait',cards,'此句由模型判断');assert.equal(r.result.status,expected);
 }
});

test('the two phases send independent complete prompts and only second phase sends approval',async()=>{
 for(const first of [true,false]){
  const calls=[],e=first?new NarrativeEngine(chapter,'first',apiPort('WAIT_OUTSIDE',calls)):await prepared(false,apiPort('WAIT_OUTSIDE',calls));first?tutorialInput(e):input(e);
  const r=await e.submitFreeInput('propose_wait',first?['scout_statement']:cards,'禁令在先，我立即请人接急报。');assert.equal(r.result.status,'accept');
  assert.equal(calls[0].instructions,first?WEIYAN_TUTORIAL_PROMPT:WEIYAN_PROMPT);
  assert.equal('engineFacts' in calls[0],!first);assert.equal(calls[1].negotiationPhase,first?'first':'second');
 }
 assert.doesNotMatch(WEIYAN_TUTORIAL_PROMPT,/姜维|姜将军/);assert.match(WEIYAN_PROMPT,/engineFacts.approval须为true/);
 assert.notEqual(WEIYAN_TUTORIAL_PROMPT,WEIYAN_PROMPT);
});

test('evidence sufficiency and approval are prompt inputs, never code overrides of a valid verdict',async()=>{
 for(const nodeId of ['tutorial.weiyan.negotiate','weiyan.negotiate']){
  const request={requestId:'prompt-owned',nodeId,text:'模型判断',evidenceIds:[],weiyan:{engineFacts:{approval:false}}};
  const result=await classifyWeiyan({async respond(){return {text:JSON.stringify({requestId:request.requestId,choice:'WAIT_OUTSIDE',reason:'model verdict'})};}},request,chapter.evidence);
  assert.equal(result.status,'accept');assert.deepEqual(result.supportedEvidenceIds,[]);
 }
});

test('Wei Yan does not require a second acceptanceCases decision after an AI acceptance',async()=>{
 const modified=structuredClone(chapter);for(const def of modified.judges)if(def.id.includes('weiyan'))def.acceptanceCases=[];
 const second=await prepared(false,apiPort('WAIT_OUTSIDE'));
 const e=new NarrativeEngine(modified,'weiyan-test',apiPort('WAIT_OUTSIDE'));e.load(second.save());input(e);
 const r=await e.submitFreeInput('propose_wait',cards,'由AI判断此句');assert.equal(r.result.status,'accept');finish(e);assert.equal(e.interactions().nodeId,'v07.handoff');
 const first=new NarrativeEngine(modified,'first',apiPort('WAIT_OUTSIDE'));tutorialInput(first);
 assert.equal((await first.submitFreeInput('propose_wait',['scout_statement'],'由AI判断此句')).result.status,'accept');finish(first);assert.equal(first.interactions().nodeId,'tutorial.execution');
});

test('API outage or unusable classifier response preserves draft and world for retry in both phases',async()=>{
 for(const first of [true,false])for(const malformed of [false,true]){
  let unavailable=true;const port=new ApiJudge({async respond(payload){const p=JSON.parse(payload.text);if(unavailable){if(!malformed)throw Error('API unavailable');return {text:JSON.stringify({requestId:'wrong',choice:'WAIT_OUTSIDE',reason:'invalid response'})};}return {text:JSON.stringify(p.kind==='classify'?{requestId:p.requestId,choice:'WAIT_OUTSIDE',reason:'retry succeeds'}:{'决策分类':p.decisionCategory,'回应的话':p.immutableAnchor})};}});
  const e=first?new NarrativeEngine(chapter,'outage',port):await prepared(false,port);first?tutorialInput(e):input(e);
  const before=e.snapshot(),nodeId=first?'tutorial.weiyan.negotiate':'weiyan.negotiate',text='保留这一句，待API恢复重试';
  const r=await e.submitFreeInput('propose_wait',first?['scout_statement']:cards,text);assert.equal(r.kind,'technical_error');
  assert.deepEqual(e.snapshot().flags,before.flags);assert.deepEqual(e.snapshot().history,before.history);assert.equal(e.snapshot().drafts[nodeId],text);assert.equal(e.interactions().nodeId,nodeId);assert(e.interactions().freeInput);
  unavailable=false;assert.equal((await e.submitFreeInput('propose_wait',first?['scout_statement']:cards,text)).result.status,'accept');
 }
});
