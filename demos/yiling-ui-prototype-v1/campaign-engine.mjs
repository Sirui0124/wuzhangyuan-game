import {randomUUID} from 'node:crypto';
import {createState,resolveRound,evaluate} from '../../docs/design/chapter-four-ai-library-20261117/furong-rescue.ts';
import {design} from './fu-ai.mjs';

export const VERSION='starter-500-reserve-2000-v2';
export const FRONTS={sha:{name:'沙摩柯',urgency:84,escort:400,cover:200,work:3},camp:{name:'冯习 · 张南',urgency:88,escort:400,cover:300,work:3.6},fu:{name:'傅肜',urgency:96,escort:300,cover:400,work:0}};
export const TASKS={rescue:'接应护送',relieve:'接替断后',suppress:'压制追兵',scout:'探查撤路',verify:'核实刘备消息',signal:'传撤离信号',retreat:'撤回接应营',hold:'原地待命',rest:'原地休整'};
export const DIFFICULTY={easy:{name:'从容',loss:.7,pressure:1},normal:{name:'标准',loss:1,pressure:2},hard:{name:'险局',loss:1.35,pressure:3}};
export function fail(text,status=400){throw Object.assign(Error(text),{status});}
export function message(s,speaker,text,kind='report',front=null,unit=null){const id=String(++s.seq);s.messages.push({id,speaker,text,kind,front,unit,round:s.round});return id;}
function receipt(s,text,front=null,unit=null){const id=s.scenarioId+'/event-'+(++s.eventSeq);s.receipts.push({id,round:s.round,text});message(s,'军侯',text,'report',front,unit);return id;}
export function fresh({seed=1,difficulty='normal'}={}){
 if(!Object.hasOwn(DIFFICULTY,difficulty))fail('难度不正确。');
 const scenarioId=randomUUID();
 const s={schemaVersion:2,balanceVersion:VERSION,scenarioId,revision:0,round:0,difficulty,seed:seed>>>0||1,phase:'deceived_and_bereaved',core:createState(design,scenarioId,seed>>>0||1),facts:Object.fromEntries(Object.keys(design.factDefinitions).map(k=>[k,false])),total:2500,reserve:2000,wounded:0,dead:0,units:{'1':{id:'1',name:'甲队',starter:true,men:500,initial:500,deployed:0,state:'ready',at:'camp',target:null,task:null,status:'营中待命',eta:0}},archive:[],nextUnit:2,fronts:Object.fromEntries(Object.entries(FRONTS).map(([id,f])=>[id,{status:'holding',progress:0,work:f.work,scouted:false,urgency:f.urgency}])),messages:[],receipts:[],turns:[],requests:{},seq:0,eventSeq:0,nextSendAt:0,ended:false};
 message(s,'沙摩柯','东沟的人还能走，西沟还有伤兵。先接东沟，再到西沟接担架，别把人落下。','dialogue','sha');
 message(s,'冯习 · 张南','张南的前队还未撤齐，后面还有伤兵。接应的人护送前队，我带后队跟上。','dialogue','camp');
 message(s,'傅肜','吴人说陛下已经遇害。跟着我的人也都死在这里了……我不走，叫他们再来。','dialogue','fu');
 receipt(s,'甲队500人在营中待命，另有预备兵2000人。新编以100人为单位，同时最多5支队伍。');
 return s;
}
export function assertLedger(s){
 const active=Object.values(s.units);const total=s.reserve+s.wounded+s.dead+active.reduce((n,u)=>n+u.men,0);
 if(total!==(s.total??2000)||active.length>5||[s.reserve,s.wounded,s.dead,...active.map(u=>u.men)].some(n=>!Number.isInteger(n)||n<0))throw Error('兵力账目不守恒');
}
function random(s){let x=s.seed;x^=x<<13;x^=x>>>17;x^=x<<5;s.seed=x>>>0;return s.seed/4294967296;}
function withdraw(s,u,reason){u.state='returning';u.eta=1;u.at='cross';u.status=reason+' · 归途中';}
function unitName(s,id){return s.units[id]?.name||`第${id}队`;}
function archive(s,id,reason){const u=s.units[id];s.archive.push({...u,closedRound:s.round,reason});
 if(u.starter){const target=u.target;delete u.pending;Object.assign(u,{state:'ready',at:'camp',target:null,task:null,eta:0,deployed:0,status:'营中待命'});receipt(s,`${u.name}${reason}，现有${u.men}人在营中待命。`,target,id);}
 else{s.reserve+=u.men;delete s.units[id];receipt(s,`第${id}队${reason}，${u.men}人归入预备兵。`,u.target,id);}}

