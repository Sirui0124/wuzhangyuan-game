import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createState, evaluate, escapeProbability, resolveRound, crisisView, validateDesign} from './furong-rescue.ts';
const d=JSON.parse(readFileSync(new URL('./furong-rescue.design.json',import.meta.url),'utf8'));
const facts=(...on)=>Object.fromEntries(Object.keys(d.factDefinitions).map(k=>[k,on.includes(k)]));
const input=(state,f,extra={})=>({scenarioId:state.scenarioId,round:state.round+1,expectedRevision:state.revision,trigger:'endRound',commandBatchIds:['batch-1'],receiptIds:['receipt-1'],facts:f,contact:true,...extra});
test('配置条件、分支编号及引用有效',()=>validateDesign(d));
test('v3反证与安全分开：口头同意不计说服，活着不等于已脱险',()=>{
  assert.equal(evaluate(d,facts('withdrawalAccepted')).crisis,99);
  assert.equal(evaluate(d,facts('liubeiAliveVerified')).crisis,99);
  assert.equal(evaluate(d,facts('liubeiAliveVerified','withdrawalAccepted')).crisis,87);
  assert.equal(evaluate(d,facts('liubeiSafeConfirmed')).crisis,99);
  assert.equal(evaluate(d,facts('liubeiAliveVerified','liubeiSafeConfirmed')).crisis,81);
  assert.equal(d.character.storyPremise.worldTruth.originalComradesAllDead,true);
  assert(!d.semanticOutcomes.some(x=>x.id==='ACCEPT_TOGETHER'));
  assert(d.semanticOutcomes.find(x=>x.id==='ACCEPT_CONTINUED_SERVICE').required.some(x=>x.includes('战死')));
});
test('全部100个危机值概率有界且单调，低于10必定成功',()=>{
  let last=1;
  for(let c=0;c<=99;c++){const p=escapeProbability(c);assert(p>=0&&p<=1);assert(p<=last);last=p;if(c<10)assert.equal(p,1);}
  assert.equal(escapeProbability(10),.99);assert.equal(escapeProbability(99),0);
  for(const c of [-1,100,NaN,10.5])assert.throws(()=>escapeProbability(c));
});
test('同路线不叠加、重复事实不刷分、失去掩护真实反弹',()=>{
  const f=facts('routeScouted','alternateRouteOpen','reliefInPosition');
  assert.equal(evaluate(d,f).crisis,55);
  assert.deepEqual(evaluate(d,f),evaluate(d,f));
  f.reliefInPosition=false;assert.equal(evaluate(d,f).crisis,79);
});
test('三个设计路径的数值与JSON一致，压力上限下全因素仍必定脱险',()=>{
  for(const route of d.routeExamples){const f=facts(...route.branchIds.flatMap(id=>d.branches.find(b=>b.id===id).all));assert.equal(evaluate(d,f).crisis,route.crisisWithoutPressure);}
  assert.equal(evaluate(d,facts(...Object.keys(d.factDefinitions)),20).probability,1);
});
test('本轮只结算一次，序列化恢复与重试不改变随机结果',()=>{
  const s=createState(d,'run-1',123456789);const i=input(s,facts('liubeiAliveVerified','withdrawalAccepted'));
  const first=resolveRound(d,s,i);const recovered=JSON.parse(JSON.stringify(first.state));
  const repeat=resolveRound(d,recovered,i);assert.equal(repeat.replayed,true);assert.deepEqual(first.resolution,repeat.resolution);assert.equal(first.state.rngState,repeat.state.rngState);assert.equal(s.round,0);
  assert.throws(()=>resolveRound(d,recovered,{...i,facts:facts()}));
});
test('99不成功且不新增死亡；未脱险后压力+2；无联系不抽签',()=>{
  const s=createState(d,'run-2',123456789);const r=resolveRound(d,s,input(s,facts()));
  assert.equal(r.resolution.outcome,'holding');assert.equal(r.resolution.draw,null);assert.equal(r.state.pressure,2);
  const lost=resolveRound(d,s,input(s,facts(...Object.keys(d.factDefinitions)),{contact:false}));assert.equal(lost.resolution.outcome,'unreachable');assert.equal(lost.resolution.draw,null);assert.equal(lost.state.pressure,0);
});
test('概率为1时成功、成功后不能继续抽签、不把脱险说成已归营',()=>{
  const s=createState(d,'run-3',123456789),f=facts(...Object.keys(d.factDefinitions));
  const r=resolveRound(d,s,input(s,f));assert.equal(r.resolution.outcome,'safe');assert.throws(()=>resolveRound(d,r.state,input(r.state,f)));
  const v=crisisView(d,r.state,f,true,'resolved');assert.equal(v.crisis.value,0);assert.equal(v.withdrawal.eligible,false);assert.equal(v.withdrawal.status,'withdrawn');assert(v.crisis.reasons[0].includes('待归营'));
});
test('拒绝聊天触发、跨存档、旧版本、跳轮、漏字段和额外字段',()=>{
  const s=createState(d,'run-4',123456789),i=input(s,facts());
  for(const patch of [{trigger:'chat'},{scenarioId:'another'},{expectedRevision:7},{round:3},{facts:{}},{facts:{...facts(),safe:true}}])assert.throws(()=>resolveRound(d,s,{...i,...patch}));
  assert.throws(()=>resolveRound({...d,version:'other'},s,i));
});
test('固定种子序列的抽样频率接近数学概率',()=>{
  let seed=2463534242,hits=0;const n=20000,p=escapeProbability(51);
  const f=facts('liubeiAliveVerified','withdrawalAccepted','alternateRouteOpen','escortReady');assert.equal(evaluate(d,f).crisis,51);
  for(let j=0;j<n;j++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;if(!seed)seed=1;const s=createState(d,`sim-${j}`,seed);if(resolveRound(d,s,input(s,f)).resolution.outcome==='safe')hits++;}
  assert(Math.abs(hits/n-p)<.015,`${hits/n} vs ${p}`);
});
