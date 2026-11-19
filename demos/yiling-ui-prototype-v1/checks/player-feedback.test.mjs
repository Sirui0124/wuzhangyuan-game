import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,orders,previewOrders,settle,prepareSettlement,derive} from '../campaign-engine.mjs';
import {resolveCampaignOrders} from '../.build/campaign-intent.js';
import {narrateReport} from '../report-ai.mjs';
const order=(action,men)=>({unit:'new',target:'camp',action,men,via:'normal'});
function supported(task,legacy=false){const s=fresh({seed:731});if(legacy){delete s.crisisRevision;for(const r of Object.values(s.fronts))delete r.crisisTuning.suppressEffect;}orders(s,[order('rescue',500),order(task,300)]);settle(s);prepareSettlement(s);return s;}

test('新局同等实际兵力的压制与接替掩护不再有未说明的七折差异',()=>{
 const suppress=supported('suppress'),relieve=supported('relieve');
 assert.equal(suppress.fronts.camp.urgency,relieve.fronts.camp.urgency);
 assert.equal(suppress.fronts.camp.assessment.probability,relieve.fronts.camp.assessment.probability);
 assert.equal(suppress.reserve,relieve.reserve);
});

test('旧v4存档缺少新参数时保持原掩护折算，读档不偷偷升级',()=>{
 const old=supported('suppress',true),current=supported('suppress');
 assert.ok(old.fronts.camp.urgency>current.fronts.camp.urgency);
 const loaded=JSON.parse(JSON.stringify(old));derive(loaded);
 assert.equal(loaded.fronts.camp.urgency,old.fronts.camp.urgency);
 assert.equal(loaded.fronts.camp.crisisTuning.suppressEffect,undefined);
});

test('护送人手有限与掩护不足分别说明，已脱险人员不继续索要援军',()=>{
 const s=fresh();orders(s,[order('rescue',100),order('suppress',100)]);settle(s);prepareSettlement(s);
 assert.ok(s.fronts.camp.assessment.reasons.some(x=>x.includes('护送人手')));
 assert.ok(s.fronts.camp.assessment.reasons.some(x=>x.includes('掩护兵力')));
 s.fronts.camp.status='safe';for(const st of s.fronts.camp.stages)st.status='safe';derive(s);
 assert.deepEqual(s.fronts.camp.assessment.reasons,[]);
 assert.ok(s.fronts.camp.stages.every(st=>st.assessment.reasons.length===0));
});

test('陆路和水路同样允许叠加护送、改令和补派，旧版船位不会锁住正式八路存档',()=>{
 for(const target of ['du','cheng','huang']){
  const s=fresh({seed:11});s.fronts[target].status='holding';
  if(target!=='du')s.boats={[target]:{state:'lost',unitId:'9'}};
  const task=(men)=>({...order('rescue',men),target});
  orders(s,[task(100),task(200)]);settle(s);prepareSettlement(s);derive(s);
  assert.equal(s.fronts[target].deployment.escort,300);
  if(target!=='du'){assert.equal(s.fronts[target].boatReady,true);assert.equal(s.units['2'].transport,'boat');}
  s.units['2'].fleetId='old';s.units['2'].fleetOwner=target;
  orders(s,[{...task(s.units['2'].men),unit:'2',target:'fu'}]);
  assert.equal(s.units['2'].pending.target,'fu');
 }
});

test('预览不占兵或队位，超额整批拒绝，旧军令也按普通行军到位',()=>{
 for(const rush of [false,true]){
  const s=fresh({seed:29}),before=structuredClone(s),cmd={...order('rescue',400),target:'sha',rush};
  assert.throws(()=>previewOrders(s,[cmd,{...cmd,men:2000}]),/第2道令.*1600/);
  const q=previewOrders(s,[cmd]);assert.equal(q.arrivals[0],2);
  assert.equal(q.reserve,1600);assert.equal(q.freeSlots,3);assert.deepEqual(s,before);
  orders(s,[cmd]);while(s.round<q.arrivals[0]){settle(s);if(s.round<q.arrivals[0])assert.equal(s.units['2'].state,'marching');}
  assert.equal(s.fronts.sha.searchVerified,true);
 }
});

test('三个难度和旧存档的速度标记都不影响到位、损耗及脱险',()=>{
 for(const difficulty of ['easy','normal','hard']){
  const current=fresh({seed:571,difficulty}),old=structuredClone(current);
  const cmd=order('rescue',400);
  orders(current,[cmd]);orders(old,[{...cmd,rush:true}]);
  assert.deepEqual(current.units,old.units);
  old.units['2'].pending.rush=true;
  for(let round=1;round<=4;round++){
   settle(current);settle(old);
   assert.deepEqual(current.fronts,old.fronts);
   assert.equal(old.wounded,current.wounded);assert.equal(old.dead,current.dead);
   assert.deepEqual(old.units['2']?.state,current.units['2']?.state);
   if(old.units['2'])old.units['2'].rush=true;
  }
 }
});

test('同句送人撤回不等于把部队召回，真正两项任务说明冲突和军令序号',()=>{
 const resolve=text=>resolveCampaignOrders(text,{unit:'auto',target:'auto'},{1:{name:'甲队',men:500}});
 assert.deepEqual(resolve('派400人急行接应沙摩柯'),resolve('派400人接应沙摩柯'));
 assert.equal(resolve('甲队去接应傅肜，带他撤回').at(0).action,'rescue');
 assert.equal(resolve('甲队护送傅肜回营').at(0).action,'rescue');
 assert.equal(resolve('派400人接应沙摩柯，沿谷道寻找部众').at(0).action,'rescue');
 assert.equal(resolve('派100人寻找沙摩柯').at(0).action,'scout');
 assert.throws(()=>resolve('派400人先侦察再护送沙摩柯'),/一队一次/);
 assert.equal(resolve('派100人传信、核实刘备消息').at(0).action,'verify');
 assert.equal(resolve('甲队接应前线，接替断后，去旧营').at(0).action,'relieve');
 assert.throws(()=>resolve('派100人接应傅肜；甲队护送沙摩柯并撤回'),/第2道军令.*撤回接应营.*接应护送/);
});

test('军报里的前队、探路队和返营的甲队都来自各自路线，AI不能跨线挪用',async()=>{
 const s=fresh({seed:13});s.round=5;
 s.fronts.camp.stages[0].status='home';s.fronts.wang.status='holding';
 s.fronts.wang.located=true;s.fronts.wang.notified=true;
 s.receipts=['camp','fu','wang'].map(f=>({front:f,id:f+'-5',round:5,text:'本轮来报。'}));
 s.lastReport={fronts:['camp','fu','wang'].map(id=>({id,status:s.fronts[id].status})),units:[
  {target:'fu',name:'甲队',state:'home',previousState:'returning',task:'接应护送'},
  {target:'wang',name:'第2队',state:'returning',task:'探查撤路'}]};
 for(const model of [false,async()=>({leads:{camp:0,fu:1,wang:1},paragraphs:[{front:'camp',text:'甲队带张南回营。'}]})]){
  const {paragraphs}=await narrateReport(s,{model}),at=id=>paragraphs.find(p=>p.front===id).text;
  assert.match(at('camp'),/张南与前队已归营/);assert.doesNotMatch(at('camp'),/甲队/);assert.match(at('fu'),/甲队.*已回营/);
  assert.match(at('wang'),/王甫与同行伤员尚未脱险/);assert.match(at('wang'),/第2队（探查撤路）正返回营中/);
 }
});
