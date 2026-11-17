import {deploy,recall,sendBoat,DATA,IDS,report,type State,type RouteId,type Task,type Approach} from './engine.js';
export interface Operation {kind:'deploy'|'recall'|'boat'|'tactic'|'supply';units:number[];route:RouteId;task:Task;approach:Approach;autoRetreat:boolean;duration:number;after:number|null;waitFor:RouteId|null}
export interface Draft {id:string;revision:number;time:number;reply:string;operations:Operation[];unsupported:string[];source:'ai'|'manual';intent:string}
export interface MilitaryTask {id:string;planId:string;operation:Operation;dependsOn:string|null;status:'waiting'|'moving'|'running'|'blocked'|'completed'|'cancelled';created:number;started:number|null;engagedAt:number|null;reason:string}
export const LABELS={waiting:'待执行',moving:'行军中',running:'执行中',blocked:'受阻',completed:'完成',cancelled:'已撤销'};
export function operationLabel(o:Operation){const names=o.units.map(i=>'甲乙丙丁戊'[i]+'队').join('、');const tasks={rescue:'接应',hold:'坚守',feint:'牵制'};return o.kind==='deploy'?`${names}赴${DATA[o.route].name}处${tasks[o.task]}${o.duration?` ${o.duration}秒`:''}`:o.kind==='recall'?`${names}撤回接应营`:o.kind==='boat'?'船队赴北岸接人':o.kind==='supply'?`向${DATA[o.route].name}处补送军需`:`${DATA[o.route].name}：${DATA[o.route].tactic}`;}
export function validateOperations(value:unknown):Operation[]{
 if(!Array.isArray(value)||value.length<1||value.length>10)throw Error('一份军令需要1至10项安排。');
 return value.map((x,i)=>{if(!x||!['deploy','recall','boat','tactic','supply'].includes(x.kind)||!IDS.includes(x.route)||!Array.isArray(x.units)||x.units.some((n:unknown)=>!Number.isInteger(n)||Number(n)<0||Number(n)>4)||new Set(x.units).size!==x.units.length||!['rescue','hold','feint'].includes(x.task)||!['direct','safe'].includes(x.approach)||typeof x.autoRetreat!=='boolean'||!Number.isInteger(x.duration)||x.duration<0||x.duration>180||(x.after!==null&&(!Number.isInteger(x.after)||x.after<0||x.after>=i))||(x.waitFor!==null&&!IDS.includes(x.waitFor)))throw Error('军令中有无法执行的安排，请重新拟令。');
 if(['deploy','recall'].includes(x.kind)&&!x.units.length)throw Error('派遣或撤回必须指定队伍。');if(!['deploy','recall'].includes(x.kind)&&x.units.length)throw Error('这项安排不应占用指定队伍。');
 if(x.kind==='boat'&&x.route!=='huang')throw Error('船队只能赴江北接人。');
 if(x.kind!=='deploy'&&x.duration!==0)throw Error('只有坚守或牵制任务可以指定持续时间。');if(x.task==='rescue'&&x.duration)throw Error('接应以实际撤离为完成条件，不能用时间替代。');
 return {kind:x.kind,units:[...x.units],route:x.route,task:x.task,approach:x.approach,autoRetreat:x.autoRetreat,duration:x.duration,after:x.after,waitFor:x.waitFor};});
}
export function commitDraft(s:State,d:Draft):string{
 if(s.receipts.includes(d.id))return '这份军令已经下达，不会重复执行。';if(s.ended)return '本次接应已结束。';if(d.revision!==s.revision||d.time!==s.time)return '战局已经变化，请按眼前军情重新拟令。';if(d.unsupported.length)return '这份草案还有未能落实的要求，请修改后再确认。';
 let ops:Operation[];try{ops=validateOperations(d.operations);}catch(e){return (e as Error).message;}
 const used=new Set<number>(),supplied=new Set<RouteId>();let supplies=0;for(const o of ops){if(s.routes[o.route].status==='lost'||s.routes[o.route].status==='saved')return `${DATA[o.route].name}这一路已经结束，请重新拟令。`;if(o.kind==='supply'){if(supplied.has(o.route))return '同一路不能重复补送军需。';supplied.add(o.route);supplies++;if(s.routes[o.route].supplied)return '该路已经补送过军需，不能重复领取效果。';}if(o.after===null&&o.waitFor===null){for(const i of o.units){if(used.has(i))return '同一支队伍不能同时执行两道军令。';used.add(i);const u=s.units[i];if(o.kind==='deploy'&&u.state!=='camp'&&!(u.state==='field'&&u.route===o.route))return `${u.name}尚未归营。先安排撤回，再接续派遣。`;if(o.kind==='recall'&&u.state==='camp')return `${u.name}已经在营中，无需召回。`;}}}
 if(supplies>s.supplies)return '军需不足，这份安排尚未下达。';
 const ids=ops.map((_,i)=>`${d.id}:${i}`);
 // A new confirmed order supersedes tasks for the same units, including future tasks.
 for(const old of s.tasks){if(['completed','cancelled'].includes(old.status))continue;if(ops.some(o=>o.units.some(i=>old.operation.units.includes(i)))){old.status='cancelled';old.reason='被新军令替代';report(s,`军侯：${operationLabel(old.operation)}的旧令撤下，按新令办。`,'order');}}
 ops.forEach((operation,i)=>s.tasks.push({id:ids[i],planId:d.id,operation,dependsOn:operation.after===null?null:ids[operation.after],status:'waiting',created:s.time,started:null,engagedAt:null,reason:''}));s.receipts.push(d.id);s.revision++;report(s,`我：${d.intent.slice(0,180)}`,'order');advanceOrders(s);return '军令已下达，执行情况记在任务簿中。';
}
export function cancelTask(s:State,id:string):string{const t=s.tasks.find(x=>x.id===id);if(!t||['completed','cancelled'].includes(t.status))return '这项任务已经结束。';for(const i of t.operation.units){const u=s.units[i];if(u.route&&s.routes[u.route].status==='evacuating')return '正在护送伤兵，不能在半途撤掉掩护。';}t.status='cancelled';t.reason='由玩家撤销';for(const i of t.operation.units)recall(s,i);s.revision++;return '军令已撤，前线队伍开始返回。';}
export function advanceOrders(s:State){
 for(const t of s.tasks){if(['completed','cancelled'].includes(t.status))continue;const o=t.operation,r=s.routes[o.route];
 if(t.dependsOn){const parent=s.tasks.find(x=>x.id===t.dependsOn);if(!parent||parent.status==='cancelled'){t.status='cancelled';t.reason='前置任务已撤销';continue;}if(parent.status!=='completed'){t.reason='等待前一道军令完成';continue;}}
 if(o.waitFor&&s.routes[o.waitFor].status!=='saved'){if(s.routes[o.waitFor].status==='lost'){t.status='blocked';t.reason='等待的接应未能完成，请改令';}else t.reason=`等待${DATA[o.waitFor].name}脱险`;continue;}
 if(t.started===null){
  if(s.ended){t.status='cancelled';t.reason='战局结束，未及执行';continue;}
  if(o.kind==='deploy'){
   if(r.status!=='active'){t.status='blocked';t.reason='该路已结束接应';continue;}
   if(o.units.some(i=>{const u=s.units[i];return u.state!=='camp'&&!(u.state==='field'&&u.route===o.route);})){t.status='blocked';t.reason='队伍尚未归营，归营后自动执行';continue;}
   const msg=deploy(s,o.units,o.route,o.task,o.approach,o.autoRetreat);if(msg!=='军令已下达。'){t.status='blocked';t.reason=msg;continue;}
  }else if(o.kind==='recall'){if(o.units.some(i=>{const u=s.units[i];return u.route&&s.routes[u.route].status==='evacuating';})){t.status='blocked';t.reason='队伍仍在护送，脱险后返回';continue;}o.units.forEach(i=>recall(s,i));
  }else if(o.kind==='boat'){if(s.boat.state==='back'){t.status='blocked';t.reason='船队正在返回';continue;}if(s.boat.state==='camp')sendBoat(s);
  }else if(o.kind==='tactic'){r.tactic=true;s.revision++;
  }else if(o.kind==='supply'){if(r.supplied||s.supplies<1){t.status='blocked';t.reason=r.supplied?'该路已补送军需':'军需不足';continue;}s.supplies--;r.supplied=true;r.health=Math.min(100,r.health+10);s.units.filter(u=>u.route===o.route&&u.state==='field').forEach(u=>u.fatigue=Math.max(0,u.fatigue-12));s.revision++;}
  t.started=s.time;t.reason='';t.status='running';
 }
 if(o.kind==='deploy'){
  const us=o.units.map(i=>s.units[i]);if(us.some(u=>u.state==='travel')){t.status='moving';t.reason='接应队在路上';continue;}
  if(t.engagedAt===null)t.engagedAt=s.time;
  if(r.status==='lost'){t.status='blocked';t.reason='接应失利';continue;}
  if(r.status==='saved'||(o.duration>0&&s.time-t.engagedAt>=o.duration)){t.status='completed';t.reason=r.status==='saved'?'人员已经脱险':'约定的掩护时间已到';}
  else if(us.every(u=>u.state==='return'||u.state==='camp')){t.status='blocked';t.reason='执行队已撤回，请改令';}
  else{t.status='running';t.reason=r.status==='evacuating'?'正在护送后队':o.task==='rescue'?'接应人员尚未全部脱险':o.duration?`还需${Math.ceil(o.duration-(s.time-t.engagedAt))}秒`:'守到人员脱险或接到新令';}
 }else if(o.kind==='recall'){if(o.units.every(i=>s.units[i].state==='camp'))t.status='completed';else t.reason='队伍正在返回';}
 else if(o.kind==='boat'){if(s.boat.state==='north'||r.status==='saved')t.status='completed';else t.reason='船队驶向北岸';}
 else t.status='completed';
 }
}
