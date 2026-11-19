import test from 'node:test';
import assert from 'node:assert/strict';
import {crisisProbability} from '../crisis-rules.mjs';
import {fresh,derive,settle} from '../campaign-engine.mjs';

test('已撤出批次不能替仍受困且危机不足条件的末批声明自主资格',()=>{
 const s=fresh(),r=s.fronts.ma;
 r.status='holding';r.located=true;r.notified=true;r.scouted=true;
 r.localOrganization={retreatVerified:true,mobileGroup:true,verifiedRound:3,relief:55};
 r.stages[0].status='home';r.stages[0].lastResolution={outcome:'safe',mode:'autonomous'};
 // The remaining batch has crisis 34, above the strict autonomous limit of 30.
 derive(s);
 assert.equal(r.stages[1].urgency,29);
 r.pressure=5;derive(s);
 assert.equal(r.stages[1].urgency,34);
 assert.equal(r.stages[1].assessment.autonomousEligible,false);
 assert.equal(r.stages[0].assessment.autonomousEligible,false);
 assert.equal(r.assessment.autonomousEligible,false);
 assert.equal(r.assessment.eligible,false);
 assert.equal(r.assessment.mode,'blocked');
 assert.equal(r.stages[0].lastResolution.mode,'autonomous');
});

test('已全脱险或归营只保留实际撤出记录，不继续发布待撤行动资格',()=>{
 for(const status of ['safe','home']){
  const s=fresh(),r=s.fronts.sha;
  r.status=status;r.searchVerified=true;
  r.localOrganization={retreatVerified:true,mobileGroup:true,verifiedRound:1,relief:45};
  for(const st of r.stages){st.status=status;st.lastResolution={outcome:'safe',mode:'autonomous'};}
  derive(s);
  assert.equal(r.urgency,0);assert.equal(r.assessment.eligible,false);
  assert.equal(r.assessment.autonomousEligible,false);assert.equal(r.assessment.mode,'blocked');
  for(const st of r.stages){assert.equal(st.assessment.probability,0);assert.equal(st.assessment.autonomousEligible,false);assert.equal(st.lastResolution.mode,'autonomous');}
 }
});

test('三档开局相同，脱险概率分档，旧存档继续沿用原曲线',()=>{
 const sessions=['easy','normal','hard'].map(difficulty=>fresh({seed:31,difficulty}));
 for(const s of sessions){
  assert.equal(s.total,2500);assert.equal(s.reserve,2000);assert.equal(s.units['1'].men,500);
  assert.equal(crisisProbability(10,s.crisisRules),1);assert.equal(crisisProbability(42,s.crisisRules),0);
 }
 for(let risk=11;risk<42;risk++){
  const [easy,normal,hard]=sessions.map(s=>crisisProbability(risk,s.crisisRules));
  assert.ok(easy>normal&&normal>hard);
 }
 const saved=structuredClone(sessions[1]);saved.crisisRules.exponent=2;
 derive(saved);assert.equal(saved.crisisRules.exponent,2);
 assert.equal(crisisProbability(26,saved.crisisRules),.25);
});

test('新局分三、三、二路开放；旧档仍按存下的轮次解锁',()=>{
 const current=fresh({seed:185});
 const old=structuredClone(current);old.fronts.wang.openAt=5;
 const open=s=>Object.keys(s.fronts).filter(id=>s.fronts[id].status!=='locked').sort();
 for(const s of [current,old]){
  assert.deepEqual(open(s),['camp','fu','sha']);
  settle(s);settle(s);
  const third=['camp','cheng','fu','ma','sha'];
  assert.deepEqual(open(s),s===current?[...third,'wang']:third);
  settle(s);settle(s);
  assert.equal(open(s).length,8);
  assert.equal(s.fronts.du.openedRound,5);assert.equal(s.fronts.huang.openedRound,5);
  assert.equal(s.fronts.wang.openedRound,s===current?3:5);
 }
});
