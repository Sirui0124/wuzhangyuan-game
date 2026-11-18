import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {join,resolve,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {fresh,settle} from '../campaign-engine.mjs';
import {createCampaignRuntime} from '../campaign-runtime.mjs';

async function isolated(fn){const directory=await mkdtemp(join(tmpdir(),'wzy-event-runtime-'));try{await fn(directory);}finally{const target=resolve(directory),base=resolve(tmpdir());assert.ok(target.startsWith(base+sep)&&target!==base);await rm(target,{recursive:true,force:true});}}
const request=s=>({scenarioId:s.scenarioId,expectedRevision:s.revision,requestId:'round-once',trigger:'endRound'});
const valid=({input})=>({selections:input.events.map(p=>({front:p.front,round:p.round,snapshotHash:p.snapshotHash,eventId:p.candidates[0].id,reason:'按该路当前已核实的处境选择。'}))});

test('真实事件选择只提交一轮，重复请求和重读不重抽',()=>isolated(async directory=>{
 let calls=0;const rt=createCampaignRuntime({directory,reportModel:false,eventModel:async input=>{calls++;return valid(input);}});
 const initial=await rt.session(),input=request(initial),first=await rt.act('round',input);
 const file=join(directory,initial.scenarioId+'.json'),saved=await readFile(file,'utf8');
 assert.equal(first.round,1);assert.ok(calls>0);const count=calls;
 const replay=await rt.act('round',input);assert.deepEqual(replay,first);assert.equal(calls,count);
 await rt.session(initial.scenarioId);assert.equal(await readFile(file,'utf8'),saved);
 const rebuilt=createCampaignRuntime({directory,reportModel:false,eventModel:()=>{throw Error('不得重新选择');}});
 assert.deepEqual(await rebuilt.act('round',input),first);assert.equal(await readFile(file,'utf8'),saved);
}));

test('事件选择期间取消不会落地移动、事件或随机数，原请求仍可重试',()=>isolated(async directory=>{
 const controller=new AbortController();let entered=false;
 const rt=createCampaignRuntime({directory,reportModel:false,eventModel:async()=>{entered=true;controller.abort();return {};}});
 const initial=await rt.session(),file=join(directory,initial.scenarioId+'.json'),saved=await readFile(file,'utf8'),input=request(initial);
 await assert.rejects(rt.act('round',input,controller.signal),/取消/);assert.ok(entered);assert.equal(await readFile(file,'utf8'),saved);
 const fallback=createCampaignRuntime({directory,reportModel:false,eventModel:false});const retried=await fallback.act('round',input);assert.equal(retried.round,1);
}));

test('非法AI选择与无AI使用相同预抽后备结果，旧v3不调用事件AI',()=>isolated(async directory=>{
 const original=fresh({seed:837261}),file=join(directory,original.scenarioId+'.json');await writeFile(file,JSON.stringify(original));
 const baseline=structuredClone(original);settle(baseline);
 const rt=createCampaignRuntime({directory,reportModel:false,eventModel:async()=>({selections:[{front:'sha',delta:-999,eventId:'invented'}]})});
 await rt.act('round',request(original));const actual=JSON.parse(await readFile(file,'utf8'));
 assert.equal(actual.seed,baseline.seed);assert.deepEqual(Object.values(actual.fronts).map(r=>[r.status,r.urgency]),Object.values(baseline.fronts).map(r=>[r.status,r.urgency]));
 const old=fresh({seed:123,rules:'eight-v3'});await writeFile(join(directory,old.scenarioId+'.json'),JSON.stringify(old));let calls=0;
 const oldRt=createCampaignRuntime({directory,reportModel:false,eventModel:async()=>{calls++;return {};}});const next=await oldRt.act('round',request(old));
 assert.equal(next.routeVersion,'eight-front-20261118-v3');assert.equal(calls,0);assert.equal(next.crisisEvents,undefined);
}));
