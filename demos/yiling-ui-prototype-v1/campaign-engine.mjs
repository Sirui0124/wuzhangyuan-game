import {crisis,initCrisis,refreshCrisis,settleCrisis,prepareCrisisEvents,recordCrisisArrival,coverStrength} from './crisis-rules.mjs';
import {initRoutes,initEightRoutes,ensureBoats,routeTuning,eight,EIGHT_CONFIG,unlockRoutes,arriveRoute,modern,returnStages,advanceStages,routeGuidance,routeAuthority} from './route-config.mjs';
import {randomUUID} from 'node:crypto';
import {createState,resolveRound,evaluate} from '../../docs/design/chapter-four-ai-library-20261117/furong-rescue.ts';
import {design} from './fu-ai.mjs';

export const VERSION='starter-500-reserve-2000-v2';
export const FRONTS={sha:{name:'沙摩柯',urgency:84,escort:400,cover:200,work:3},camp:{name:'冯习 · 张南',urgency:88,escort:400,cover:300,work:3.6},fu:{name:'傅肜',urgency:96,escort:300,cover:400,work:0},...Object.fromEntries(Object.entries(EIGHT_CONFIG).filter(([id])=>!['sha','camp','fu'].includes(id)).map(([id,cfg])=>[id,{...cfg,urgency:80}]))};
export const TASKS={rescue:'接应护送',relieve:'接替断后',suppress:'压制追兵',scout:'探查撤路',verify:'核实刘备消息',signal:'传撤离信号',retreat:'撤回接应营',hold:'原地待命',rest:'原地休整'};
export const DIFFICULTY={easy:{name:'从容',loss:.7,pressure:1},normal:{name:'标准',loss:1,pressure:2},hard:{name:'险局',loss:1.35,pressure:3}};
export function fail(text,status=400){throw Object.assign(Error(text),{status});}
export function message(s,speaker,text,kind='report',front=null,unit=null){const id=String(++s.seq);s.messages.push({id,speaker,text,kind,front,unit,round:s.round});return id;}
function receipt(s,text,front=null,unit=null){const id=s.scenarioId+'/event-'+(++s.eventSeq);s.receipts.push({id,round:s.round,text,front,unit});message(s,'军侯',text,'report',front,unit);return id;}
export function fresh({seed=1,difficulty='normal',total=2500,rules='eight'}={}){
 if(!Object.hasOwn(DIFFICULTY,difficulty))fail('难度不正确。');
 if(!Number.isInteger(total)||total<500||total%100)fail('初始兵力须为不少于500的百人整数。');
 const scenarioId=randomUUID();
 const s={schemaVersion:2,balanceVersion:VERSION,scenarioId,revision:0,round:0,roundLimit:6,difficulty,seed:seed>>>0||1,phase:'deceived_and_bereaved',core:createState(design,scenarioId,seed>>>0||1),facts:Object.fromEntries(Object.keys(design.factDefinitions).map(k=>[k,false])),total:2500,reserve:2000,wounded:0,dead:0,units:{'1':{id:'1',name:'甲队',starter:true,men:500,initial:500,deployed:0,state:'ready',at:'camp',target:null,task:null,status:'营中待命',eta:0}},archive:[],nextUnit:2,fronts:Object.fromEntries(Object.entries(FRONTS).map(([id,f])=>[id,{status:'holding',progress:0,work:f.work,scouted:false,urgency:f.urgency}])),messages:[],receipts:[],turns:[],requests:{},seq:0,eventSeq:0,nextSendAt:0,ended:false};
 if(rules==='three'){for(const id of Object.keys(s.fronts))if(!['sha','camp','fu'].includes(id))delete s.fronts[id];initRoutes(s);}else{initEightRoutes(s);s.roundLimit=8;if(rules!=='eight-v2')initCrisis(s,{version:rules==='eight-v3'?'v3':'v4'});}
 s.total=total;s.reserve=total-500;
 message(s,'沙摩柯','火起后，人都冲散了。营口那小卒说有人往谷里去，我追过来，还没见着他们。','dialogue','sha');
 message(s,'张南','前队在营口，我看着他们。冯习还在里面收伤兵。','dialogue','camp');
 message(s,'冯习','先把能走的人接出去。后队抬着伤兵，还得有人守住营口。','dialogue','camp');
 message(s,'傅肜','吴人说陛下已经遇害。跟着我的人也都死在这里了……我不走，叫他们再来。','dialogue','fu');
 receipt(s,`甲队500人在营中待命，另有预备兵${s.reserve}人。新编以100人为单位，同时最多5支队伍。${s.crisisRevision?'各处的求援还会陆续送到，营里要留人周转。':''}`);
 return s;
}
export function assertLedger(s){
 const active=Object.values(s.units);const total=s.reserve+s.wounded+s.dead+active.reduce((n,u)=>n+u.men,0);
 if(total!==(s.total??2000)||active.length>5||[s.reserve,s.wounded,s.dead,...active.map(u=>u.men)].some(n=>!Number.isInteger(n)||n<0))throw Error('兵力账目不守恒');
}
function random(s){let x=s.seed;x^=x<<13;x^=x>>>17;x^=x<<5;s.seed=x>>>0;return s.seed/4294967296;}
function legacyFleets(s){return eight(s)&&s.routeVersion!=='eight-front-20261118-v4';}
export function travelRounds(unit,order){
 if(['retreat','rest','hold'].includes(order.action))return 0;
 if(unit?.state==='active'&&unit.target===order.target)return 1;
 return ['scout','verify','signal'].includes(order.action)?1:2;
}
export function previewOrders(state,items){
 const after=structuredClone(state);
 orders(after,items);
 return {revision:state.revision,reserve:after.reserve,freeSlots:5-Object.keys(after.units).length,
  arrivals:items.map(order=>state.round+Math.max(1,travelRounds(state.units[order.unit],order)))};
}
function withdraw(s,u,reason){u.state='returning';u.eta=1;u.at='cross';u.status=reason+' · 返程中，两个时辰后归营';}
function unitName(s,id){return s.units[id]?.name||`第${id}队`;}
function archive(s,id,reason){const u=s.units[id];s.archive.push({...u,closedRound:s.round,reason});
 if(eight(s)&&u.fleetId){const boat=s.boats?.[u.fleetOwner||u.target];if(boat?.unitId===id){boat.unitId=null;boat.state='ready';}delete u.fleetId;delete u.fleetOwner;delete u.transport;}
 if(u.starter){const target=u.target;delete u.pending;Object.assign(u,{state:'ready',at:'camp',target:null,task:null,eta:0,deployed:0,status:'营中待命'});receipt(s,`${u.name}${reason}，现有${u.men}人在营中待命。`,target,id);}
 else{s.reserve+=u.men;delete s.units[id];receipt(s,`第${id}队${reason}，${u.men}人归入预备兵。`,u.target,id);}}

