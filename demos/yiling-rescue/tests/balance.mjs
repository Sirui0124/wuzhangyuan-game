import {ROUTES,BY_ID,ROUND_PRESSURE} from '../.build/data.js';
import {createState,resolveRound,nextRound,chooseCampPriority} from '../.build/engine.js';
import {writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const focus=[{sha:1100,ma:1000},{wang:600},{huang:800},{huang:500},{huang:500},{sun:200}];
const spread=[{sha:600,ma:600,huang:600},{front:300,fu:300,wang:300},{cheng:300,du:300,sun:200},{fu:100,huang:100,cheng:100,du:100,wang:100},{ma:200,wang:100,huang:200},{huang:300,sun:200}];
function run(seed,plans,count){
 const s=createState('simulation',seed),ledger=[];
 chooseCampPriority(s,'liu','ma');chooseCampPriority(s,'clerk','sha');chooseCampPriority(s,'attendant','huang');
 for(let round=1;round<=6;round++){
  if(round===2){chooseCampPriority(s,'liu','front');chooseCampPriority(s,'clerk','fu');chooseCampPriority(s,'attendant','wang');}
  if(round===3){chooseCampPriority(s,'clerk','cheng');chooseCampPriority(s,'boat','sun');}
  if(round===4)chooseCampPriority(s,'clerk','du');
  // Optimistic information/persuasion assumptions, respecting actual discovery rounds.
  for(const r of ROUTES){const t=s.tracks[r.id];if(!t.discovered)continue;t.known=r.facts.map(f=>f.id);if(r.core&&!t.agreed){t.agreed=true;t.thought=true;t.risk=Math.max(0,t.risk-8);}}
  const scheduled=Object.entries(plans[round-1]);
  const unavailable=scheduled.filter(([id])=>!s.tracks[id].discovered).map(([id,troops])=>({id,troops,reason:'本轮尚未发现，未派出兵力'}));
  const orders=scheduled.filter(([id])=>s.tracks[id].discovered&&s.tracks[id].status==='active').map(([id,troops])=>({id,troops,text:'按已知军情接应'}));
  const report=resolveRound(s,orders,orders.map(o=>({id:o.id,matched:BY_ID[o.id].actions.slice(0,count).map(a=>a.id),reason:'数值模拟'})));
  ledger.push({round,remaining:s.troops,unavailable,changes:report.changes});nextRound(s);
 }
 const saved=ROUTES.filter(r=>s.tracks[r.id].status==='saved').map(r=>r.id);
 assert.equal(s.phase,'ended');assert.ok(s.troops>=0);assert.ok(5000-s.troops<=5000);
 return {saved,spent:5000-s.troops,ledger};
}
const samples=1000,scenarios={};
for(const [name,plans,count] of [['集中接应、完整军令',focus,3],['集中接应、遗漏一项',focus,2],['集中接应、仅一项安排',focus,1],['分散派兵、完整军令',spread,3]]){
 const distribution={},byRoute=Object.fromEntries(ROUTES.map(r=>[r.id,0]));let total=0,spent=0;
 for(let i=0;i<samples;i++){const r=run('difficulty-'+i,plans,count);total+=r.saved.length;spent+=r.spent;distribution[r.saved.length]=(distribution[r.saved.length]??0)+1;for(const id of r.saved)byRoute[id]++;}
 scenarios[name]={averageSaved:total/samples,averageSpent:spent/samples,distribution,survivalRate:Object.fromEntries(Object.entries(byRoute).map(([id,n])=>[BY_ID[id].name,n/samples]))};
}
assert.ok(scenarios['集中接应、完整军令'].averageSaved>=3.5&&scenarios['集中接应、完整军令'].averageSaved<5);
assert.ok(scenarios['集中接应、完整军令'].averageSaved>scenarios['集中接应、遗漏一项'].averageSaved);
assert.ok(scenarios['集中接应、遗漏一项'].averageSaved>scenarios['集中接应、仅一项安排'].averageSaved);
assert.ok(scenarios['集中接应、完整军令'].averageSaved>scenarios['分散派兵、完整军令'].averageSaved+1);
const result={note:'不同开局、相同固定方案的数值模拟。按实际军营发现轮次推进，假设每条已发现路线均问齐情报且核心说服成功；不是玩家通过率、最优策略或最大可救人数证明。',samplesPerScenario:samples,roundPressure:ROUND_PRESSURE,scenarios,example:run('difficulty-0',focus,3)};
await mkdir('outputs/yiling-rescue-balance-20261028',{recursive:true});await writeFile('outputs/yiling-rescue-balance-20261028/balance.json',JSON.stringify(result,null,2));console.log(JSON.stringify(scenarios,null,2));
