import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import {createCampaignRuntime,campaignHandler} from '../campaign-runtime.mjs';
import {assertLedger} from '../campaign-engine.mjs';

const disabled={reportModel:false,eventModel:false,routeModel:false,model:()=>{throw Error('This test must not call a model.');}};
const input=s=>({scenarioId:s.scenarioId,expectedRevision:s.revision,requestId:randomUUID()});
const O=(target,action,men=100,unit='new')=>({unit,target,action,men,rush:true,via:'normal'});
async function fixture(fn){const directory=await mkdtemp(join(tmpdir(),'wzy-checkpoint-'));try{await fn(directory,createCampaignRuntime({...disabled,directory}));}finally{await rm(directory,{recursive:true,force:true});}}
const raw=(directory,id)=>readFile(join(directory,id+'.json'),'utf8');

test('手动存档不可变；完整待发军令和随机状态恢复为新会话，不覆盖原局',async()=>fixture(async(directory,r)=>{
 let s=await r.session();
 s=await r.act('orders',{...input(s),orders:[O('sha','rescue',400),O('fu','verify')]});
 const sourceId=s.scenarioId,original=await raw(directory,sourceId),saveRequest=input(s);
 const c=await r.checkpoint(saveRequest),cpPath=join(directory,'checkpoints',c.id+'.json'),checkpointText=await readFile(cpPath,'utf8');
 assert.equal(c.revision,s.revision);assert.equal(c.round,0);assert.equal(await raw(directory,sourceId),original);
 assert.deepEqual(await r.checkpoint(saveRequest),c);
 s=await r.act('round',{...input(s),trigger:'endRound'});
 const progressed=await raw(directory,sourceId),restoreRequest={...input(s),checkpointId:c.id};
 const restored=await r.restore(restoreRequest),snapshot=JSON.parse(checkpointText).state,newRaw=JSON.parse(await raw(directory,restored.scenarioId));
 assert.notEqual(restored.scenarioId,sourceId);assert.equal(restored.revision,0);assert.equal(restored.round,0);
 for(const key of ['fronts','units','reserve','seed','difficulty','facts','messages','receipts','boats','seq','eventSeq','routeTurns','turns'])assert.deepEqual(newRaw[key],snapshot[key],key);
 assert.equal(Object.keys(restored.fronts).length,8);assert.equal(restored.units['2'].pending.target,'sha');assert.equal(restored.units['3'].pending.action,'verify');
 assert.equal(newRaw.core.scenarioId,restored.scenarioId);assert.deepEqual(newRaw.requests,{});assertLedger(newRaw);
 const expected=structuredClone(snapshot);Object.assign(expected,{scenarioId:newRaw.scenarioId,revision:0,requests:{},nextSendAt:0,restoredFrom:newRaw.restoredFrom});expected.core.scenarioId=newRaw.scenarioId;assert.deepEqual(newRaw,expected);
 assert.equal(await raw(directory,sourceId),progressed);assert.equal(await readFile(cpPath,'utf8'),checkpointText);
 assert.equal((await r.restore(restoreRequest)).scenarioId,restored.scenarioId);
 const restarted=createCampaignRuntime({...disabled,directory});assert.equal((await restarted.restore(restoreRequest)).scenarioId,restored.scenarioId);assert.deepEqual(await restarted.checkpoint(saveRequest),c);
 await assert.rejects(r.checkpoint({...saveRequest,expectedRevision:saveRequest.expectedRevision+1}),e=>e.status===409);
 await assert.rejects(r.restore({...restoreRequest,checkpointId:randomUUID()}),e=>e.status===409);
 const next=await r.act('round',{...input(restored),trigger:'endRound'});
 assert.equal(next.round,s.round);assert.deepEqual(next.units,s.units);assert.deepEqual(next.fronts,s.fronts);
 assert.equal(JSON.parse(await raw(directory,next.scenarioId)).seed,JSON.parse(progressed).seed);
}));

