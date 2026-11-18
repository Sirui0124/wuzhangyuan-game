// Runtime contract for new campaigns. Older saves retain their original route rules.
export const ROUTE_VERSION='three-front-20261118-v1';
export const EIGHT_ROUTE_VERSION='eight-front-20261118-v2';
export const EIGHT_CONFIG={
 sha:{name:'沙摩柯',openAt:1,work:.9,escort:300,cover:200,base:.75,location:'谷道',stages:[{id:'chief',name:'沙摩柯',work:.3},{id:'clans',name:'找到的部众',work:.6}]},
 camp:{name:'冯习 · 张南',openAt:1,work:2.4,escort:400,cover:300,base:.35,location:'旧营',stages:[{id:'front',name:'张南与前队',work:.9},{id:'rear',name:'冯习与后队伤兵',work:1.5}]},
 fu:{name:'傅肜',openAt:1,work:0,escort:300,cover:400,location:'后阵'},
 ma:{name:'马良',openAt:3,work:2.2,escort:400,cover:200,base:.78,minExecutions:3,location:'已核实的联络路线',stages:[{id:'messenger',name:'马良',work:1},{id:'party',name:'随行联络人员',work:1.2}]},
 cheng:{name:'程畿',openAt:3,work:1.85,escort:400,cover:250,base:.65,minExecutions:2,water:true,location:'上游船队',stages:[{id:'wounded',name:'同行伤员',work:.8*(1.85/1.7)},{id:'rear',name:'程畿与末船同行者',work:.9*(1.85/1.7)}]},
 du:{name:'杜路 · 刘宁',openAt:5,work:2.93,escort:500,cover:300,base:.6,minExecutions:2,location:'被围营地',stages:[{id:'party',name:'杜路、刘宁与部众',work:2.93}]},
 wang:{name:'王甫',openAt:5,work:.9,escort:300,cover:150,base:.6,location:'秭归方向退军',stages:[{id:'party',name:'王甫与同行伤员',work:.9}]},
 huang:{name:'黄权',openAt:5,work:2.93,escort:500,cover:300,base:.6,minExecutions:3,water:true,location:'江北接应渡口',stages:[{id:'first',name:'黄权部前批将士',work:1.465},{id:'rear',name:'黄权与末批掩护将士',work:1.465}]},
};
export function eight(s){return [EIGHT_ROUTE_VERSION,'eight-front-20261118-v1','eight-front-20261118-v3','eight-front-20261118-v4'].includes(s.routeVersion);}
const LEGACY_BASE={sha:.75,camp:.35,ma:.85,cheng:.8,du:.8,wang:.8,huang:.8};
export function routeTuning(s,id){const r=s.fronts[id];return {...EIGHT_CONFIG[id],...(r.tuning||{base:LEGACY_BASE[id]}),work:r.work};}
export function ensureBoats(s){
 if(!eight(s)||s.boats)return;
 s.boats=Object.fromEntries(['cheng','huang'].map(id=>{const u=Object.values(s.units).find(u=>u.target===id&&u.task==='rescue');const boat={id:id+'-fleet',name:id==='cheng'?'江上接应船队':'江北渡运船队',owner:id,unitId:u?.id||null,state:u?.state||'ready',capacityProgress:1.25};if(u){u.fleetId=boat.id;u.fleetOwner=id;}return [id,boat];}));
}
export function initEightRoutes(s){
 s.routeVersion=EIGHT_ROUTE_VERSION;s.routeTurns=[];
 s.boats=Object.fromEntries(['cheng','huang'].map(id=>[id,{id:id+'-fleet',name:id==='cheng'?'江上接应船队':'江北渡运船队',owner:id,unitId:null,state:'ready',capacityProgress:1.25}]));
 for(const [id,cfg] of Object.entries(EIGHT_CONFIG))s.fronts[id]={status:cfg.openAt===1?'holding':'locked',openAt:cfg.openAt,progress:0,work:cfg.work,tuning:{base:cfg.base??.35,escort:cfg.escort,cover:cfg.cover,minExecutions:cfg.minExecutions||1},scouted:false,urgency:id==='fu'?96:80,executions:0,planAccepted:false,planRevoked:false,searchVerified:false,located:false,notified:false,boatReady:false,passageReady:false,...(cfg.stages?{stages:cfg.stages.map(x=>({...x,progress:0,status:'holding'}))}:{})};
}
export function unlockRoutes(s,receipt){
 if(!eight(s)||s.ended)return;
 const intros={ma:'驿卒送来消息：马良和联络人员尚未归队，他愿带接应队沿旧路去找。',cheng:'船工回报：程畿的船队落在后头，正受追击，需要水上接应。',du:'散兵带来消息：杜路、刘宁所部被围，粮食将尽，仍有窄道可接应。',wang:'亲随在退军中认出了王甫一行的标记，可以带接应队前往辨认。',huang:'江北使者抵营：黄权所部归路阻隔，盼落实两岸接应，分批渡江。'};
 for(const [id,r] of Object.entries(s.fronts))if(r.status==='locked'&&r.openAt<=s.round+1){r.status='holding';r.openedRound=s.round+1;receipt(s,intros[id],id);}
}
export function arriveRoute(s,id,task,receipt,unit){
 if(!eight(s)||!['rescue','scout'].includes(task))return;
 const r=s.fronts[id];
 if(id==='sha'&&!r.searchVerified){r.searchVerified=true;r.scouted=true;receipt(s,'接应人员在谷道核实了会合处，通知沙摩柯，并找到一批失散部众；其余失散者仍无确报。',id,unit);}
 if(['ma','wang'].includes(id)&&!r.located){r.located=true;r.notified=true;r.scouted=true;receipt(s,id==='ma'?'驿卒带队找到马良一行，撤军消息已送达，联络人员开始随接应队撤离。':'亲随辨认出王甫一行，接应队核实了退路，正接同行伤员撤回。',id,unit);}
 if(EIGHT_CONFIG[id]?.water&&task==='rescue'&&!r.boatReady){r.boatReady=true;receipt(s,id==='cheng'?'船工引导接应船与程畿船队会合，开始转移同行伤员。':'接应船抵达渡口，两岸联络和南岸接收已落实，开始分批渡运。',id,unit);}
 if(id==='du'&&task==='rescue'&&!r.passageReady){r.passageReady=true;r.notified=true;receipt(s,'接应队守住窄道出口，送达大营的真实接应消息，引导杜路、刘宁所部突围。',id,unit);}
}
export const ROUTE_CONFIG={
 sha:{work:1.8,stages:[{id:'chief',name:'沙摩柯',work:.6},{id:'clans',name:'找到的部众',work:1.2}],location:'失散后的谷道，部众去向尚未核实'},
 camp:{work:2.4,stages:[{id:'front',name:'张南与前队',work:.9},{id:'rear',name:'冯习与后队伤兵',work:1.5}],location:'旧营'},
};
export function initRoutes(s){
 s.routeVersion=ROUTE_VERSION;s.routeTurns=[];
 for(const [id,cfg] of Object.entries(ROUTE_CONFIG))Object.assign(s.fronts[id],{work:cfg.work,stages:cfg.stages.map(x=>({...x,progress:0,status:'holding'})),planAccepted:false,planRevoked:false});
 s.fronts.sha.searchVerified=false;
}
export function modern(s){return s.routeVersion===ROUTE_VERSION||eight(s);}
export function returnStages(s,receipt){
 if(!modern(s))return;
 for(const [id,r] of Object.entries(s.fronts))for(const stage of r.stages||[])if(stage.status==='safe'&&stage.safeRound<s.round){stage.status='home';stage.homeRound=s.round;receipt(s,stage.name+'已抵达接应营。',id);}
}
export function advanceStages(s,id,speed,escort,cover,receipt){
 const r=s.fronts[id];
 if(eight(s)&&escort>0){r.executions=(r.executions||0)+1;const min=routeTuning(s,id).minExecutions||1;if(r.executions<min)speed=Math.min(speed,Math.max(0,r.work-r.progress-.01));}
 if(id==='sha'&&!r.searchVerified){if(escort>0)receipt(s,'接应队已与沙摩柯联络，失散部众去向仍未核实，尚未形成撤出回报。',id);return;}
 let budget=speed,remainingCap=1.25;
 for(const stage of r.stages){
  if(stage.status!=='holding')continue;
  const bonus=id==='camp'&&stage.id==='rear'&&r.planAccepted&&escort>0&&cover>=150?1.15:1;
  const gain=Math.min(stage.work-stage.progress,budget*bonus,remainingCap);
  stage.progress+=gain;remainingCap-=gain;budget=Math.max(0,budget-gain/bonus);
  if(stage.progress>=stage.work-1e-8){stage.progress=stage.work;stage.status='safe';stage.safeRound=s.round;receipt(s,stage.name+'已撤出，正在返回接应营。',id);}
  else if(gain>0)receipt(s,stage.name+'的接应仍在进行，尚未收到撤出回报。',id);
  if(budget<=0||remainingCap<=0)break;
 }
 r.progress=r.stages.reduce((n,x)=>n+x.progress,0);
 if(r.stages.every(x=>x.status!=='holding')){r.status='safe';r.safeRound=s.round;r.urgency=0;receipt(s,(EIGHT_CONFIG[id]?.name||id)+'一路接应已完成，最后一批正返回接应营。',id);}
}
export function routeAuthority(s,front){
 if(eight(s)&&!['sha','camp'].includes(front)){
 const r=s.fronts[front],cfg=EIGHT_CONFIG[front],names=front==='du'?['杜路','刘宁']:front==='ma'&&!r.located?['驿卒']:front==='wang'&&!r.located?['失散亲随']:[cfg.name];
 const personStage=front==='ma'?r.stages[0]:r.stages.at(-1),speakerStates=Object.fromEntries(names.map(name=>[name,{status:personStage.status,location:personStage.status==='home'?'接应营':personStage.status==='safe'?'回营途中':!r.located&&['ma','wang'].includes(front)?'营中报信处':cfg.location}]));
 return {front,status:r.status,location:personStage.status==='home'?'接应营':personStage.status==='safe'?'回营途中':!r.located&&['ma','wang'].includes(front)?(front==='ma'?'沿联络路线寻找，位置未核实':'往秭归撤退的队伍中，位置未核实'):cfg.location,speakerStates,knowledge:Object.fromEntries(['located','notified','boatReady','passageReady'].map(k=>[k,!!r[k]])),searchVerified:null,planAccepted:!!r.planAccepted,stages:r.stages.map(({id,name,status})=>({id,name,status})),aid:Object.values(s.units).filter(u=>u.target===front).map(({id,name,men,state,task,transport})=>({id,name,men,state,task,transport})),reports:s.receipts.filter(e=>e.front===front).slice(-8).map(({id,text})=>({id,text})),round:s.round};
 }
 const r=s.fronts[front],speakerStates=Object.fromEntries((r.stages||[]).filter(x=>front==='camp'||x.id==='chief').map(x=>[x.id==='chief'?'沙摩柯':x.id==='front'?'张南':'冯习',{status:x.status,location:x.status==='home'?'接应营':x.status==='safe'?'回营途中':front==='sha'?'谷道':'旧营'}]));
 return {speakerStates,front,status:r.status,location:front==='sha'?(speakerStates['沙摩柯']?.status==='home'?'接应营':speakerStates['沙摩柯']?.status==='safe'?'回营途中':r.searchVerified?'已核实的谷道会合处':'谷道，部众去向尚未核实'):(r.status==='home'?'接应营':r.status==='safe'?'回营途中':'旧营'),searchVerified:front==='sha'?!!r.searchVerified:null,planAccepted:!!r.planAccepted,stages:r.stages?.map(({id,name,status})=>({id,name,status}))||[],aid:Object.values(s.units).filter(u=>u.target===front).map(({id,name,men,state,task})=>({id,name,men,state,task})),reports:s.receipts.filter(e=>e.front===front).slice(-8).map(({id,text})=>({id,text})),round:s.round};
}
export function routeGuidance(s,front){
 const r=s.fronts[front];if(!r||r.status==='locked')return [];
 const stage=id=>r.stages?.find(x=>x.id===id),holding=id=>stage(id)?.status==='holding';
 if(r.status==='home')return front==='sha'?['找到的人都安顿好了吗？','其余失散的人有消息了吗？']:front==='camp'?['冯习，伤员安置好了吗？','张南，前队的人都安顿好了吗？']:['同行的人都安顿好了吗？'];
 if(r.status==='safe')return ['路上还顺利吗？','同行的人还有什么需要照应的？'];
 if(front==='sha'){
  if(!r.searchVerified)return ['营口那小卒指的是哪边？',eight(s)?'我叫人沿路去找。你先等等，别一个人往前追。':'先别独自追了，等探路的人核实消息，好吗？'];
  if(!holding('chief'))return ['找到的部众还有哪些人没撤出来？','其余失散的人有消息了吗？'];
  return r.planAccepted?['找着的族人里，有人受伤吗？','眼下撤出来还有什么困难？']:['找着的族人里，有人受伤吗？','别再独自追了，和找到的人相互照应，等接应一起撤，好吗？'];
 }
 if(front==='camp')return holding('front')?(r.planAccepted?['张南，前队现在怎样？','冯将军，后头的伤兵能走吗？']:['张南，前队现在怎样？','后队另派人护送，掩护留在营口接替断后。两位能照此交接吗？']):['冯将军，后头的伤兵能走吗？','冯习，留守营口的人现在怎样？'];
 if(front==='ma')return !r.located?['最后在哪里见过马良？','路上遇见他们，你认得出来吗？']:!holding('messenger')?['马良，同行的人还有谁没撤出来？','留下的人眼下有什么困难？']:['马良，同行的人现在怎样？','撤军的消息送到后，眼下还有什么困难？'];
 if(front==='wang')return !r.located?['怎样辨认王甫的队伍？','你最后在哪儿见过他们的记号？']:['王甫，同行伤员现在怎样？','眼下撤出来还有什么困难？'];
 if(front==='cheng')return r.boatReady?['程畿，伤员转移得怎样了？','最后留在船上的人还缺什么接应？']:['船上的伤员现在怎样？','接应船怎样靠过去？'];
 if(front==='du')return r.passageReady?['出口已经接通，伤员撤出还有什么困难？','留下的人现在怎样？']:['营里现在还能撑住吗？','从哪边接应，才好带伤员一起突围？'];
 if(front==='huang')return !holding('first')?['黄权，最后一批人还有什么困难？','江北留下的人怎样相互照应？']:r.boatReady?['黄将军，对岸有回信了吗？','最后一批人过江还缺什么？']:['两岸接应还缺什么？','最后一批人怎样过江？'];
 return [];
}
