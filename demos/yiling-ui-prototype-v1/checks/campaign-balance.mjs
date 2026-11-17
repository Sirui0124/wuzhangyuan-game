// Runs the shipping engine, with explicit fixture consent after delivered proof.
// This measures tactics, not model persuasion quality or human completion rate.
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {fresh,orders,settle,assertLedger} from '../campaign-engine.mjs';
const out=new URL('../../../outputs/yiling-shared-balance/',import.meta.url);
const policies={balanced:{escort:400,cover:300},escortOnly:{escort:500,cover:0},smallTeams:{escort:100,cover:100},heavy:{escort:800,cover:600}};
const results=[];
const order=(men,target,action)=>({unit:'new',men,target,action,rush:false,via:action==='scout'?'side':'normal'});
for(const difficulty of ['easy','normal','hard'])for(const [policy,config] of Object.entries(policies)){
 const runs=[];
 for(let trial=0;trial<200;trial++){
  const seed=createHash('sha256').update('shared-v2-'+trial).digest().readUInt32LE()||1;
  const s=fresh({seed,difficulty});
  for(let turn=0;turn<24&&!s.ended;turn++){
   const batches=[];let available=s.reserve,slots=5-Object.keys(s.units).length;
   if(s.units['1']?.state==='ready'){const target=['sha','camp','fu'].find(f=>s.fronts[f].status==='holding');if(target)batches.push({unit:'1',target,action:'rescue',rush:false,via:'normal'});}
   const active=(f,task)=>Object.values(s.units).some(u=>u.target===f&&u.task===task)||batches.some(o=>o.unit==='1'&&o.target===f&&o.action===task);
   const add=(n,f,task)=>{if(n&&available>=n&&slots>0){batches.push(order(n,f,task));available-=n;slots--;}};
   if(!s.facts.liubeiAliveVerified&&!active('fu','verify'))add(100,'fu','verify');
   // One small scout at a time preserves command slots for fighting pairs.
   const scout=['sha','camp','fu'].find(f=>s.fronts[f].status==='holding'&&!s.fronts[f].scouted&&!active(f,'scout'));
   if(scout&&!Object.values(s.units).some(u=>u.task==='scout'))add(100,scout,'scout');
   for(const f of ['sha','camp','fu'])if(s.fronts[f].status==='holding'){
    if(!active(f,'rescue'))add(config.escort,f,'rescue');
    if(!active(f,'relieve'))add(config.cover,f,'relieve');
   }
   if(batches.length)orders(s,batches);
   if(s.facts.liubeiAliveVerified)s.facts.withdrawalAccepted=true;
   settle(s);assertLedger(s);
   // Keep artifacts compact; this does not change state used by the engine.
   s.messages=[];s.receipts=[];
  }
  runs.push({round:s.round,ended:s.ended,returned:Object.values(s.fronts).filter(f=>f.status==='home').length,loss:s.wounded+s.dead,dead:s.dead});
 }
 const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
 results.push({difficulty,policy,runs:runs.length,completeBy12:runs.filter(r=>r.ended&&r.round<=12).length/2,completeBy24:runs.filter(r=>r.ended).length/2,medianRounds:median(runs.map(r=>r.round)),meanLoss:Math.round(runs.reduce((n,r)=>n+r.loss,0)/runs.length),meanDead:Math.round(runs.reduce((n,r)=>n+r.dead,0)/runs.length)});
}
await mkdir(out,{recursive:true});await writeFile(new URL('results.json',out),JSON.stringify({scope:'2500-total-with-starter; shipping-engine; consent fixture; 24-round observation cap, not a gameplay deadline',results},null,2));console.table(results);
