import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fresh as freshEngine,orders,settle,publicSession,assertLedger} from '../campaign-engine.mjs';
import {crisisProbability,refreshCrisis} from '../crisis-rules.mjs';
process.env.CRISIS_BALANCE_LIBRARY='1';
const {simulate,seedFor,audit}=await import('./crisis-balance.mjs');
const fresh=(options={})=>freshEngine({...options,rules:'eight-v3'});
const O=(target,action,men,unit='new')=>({target,action,men,unit,rush:true,via:action==='scout'?'side':'normal'});
const escaped=r=>['safe','home'].includes(r.status);

test('v3危机来自真实状态，无工作量/进度/隐形执行次数，公开投影一致',()=>{
 const s=fresh({seed:7}),view=publicSession(s);assert.match(s.routeVersion,/v3/);
 for(const [id,r] of Object.entries(s.fronts)){
  for(const obj of [r,...r.stages,...Object.values(s.boats)])for(const key of ['progress','work','capacityProgress','executions','minExecutions'])assert.equal(Object.hasOwn(obj,key),false,`${id}:${key}`);
  assert.equal(view.fronts[id].urgency,r.urgency);assert.deepEqual(view.fronts[id].assessment,r.assessment);
 }
});
test('所有路线使用同一危机概率曲线，低危确定、高危不能，曲线单调',()=>{
 const rules=fresh().crisisRules;assert.equal(crisisProbability(0,rules),1);assert.equal(crisisProbability(rules.certainBelow,rules),1);assert.equal(crisisProbability(rules.impossibleAbove,rules),0);assert.equal(crisisProbability(100,rules),0);
 let last=1;for(let c=0;c<=100;c++){const p=crisisProbability(c,rules);assert.ok(p>=0&&p<=1&&p<=last);last=p;}
});
test('未到位军令不降低危机，实际到位后才影响真实危机',()=>{
 const s=fresh({seed:11}),before=s.fronts.camp.urgency;orders(s,[O('camp','rescue',400)]);assert.equal(publicSession(s).fronts.camp.urgency,before);settle(s);assert.ok(s.fronts.camp.urgency<before);
});
test('无人接应会恶化，真实接应部分缓解后撤兵可重新回升',()=>{const result=audit();assert.ok(result.unaidedRises.length);assert.ok(result.rebound.after>result.rebound.lowered);});
test('旧营接力表态不能代替后队真实掩护',()=>{
 const s=fresh({seed:21});s.fronts.camp.planAccepted=true;orders(s,[O('camp','rescue',500,'1')]);settle(s);
 const rear=s.fronts.camp.stages.find(st=>st.id==='rear');assert.equal(rear.lastResolution.eligible,false);assert.equal(rear.status,'holding');assert.ok(rear.lastResolution.reasons.length);
});
test('同一路全部就绪批次共享一个真实战场抽样，没有强制逐轮排队',()=>{
 const s=fresh({seed:31});s.fronts.camp.planAccepted=true;orders(s,[O('camp','rescue',500,'1'),O('camp','relieve',300)]);settle(s);
 const a=s.fronts.camp.stages.map(st=>st.lastResolution);assert.ok(a.every(x=>x.eligible));assert.equal(new Set(a.map(x=>x.draw)).size,1);
 for(const x of a)if(x.urgency<=s.crisisRules.certainBelow)assert.equal(x.outcome,'safe');
 assert.ok(s.fronts.camp.stages.every(st=>st.status==='safe'),'Both low-crisis ready batches can leave in same round.');
});
test('路线整体概率取剩余批次最低值，危机取最高值',()=>{
 const s=fresh({seed:5});orders(s,[O('camp','rescue',100)]);settle(s);refreshCrisis(s);
 const r=s.fronts.camp,remaining=r.stages.filter(st=>st.status==='holding');assert.ok(remaining.length>0);
 assert.equal(r.urgency,Math.max(...r.stages.map(st=>st.urgency)));assert.equal(r.assessment.probability,Math.min(...remaining.map(st=>st.assessment.probability)));
});
test('傅肜消息与掩护齐备但无护送时，未脱险危机不显示为零',()=>{
 const s=fresh({seed:19});orders(s,[O('fu','relieve',400)]);settle(s);
 Object.assign(s.facts,{liubeiAliveVerified:true,liubeiSafeConfirmed:true,withdrawalAccepted:true,alternateRouteOpen:true,routeScouted:true,withdrawalSignalDelivered:true});
 s.fronts.fu.pressure=0;refreshCrisis(s);
 assert.equal(s.fronts.fu.status,'holding');assert.equal(s.fronts.fu.assessment.eligible,false);assert.equal(s.fronts.fu.assessment.probability,0);assert.equal(s.fronts.fu.urgency,1);
});
test('实际通知与接应下沙摩柯/傅肜可在两轮内脱险',()=>{
 for(let seed=1;seed<=24;seed++){
  const s=fresh({seed});orders(s,[O('sha','rescue',500,'1'),O('fu','rescue',400),O('fu','verify',100)]);settle(s);assert.equal(s.facts.liubeiAliveVerified,true);s.facts.withdrawalAccepted=true;settle(s);assert.ok(escaped(s.fronts.sha));assert.ok(escaped(s.fronts.fu));assertLedger(s);
 }
});
test('按3+2+3开放，锁定期间不暗中累加危机压力',()=>{
 const s=fresh({seed:43}),start=s.fronts.huang.pressure;assert.equal(s.fronts.ma.status,'locked');assert.equal(s.fronts.huang.status,'locked');settle(s);settle(s);assert.equal(s.fronts.ma.status,'holding');assert.equal(s.fronts.cheng.status,'holding');assert.equal(s.fronts.huang.status,'locked');assert.equal(s.fronts.huang.pressure,start);settle(s);settle(s);for(const id of ['du','wang','huang'])assert.equal(s.fronts[id].status,'holding');
});
test('JSON读档保留真实危机、随机序列与后续结算，不重抽',()=>{
 const s=fresh({seed:57});orders(s,[O('camp','rescue',500,'1'),O('camp','relieve',200)]);settle(s);const loaded=JSON.parse(JSON.stringify(s));settle(s);settle(loaded);assert.deepEqual(loaded,s);
});
test('实际八路全脱险即成功，接应队仍在返程不阻止结束',async()=>{
 const fixture=JSON.parse(await readFile(new URL('./crisis-policies.json',import.meta.url),'utf8'));let success;
 for(let i=0;i<32;i++){const run=simulate(2500,fixture.optimized[0],seedFor('regression-safe',i),true);if(run.allSafe){success=run;break;}}
 assert.ok(success,'A legitimate complete rescue path must exist.');assert.equal(success.endReason,'rescued');assert.equal(success.returning,true);assert.equal(success.allHome,false);assert.ok(success.round<=8);
});
