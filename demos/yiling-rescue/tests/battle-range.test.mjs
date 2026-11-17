import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,resolveRound,publicView,actionEffect,battleBounds,orderOutlook} from '../.build/engine.js';
import {BY_ID,ROUTES} from '../.build/data.js';
const fixture=(seed,round=1)=>{
 const s=createState('fixture',seed);s.round=round;
 for(const r of ROUTES){s.tracks[r.id].discovered=true;s.tracks[r.id].known=r.facts.map(f=>f.id);s.tracks[r.id].agreed=true;}
 return s;
};
const order=(id,troops)=>({id,troops,text:'安排接应'});
const assessment=(id,count=3)=>({id,matched:BY_ID[id].actions.slice(0,count).map(a=>a.id),reason:'测试军令'});

test('六轮各有范围，结算落在范围内；投入不足时可能继续恶化',()=>{
 const effects=new Set();
 for(let round=1;round<=6;round++)for(let i=0;i<100;i++){
  const s=fixture('range-'+i,round),o=order('huang',800),a=assessment('huang'),e=actionEffect(s,o,a);
  const report=resolveRound(s,[o],[a]),c=report.changes.find(c=>c.id==='huang');
  assert.ok(c.effect>=e.minEffect&&c.effect<=e.maxEffect);
  assert.ok(c.pressure>=e.minGrowth&&c.pressure<=e.maxGrowth);assert.equal(c.after,Math.max(0,Math.min(100,c.before+c.pressure-c.effect)));
  if(round===1)effects.add(c.effect);
 }
 assert.ok(effects.size>=5,'同样安排在不同开局应有多种结果');
 const s=fixture('weak',6),o=order('huang',100),a=assessment('huang',0),c=resolveRound(s,[o],[a]).changes.find(c=>c.id==='huang');
 assert.ok(c.after>c.before);assert.match(orderOutlook(fixture('weak',6),o,a),/难稳住/);
});

test('同一战局多兵或更完整军令不会得到更差效果；完整军令缩小下行范围',()=>{
 for(let round=1;round<=6;round++)for(let i=0;i<50;i++){
  const s=fixture('quality-'+i,round),o=order('huang',500);
  const weak=actionEffect(s,o,assessment('huang',0)),full=actionEffect(s,o,assessment('huang'));
  assert.ok(full.minFactor>weak.minFactor);assert.ok(full.minEffect>=weak.maxEffect);
  const outcome=(troops,count)=>resolveRound(structuredClone(s),[order('huang',troops)],[assessment('huang',count)]).changes.find(c=>c.id==='huang').after;
  assert.ok(outcome(800,3)<=outcome(500,3));assert.ok(outcome(500,3)<=outcome(500,0));
 }
 assert.ok(battleBounds(fixture('x',6),'huang').minGrowth>battleBounds(fixture('x',1),'huang').minGrowth);
});

test('存档与重试不重抽，结果不依赖军令顺序或其他路线；旧存档兼容',()=>{
 for(const legacy of [false,true]){
  const s=fixture('persist');if(legacy)delete s.battleSeed;
  const orders=[order('huang',700),order('ma',500)],assessments=orders.map(o=>assessment(o.id));
  const run=()=>resolveRound(JSON.parse(JSON.stringify(s)),orders,assessments);
  assert.deepEqual(run(),run());
  const alone=resolveRound(structuredClone(s),[orders[0]],[assessments[0]]).changes.find(c=>c.id==='huang');
  assert.deepEqual(alone,run().changes.find(c=>c.id==='huang'));
  assert.deepEqual(run(),resolveRound(structuredClone(s),orders.toReversed(),assessments.toReversed()));
  const view=JSON.stringify(publicView(s));assert.ok(!view.includes('battleSeed'));assert.ok(!view.includes('"draw"'));
 }
});
