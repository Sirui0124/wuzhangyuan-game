import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createRuntime} from '../fu-runtime.mjs';
async function fixture(model){
 const directory=await mkdtemp(join(tmpdir(),'fu-runtime-'));
 return {directory,runtime:createRuntime({directory,cooldownMs:0,model})};
}
const req=(s,extra={})=>({scenarioId:s.scenarioId,expectedRevision:s.revision,requestId:randomUUID(),...extra});
const order=(unit,action,extra={})=>({unit,action,target:'fu',...extra});
const model=async({input})=>input.classification?{reply:input.authority.facts.withdrawalAccepted?'陛下既还在，我就回去见他。这里的事，我得亲口说。':'你从哪儿得的消息？',claims:{liubei:input.authority.liubei,comrades:'dead',furong:input.authority.furong,...(input.authority.crisis?{crisis:structuredClone(input.authority.crisis)}:{})},factRefs:[]}:
 {outcomeId:input.authority.facts.liubeiAliveVerified?'ACCEPT_CONTINUED_SERVICE':'ASK_LIUBEI_PROOF',checks:{requestsWithdrawal:true,acknowledgesLoss:true,continuedDuty:true},quotes:[{messageId:'current',text:input.current.text}]};
test('真实行动需结束本轮；消息分轮核实；存档重载与同轮重试幂等',async()=>{
 const {runtime,directory}=await fixture(model);let s=await runtime.session();
 assert.equal(s.view.crisis.value,99);
 s=await runtime.act('orders',req(s,{orders:[order('甲','verify')]}));
 assert.equal(s.facts.liubeiAliveVerified,false);assert.equal(s.round,0);
 const firstRound=req(s,{trigger:'endRound'});s=await runtime.act('round',firstRound);
 assert.equal(s.facts.liubeiAliveVerified,true);assert.equal(s.facts.liubeiSafeConfirmed,false);
 assert.equal(s.view.crisis.value,99);
 const replay=await runtime.act('round',firstRound);assert.equal(replay.revision,s.revision);assert.equal(replay.round,1);
 const restored=await createRuntime({directory,cooldownMs:0,model}).session(s.scenarioId);assert.deepEqual(restored,s);
 s=await runtime.act('round',req(s,{trigger:'endRound'}));
 assert.equal(s.facts.liubeiSafeConfirmed,true);assert.equal(s.units.甲.at,'camp');
 assert(!s.messages.some(m=>m.text.includes('已护送本路将士回到')));
});
test('自由输入用模型，证据未到不能刷说服，证据到后能更新意愿而不推进轮次',async()=>{
 const {runtime}=await fixture(model);let s=await runtime.session();
 s=await runtime.act('chat',req(s,{text:'陛下还活着，你回去继续护他，不能让弟兄白白牺牲。'}));
 assert.equal(s.facts.withdrawalAccepted,false);assert.equal(s.round,0);
 s=await runtime.act('orders',req(s,{orders:[order('甲','verify')]}));
 s=await runtime.act('round',req(s,{trigger:'endRound'}));
 s=await runtime.act('chat',req(s,{text:'他们与你护住了陛下，你回去继续护他，也把这一战告诉他。'}));
 assert.equal(s.facts.withdrawalAccepted,true);assert.equal(s.round,1);
 const crisis=s.view.crisis.value;
 s=await runtime.act('chat',req(s,{text:'他们与你护住了陛下，你回去继续护他，也把这一战告诉他。'}));
 assert.equal(s.view.crisis.value,crisis);
});
test('最小兵力/跨路线/信号条件校验；同队不能兼任；失败无状态写入',async()=>{
 const {runtime,directory}=await fixture();let s=await runtime.session();
 const save=join(directory,s.scenarioId+'.json'),raw=JSON.parse(await readFile(save,'utf8'));
 raw.core.rngState=123456789;await writeFile(save,JSON.stringify(raw));
 for(const orders of [[order('甲','relieve',{men:1})],[{...order('甲','rescue'),target:'sha'}],[order('甲','signal')],[order('甲','relieve'),order('甲','rescue')]]){
  await assert.rejects(runtime.act('orders',req(s,{orders})));
  assert.equal((await runtime.session(s.scenarioId)).revision,0);
 }
 s=await runtime.act('orders',req(s,{orders:[order('甲','relieve',{rush:true})]}));
 s=await runtime.act('round',req(s,{trigger:'endRound'}));
 assert.notEqual(s.phase,'safe');
 assert.equal(s.facts.reliefInPosition,true);
 s=await runtime.act('orders',req(s,{orders:[order('甲','rescue')]}));
 s=await runtime.act('round',req(s,{trigger:'endRound'}));
 assert.equal(s.facts.reliefInPosition,false);assert.equal(s.facts.escortReady,false);
});
test('模型错误不产生假回话/扣间隔/推进；服务端禁止客户端改facts与随机数',async()=>{
 const {runtime}=await fixture(async()=>{throw Error('model unavailable');});const s=await runtime.session();
 await assert.rejects(runtime.act('chat',req(s,{text:'你好'})));
 assert.deepEqual(await runtime.session(s.scenarioId),s);
 const next=await runtime.act('round',req(s,{trigger:'endRound',facts:{withdrawalAccepted:true},randomRoll:0}));
 assert.equal(next.facts.withdrawalAccepted,false);assert.equal(next.phase,'deceived_and_bereaved');assert.equal(next.view.lastResolution.probability,0);
});
test('成功不等于归营；同档并发仅一次提交；成功后不继续抽签',async()=>{
 const {runtime,directory}=await fixture(model);let s=await runtime.session();
 // 设置测试专用权威账本，生产API不允许此入口。
 const path=join(directory,s.scenarioId+'.json'),raw=JSON.parse(await readFile(path,'utf8'));
 for(const k of Object.keys(raw.facts))raw.facts[k]=true;
 for(const [unit,action] of [['甲','relieve'],['乙','suppress'],['丙','rescue']]){
  Object.assign(raw.units[unit],{at:'rear',deployed:400,progress:2,task:{action,duration:2}});
 }
 raw.phase='withdrawal_accepted';await writeFile(path,JSON.stringify(raw));
 const i=req(s,{trigger:'endRound'}),[a,b]=await Promise.all([runtime.act('round',i),runtime.act('round',i)]);
 assert.equal(a.phase,'safe');assert.equal(a.revision,b.revision);assert.equal(a.view.lastResolution.probability,1);
 s=await runtime.act('round',req(a,{trigger:'endRound'}));
 assert.equal(s.phase,'home');assert.equal(s.view.withdrawal.eligible,false);
 await assert.rejects(runtime.act('round',req(s,{trigger:'endRound'})));
});
