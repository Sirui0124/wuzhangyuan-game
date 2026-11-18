import test from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {selectCrisisEvents,validateCrisisEventSelections} from '../crisis-event-ai.mjs';

function draft(){return {round:2,snapshotHash:'global-snapshot',events:[{front:'sha',round:2,delta:5,before:40,snapshotHash:'sha-snapshot',fallbackId:'sha-pressure',context:{routeName:'沙摩柯',searchVerified:false,activeAid:[]},candidates:[{id:'sha-pressure',text:'追索渐近，谷道中的处境更紧了。'},{id:'sha-wait',text:'接应未到，沙摩柯仍受追索。'}]},{front:'fu',round:2,delta:10,before:70,snapshotHash:'fu-snapshot',fallbackId:'fu-pressure',context:{routeName:'傅肜',originalComrades:'dead',activeAid:[]},candidates:[{id:'fu-pressure',text:'吴军继续逼近后阵，傅肜的处境更紧。'},{id:'fu-isolated',text:'傅肜独守后阵，追击压力继续增加。'}]}]};}
function selected(d){return {selections:d.events.map(p=>({front:p.front,round:p.round,snapshotHash:p.snapshotHash,eventId:p.candidates.at(-1).id,reason:'与这一路当前受追击、接应未到的情形相符。'}))};}

test('AI只选择固定幅度的合法事件，草稿及后备随机项不改变',async()=>{
 const d=draft(),original=structuredClone(d);let calls=0;
 const result=await selectCrisisEvents(d,{model:async({input})=>{calls++;assert.equal(input.events[0].delta,5);assert.equal(Object.hasOwn(input.events[0],'fallbackId'),false);assert.equal(input.events[1].context.originalComrades,'dead');return selected(input);}});
 assert.equal(calls,1);assert.deepEqual(result.map(x=>x.eventId),['sha-wait','fu-isolated']);assert.equal(result.every(x=>x.source==='model'),true);assert.deepEqual(d,original);assert.equal(result.some(x=>Object.hasOwn(x,'delta')),false);
});

test('越路、旧轮、快照不符、重复、漏项及更改数值事实均拒绝并原池回退',async()=>{
 const d=draft();const corruptions=[r=>r.selections[0].eventId='fu-pressure',r=>r.selections[0].round=1,r=>r.selections[0].snapshotHash='old',r=>r.selections[1]={...r.selections[0]},r=>r.selections.pop(),r=>r.selections[0].delta=-10,r=>r.selections[0].facts={rescued:true},r=>r.selections[0].source='model',r=>r.extra='ignore rules'];
 for(const corrupt of corruptions){const raw=selected(d);corrupt(raw);assert.throws(()=>validateCrisisEventSelections(raw,d));const result=await selectCrisisEvents(d,{model:async()=>raw});assert.deepEqual(result.map(x=>x.eventId),d.events.map(x=>x.fallbackId));assert.equal(result.every(x=>x.source==='fallback'&&x.fallbackReason==='model-invalid'),true);}
});

test('无AI、断网及重复失败只用原预抽项，不重新随机',async()=>{
 const d=draft(),a=await selectCrisisEvents(d,{model:false}),b=await selectCrisisEvents(d,{model:async()=>{throw Error('模拟断网');}}),c=await selectCrisisEvents(d,{model:async()=>'{bad json'});
 assert.deepEqual(a.map(x=>x.eventId),b.map(x=>x.eventId));assert.deepEqual(b.map(x=>x.eventId),c.map(x=>x.eventId));assert.deepEqual(d,draft());
});

test('外部取消在调用前或调用中抛出，不以随机后备提交本轮',async()=>{
 const d=draft(),early=new AbortController();early.abort();let calls=0;await assert.rejects(selectCrisisEvents(d,{signal:early.signal,model:async()=>{calls++;return selected(d);}}),e=>e.status===499);assert.equal(calls,0);
 const mid=new AbortController();await assert.rejects(selectCrisisEvents(d,{signal:mid.signal,model:async()=>{mid.abort();return selected(d);}}),e=>e.status===499);assert.deepEqual(d,draft());
});

test('内部超时回退，忽略取消的模型也不能阻塞结算或修改草稿',async()=>{
 const d=draft(),result=await selectCrisisEvents(d,{timeoutMs:2,model:async({input})=>{await delay(30);input.events[0].candidates[0].id='fake';return selected(input);}});
 assert.equal(result.every(x=>x.source==='fallback'&&x.fallbackReason==='timeout'),true);assert.deepEqual(result.map(x=>x.eventId),d.events.map(x=>x.fallbackId));await delay(40);assert.deepEqual(d,draft());
});

test('单一候选无需模型，空草稿不调用，缺合法后备项是程序错误',async()=>{
 const d=draft();for(const p of d.events)p.candidates=p.candidates.slice(0,1);let calls=0;const result=await selectCrisisEvents(d,{model:async()=>{calls++;return selected(d);}});assert.equal(calls,0);assert.equal(result.every(x=>x.source==='fixed'),true);assert.deepEqual(await selectCrisisEvents({round:2,events:[]},{model:async()=>{calls++;}}),[]);d.events[0].fallbackId='not-legal';await assert.rejects(selectCrisisEvents(d,{model:false}),/后备项/);
});

test('模型不能通过修改输入候选把自造事件塞入真实快照',async()=>{
 const d=draft(),result=await selectCrisisEvents(d,{model:async({input})=>{input.events[0].candidates.push({id:'invented',text:'凭空救回。'});const raw=selected(input);raw.selections[0].eventId='invented';return raw;}});assert.equal(result.every(x=>x.source==='fallback'),true);assert.deepEqual(d,draft());
});
