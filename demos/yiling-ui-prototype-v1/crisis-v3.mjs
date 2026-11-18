// Authoritative crisis model. Relief is recalculated from current facts, never banked as work.
export const CRISIS_VERSION='eight-front-20261118-v3';
export const crisis=s=>s.routeVersion===CRISIS_VERSION;
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
export function initCrisis(s){
 s.routeVersion=CRISIS_VERSION;s.crisisRules={certainBelow:10,impossibleAbove:42,exponent:2};
 for(const [id,r] of Object.entries(s.fronts)){
  delete r.progress;delete r.work;delete r.executions;delete r.tuning;
  r.crisisTuning=structuredClone(CRISIS_CONFIG[id]);r.pressure=0;
  r.stages??=[{id:'person',name:'傅肜',status:'holding'}];
  for(const st of r.stages){delete st.work;delete st.progress;st.urgency=r.crisisTuning.base;}
 }
 for(const b of Object.values(s.boats))delete b.capacityProgress;
 refreshCrisis(s);
}
const strength=(s,id,task)=>Object.values(s.units).filter(u=>u.state==='active'&&u.target===id&&u.task===task).reduce((n,u)=>n+u.men,0);
export function crisisProbability(value,rules){
 if(value<=rules.certainBelow)return 1;
 if(value>=rules.impossibleAbove)return 0;
 return ((rules.impossibleAbove-value)/(rules.impossibleAbove-rules.certainBelow))**rules.exponent;
}
export function refreshCrisis(s){
 if(!crisis(s))return;
 for(const [id,r] of Object.entries(s.fronts)){
  const cfg=r.crisisTuning,escort=strength(s,id,'rescue'),cover=strength(s,id,'relieve')+.7*strength(s,id,'suppress');
  const known=id==='sha'?r.searchVerified:id==='ma'||id==='wang'?r.located&&r.notified:id==='cheng'||id==='huang'?r.boatReady:id==='du'?r.passageReady:r.scouted;
  const f=s.facts,reasons=[];
  if(!escort)reasons.push('护送队尚未在岗');
  if(['sha','ma','wang','cheng','du','huang'].includes(id)&&!known)reasons.push('实际会合或接应条件尚未落实');
  const eligible=escort>0&&(id==='fu'||id==='camp'||!!known);
  const components={base:cfg.base,pressure:r.pressure,escort:-cfg.escortRelief*Math.min(1.25,escort/cfg.escort),cover:-cfg.coverRelief*Math.min(1,cover/cfg.cover),knowledge:known?-cfg.knowledge:0,cooperation:id==='camp'&&r.planAccepted?-8:0};
  if(id==='fu'){
   components.truth=f.liubeiAliveVerified?-8:0;components.resolve=f.withdrawalAccepted?-20:0;
   components.duty=f.liubeiSafeConfirmed?-18:0;components.route=f.alternateRouteOpen?-20:f.routeScouted?-10:0;
   components.signal=f.withdrawalSignalDelivered?-10:0;
  }
  for(const key of Object.keys(components))if(Object.is(components[key],-0))components[key]=0;
  if(escort&&cover<cfg.cover)reasons.push('掩护兵力不足，追击仍在威胁撤离');
  for(const [index,st] of r.stages.entries()){
   const parts={...components,batch:index>0&&id!=='sha'?5:0};
   const urgency=st.status==='holding'?Math.max(1,Math.min(99,Math.round(Object.values(parts).reduce((a,b)=>a+b,0)))):0;
   const batchReady=eligible&&(id!=='camp'||index===0||cover>0);
   const batchReasons=id==='camp'&&index>0&&!cover?[...reasons,'后队伤员尚无实际掩护']:reasons;
   st.urgency=urgency;st.assessment={urgency,eligible:st.status==='holding'&&batchReady&&r.status!=='locked',probability:st.status==='holding'&&batchReady&&r.status!=='locked'?crisisProbability(urgency,s.crisisRules):0,reasons:[...batchReasons],components:parts};
  }
  r.urgency=Math.max(...r.stages.map(x=>x.urgency));
  r.assessment={urgency:r.urgency,eligible:r.stages.some(x=>x.assessment.eligible),probability:r.stages.some(x=>x.status==='holding')?Math.min(...r.stages.filter(x=>x.status==='holding').map(x=>x.assessment.probability)):0,reasons,components};
 }
}
export function settleCrisis(s,random,receipt){
 refreshCrisis(s);
 for(const [id,r] of Object.entries(s.fronts)){
  if(r.status!=='holding')continue;
  // One encounter draw per route. Ready groups can leave together; no minimum turns.
  const draw=r.stages.some(st=>st.assessment.eligible)?random(s):null;
  for(const st of r.stages){
   if(st.status!=='holding')continue;
   const a=structuredClone(st.assessment),safe=a.eligible&&draw<a.probability;
   st.lastResolution={round:s.round,...a,draw,outcome:safe?'safe':'holding'};
   if(safe){st.status='safe';st.safeRound=s.round;st.urgency=0;receipt(s,st.name+'已脱离险境，正在返回接应营。',id);}
   else if(a.eligible)receipt(s,st.name+'仍受追击，接应队尚未带人脱离险境。',id);
  }
  if(draw===null)receipt(s,'接应条件尚未落实，受困人员仍在原处等待。',id);

  if(r.stages.every(x=>x.status!=='holding')){r.status='safe';r.safeRound=s.round;r.urgency=0;}
  else r.pressure=Math.min(20,r.pressure+(draw===null?6:r.crisisTuning.pressure)*({easy:.5,normal:1,hard:1.5}[s.difficulty]));
  if(id==='fu'){
   const a=r.stages[0].lastResolution,safe=r.status==='safe';
   s.core.status=r.status==='safe'?'safe':'holding';s.core.round=s.round;s.core.revision++;s.core.pressure=r.pressure;
   s.core.journal.push({round:s.round,crisis:a.urgency,probability:a.probability,draw,outcome:safe?'safe':'holding',pressureAfter:r.pressure,factors:[]});
  }
 }
 refreshCrisis(s);
}