test('同一保存或恢复请求跨运行实例并发只发布同一份不可变结果',async()=>fixture(async(directory,a)=>{
 const b=createCampaignRuntime({...disabled,directory}),s=await a.session(),save=input(s);
 const checkpoints=await Promise.all([a.checkpoint(save),b.checkpoint(save)]);
 assert.deepEqual(checkpoints[0],checkpoints[1]);
 const restore={...input(s),checkpointId:checkpoints[0].id};
 const sessions=await Promise.all([a.restore(restore),b.restore(restore)]);
 assert.equal(sessions[0].scenarioId,sessions[1].scenarioId);assert.deepEqual(sessions[0],sessions[1]);
}));

test('保存和读档按当前会话版本防并发；不存在的存档与非法编号不产生新局',async()=>fixture(async(directory,r)=>{
 const initial=await r.session(),stale=input(initial);
 const s=await r.act('orders',{...input(initial),orders:[O('fu','verify')]});
 await assert.rejects(r.checkpoint(stale),e=>e.status===409&&e.session.revision===s.revision);
 const c=await r.checkpoint(input(s));
 await assert.rejects(r.restore({...stale,checkpointId:c.id}),e=>e.status===409);
 await assert.rejects(r.restore({...input(s),checkpointId:randomUUID()}),e=>e.status===404);
 await assert.rejects(r.restore({...input(s),checkpointId:'../outside'}),/编号/);
 await assert.rejects(r.checkpoint({...input(s),expectedRevision:-1}),/版本/);
 const [a,b]=await Promise.all([r.checkpoint(input(s)),r.act('round',{...input(s),trigger:'endRound'})]);
 assert.equal(a.revision,s.revision);assert.equal(b.revision,s.revision+1);
 assert.equal(JSON.parse(await readFile(join(directory,'checkpoints',a.id+'.json'),'utf8')).state.round,s.round);
}));

test('HTTP checkpoint/restore端点保留统一响应封装、来源和版本错误',async()=>fixture(async(directory,r)=>{
 const server=createServer(campaignHandler(r));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const base=`http://127.0.0.1:${server.address().port}/api/yiling-command/`;
  const post=async(kind,body,origin)=>{const response=await fetch(base+kind,{method:'POST',headers:{'content-type':'application/json',...(origin?{origin}:{})},body:JSON.stringify(body)});return {status:response.status,body:await response.json()};};
  const s=(await post('session',{})).body.session;
  const c=await post('checkpoint',input(s));assert.equal(c.status,200);assert.equal(c.body.ok,true);assert.ok(c.body.checkpoint.id);assert.equal(c.body.session,undefined);
  const restored=await post('restore',{...input(s),checkpointId:c.body.checkpoint.id});assert.equal(restored.status,200);assert.equal(restored.body.ok,true);assert.notEqual(restored.body.session.scenarioId,s.scenarioId);
  assert.equal((await post('checkpoint',input(s),'https://example.invalid')).status,403);
  assert.equal((await post('checkpoint',{...input(s),expectedRevision:7})).status,409);
 }finally{await new Promise(resolve=>server.close(resolve));}
}));

test('问话被明确拒绝时原军令与存档仍可用，重试结算不重复消耗',async()=>fixture(async(directory,r)=>{
 let s=await r.session();const cmd=O('sha','rescue',300);
 const before=await raw(directory,s.scenarioId);
 const quote=await r.preview({...input(s),orders:[cmd]});assert.equal(quote.reserve,1700);assert.equal(await raw(directory,s.scenarioId),before);
 s=await r.act('orders',{...input(s),orders:[cmd]});
 const submitted=await raw(directory,s.scenarioId);
 await assert.rejects(r.act('chat',{...input(s),front:'fu',text:'陛下的消息是谁送来的？'}),e=>e.notCommitted===true);
 assert.equal(await raw(directory,s.scenarioId),submitted);
 assert.equal((await r.checkpoint(input(s))).revision,s.revision);
 const advance={...input(s),trigger:'endRound'};
 const next=await r.act('round',advance);assert.equal(next.round,1);
 assert.deepEqual(await r.act('round',advance),next);
 assert.equal(next.messages.filter(m=>m.kind==='order').length,1);
 await assert.rejects(r.preview({...input(s),orders:[cmd]}),e=>e.status===409&&e.session.revision===next.revision);
}));
