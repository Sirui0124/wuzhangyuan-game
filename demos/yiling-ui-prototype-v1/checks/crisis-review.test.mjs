import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,derive} from '../campaign-engine.mjs';

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
