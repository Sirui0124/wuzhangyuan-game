import {FRONTS,ROUTES,type Route,type Action} from './turn-story.js';
export {FRONTS,ROUTES};
export type {Route,Action};
export type Status='active'|'returning'|'saved'|'lost';
export interface Front {stage:number;crisis:number;men:number;action:Action;status:Status;coordinated:boolean;supplyTurn:number;report:string;completed:number[];remaining:number[];}
export interface Order {route:Route;troops:number;action:Action;coordinate:boolean;supply:boolean;objective?:'current'|'flag'|'clear';}
export interface Receipt {turn:number;route:Route;before:number;after:number;risk:number;loss:number;resolved:boolean;text:string;}
export interface State {version:3;introSeen:Route[];turn:number;revision:number;camp:number;supplies:number;returning:number;losses:number;seed:number;ended:boolean;fronts:Record<Route,Front>;saved:string[];receipts:Receipt[];ids:string[];conversation:{route:Route;who:string;text:string}[];}
export const clamp=(n:number)=>Math.max(0,Math.min(100,n));
export function fresh(seed=0x731a):State {return {version:3,introSeen:[],turn:1,revision:0,camp:2500,supplies:8,returning:0,losses:0,seed:seed>>>0,ended:false,fronts:Object.fromEntries(ROUTES.map((id):[Route,Front]=>[id,{stage:0,crisis:FRONTS[id].stages[0].crisis,men:0,action:'rescue',status:'active',coordinated:false,supplyTurn:0,report:FRONTS[id].stages[0].brief,completed:[],remaining:FRONTS[id].stages.map(e=>e.crisis)}])) as Record<Route,Front>,saved:[],receipts:[],ids:[],conversation:[]};}
export const scene=(s:State,id:Route)=>FRONTS[id].stages[s.fronts[id].stage];
export function efficiency(s:State,id:Route,action:Action='rescue') {const r=scene(s,id).rate;return r*(action==='hold'?.45:action==='attack'?(id==='fu'&&s.fronts[id].stage===0?1.1:.35):1);}
export function demand(s:State,id:Route){const f=s.fronts[id];return f.status==='active'?Math.ceil((f.crisis/efficiency(s,id,f.action)-1e-9))*100:0;}
export function risk(s:State,id:Route){const f=s.fronts[id];return f.status==='active'?Math.max(0,Math.ceil(clamp(f.crisis-f.men/100*efficiency(s,id,f.action))-1e-9)):0;}
export function validateOrders(raw:unknown):Order[]{
 if(!Array.isArray(raw)||!raw.length||raw.length>3)throw Error('请写明要调哪一路、多少人。');
 const routes=new Set();return raw.map(o=>{if(!o||!ROUTES.includes(o.route)||routes.has(o.route)||!Number.isInteger(o.troops)||o.troops<0||o.troops>2500||!['rescue','hold','attack'].includes(o.action)||typeof o.coordinate!=='boolean'||typeof o.supply!=='boolean'||(o.objective!==undefined&&!['current','flag','clear'].includes(o.objective)))throw Error('军令人数或分工不完整；每路只保留一项安排。');routes.add(o.route);return {route:o.route,troops:o.troops,action:o.action,coordinate:o.coordinate,supply:o.supply,objective:o.objective||'current'};});
}
function apply(s:State,orders:Order[]){
 if(s.ended)throw Error('本局已经结算。');
 let need=0,cost=0;for(const o of orders){const f=s.fronts[o.route];if(f.status!=='active')throw Error('这一路已经结束接应，不能再派兵。');need+=Math.max(0,o.troops-f.men);cost+=Math.ceil(Math.max(0,o.troops-f.men)/500)+Number(o.supply);
  if((o.coordinate||o.supply)&&o.troops===0)throw Error('需要现场有人接应，才能安排配合或补给。');
  if(o.coordinate&&f.coordinated)throw Error('本路原部已经接过一程，不能重复调用。');
  if(o.supply&&f.supplyTurn===s.turn)throw Error('这一路本回合已经送过军需。');}
 if(need>s.camp)throw Error(`待命只有${s.camp}人；撤下的人要到本回合结束才归营。`);
 if(cost>s.supplies)throw Error(`此令需${cost}份军需，目前只有${s.supplies}份。`);
 s.camp-=need;s.supplies-=cost;
 for(const o of orders){const f=s.fronts[o.route];
  if(o.objective&&o.objective!=='current'){if(o.route!=='feng')throw Error('迁旗和清侧路只属于双将这一处。');const stage=o.objective==='flag'?0:1;if(f.completed.includes(stage))throw Error('这件事已经办完，不必重复调兵。');if(f.stage!==stage){f.remaining[f.stage]=f.crisis;f.stage=stage;f.crisis=f.remaining[stage];f.report=scene(s,o.route).brief;}}
  s.returning+=Math.max(0,f.men-o.troops);f.men=o.troops;f.action=o.action;
  if(o.coordinate){f.crisis=clamp(f.crisis-({fu:18,feng:23,sha:20}[o.route]));f.coordinated=true;}
  if(o.supply){f.crisis=clamp(f.crisis-FRONTS[o.route].supply);f.supplyTurn=s.turn;}
 }
 return cost;
}
export function preview(s:State,raw:unknown){const orders=validateOrders(raw),copy=structuredClone(s),cost=apply(copy,orders);return {state:copy,cost,orders};}
export function commit(s:State,raw:unknown,key:string,revision:number){if(s.ids.includes(key))return false;if(revision!==s.revision)throw Error('战局已变，请按当前军情重新拟令。');const p=preview(s,raw);Object.assign(s,p.state);s.ids.push(key);s.revision++;return true;}
function random(s:State){s.seed=(Math.imul(1664525,s.seed)+1013904223)>>>0;return s.seed/4294967296;}
function savePeople(s:State,id:Route){for(const name of id==='fu'?['傅肜']:id==='feng'?['冯习','张南']:['沙摩柯'])if(!s.saved.includes(name))s.saved.push(name);}
export function endTurn(s:State,key='turn-'+s.turn){
 if(s.ids.includes(key)||s.ended)return false;s.ids.push(key);
 // Return movements were already committed; their troops cannot work on another front this round.
 s.camp+=s.returning;s.returning=0;
 for(const id of ROUTES){const f=s.fronts[id];if(f.status==='returning'){s.camp+=f.men;f.men=0;f.status='saved';f.report='接应兵已经归营，可重新调遣。';continue;}if(f.status!=='active')continue;
  const e=scene(s,id),before=f.crisis,hadMen=f.men>0,p=risk(s,id);const roll=random(s);const struck=p>0&&roll<p/100;
  // The other unfinished preparation in the old camp continues to deteriorate.
  if(id==='feng'&&f.stage<2)for(const other of [0,1])if(other!==f.stage&&!f.completed.includes(other))f.remaining[other]=clamp(f.remaining[other]+FRONTS.feng.stages[other].growth);
  const loss=struck?Math.min(50,f.men):0;f.men-=loss;s.losses+=loss;
  // Partial manpower always contributes. A failed roll never erases the reduction already achieved.
  const resolved=p===0&&f.men>0&&f.action!=='hold';
  if(resolved){f.report=e.success;f.completed.push(f.stage);f.remaining[f.stage]=0;if(id==='sha'&&f.stage===1)savePeople(s,id);
   if(f.stage===2){savePeople(s,id);f.status='returning';f.crisis=0;}
   else {if(id==='feng'){if(f.completed.includes(0)&&f.completed.includes(1)){f.stage=2;f.report='军旗已移到坡上，侧路也清开了。冯习正在收兵，张南带着前部赶来，两边还须合队撤离。';}else{f.stage=f.completed.includes(0)?1:0;if(f.completed.includes(1))f.report='侧路已清，张南暂守出口等候。冯习的军旗还在旧营，需把散兵引向坡上。';}}else f.stage++;f.crisis=f.remaining[f.stage];f.action='rescue';}
  } else {f.crisis=clamp(p+e.growth);f.report=hadMen&&struck?e.setback:f.men>0?`接应兵已压低眼前危机，${e.title}还未办完。下一轮可以继续，也可增援或调回部分人。`:'接应兵尚未到位，原部还在支撑。';}
  if(f.status==='active'&&s.turn>=FRONTS[id].deadline){f.status='lost';f.report=id==='sha'&&s.saved.includes('沙摩柯')?'沙摩柯已脱险，但最后一批人未能接出。接应队撤回，失散人员去向未明。':'救援窗口已关闭，尚未接出的人员失联。接应队撤回，不能据此断言失联者全部战死。';s.returning+=f.men;f.men=0;}
  s.receipts.push({turn:s.turn,route:id,before,after:f.crisis,risk:p,loss,resolved,text:f.report});
 }
 s.turn++;s.revision++;
 if(ROUTES.every(id=>['saved','lost'].includes(s.fronts[id].status))&&s.returning===0)s.ended=true;
 return true;
}
export function restore(text:string):State|null {try{const s=JSON.parse(text);if(s.version!==3||!Number.isInteger(s.turn)||s.turn<1||s.turn>10||!Number.isInteger(s.seed)||s.seed<0||s.seed>4294967295||!Number.isInteger(s.revision)||s.revision<0||typeof s.ended!=='boolean')return null;
 for(const k of ['camp','supplies','returning','losses'])if(!Number.isInteger(s[k])||s[k]<0||s[k]>(k==='supplies'?8:2500))return null;
 if(!Array.isArray(s.saved)||s.saved.some((n:unknown)=>!['傅肜','冯习','张南','沙摩柯'].includes(n as string))||!Array.isArray(s.ids)||!Array.isArray(s.receipts)||!Array.isArray(s.conversation))return null;
 if(s.introSeen===undefined)s.introSeen=[];if(!Array.isArray(s.introSeen)||s.introSeen.some((id:unknown)=>!ROUTES.includes(id as Route)))return null;let total=s.camp+s.returning+s.losses;for(const id of ROUTES){const f=s.fronts?.[id];if(!f||!Array.isArray(f.completed)||f.completed.some((n:unknown)=>!Number.isInteger(n)||Number(n)<0||Number(n)>2)||!Array.isArray(f.remaining)||f.remaining.length!==3||f.remaining.some((n:unknown)=>typeof n!=='number'||!Number.isFinite(n)||n<0||n>100)||!Number.isInteger(f.stage)||f.stage<0||f.stage>2||!Number.isFinite(f.crisis)||f.crisis<0||f.crisis>100||!Number.isInteger(f.men)||f.men<0||f.men>2500||!['active','returning','saved','lost'].includes(f.status)||!['rescue','hold','attack'].includes(f.action)||typeof f.coordinated!=='boolean'||!Number.isInteger(f.supplyTurn)||typeof f.report!=='string')return null;total+=f.men;}if(total!==2500)return null;return s;
 }catch{return null;}}
