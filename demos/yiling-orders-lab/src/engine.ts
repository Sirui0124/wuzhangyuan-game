import * as core from './core.js';
export const IDS=core.IDS,META=core.META,clone=core.clone;
export type Route=core.Route;
export type Person=core.Person;
export type Action='rescue'|'hold'|'withdraw'|'supply'|'continue';
export type Goal='all'|'leader'|'feng'|'zhang';
export interface Command {route:Route;action:Action;count:number|null;countMode:'set'|'add'|'remove'|'keep';goal:Goal;supplies:boolean;waitFor:core.Wait;}
export interface Mission {action:Action;goal:Goal;}
export interface Alert {id:string;route:Route;title:string;text:string;turn:number;resolved:boolean;}
export interface Order {turn:number;text:string;commands:Command[];}
export interface State {version:2;world:core.State;revision:number;missions:Record<Route,Mission|null>;queued:Partial<Record<Route,Command>>;alerts:Alert[];seen:string[];orders:Order[];}
export const KEY='yiling-natural-orders-v1-20261115';
export function fresh(seed=731115):State{return {version:2,world:core.fresh(seed),revision:0,missions:{fu:null,feng:null,sha:null},queued:{},alerts:[],seen:[],orders:[]};}
export function validate(raw:unknown):Command[]{
 if(!Array.isArray(raw)||raw.length<1||raw.length>3)throw Error('一份军令可以安排一至三路，请说明接应对象。');
 const seen=new Set<Route>();return raw.map(x=>{if(!x||!IDS.includes(x.route)||seen.has(x.route)||!['rescue','hold','withdraw','supply','continue'].includes(x.action)||!['set','add','remove','keep'].includes(x.countMode)||!['all','leader','feng','zhang'].includes(x.goal)||!['now','fu','feng','zhang','sha'].includes(x.waitFor)||typeof x.supplies!=='boolean'||(x.countMode==='keep'?x.count!==null:!Number.isInteger(x.count)||x.count<0||x.count>2500))throw Error('军令的对象、人数或行动还不清楚。');seen.add(x.route);if(x.route!=='feng'&&['feng','zhang'].includes(x.goal))throw Error('冯习或张南的单独接应属于旧营一路。');return {route:x.route,action:x.action,count:x.count,countMode:x.countMode,goal:x.goal,supplies:x.supplies,waitFor:x.waitFor};});
}
const person:Record<string,Person>={fu:'傅肜',feng:'冯习',zhang:'张南',sha:'沙摩柯'};
export function policies(w:core.State,id:Route,m:Mission,n:number,supply=false,wait:core.Wait='now'):core.Policy{
 const f=w.fronts[id];const pkg=f.supply||supply;
 const finish=m.action==='withdraw'?'stop':m.goal==='leader'?(id==='fu'?'fu':id==='feng'?'feng':'sha'):m.goal==='feng'?'feng':m.goal==='zhang'?'zhang':'all';
 let mode=id==='fu'?(n>=1000?'forward':'borrow'):id==='feng'?(n>=1000?'parallel':'clear'):'east';
 // Once a forward position exists, a smaller replacement force can use the original force's cover.
 if(id==='fu'&&f.work[1]>=500&&n<1000)mode='borrow';
 const need=id==='feng'?(pkg?200:300):id==='sha'?core.guardNeed(w.turn):500;
 const guard=id==='fu'?(mode==='forward'?Math.min(500,Math.floor(n/2)):0):id==='feng'?Math.min(need,Math.floor(n*.7)):Math.min(need,n);
 return {troops:n,mode,guard,native:true,package:supply,finish,wait};
}
function target(s:State,c:Command){const f=s.world.fronts[c.route];const current=s.queued[c.route]?.countMode==='set'?s.queued[c.route]!.count!:f.men;return c.countMode==='keep'?current:c.countMode==='add'?current+c.count!:c.countMode==='remove'?current-c.count!:c.count!;}
function mission(s:State,c:Command):Mission {const old=s.missions[c.route];return {action:c.action==='supply'?(old?.action==='hold'?'hold':'rescue'):c.action==='continue'?'rescue':c.action,goal:c.action==='supply'?old?.goal||'all':c.goal};}
function prepare(s:State){const w=clone(s.world);w.queued={};const held:Route[]=[];
 for(const id of IDS){const m=s.missions[id];if(m&&w.fronts[id].status==='active'){w.fronts[id].policy=policies(w,id,m,w.fronts[id].men);if(m.action==='hold')held.push(id);}}
 for(const id of IDS){const c=s.queued[id];if(!c)continue;const m=mission(s,c),n=c.count!;
  core.queue(w,id,policies(w,id,m,n,c.supplies,c.waitFor));
  if(c.waitFor==='now'||w.saved[person[c.waitFor]]!==undefined){const i=held.indexOf(id);if(i>=0)held.splice(i,1);if(m.action==='hold')held.push(id);}
 }return {world:w,held};
}
export function pending(s:State){return s.alerts.filter(a=>!a.resolved&&s.world.fronts[a.route].status==='active');}
export function preview(s:State,raw:unknown){const cs=validate(raw),copy=clone(s);if(s.world.ended)throw Error('本次接应已经结束。');
 for(const c of cs){const f=copy.world.fronts[c.route];if(f.status!=='active')throw Error(`${META[c.route].name}一路已经收队，不能再次派遣。`);const n=c.action==='withdraw'?0:target(copy,c);if(n<0||n>2500)throw Error('调遣后的人数超出本次兵力，请核对增援或撤回数量。');
  if(n===0&&['rescue','hold','continue'].includes(c.action))throw Error('请说明派多少人；这一路目前还没有接应兵。');
  if(c.action==='supply'&&!s.missions[c.route])throw Error('这一路还没有接应队，请先说明派兵安排。');
  if(c.supplies&&!core.packageUseful(copy.world,c.route))throw Error('本路专项物资已用过，或对应任务已经完成。');
  copy.queued[c.route]={...c,count:n,countMode:'set'};
 }
 const p=prepare(copy),b=core.budget(p.world);
 return {state:copy,commands:cs.map(c=>copy.queued[c.route]!),cost:b.stock,newTroops:b.people,expected:project(copy)};
}
export function confirm(s:State,raw:unknown,revision:number,text:string){if(revision!==s.revision)throw Error('军情或原话已经变化，请重新整理军令。');const p=preview(s,raw);s.queued=p.state.queued;const routes=p.commands.map(c=>c.route);for(const a of s.alerts)if(routes.includes(a.route))a.resolved=true;s.orders.push({turn:s.world.turn,text,commands:p.commands});s.revision++;return p;}
function addAlert(s:State,id:string,route:Route,title:string,text:string){if(s.seen.includes(id)||s.world.fronts[route].status!=='active')return;s.seen.push(id);s.alerts.push({id,route,title,text,turn:s.world.turn-1,resolved:false});}
export function step(s:State,opts:{forecast?:boolean;ignoreAlerts?:boolean}={}){
 if(s.world.ended)return null;if(!opts.ignoreAlerts&&pending(s).length)throw Error('有新的军情需要回复。先听报，再决定继续、增援或收队。');
 const copy=clone(s),old=clone(copy.world),p=prepare(copy);
 for(const id of IDS){const c=copy.queued[id];if(c&&(c.waitFor==='now'||old.saved[person[c.waitFor]]!==undefined))copy.missions[id]=mission(copy,c);}
 const r=core.advance(p.world,{forecast:opts.forecast,hold:p.held});if(!r)return null;copy.world=p.world;
 for(const id of IDS){const c=copy.queued[id];if(c&&(c.waitFor==='now'||old.saved[person[c.waitFor]]!==undefined||copy.world.fronts[id].status!=='active'))delete copy.queued[id];}
 // The core queue is rebuilt from intent next round; the detailed split is never a player setting.
 copy.world.queued={};copy.revision++;
 if(!opts.forecast){
  if(old.saved['张南']===undefined&&copy.world.saved['张南']!==undefined&&copy.world.saved['冯习']===undefined)addAlert(copy,'zhang-first','feng','张南已经撤出','张南与前队已过岔口，冯习仍在收后队。继续接后队会占用现有人手，也可以增援或现在收队。');
  if(old.saved['沙摩柯']===undefined&&copy.world.saved['沙摩柯']!==undefined&&!copy.world.fronts.sha.out[1]&&copy.world.fronts.sha.work[1]<(copy.world.fronts.sha.supply?750:1000))addAlert(copy,'sha-first','sha','首批已经出林','沙摩柯与东沟首批已脱险，西沟还有人。继续搜寻会让接应队留在林口，也可增派搜寻力量或收队。');
  if([4,6].includes(copy.world.turn)&&copy.missions.sha)addAlert(copy,'forest-'+copy.world.turn,'sha','林口的追兵逼近了',`下一回合林口足额接应需${core.guardNeed(copy.world.turn)}人。部队会先保障出口，留下的搜寻人手可能变少。要照旧继续、增援，还是送转运物资？`);
  for(const l of r.lines)if(l.loss>0)addAlert(copy,'loss-'+l.route,l.route,'接应队出现减员',`${l.loss}人负伤或掉队，现场剩${copy.world.fronts[l.route].men}名可用接应兵。已完成的工作保留，是否继续或补充兵力？`);
 }
 for(const a of copy.alerts)if(copy.world.fronts[a.route].status!=='active')a.resolved=true;
 Object.assign(s,copy);return r;
}
export function project(s:State){const copy=clone(s),cost=core.budget(prepare(copy).world);const first=step(copy,{forecast:true,ignoreAlerts:true});const finish:Partial<Record<Route,number>>={},risk:Record<Route,number>={fu:0,feng:0,sha:0},maxRisk:Record<Route,number>={fu:0,feng:0,sha:0};for(const id of IDS)if(copy.world.fronts[id].status==='done')finish[id]=first?.turn;
 for(const l of first?.lines||[])risk[l.route]=maxRisk[l.route]=l.risk;
 for(let i=0;i<9&&!copy.world.ended;i++){const r=step(copy,{forecast:true,ignoreAlerts:true});for(const l of r?.lines||[])maxRisk[l.route]=Math.max(maxRisk[l.route],l.risk);for(const id of IDS)if(copy.world.fronts[id].status==='done'&&finish[id]===undefined)finish[id]=r?.turn;}
 return {first,finish,risk,maxRisk,outcomes:Object.fromEntries(IDS.map(id=>[id,copy.world.fronts[id].result])),camp:copy.world.camp,saved:Object.keys(copy.world.saved),stock:copy.world.stock,cost:cost.stock,newTroops:cost.people};
}
export function summary(c:Command){const whom=META[c.route].name;if(c.action==='withdraw')return `停止${whom}一路接应，现场接应兵撤回`;const action=c.action==='hold'?'稳住现场，暂不推进':c.action==='supply'?'送专项物资，保持原任务':c.action==='continue'?'继续接应':'接应撤离';return `${whom}：${c.count}人，${action}${c.goal!=='all'?'，先接'+(c.goal==='leader'?(c.route==='fu'?'傅肜':c.route==='sha'?'沙摩柯':'冯习'):c.goal==='feng'?'冯习':'张南')+'后收队':'，接齐后回来'}${c.supplies?'；增送1份专项物资':''}${c.waitFor!=='now'?'；等'+person[c.waitFor]+'脱险再执行':''}`;}
export function stage(s:State,id:Route){const f=s.world.fronts[id];if(f.status==='done')return f.result==='complete'?'已接齐并归营':'已收队';if(f.status==='returning')return '接应队归营中';if(!s.missions[id]&&!s.queued[id])return '等待接应';if(s.missions[id]?.action==='hold')return '稳住现场，等待新令';if(id==='fu')return f.work[0]<500?'接替后阵':f.work[1]<500?'原部整队，准备接后队':'交替接回队尾';if(id==='feng')return f.work[0]<500||f.work[1]<500?'迁旗、清理退路':s.world.saved['张南']!==undefined?'张南已出，接应后队':'引导前部通过';return f.out[0]?'首批已出，接应西沟':f.work[0]>=500?'东沟已找到，接人出林':'寻找两沟部众';}
export function suggestions(s:State,id:Route){const f=s.world.fronts[id],name=META[id].name,alert=pending(s).some(a=>a.route===id);if(alert)return ['照原来的兵力继续接后队。',`给${name}这一路再增派五百人。`,id==='sha'?'沙摩柯先走，其他部众继续接齐。':id==='feng'?'先把张南接回来，停止后续接应。':'后阵先稳住，暂时不要接人。'];if(!s.missions[id])return [`派五百人接应${name}，接齐后回来。`,`派一千人接应${name}。`,'多派五百人能快多少？'];return ['继续按原令接应。',`这一路再增派三百人。`,!f.supply?'送一份担架和绳索，继续接应。':'现在收队，没接出的人保留未接出结果。'];}
export function restore(text:string):State|null{try{const s=JSON.parse(text) as State;if(s.version!==2||!Number.isInteger(s.revision)||!s.missions||!s.queued||!Array.isArray(s.alerts)||!Array.isArray(s.seen)||!Array.isArray(s.orders))return null;const w=core.restore(JSON.stringify(s.world));if(!w)return null;for(const id of IDS){const m=s.missions[id];if(m&&(!['rescue','hold','withdraw','continue','supply'].includes(m.action)||!['all','leader','feng','zhang'].includes(m.goal)))return null;if(s.queued[id])validate([s.queued[id]]);}for(const a of s.alerts)if(!IDS.includes(a.route)||typeof a.id!=='string'||typeof a.text!=='string'||typeof a.title!=='string'||typeof a.resolved!=='boolean')return null;s.world=w;return s;}catch{return null;}}