export function orders(s,items){
 if(s.ended)fail('本次营救已结算，请新开一局。');
 if(!Array.isArray(items)||!items.length||items.length>5)fail('一批可安排1至5支队伍。');
 // Validate on a copy: a bad last clause cannot reserve the first clause's soldiers.
 const draft=structuredClone(s),seen=new Set();ensureBoats(draft);
 for(const [orderIndex,o] of items.entries()){
  if(!o||!Object.hasOwn(TASKS,o.action)||(o.target!==null&&!Object.hasOwn(draft.fronts,o.target)))fail('任务或接应对象不明确。');
  if(o.target&&draft.fronts[o.target].status==='locked')fail('尚未收到这一路的接应消息。');
  if(!['normal','side'].includes(o.via))fail(`第${orderIndex+1}条军令的路线不正确，请选择常规或南侧道路；本批军令均未发出。`);
  const existing=o.unit!=='new';let u;
  if(existing){
   if(typeof o.unit!=='string'||!Object.hasOwn(draft.units,o.unit)||seen.has(o.unit))fail('该队不存在，或同一批被重复安排。');
   seen.add(o.unit);u=draft.units[o.unit];
   if(u.state==='returning')fail(`第${o.unit}队正在归营，请等其返回。`);
   if(legacyFleets(draft)&&u.fleetId&&o.action!=='retreat'&&(o.target!==(u.fleetOwner||u.target)||o.action!=='rescue'))fail('船队仍在本路执行，请先撤回，归营后再安排其他任务。');
   if(o.men!==undefined&&o.men!==u.men)fail('已派出的队伍按现有实兵调度，不能隔空补员或拆队。');
  }else{
   if(['retreat','hold','rest'].includes(o.action))fail('待命兵力无需新编队休整或撤回。');
   if(!Number.isInteger(o.men)||o.men<100||o.men%100)fail('新编队以100人为单位。');
   if(o.men>draft.reserve)fail(`第${orderIndex+1}道令要新编${o.men}人，当前预备兵只有${draft.reserve}人。本批尚未发出。`);
   if(Object.keys(draft.units).length>=5)fail('最多同时5支任务队，待出发与归途中也占名额。');
   const id=String(draft.nextUnit++);u={id,men:o.men,initial:o.men,deployed:o.men,state:'queued',at:'camp',target:o.target,task:o.action,status:'待出发',eta:0};draft.units[id]=u;draft.reserve-=o.men;
  }
  if(['rescue','relieve','suppress','scout'].includes(o.action)&&!o.target)fail('请写明接应哪一路。');
  if(['verify','signal'].includes(o.action)&&o.target!=='fu')fail('核实刘备与撤离信号用于傅肜一路。');
  if(o.action==='signal'&&!draft.facts.withdrawalAccepted)fail(`第${orderIndex+1}条军令暂不能传撤离信号：傅肜尚未接受撤离，先与他把回去的打算说清楚；核实消息和安排接应不受此限制。本批军令均未发出。`);
  if(o.target&&draft.fronts[o.target].status!=='holding'&&!['retreat','rest','hold'].includes(o.action))fail('这一路已经撤离，无需继续派队。');
  if(legacyFleets(draft)&&EIGHT_CONFIG[o.target]?.water&&o.action==='rescue'){
   const boat=draft.boats[o.target];if(boat.state==='lost')fail('本路接应船队已失去联络，无法再次派出。');if(boat.unitId&&boat.unitId!==u.id)fail('本路接应船队已被占用，只有这一支船队，不能另派护送队或就地补员。更换护送兵力须先撤回，期间水上接应会中断；本批军令均未发出。');
   boat.unitId=u.id;boat.state='queued';u.fleetId=boat.id;u.fleetOwner=o.target;
  }
  if(o.action==='retreat'&&u.state==='queued'){archive(draft,u.id,'取消待发军令');continue;}
  if(u.state==='ready'&&['retreat','rest','hold'].includes(o.action)){receipt(draft,`${u.name}在营中待命。`,null,u.id);continue;}
  if(u.state==='ready')u.state='queued';
  u.pending={unit:u.id,action:o.action,target:o.target,men:u.men,via:o.via};u.status=u.state==='queued'?'待出发':'新令待执行';
  message(draft,'我',`${unitName(draft,u.id)} · ${u.men}人 · ${TASKS[o.action]}${o.target?' → '+FRONTS[o.target].name:''}${o.via==='side'?' · 南侧路':''}`,'order',o.target,u.id);
 }
 assertLedger(draft);Object.assign(s,draft);
}
function strength(s,front,task){return Object.values(s.units).filter(u=>u.state==='active'&&u.target===front&&u.task===task).reduce((n,u)=>n+u.men,0);}
function weightedDesign(s){const ratios={cover:Math.min(1,strength(s,'fu','relieve')/400),escort:Math.min(1,strength(s,'fu','rescue')/300),enemy:Math.min(1,strength(s,'fu','suppress')/400)};return {...design,branches:design.branches.map(b=>({...b,reduction:Math.round((eight(s)&&b.group==='escort'?55:eight(s)&&b.group==='resolve'?20:b.reduction)*(ratios[b.group]??1))}))};}
export function derive(s){
 ensureBoats(s);
 if(eight(s)){for(const id of ['cheng','huang'])s.fronts[id].boatReady=strength(s,id,'rescue')>0;s.fronts.du.passageReady=strength(s,'du','rescue')>0;}
 if(legacyFleets(s))for(const boat of Object.values(s.boats||{})){const u=s.units[boat.unitId];if(boat.state!=='lost')boat.state=u?.state||'ready';if(!u)boat.unitId=null;}
 s.facts.reliefInPosition=strength(s,'fu','relieve')>0;s.facts.escortReady=strength(s,'fu','rescue')>0;s.facts.enemySuppressed=strength(s,'fu','suppress')>0;
 if(s.fronts.fu.status==='home')s.phase='home';else if(s.core.status==='safe')s.phase='safe';else s.phase=s.facts.withdrawalAccepted?'withdrawal_accepted':s.facts.liubeiAliveVerified?'truth_verified':'deceived_and_bereaved';
 if(crisis(s)){refreshCrisis(s);return;}
 s.fronts.fu.urgency=s.core.status==='safe'?0:Math.round(evaluate(weightedDesign(s),s.facts,s.core.pressure).crisis/99*FRONTS.fu.urgency);
}
export function prepareSettlement(s){
 if(s.ended)fail('本次营救已经结束。');
 const before=structuredClone(s),casualties={};
 s.round++;
 returnStages(s,receipt);
 for(const [f,route] of Object.entries(s.fronts))if(route.status==='safe'){route.status='home';receipt(s,FRONTS[f].name+'已回到接应营。',f);}
 for(const [id,u] of Object.entries(s.units)){
  if(u.state==='returning'){archive(s,id,'回营');continue;}
  if(u.pending){const o=u.pending;delete u.pending;
   if(o.action==='retreat'){withdraw(s,u,'奉令撤回');receipt(s,`${unitName(s,id)}奉令撤回，正返回接应营，两个时辰后归营。`,u.target,id);continue;}
   const travel=travelRounds(u,o);
   u.task=o.action;u.target=o.target||u.target;u.via=o.via;delete u.transport;
   if(['hold','rest'].includes(o.action)){u.state='active';u.eta=0;u.status=TASKS[o.action];continue;}
   u.state='marching';u.eta=travel;u.at='cross';
  }
  if(u.state==='marching'){
   u.eta--;u.status=`行军 · ${Math.max(0,u.eta)*2}个时辰后到位`;if(u.eta>0){receipt(s,`${unitName(s,id)}正${u.via==='side'?'沿南侧路':''}赶往${FRONTS[u.target].name}所在处，尚未到位。`,u.target,id);continue;}
   u.state='active';u.at=eight(s)&&!['sha','camp','fu'].includes(u.target)?u.target:u.target==='fu'?'rear':u.target==='sha'?'east':'campfire';u.status=TASKS[u.task]+'中';
   if(eight(s)&&EIGHT_CONFIG[u.target]?.water&&u.task==='rescue'){u.transport='boat';u.status='水上接应中';}
   receipt(s,`${unitName(s,id)}已到位，${u.men}人${u.transport==='boat'?'随接应船渡运护送':TASKS[u.task]}。`,u.target,id);
   arriveRoute(s,u.target,u.task,receipt,id);
   recordCrisisArrival(s,u.target,u.task,receipt);
   if(u.task==='scout'){s.fronts[u.target].scouted=true;if(modern(s)&&u.target==='sha'){s.fronts.sha.searchVerified=true;receipt(s,'侦察队核实了谷道中的部众去向，与沙摩柯联络并确认会合处；找到的人尚待护送，仍失散者不作全数找齐。','sha',id);}if(u.target==='fu'){s.facts.routeScouted=true;if(u.via==='side')s.facts.alternateRouteOpen=true;}receipt(s,'撤路已探明'+(u.via==='side'?'，南侧替代路线可通行':'')+'。',u.target,id);withdraw(s,u,'侦察完成');}
   if(u.task==='verify'){s.facts.liubeiAliveVerified=true;receipt(s,'传令兵与刘备随行队取得联系，确认陛下仍在；反证已送达傅肜。','fu',id);withdraw(s,u,'核实完成');u.verifyReturn=true;}
   if(u.task==='signal'){s.facts.withdrawalSignalDelivered=true;receipt(s,'共同撤离信号已送达。','fu',id);withdraw(s,u,'传信完成');}
  }
 }
 // The second receipt is only available once the verifying unit has actually returned.
 if(s.archive.some(u=>u.verifyReturn)&&!s.facts.liubeiSafeConfirmed){s.facts.liubeiSafeConfirmed=true;receipt(s,'核实队回营复报：刘备已脱离当下追击，消息已送达傅肜。','fu');}
 for(const f of Object.keys(s.fronts).filter(f=>!crisis(s)&&f!=='fu')){
  const route=s.fronts[f],cfg=eight(s)?{...FRONTS[f],...routeTuning(s,f)}:FRONTS[f];if(route.status!=='holding')continue;
  const escort=strength(s,f,'rescue'),cover=strength(s,f,'relieve')+strength(s,f,'suppress')*.7;
  const speed=Math.min(1.25,escort/cfg.escort)*((cfg.base??.35)+(1-(cfg.base??.35))*Math.min(1,cover/cfg.cover))*(route.scouted||eight(s)&&f!=='camp'?1:.85);
  if(modern(s)){advanceStages(s,f,speed,escort,cover,receipt);if(route.status==='holding'){
   route.urgency=Math.max(1,Math.round(cfg.urgency-route.progress/route.work*(cfg.urgency-9)));
   if(eight(s)&&!['sha','camp'].includes(f)&&escort>0&&cover<cfg.cover)receipt(s,cover===0?'接应队仍在接送人员，尚无另一队掩护，转移较慢。':'接应仍在进行，现有掩护尚不足以让护送队全速接人。',f);
  }continue;}
  route.progress+=speed;route.urgency=Math.max(1,Math.min(100,Math.round(cfg.urgency-route.progress/route.work*(cfg.urgency-9)+Math.max(0,s.round-5)*2)));
  if(speed>0)receipt(s,f==='sha'?(route.progress<route.work/2?'东沟的人正在撤出。':'东沟已接上，正把西沟担架接出来。'):(route.progress<route.work/2?'张南前队正在撤出。':'前队已接上，正收冯习的后队伤兵。'),f);
  if(route.progress>=route.work){route.status='safe';route.urgency=0;receipt(s,FRONTS[f].name+'一路已接齐，正在护送归营。',f);}
 }
 derive(s);
 const eventDraft=prepareCrisisEvents(s,random);
 return {before,casualties,eventDraft};
}
export function completeSettlement(s,prepared,selections){
 const {before,casualties}=prepared;
 if(crisis(s))settleCrisis(s,random,receipt,selections);
 if(!crisis(s)&&s.core.status!=='safe'){
  const adjusted=weightedDesign(s);const before=s.core.pressure;
  const r=resolveRound(adjusted,s.core,{scenarioId:s.scenarioId,round:s.round,expectedRevision:s.core.revision,trigger:'endRound',commandBatchIds:[],receiptIds:s.receipts.filter(x=>x.round===s.round).map(x=>x.id),facts:s.facts,contact:true,eligible:strength(s,'fu','rescue')>0});
  s.core=r.state;if(r.resolution.outcome==='safe'){s.fronts.fu.status='safe';s.fronts.fu.safeRound=s.round;s.fronts.fu.urgency=0;receipt(s,'傅肜已经脱离后阵险境，正在返回接应营。','fu');}
  else{s.core.pressure=Math.min(20,before+DIFFICULTY[s.difficulty].pressure);}
 }
 const combatCover=Object.fromEntries(Object.keys(FRONTS).map(f=>[f,crisis(s)?coverStrength(s,f):strength(s,f,'relieve')+strength(s,f,'suppress')*.7]));
 for(const [id,u] of Object.entries(s.units)){
  if(u.state!=='active'||!['rescue','relieve','suppress','hold','rest'].includes(u.task))continue;
  const cfg=FRONTS[u.target],cover=combatCover[u.target];
  const hazard=(['relieve','suppress'].includes(u.task)?.04:.024)+Math.min(.03,.003*Math.max(0,s.round-8));
  const p=Math.min(.12,hazard*(s.crisisRules?.lossScale??DIFFICULTY[s.difficulty].loss)*(s.fronts[u.target].scouted?1:1.3)*(1.4-.7*Math.min(1,cover/(cfg.cover*1.5))));
  let loss=0,dead=0;for(let i=0;i<u.men;i++)if(random(s)<p){loss++;if(random(s)<.3)dead++;}
  casualties[id]={wounded:loss-dead,dead};u.men-=loss;u.deployed=u.men;s.wounded+=loss-dead;s.dead+=dead;
  if(u.men===0)receipt(s,`${unitName(s,id)}本轮出战${loss}人，伤${loss-dead}人、亡${dead}人，已无可战兵力。`,u.target,id);
  if(u.men===0){if(legacyFleets(s)&&u.fleetId&&s.boats?.[u.target]){s.boats[u.target].state='lost';s.boats[u.target].unitId=null;}s.archive.push({...u,closedRound:s.round,reason:'失去战力'});delete s.units[id];}
  else if(s.fronts[u.target].status!=='holding'){withdraw(s,u,'该路危机已解除');receipt(s,`${unitName(s,id)}本轮出战${u.men+loss}人，伤${loss-dead}人、亡${dead}人。该路危机已解除，余兵${u.men}人正在返程，两个时辰后归营。`,u.target,id);}
  else {u.status=TASKS[u.task]+'中 · 该路尚未解围';receipt(s,`${unitName(s,id)}本轮出战${u.men+loss}人，伤${loss-dead}人、亡${dead}人，余兵${u.men}人继续在当地${TASKS[u.task]}，该路尚未解围。`,u.target,id);}
 }
 derive(s);assertLedger(s);
 const allHome=Object.values(s.fronts).every(f=>f.status==='home')&&!Object.values(s.units).some(u=>u.state!=='ready');
 const allSafe=Object.values(s.fronts).every(f=>f.status==='safe'||f.status==='home');
 s.endReason=(eight(s)?allSafe:allHome)?'rescued':s.round>=(s.roundLimit??6)?'deadline':null;
 s.ended=!!s.endReason;
 if(s.endReason==='deadline')receipt(s,(eight(s)?'十六':'十二')+'时辰已尽，本次调度结束。各路按实际营救状态记录，返程队伍仍在途中，未归营兵力不计入预备兵。');
 if(allHome)receipt(s,`${eight(s)?'八':'三'}路归营。历时${s.round}轮，接应兵力存活${(s.total??2000)-s.dead}人，其中伤${s.wounded}人、阵亡${s.dead}人。`);
 else if(eight(s)&&allSafe)receipt(s,`八路已全部脱险，本次营救成功。历时${s.round}轮；仍在返程的人员按实况记录，不影响营救结果。`);
 s.lastReport={round:s.round,elapsed:s.round*2,ended:s.ended,pool:{reserve:s.reserve,ready:Object.values(s.units).filter(u=>u.state==='ready').reduce((n,u)=>n+u.men,0),outside:Object.values(s.units).filter(u=>u.state!=='ready').reduce((n,u)=>n+u.men,0)},events:s.receipts.filter(x=>x.round===s.round).map(x=>x.text),fronts:Object.entries(s.fronts).filter(([,f])=>f.status!=='locked').map(([id,f])=>({id,...(f.lastCrisisEvent?.round===s.round?{lastCrisisEvent:structuredClone(f.lastCrisisEvent)}:{}),...(f.stages?{stages:f.stages.map(({id,name,status,urgency,assessment,lastResolution})=>({id,name,status,urgency,assessment,lastResolution}))}:{}),before:before.fronts[id].urgency,after:f.urgency,status:f.status})),units:Object.entries(before.units).map(([id,u])=>{const after=s.units[id],arch=s.archive.findLast(a=>a.id===id&&a.closedRound===s.round);return {id,name:u.name||`第${id}队`,target:after?.target||u.pending?.target||u.target,task:TASKS[after?.task||u.pending?.action||u.task]||'营中待命',via:after?.via||u.pending?.via||u.via||'normal',previousState:u.state,wounded:casualties[id]?.wounded||0,dead:casualties[id]?.dead||0,eta:after?.eta||0,before:u.men,after:after?.men??arch?.men??0,state:after?.state??(arch?.reason==='失去战力'?'lost':'home'),status:after?.status??(arch?.reason==='失去战力'?'已无可战兵力':'已归营')};})};
 unlockRoutes(s,receipt);
}
export function settle(s){return completeSettlement(s,prepareSettlement(s));}
export function publicSession(s){s=structuredClone(s);derive(s);for(const f of (crisis(s)?[]:['sha','camp'])){const r=s.fronts[f],cfg=FRONTS[f];r.urgency=r.status!=='holding'?0:Math.max(1,Math.min(100,Math.round(cfg.urgency-r.progress/r.work*(cfg.urgency-9)+Math.max(0,s.round-5)*2)));}return {...s,...(modern(s)?{routeInfo:Object.fromEntries(Object.keys(s.fronts).filter(f=>f!=='fu'&&s.fronts[f].status!=='locked').map(f=>[f,{...routeAuthority(s,f),suggestions:routeGuidance(s,f)}]))}:{}),routeTurns:undefined,seed:undefined,requests:undefined,core:undefined,turns:undefined,archive:undefined,receipts:undefined,grade:s.ended?(s.endReason==='deadline'?'时限已至':eight(s)?'八路全部脱险':s.round<=12&&s.wounded+s.dead<=250?'从容接回':s.wounded+s.dead<=500?'力战接回':'艰难接回'):null};}