export function orders(s,items){
 if(s.ended)fail('本次营救已结算，请新开一局。');
 if(!Array.isArray(items)||!items.length||items.length>5)fail('一批可安排1至5支队伍。');
 // Validate on a copy: a bad last clause cannot reserve the first clause's soldiers.
 const draft=structuredClone(s),seen=new Set();
 for(const o of items){
  if(!o||!Object.hasOwn(TASKS,o.action)||!['sha','camp','fu',null].includes(o.target))fail('任务或接应对象不明确。');
  if(typeof o.rush!=='boolean'||!['normal','side'].includes(o.via))fail('行军或路线不正确。');
  const existing=o.unit!=='new';let u;
  if(existing){
   if(typeof o.unit!=='string'||!Object.hasOwn(draft.units,o.unit)||seen.has(o.unit))fail('该队不存在，或同一批被重复安排。');
   seen.add(o.unit);u=draft.units[o.unit];
   if(u.state==='returning')fail(`第${o.unit}队正在归营，请等其返回。`);
   if(o.men!==undefined&&o.men!==u.men)fail('已派出的队伍按现有实兵调度，不能隔空补员或拆队。');
  }else{
   if(['retreat','hold','rest'].includes(o.action))fail('待命兵力无需新编队休整或撤回。');
   if(!Number.isInteger(o.men)||o.men<100||o.men%100||o.men>draft.reserve)fail(`新编人数须是100的整数倍；当前可调${draft.reserve}人。`);
   if(Object.keys(draft.units).length>=5)fail('最多同时5支任务队，待出发与归途中也占名额。');
   const id=String(draft.nextUnit++);u={id,men:o.men,initial:o.men,deployed:o.men,state:'queued',at:'camp',target:o.target,task:o.action,status:'待出发',eta:0};draft.units[id]=u;draft.reserve-=o.men;
  }
  if(['rescue','relieve','suppress','scout'].includes(o.action)&&!o.target)fail('请写明接应哪一路。');
  if(['verify','signal'].includes(o.action)&&o.target!=='fu')fail('核实刘备与撤离信号用于傅肜一路。');
  if(o.action==='signal'&&!draft.facts.withdrawalAccepted)fail('傅肜尚未接受撤离，先与他把回去的打算说清楚。');
  if(o.target&&draft.fronts[o.target].status!=='holding'&&!['retreat','rest','hold'].includes(o.action))fail('这一路已经撤离，无需继续派队。');
  if(o.action==='retreat'&&u.state==='queued'){archive(draft,u.id,'取消待发军令');continue;}
  if(u.state==='ready'&&['retreat','rest','hold'].includes(o.action)){receipt(draft,`${u.name}在营中待命。`,null,u.id);continue;}
  if(u.state==='ready')u.state='queued';
  u.pending={...o,unit:u.id,men:u.men};u.status=u.state==='queued'?'待出发':'新令待执行';
  message(draft,'我',`${unitName(draft,u.id)} · ${u.men}人 · ${TASKS[o.action]}${o.target?' → '+FRONTS[o.target].name:''}${o.rush?' · 急行军':''}${o.via==='side'?' · 南侧路':''}`,'order',o.target,u.id);
 }
 assertLedger(draft);Object.assign(s,draft);
}
function strength(s,front,task){return Object.values(s.units).filter(u=>u.state==='active'&&u.target===front&&u.task===task).reduce((n,u)=>n+u.men,0);}
function weightedDesign(s){const ratios={cover:Math.min(1,strength(s,'fu','relieve')/400),escort:Math.min(1,strength(s,'fu','rescue')/300),enemy:Math.min(1,strength(s,'fu','suppress')/400)};return {...design,branches:design.branches.map(b=>({...b,reduction:Math.round(b.reduction*(ratios[b.group]??1))}))};}
export function derive(s){
 s.facts.reliefInPosition=strength(s,'fu','relieve')>0;s.facts.escortReady=strength(s,'fu','rescue')>0;s.facts.enemySuppressed=strength(s,'fu','suppress')>0;
 if(s.fronts.fu.status==='home')s.phase='home';else if(s.core.status==='safe')s.phase='safe';else s.phase=s.facts.withdrawalAccepted?'withdrawal_accepted':s.facts.liubeiAliveVerified?'truth_verified':'deceived_and_bereaved';
 s.fronts.fu.urgency=s.core.status==='safe'?0:Math.round(evaluate(weightedDesign(s),s.facts,s.core.pressure).crisis/99*FRONTS.fu.urgency);
}
export function settle(s){
 if(s.ended)fail('本次营救已经结束。');
 s.round++;
 for(const [f,route] of Object.entries(s.fronts))if(route.status==='safe'){route.status='home';receipt(s,FRONTS[f].name+'已回到接应营。',f);}
 for(const [id,u] of Object.entries(s.units)){
  if(u.state==='returning'){archive(s,id,'回营');continue;}
  if(u.pending){const o=u.pending;delete u.pending;
   if(o.action==='retreat'){withdraw(s,u,'撤回');continue;}
   const samePlace=u.state==='active'&&u.target===o.target;
   u.task=o.action;u.target=o.target||u.target;u.rush=o.rush;u.via=o.via;
   if(['hold','rest'].includes(o.action)){u.state='active';u.eta=0;u.status=TASKS[o.action];continue;}
   u.state='marching';u.eta=samePlace?1:['scout','verify','signal'].includes(o.action)?1:o.rush?1:2;u.at='cross';
  }
  if(u.state==='marching'){
   u.eta--;u.status=`行军 · ${Math.max(0,u.eta)}轮后到位`;if(u.eta>0)continue;
   u.state='active';u.at=u.target==='fu'?'rear':u.target==='sha'?'east':'campfire';u.status=TASKS[u.task]+'中';
   receipt(s,`${unitName(s,id)}已到位，${u.men}人${TASKS[u.task]}。`,u.target,id);
   if(u.task==='scout'){s.fronts[u.target].scouted=true;if(u.target==='fu'){s.facts.routeScouted=true;if(u.via==='side')s.facts.alternateRouteOpen=true;}receipt(s,'撤路已探明'+(u.via==='side'?'，南侧替代路线可通行':'')+'。',u.target,id);withdraw(s,u,'侦察完成');}
   if(u.task==='verify'){s.facts.liubeiAliveVerified=true;receipt(s,'传令兵与刘备随行队取得联系，确认陛下仍在；反证已送达傅肜。','fu',id);withdraw(s,u,'核实完成');u.verifyReturn=true;}
   if(u.task==='signal'){s.facts.withdrawalSignalDelivered=true;receipt(s,'共同撤离信号已送达。','fu',id);withdraw(s,u,'传信完成');}
  }
 }
 // The second receipt is only available once the verifying unit has actually returned.
 if(s.archive.some(u=>u.verifyReturn)&&!s.facts.liubeiSafeConfirmed){s.facts.liubeiSafeConfirmed=true;receipt(s,'核实队回营复报：刘备已脱离当下追击，消息已送达傅肜。','fu');}
 for(const f of ['sha','camp']){
  const route=s.fronts[f],cfg=FRONTS[f];if(route.status!=='holding')continue;
  const escort=strength(s,f,'rescue'),cover=strength(s,f,'relieve')+strength(s,f,'suppress')*.7;
  const speed=Math.min(1.25,escort/cfg.escort)*(.35+.65*Math.min(1,cover/cfg.cover))*(route.scouted?1:.85);
  route.progress+=speed;route.urgency=Math.max(1,Math.min(100,Math.round(cfg.urgency-route.progress/route.work*(cfg.urgency-9)+Math.max(0,s.round-5)*2)));
  if(speed>0)receipt(s,f==='sha'?(route.progress<route.work/2?'东沟的人正在撤出。':'东沟已接上，正把西沟担架接出来。'):(route.progress<route.work/2?'张南前队正在撤出。':'前队已接上，正收冯习的后队伤兵。'),f);
  if(route.progress>=route.work){route.status='safe';route.urgency=0;receipt(s,FRONTS[f].name+'一路已接齐，正在护送归营。',f);}
 }
 derive(s);
 if(s.core.status!=='safe'){
  const adjusted=weightedDesign(s);const before=s.core.pressure;
  const r=resolveRound(adjusted,s.core,{scenarioId:s.scenarioId,round:s.round,expectedRevision:s.core.revision,trigger:'endRound',commandBatchIds:[],receiptIds:s.receipts.filter(x=>x.round===s.round).map(x=>x.id),facts:s.facts,contact:true});
  s.core=r.state;if(r.resolution.outcome==='safe'){s.fronts.fu.status='safe';s.fronts.fu.urgency=0;receipt(s,'傅肜已经脱离后阵险境，正在返回接应营。','fu');}
  else{s.core.pressure=Math.min(20,before+DIFFICULTY[s.difficulty].pressure);}
 }
 for(const [id,u] of Object.entries(s.units)){
  if(u.state!=='active'||!['rescue','relieve','suppress','hold','rest'].includes(u.task))continue;
  if(s.fronts[u.target].status!=='holding'){withdraw(s,u,'护送完成');continue;}
  const cfg=FRONTS[u.target],cover=strength(s,u.target,'relieve')+strength(s,u.target,'suppress')*.7;
  const hazard=(['relieve','suppress'].includes(u.task)?.04:.024)+Math.min(.03,.003*Math.max(0,s.round-8));
  const p=Math.min(.12,hazard*DIFFICULTY[s.difficulty].loss*(s.fronts[u.target].scouted?1:1.3)*(1.4-.7*Math.min(1,cover/(cfg.cover*1.5)))*(u.rush?1.15:1));
  let loss=0,dead=0;for(let i=0;i<u.men;i++)if(random(s)<p){loss++;if(random(s)<.3)dead++;}
  u.men-=loss;u.deployed=u.men;s.wounded+=loss-dead;s.dead+=dead;
  if(loss)receipt(s,`${unitName(s,id)}本轮伤${loss-dead}、亡${dead}，现有${u.men}人。`,u.target,id);
  if(u.men===0){s.archive.push({...u,closedRound:s.round,reason:'失去战力'});delete s.units[id];}
  else if(u.men<Math.max(50,u.initial*.35)){withdraw(s,u,'战力不足，自动撤回');receipt(s,`${unitName(s,id)}损耗过重，正撤回接应营。`,u.target,id);}
 }
 derive(s);assertLedger(s);
 s.ended=Object.values(s.fronts).every(f=>f.status==='home')&&!Object.values(s.units).some(u=>u.state!=='ready');
 if(s.ended)receipt(s,`三路归营。历时${s.round}轮，接应兵力存活${(s.total??2000)-s.dead}人，其中伤${s.wounded}人、阵亡${s.dead}人。`);
}
export function publicSession(s){s=structuredClone(s);derive(s);for(const f of ['sha','camp']){const r=s.fronts[f],cfg=FRONTS[f];r.urgency=r.status!=='holding'?0:Math.max(1,Math.min(100,Math.round(cfg.urgency-r.progress/r.work*(cfg.urgency-9)+Math.max(0,s.round-5)*2)));}return {...s,seed:undefined,requests:undefined,core:undefined,turns:undefined,archive:undefined,receipts:undefined,grade:s.ended?(s.round<=12&&s.wounded+s.dead<=250?'从容接回':s.wounded+s.dead<=500?'力战接回':'艰难接回'):null};}
