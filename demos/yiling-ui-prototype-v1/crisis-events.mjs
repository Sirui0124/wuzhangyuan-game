import {createHash} from 'node:crypto';
const names={sha:'沙摩柯',fu:'傅肜',camp:'冯习、张南',ma:'马良',cheng:'程畿',du:'杜路、刘宁',wang:'王甫',huang:'黄权'};
export const effectiveResponse=(s,id)=>s.fronts[id]?.lastResponseRound===s.round||Object.values(s.units).some(u=>u.state==='active'&&u.target===id&&u.men>0&&['rescue','relieve','suppress'].includes(u.task));
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const threats={sha:'谷道上的追兵',fu:'后阵的吴军',camp:'营口的追兵',ma:'沿路搜寻的吴军',cheng:'江岸的追兵',du:'窄道口的吴军',wang:'退路上的追兵',huang:'渡口附近的吴军'};
function candidates(id,delta,r){
 const enemy=threats[id];
 const bodies=delta<0?[`${enemy}一时放缓了追逼，受困人员有了些喘息的余地。`,`${enemy}暂未压近，这一路眼下的险情稍有缓和。`]:delta>0?[`${enemy}继续逼近，这一路能周旋的余地更小了。`,`${enemy}仍在压迫退路，受困人员处境更加吃紧。`]:[`${enemy}尚未退去，这一路仍在原处周旋。`,`${enemy}与受困人员仍在相持，险情没有明显变化。`];
 const holding=stage=>r.stages.some(x=>x.id===stage&&x.status==='holding');
 if(delta!==0){const lower=delta<0;let specific=null;
  if(id==='sha'&&r.searchVerified&&holding('clans'))specific=lower?'找到的部众互相照应，队伍暂未继续散开，眼下多了些周旋余地。':'找到的部众尚未离开险地，追索迫得他们更难互相照应。';
  if(id==='ma'&&r.located&&r.notified&&holding('party'))specific=lower?'马良与随员重新照应好彼此，沿路周旋暂时稳住了。':'随员既要赶路又要相互照应，沿途受追索的压力更重了。';
  if(id==='fu')specific=lower?'傅肜独自在后阵寻得片刻喘息，逼近的压力暂缓。':'傅肜独守后阵，能周旋的空隙越来越小了。';
  if(id==='du'&&!lower)specific='被围的人饥乏未解，照应伤员和维持队形更吃力了。';
  if(id==='huang'&&holding('rear'))specific=lower?'黄权部重新整顿队次，岸上等候的将士暂时稳住阵脚。':'江北候渡的队伍仍受逼迫，最后一批人的周旋余地更小了。';
  if(specific)bodies.push(specific);
 }
 return bodies.map((text,index)=>({id:`${id}:${delta}:${index}`,text}));
}
export function prepareCrisisEvents(s,random){
 if(s.routeVersion!=='eight-front-20261118-v4')return null;
 if(s.crisisEventDraft?.round===s.round)return s.crisisEventDraft;
 const events=[];
 for(const [front,r]of Object.entries(s.fronts)){
  if(r.status!=='holding'||effectiveResponse(s,front)||r.urgency<30)continue;
  const before=r.urgency,deltas=before<=50?[-10,-5,0,5,10]:[5,10];
  const delta=deltas[Math.min(deltas.length-1,Math.floor(random(s)*deltas.length))];
  const pool=candidates(front,delta,r),fallbackId=pool[Math.floor(random(s)*pool.length)].id;
  const context={routeName:names[front],stages:r.stages.map(({id,name,status})=>({id,name,status})),response:{lastResponseRound:r.lastResponseRound??null,inTransit:Object.values(s.units).some(u=>u.target===front&&['queued','marching'].includes(u.state))},knowledge:{scouted:!!r.scouted,searchVerified:!!r.searchVerified,located:!!r.located,notified:!!r.notified,boatReady:!!r.boatReady,passageReady:!!r.passageReady,localOrganization:r.localOrganization||null},activeAid:Object.values(s.units).filter(u=>u.target===front).map(({men,state,task})=>({men,state,task})),recentReports:s.receipts.filter(x=>x.front===front).slice(-5).map(({text})=>text)};
  const snapshotHash=digest({round:s.round,front,before,delta,context});
  events.push({front,round:s.round,before,delta,candidates:pool,fallbackId,snapshotHash,context});
 }
 s.crisisEventDraft={round:s.round,snapshotHash:digest(events),events};return s.crisisEventDraft;
}
export function applyCrisisEvents(s,selections=[],receipt=()=>{}){
 if(s.routeVersion!=='eight-front-20261118-v4')return;
 s.crisisEvents??=[];
 for(const e of s.crisisEventDraft?.events||[]){
  if(e.round!==s.round||s.crisisEvents.some(x=>x.front===e.front&&x.round===e.round))continue;
  const r=s.fronts[e.front];if(r.status!=='holding'||effectiveResponse(s,e.front))continue;
  const selected=Array.isArray(selections)?selections.find(x=>x.front===e.front&&x.round===e.round&&x.snapshotHash===e.snapshotHash&&e.candidates.some(c=>c.id===x.eventId)):null;
  const chosen=e.candidates.find(x=>x.id===(selected?.eventId||e.fallbackId));
  // Preserve the event as a persistent offset; no second unresponsive pressure is applied.
  const before=r.urgency,after=Math.max(0,Math.min(100,before+e.delta)),actualDelta=after-before;
  r.eventOffset=(r.eventOffset||0)+actualDelta;
  const event={front:e.front,round:s.round,eventId:chosen.id,delta:e.delta,actualDelta,before,after,text:chosen.text,source:['model','fixed'].includes(selected?.source)?selected.source:'fallback',snapshotHash:e.snapshotHash,...(selected?.promptVersion?{promptVersion:selected.promptVersion}:{}),...(selected?.fallbackReason?{fallbackReason:selected.fallbackReason}:{})};
  r.lastCrisisEvent=event;s.crisisEvents.push(event);receipt(s,chosen.text,e.front);
 }
}
