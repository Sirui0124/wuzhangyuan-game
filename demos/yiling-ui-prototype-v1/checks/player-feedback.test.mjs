import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,orders,prepareSettlement,derive} from '../campaign-engine.mjs';
const order=(action,men)=>({unit:'new',target:'camp',action,men,rush:true,via:'normal'});
function supported(task,legacy=false){const s=fresh({seed:731});if(legacy){delete s.crisisRevision;for(const r of Object.values(s.fronts))delete r.crisisTuning.suppressEffect;}orders(s,[order('rescue',500),order(task,300)]);prepareSettlement(s);return s;}

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
 const s=fresh();orders(s,[order('rescue',100),order('suppress',100)]);prepareSettlement(s);
 assert.ok(s.fronts.camp.assessment.reasons.some(x=>x.includes('护送人手')));
 assert.ok(s.fronts.camp.assessment.reasons.some(x=>x.includes('掩护兵力')));
 s.fronts.camp.status='safe';for(const st of s.fronts.camp.stages)st.status='safe';derive(s);
 assert.deepEqual(s.fronts.camp.assessment.reasons,[]);
 assert.ok(s.fronts.camp.stages.every(st=>st.assessment.reasons.length===0));
});
