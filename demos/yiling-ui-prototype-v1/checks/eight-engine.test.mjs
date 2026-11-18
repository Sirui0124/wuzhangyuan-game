import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh as engineFresh,orders,settle,assertLedger,publicSession} from '../campaign-engine.mjs';
import {routeTuning} from '../route-config.mjs';
// Frozen v2 regression fixtures; v3 crisis invariants are tested separately.
const fresh=(options={})=>engineFresh({...options,rules:options.rules??'eight-v2'});
const o=(target,men,action='rescue',unit='new')=>({target,men,action,unit,rush:true,via:'normal'});
const go=(s,n)=>{while(s.round<n)settle(s);};
test('八路按发令窗口3+2+3开放，未开放不能派兵或透露AI状态',()=>{
 const s=fresh();assert.equal(s.total,2500);assert.equal(s.roundLimit,8);
 const available=()=>Object.values(s.fronts).filter(r=>r.status!=='locked').length;
 assert.equal(available(),3);assert.throws(()=>orders(s,[o('huang',100)]),/尚未/);assert.equal(publicSession(s).routeInfo.huang,undefined);
 go(s,1);assert.equal(available(),3);go(s,2);assert.equal(available(),5);go(s,4);assert.equal(available(),8);assertLedger(s);
});
test('沙摩柯接应到位才核实，适当投入一至两轮脱险，返程另算',()=>{
 for(const men of [300,500]){const s=fresh({seed:123});orders(s,[o('sha',men)]);assert.equal(s.fronts.sha.searchVerified,false);settle(s);assert.equal(s.fronts.sha.searchVerified,true);if(men===300)settle(s);assert.equal(s.fronts.sha.status,'safe');assert.equal(s.units['2'].state,'returning');settle(s);assert.equal(s.fronts.sha.status,'home');assert.equal(s.units['2'],undefined);assertLedger(s);}
});
test('傅肜实际核实配合接应及说服，适当兵力两轮内脱险',()=>{
 for(let seed=1;seed<=100;seed++){const s=fresh({seed});orders(s,[o('fu',400),o('fu',100,'verify')]);settle(s);assert.equal(s.facts.liubeiAliveVerified,true);s.facts.withdrawalAccepted=true;settle(s);assert.ok(['safe','home'].includes(s.fronts.fu.status));assertLedger(s);}
});
test('任何兵力档只聊天或核实，不会自动救回傅肜',()=>{
 for(const total of [2000,2500,3000]){const s=fresh({total});orders(s,[o('fu',100,'verify')]);settle(s);s.facts.withdrawalAccepted=true;go(s,8);assert.equal(s.fronts.fu.status,'holding');assertLedger(s);}
});
test('马良三次实际执行才完整脱险，人物与联络人员分开归营',()=>{
 const s=fresh();go(s,2);orders(s,[o('ma',800)]);assert.equal(s.fronts.ma.located,false);settle(s);assert.equal(s.fronts.ma.located,true);assert.equal(s.fronts.ma.notified,true);settle(s);assert.equal(s.fronts.ma.status,'holding');settle(s);assert.equal(s.fronts.ma.status,'safe');assert.equal(s.fronts.ma.executions,3);settle(s);assert.equal(s.fronts.ma.status,'home');
});
test('水路必须实际水上接应，光掩护不发生渡运',()=>{
 const s=fresh();go(s,2);orders(s,[o('cheng',300,'relieve')]);settle(s);assert.equal(s.fronts.cheng.boatReady,false);assert.equal(s.fronts.cheng.progress,0);orders(s,[o('cheng',500)]);settle(s);assert.equal(s.fronts.cheng.boatReady,true);assert.equal(s.units['3'].transport,'boat');assert.ok(s.fronts.cheng.progress>0);
});
test('第五轮黄权三轮接应第八轮归营，不把前批渡完算全救',()=>{
 const s=fresh();go(s,4);orders(s,[o('huang',700),o('huang',300,'relieve')]);go(s,6);assert.equal(s.fronts.huang.status,'holding');go(s,7);assert.equal(s.fronts.huang.status,'safe');go(s,8);assert.equal(s.fronts.huang.status,'home');assert.equal(s.ended,true);assertLedger(s);
});
test('末轮脱险仍在归途，截止不判死或强制回营',()=>{
 const s=fresh();go(s,7);orders(s,[o('wang',500),o('wang',200,'relieve')]);settle(s);assert.equal(s.fronts.wang.status,'safe');assert.equal(s.units['2'].state,'returning');assert.equal(s.endReason,'deadline');assert.match(s.lastReport.events.join(' '),/十六时辰/);assert.throws(()=>orders(s,[o('fu',100)]),/结算/);
});
test('三档兵力守恒且旧三路仍六轮、独立侦察和原工作量',()=>{
 for(const total of [2000,2500,3000]){const s=fresh({total});assert.equal(s.reserve,total-500);go(s,8);assertLedger(s);}
 const old=fresh({rules:'three'});assert.equal(old.roundLimit,6);assert.equal(Object.keys(old.fronts).length,3);assert.equal(old.fronts.sha.work,1.8);orders(old,[o('sha',500)]);settle(old);assert.equal(old.fronts.sha.searchVerified,false);assert.equal(old.fronts.sha.progress,0);go(old,6);assert.equal(old.ended,true);
});
test('每条水路船队有限，待发与归途不能另造船，实际返营才释放',()=>{
 const s=fresh();go(s,2);orders(s,[o('cheng',300)]);assert.equal(s.boats.cheng.unitId,'2');
 const before=s.reserve;assert.throws(()=>orders(s,[o('cheng',100)]),/船队已被占用/);assert.equal(s.reserve,before);
 settle(s);assert.equal(s.boats.cheng.state,'active');assert.throws(()=>orders(s,[o('ma',s.units['2'].men,'rescue','2')]),/先撤回/);
 orders(s,[o('cheng',s.units['2'].men,'retreat','2')]);settle(s);assert.equal(s.boats.cheng.state,'returning');assert.equal(s.fronts.cheng.boatReady,false);assert.throws(()=>orders(s,[o('cheng',300)]),/船队已被占用/);
 settle(s);assert.equal(s.boats.cheng.state,'ready');orders(s,[o('cheng',300)]);assert.equal(s.boats.cheng.unitId,'3');assertLedger(s);
});
test('八路全脱险即成功，末轮返程不再作为失败条件',()=>{
 const s=fresh();s.round=7;s.core.status='safe';
 for(const r of Object.values(s.fronts)){r.status='home';for(const stage of r.stages||[]){stage.status='home';stage.progress=stage.work;}}
 const r=s.fronts.wang;r.status='holding';r.progress=0;r.stages[0].status='holding';r.stages[0].progress=0;
 orders(s,[o('wang',500),o('wang',200,'relieve')]);settle(s);assert.equal(s.fronts.wang.status,'safe');assert.equal(s.units['2'].state,'returning');assert.equal(s.endReason,'rescued');assert.equal(s.ended,true);assert.equal(publicSession(s).grade,'八路全部脱险');assert.doesNotMatch(s.lastReport.events.join(' '),/八路归营/);assertLedger(s);
});
test('v2后期长线缺掩护不能靠等待轻易全救，足量掩护仍可三轮脱险',()=>{
 const bare=fresh({seed:123}),covered=fresh({seed:123});go(bare,4);go(covered,4);
 orders(bare,[o('huang',600)]);orders(covered,[o('huang',600),o('huang',300,'relieve')]);
 settle(bare);settle(covered);assert.ok(covered.fronts.huang.progress>bare.fronts.huang.progress*1.4);
 go(covered,7);assert.equal(covered.fronts.huang.status,'safe');go(bare,8);assert.equal(bare.fronts.huang.status,'holding');
});
test('参数快照持久化；旧八路v1无快照时仍用原推进比例',()=>{
 const s=fresh();assert.equal(s.routeVersion,'eight-front-20261118-v2');assert.equal(routeTuning(s,'huang').base,.6);assert.equal(routeTuning(s,'ma').base,.78);
 const loaded=JSON.parse(JSON.stringify(s));assert.deepEqual(loaded.fronts.huang.tuning,s.fronts.huang.tuning);
 loaded.routeVersion='eight-front-20261118-v1';for(const r of Object.values(loaded.fronts))delete r.tuning;
 assert.equal(routeTuning(loaded,'huang').base,.8);assert.equal(routeTuning(loaded,'ma').base,.85);
});
