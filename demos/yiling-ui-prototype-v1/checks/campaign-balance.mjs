import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fresh,orders,settle,assertLedger} from '../campaign-engine.mjs';
import {ROUTE_VERSION} from '../route-config.mjs';
const out=new URL('../../../outputs/three-front-balance-20261118/',import.meta.url);await mkdir(out,{recursive:true});
const fronts=['sha','camp','fu'];
const O=(target,action,men,unit='new',rush=true)=>({target,action,men,unit,rush,via:action==='scout'?'side':'normal'});
const policies={
 shaPartial:{consent:false,plan:(s,r)=>r===1?[O('sha','rescue',200),O('sha','scout',100)]:[]},
 fuLastRound:{consent:true,plan:(s,r)=>r===1?[O('fu','verify',100),O('fu','scout',100)]:r===6?[O('fu','rescue',500,'1'),O('fu','relieve',500),O('fu','suppress',500),O('fu','signal',100)]:[]},
 shaNoSearch:{consent:false,plan:(s,r)=>r===1?[O('sha','rescue',500,'1'),O('sha','relieve',300)]:[]},
 shaSearchEarly:{consent:false,plan:(s,r)=>r===1?[O('sha','rescue',500,'1'),O('sha','relieve',300),O('sha','scout',100)]:[]},
 shaSearchLate:{consent:false,plan:(s,r)=>r===1?[O('sha','rescue',500,'1'),O('sha','relieve',300)]:r===4?[O('sha','scout',100)]:[]},
 campNoPlan:{consent:false,plan:(s,r)=>r===1?[O('camp','rescue',500,'1'),O('camp','relieve',200)]:[]},
 campRelayPlan:{consent:false,relay:true,plan:(s,r)=>r===1?[O('camp','rescue',500,'1'),O('camp','relieve',200)]:[]},
 campWeakCoverPlan:{consent:false,relay:true,plan:(s,r)=>r===1?[O('camp','rescue',500,'1'),O('camp','relieve',100)]:[]},
 twoRoads:{consent:false,plan:(s,r)=>r===1?[O('camp','rescue',500,'1'),O('camp','relieve',400),O('sha','rescue',600),O('sha','relieve',300),O('sha','scout',100)]:[]},
 fuInformationOnly:{consent:false,plan:(s,r)=>r===1?[O('fu','verify',100),O('fu','scout',100)]:[]},
 fuInformationAndConsentOnly:{consent:true,plan:(s,r)=>r===1?[O('fu','verify',100),O('fu','scout',100)]:[]},
 fuMilitaryNoConsent:{consent:false,plan:(s,r)=>r===1?[O('fu','rescue',500,'1'),O('fu','relieve',500),O('fu','verify',100),O('fu','scout',100),O('fu','suppress',500)]:[]},
 fullSearchStaggered:{consent:true,relay:true,plan:full},
 fullSearchNoRelay:{consent:true,plan:full},
 fullSearchNoConsent:{consent:false,relay:true,plan:full},
 fullPrepared:{consent:true,relay:true,plan:(s,r)=>[...full(s,r),...(r===5&&s.fronts.fu.status==='holding'?[O('fu','signal',100),O('fu','suppress',400)]:[])]},
};
function full(s,r){if(r===1)return[O('camp','rescue',500,'1'),O('camp','relieve',400),O('sha','rescue',600),O('sha','scout',100),O('fu','verify',100)];if(r===3)return[...(s.fronts.sha.status==='holding'?[O('sha','relieve',300)]:[]),...(s.fronts.fu.status==='holding'?[O('fu','scout',100)]:[])];if(r===5&&s.fronts.fu.status==='holding')return[O('fu','rescue',400),O('fu','relieve',400)];return[];}
// Consent is a controlled fixture after delivered proof, never an AI or human pass rate.
const results=[],traces=[];const n=Number(process.env.TRIALS||200);
for(const difficulty of ['easy','normal','hard'])for(const [policy,def] of Object.entries(policies)){
 const runs=[];
 for(let t=0;t<n;t++){
  const seed=createHash('sha256').update('three-front-six-round-'+t).digest().readUInt32LE()||1,s=fresh({seed,difficulty,rules:'three'});let error=null;const trace=[];
  while(!s.ended){const r=s.round+1;let batch=def.plan(s,r);if(batch.length)try{orders(s,batch);}catch(e){error=e.message;break;}
   if(def.consent&&s.facts.liubeiAliveVerified)s.facts.withdrawalAccepted=true;
   if(def.relay)s.fronts.camp.planAccepted=true;
   settle(s);assertLedger(s);trace.push({round:s.round,status:Object.fromEntries(fronts.map(f=>[f,s.fronts[f].status])),progress:{sha:s.fronts.sha.progress,camp:s.fronts.camp.progress},stages:structuredClone({sha:s.fronts.sha.stages,camp:s.fronts.camp.stages}),fu:s.core.journal.at(-1),reserve:s.reserve,slots:Object.keys(s.units).length,units:Object.values(s.units).map(u=>({id:u.id,men:u.men,target:u.target,task:u.task,state:u.state})),loss:s.dead+s.wounded});
  }
  const row={seed,round:s.round,status:Object.fromEntries(fronts.map(f=>[f,s.fronts[f].status])),stageResults:structuredClone({sha:s.fronts.sha.stages,camp:s.fronts.camp.stages}),loss:s.dead+s.wounded,dead:s.dead,error};runs.push(row);if(t===0)traces.push({difficulty,policy,trace,...row});
 }
 const avg=k=>Math.round(runs.reduce((v,r)=>v+r[k],0)/n*10)/10;
 results.push({difficulty,policy,n,allHome:runs.filter(r=>fronts.every(f=>r.status[f]==='home')).length/n,allAtLeastSafe:runs.filter(r=>fronts.every(f=>r.status[f]!=='holding')).length/n,status:Object.fromEntries(fronts.map(f=>[f,Object.fromEntries(['home','safe','holding'].map(k=>[k,runs.filter(r=>r.status[f]===k).length/n]))])),meanLoss:avg('loss'),meanDead:avg('dead'),meanStageHomeRound:Object.fromEntries(['sha','camp'].map(f=>[f,runs[0].stageResults[f].map((stage,index)=>{const rounds=runs.map(r=>r.stageResults[f][index].homeRound).filter(x=>Number.isFinite(x));return {id:stage.id,returned:rounds.length,mean:rounds.length?rounds.reduce((n,x)=>n+x,0)/rounds.length:null};})])),errors:runs.filter(r=>r.error).length});
}
const files=['campaign-engine.mjs','route-config.mjs','fu-ai.mjs','../../docs/design/chapter-four-ai-library-20261117/furong-rescue.ts','../../docs/design/chapter-four-ai-library-20261117/furong-rescue.design.json'];const hashes=Object.fromEntries(await Promise.all(files.map(async f=>[f,createHash('sha256').update(await readFile(new URL('../'+f,import.meta.url))).digest('hex')])));
await writeFile(new URL('results.json',out),JSON.stringify({scope:'six tactical rounds, actual engine, controlled consent only after verified evidence, no AI/human success-rate claim',routeVersion:ROUTE_VERSION,seedSequence:{algorithm:'sha256(UTF-8 three-front-six-round- + trialIndex), first four bytes readUInt32LE, zero replaced by 1',count:n,seeds:Array.from({length:n},(_,t)=>createHash('sha256').update('three-front-six-round-'+t).digest().readUInt32LE()||1)},hashes,results,traces},null,2));
console.table(results.map(({difficulty,policy,allHome,allAtLeastSafe,meanLoss,meanDead,errors,status})=>({difficulty,policy,allHome,allAtLeastSafe,shaHome:status.sha.home,campHome:status.camp.home,fuHome:status.fu.home,meanLoss,meanDead,errors})));
