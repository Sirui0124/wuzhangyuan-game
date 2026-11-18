import * as legacy from './crisis-v3.mjs';
import {effectiveResponse,prepareCrisisEvents,applyCrisisEvents} from './crisis-events.mjs';
export {prepareCrisisEvents,applyCrisisEvents} from './crisis-events.mjs';
// Authoritative crisis model. Relief is recalculated from current facts, never banked as work.
export const CRISIS_VERSION='eight-front-20261118-v4';
export const crisis=s=>s.routeVersion===CRISIS_VERSION||legacy.crisis(s);
export const CRISIS_CONFIG={
 sha:{base:82,escort:300,escortRelief:65,cover:200,coverRelief:14,knowledge:12,pressure:1},
 fu:{base:96,escort:300,escortRelief:55,cover:400,coverRelief:24,knowledge:0,pressure:1},
 camp:{base:94,escort:400,escortRelief:44,cover:300,coverRelief:30,knowledge:8,pressure:2},
 ma:{base:91,escort:400,escortRelief:50,cover:200,coverRelief:22,knowledge:12,pressure:2},
 cheng:{base:96,escort:400,escortRelief:48,cover:250,coverRelief:27,knowledge:10,pressure:2},
 du:{base:98,escort:500,escortRelief:46,cover:300,coverRelief:30,knowledge:10,pressure:3},
 wang:{base:88,escort:300,escortRelief:54,cover:150,coverRelief:20,knowledge:12,pressure:2},
 huang:{base:98,escort:500,escortRelief:46,cover:300,coverRelief:30,knowledge:10,pressure:3},
};
export function initCrisis(s,{version='v4'}={}){
 if(version==='v3')return legacy.initCrisis(s);
 s.crisisEvents=[];s.crisisRevision='20261118-player-feedback-1';
 s.routeVersion=CRISIS_VERSION;s.crisisRules={certainBelow:10,impossibleAbove:42,exponent:2};
 for(const [id,r] of Object.entries(s.fronts)){
  delete r.progress;delete r.work;delete r.executions;delete r.tuning;
  r.crisisTuning={...structuredClone(CRISIS_CONFIG[id]),suppressEffect:1};r.pressure=0;r.eventOffset=0;
  r.stages??=[{id:'person',name:'傅肜',status:'holding'}];
  for(const st of r.stages){delete st.work;delete st.progress;st.urgency=r.crisisTuning.base;}
 }
 for(const b of Object.values(s.boats))delete b.capacityProgress;
 refreshCrisis(s);
}
const strength=(s,id,task)=>Object.values(s.units).filter(u=>u.state==='active'&&u.target===id&&u.task===task).reduce((n,u)=>n+u.men,0);
// Older saved v4 tuning omitted this field and keeps its original 70% effect.
export function coverStrength(s,id){const factor=s.routeVersion===CRISIS_VERSION?(s.fronts[id]?.crisisTuning?.suppressEffect??.7):.7;return strength(s,id,'relieve')+factor*strength(s,id,'suppress');}
export function crisisProbability(value,rules){
 if(value<=rules.certainBelow)return 1;
 if(value>=rules.impossibleAbove)return 0;
 return ((rules.impossibleAbove-value)/(rules.impossibleAbove-rules.certainBelow))**rules.exponent;
}
export function refreshCrisis(s){
 if(legacy.crisis(s))return legacy.refreshCrisis(s);
 if(!crisis(s))return;
 for(const [id,r] of Object.entries(s.fronts)){
  const cfg=r.crisisTuning,escort=strength(s,id,'rescue'),cover=coverStrength(s,id);
  const known=id==='sha'?r.searchVerified:id==='ma'||id==='wang'?r.located&&r.notified:id==='cheng'||id==='huang'?r.boatReady:id==='du'?r.passageReady:r.scouted;
  const f=s.facts,reasons=[];
  if(!escort)reasons.push('护送队尚未在岗');
  if(['sha','ma','wang','cheng','du','huang'].includes(id)&&!known)reasons.push('实际会合或接应条件尚未落实');
  const eligible=escort>0&&(id==='fu'||id==='camp'||!!known);
  const organized=['sha','ma'].includes(id)&&r.localOrganization?.retreatVerified&&r.localOrganization?.mobileGroup;
  const autonomousConditions=organized&&!escort;
  const components={base:cfg.base,pressure:r.pressure,event:r.eventOffset||0,organization:organized?-Math.max(0,r.localOrganization.relief-cfg.escortRelief*Math.min(1.25,escort/cfg.escort)):0,escort:-cfg.escortRelief*Math.min(1.25,escort/cfg.escort),cover:-cfg.coverRelief*Math.min(1,cover/cfg.cover),knowledge:known?-cfg.knowledge:0,cooperation:id==='camp'&&r.planAccepted?-8:0};
  if(id==='fu'){
   components.truth=f.liubeiAliveVerified?-8:0;components.resolve=f.withdrawalAccepted?-20:0;
   components.duty=f.liubeiSafeConfirmed?-18:0;components.route=f.alternateRouteOpen?-20:f.routeScouted?-10:0;
   components.signal=f.withdrawalSignalDelivered?-10:0;
  }
  for(const key of Object.keys(components))if(Object.is(components[key],-0))components[key]=0;
  if(escort&&escort<cfg.escort)reasons.push('现有护送人手有限，接送与照应同行者仍吃紧');
  if(escort&&escort<cfg.escort&&['cheng','huang'].includes(id))reasons.push('本路只有一支接应船队，不能另派护送队或就地补员；更换护送兵力须先撤回，期间水上接应会中断');
  if(escort&&cover<cfg.cover)reasons.push('掩护兵力不足，追击仍在威胁撤离');
  if(escort&&(r.pressure+(r.eventOffset||0))>0)reasons.push('此前追击造成的压力尚未解除');
  if(r.status!=='holding')reasons.length=0;
  for(const [index,st] of r.stages.entries()){
   const parts={...components,batch:index>0&&id!=='sha'?5:0};
   const urgency=st.status==='holding'?Math.max(1,Math.min(100,Math.round(Object.values(parts).reduce((a,b)=>a+b,0)))):0;
   // A resolved batch has zero urgency, but that must not grant a fresh escape
   // opportunity or leak autonomous eligibility to a still-trapped batch.
   const awaiting=st.status==='holding'&&r.status==='holding';
   const autonomousEligible=awaiting&&!!autonomousConditions&&urgency<30;
   const batchReady=awaiting&&((eligible&&(id!=='camp'||index===0||cover>0))||autonomousEligible);
   const mode=autonomousEligible?'autonomous':batchReady?'escorted':'blocked';
   const batchReasons=id==='camp'&&index>0&&!cover?[...reasons,'后队伤员尚无实际掩护']:reasons;
   st.urgency=urgency;st.assessment={urgency,mode,autonomousEligible,eligible:st.status==='holding'&&batchReady&&r.status!=='locked',probability:st.status==='holding'&&batchReady&&r.status!=='locked'?crisisProbability(urgency,s.crisisRules):0,reasons:st.status==='holding'?[...batchReasons]:[],components:parts};
  }
  r.urgency=Math.max(...r.stages.map(x=>x.urgency));
  r.assessment={urgency:r.urgency,mode:r.stages.some(x=>x.assessment.mode==='autonomous')?'autonomous':r.stages.some(x=>x.assessment.mode==='escorted')?'escorted':'blocked',autonomousEligible:r.stages.some(x=>x.assessment.autonomousEligible),eligible:r.stages.some(x=>x.assessment.eligible),probability:r.stages.some(x=>x.status==='holding')?Math.min(...r.stages.filter(x=>x.status==='holding').map(x=>x.assessment.probability)):0,reasons,components};
 }
}
export function settleCrisis(s,random,receipt,selections=[]){
 if(legacy.crisis(s))return legacy.settleCrisis(s,random,receipt);
 if(s.crisisSettledRound===s.round)return;
 refreshCrisis(s);prepareCrisisEvents(s,random);applyCrisisEvents(s,selections,receipt);refreshCrisis(s);
 s.crisisSettledRound=s.round;
 for(const [id,r] of Object.entries(s.fronts)){
  if(r.status!=='holding')continue;
  // One encounter draw per route. Ready groups can leave together; no minimum turns.
  const draw=r.stages.some(st=>st.assessment.eligible)?random(s):null;
  for(const st of r.stages){
   if(st.status!=='holding')continue;
   const a=structuredClone(st.assessment),safe=a.eligible&&draw<a.probability;
   st.lastResolution={round:s.round,...a,draw,outcome:safe?'safe':'holding'};
   if(safe){st.status='safe';st.safeRound=s.round;st.urgency=0;receipt(s,st.name+(a.mode==='autonomous'?'已沿核实的退路自行撤出，正在返回接应营。':'已脱离险境，正在返回接应营。'),id);}
   else if(a.eligible)receipt(s,st.name+(a.mode==='autonomous'?'仍在设法沿退路撤离，尚未收到脱险回报。':'仍受追击，接应队尚未带人脱离险境。'),id);
  }
  if(draw===null)receipt(s,'接应条件尚未落实，受困人员仍在原处等待。',id);

  if(r.stages.every(x=>x.status!=='holding')){r.status='safe';r.safeRound=s.round;r.urgency=0;}
  else if(effectiveResponse(s,id))r.pressure=Math.min(20,r.pressure+r.crisisTuning.pressure*({easy:.5,normal:1,hard:1.5}[s.difficulty]));
  if(id==='fu'){
   const a=r.stages[0].lastResolution,safe=r.status==='safe';
   s.core.status=r.status==='safe'?'safe':'holding';s.core.round=s.round;s.core.revision++;s.core.pressure=r.pressure;
   s.core.journal.push({round:s.round,crisis:a.urgency,probability:a.probability,draw,outcome:safe?'safe':'holding',pressureAfter:r.pressure,factors:[]});
  }
 }
 refreshCrisis(s);
}

// These are verified one-time local capabilities, not accumulated progress.
export function recordCrisisArrival(s,id,task,receipt=()=>{}){
 if(s.routeVersion!==CRISIS_VERSION||!s.fronts[id])return;
 const r=s.fronts[id];
 if(['scout','verify','signal'].includes(task)){r.responseFacts??={};if(!r.responseFacts[task]){r.responseFacts[task]=true;r.lastResponseRound=s.round;}}
 if(!['sha','ma'].includes(id)||!['scout','rescue'].includes(task)||r.localOrganization)return;
 const verified=id==='sha'?r.searchVerified:r.located&&r.notified&&r.scouted;
 if(!verified)return;
 r.localOrganization={retreatVerified:true,mobileGroup:true,verifiedRound:s.round,relief:id==='sha'?45:55};
 receipt(s,id==='sha'?'已经联系上的部众仍能自行行进，退路也已核实；未找到的人仍不作获救计算。':'马良与随员已收到撤军消息，退路核实可走，随员能自行整队撤离。',id);
}
