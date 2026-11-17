import * as core from './core.js';
export const IDS=core.IDS,META=core.META,clone=core.clone;
export type Route=core.Route;export type Person=core.Person;
export type Action='rescue'|'hold'|'withdraw'|'supply'|'continue'|'reorganize'|'adjust'|'rest';
export type Goal='all'|'leader'|'feng'|'zhang';export type Pace='normal'|'rush'|'rest';
export interface Command {route:Route;action:Action;count:number|null;countMode:'set'|'add'|'remove'|'keep';goal:Goal;grain:number;relief:number;waitFor:core.Wait;grainMode?:'add'|'total';ration?:number;pace?:Pace;}
export interface Mission {action:Action;goal:Goal;}
export interface Setting {ration:number;pace:'normal'|'rush';}
export interface Pool {men:number;morale:number;fatigue:number;}
export interface Alert {id:string;route:Route;title:string;text:string;turn:number;resolved:boolean;}
export interface Conflict {route:Route;kind:'rear'|'crowd'|'walkers';baseMen:number;helpers:number;grain:number;needGrain:number;resolved:boolean;}
export interface Order {turn:number;text:string;commands:Command[];}
export interface State {version:4;world:core.State;revision:number;missions:Record<Route,Mission|null>;settings:Record<Route,Setting>;campUnits:Pool[];queued:Partial<Record<Route,Command>>;alerts:Alert[];seen:string[];orders:Order[];conflict:Conflict|null;}
export const KEY='yiling-radio-lab-v3-20261115';
const ACTIONS:Action[]=['rescue','hold','withdraw','supply','continue','reorganize','adjust','rest'];
const person:Record<string,Person>={fu:'傅肜',feng:'冯习',zhang:'张南',sha:'沙摩柯'};
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
export const rationName=(n:number)=>n===100?'正常配给':n>100?`加粮${n-100}%`:`节用${100-n}%`;
export const moraleName=(n:number)=>n>=65?'士气稳定':n>=45?'士气受压':'士气低落';
export const fatigueName=(n:number)=>n>=80?'疲惫':n>=60?'疲劳':'尚能坚持';
export function fresh(seed=731115):State {
 const world=core.fresh(seed);world.totalGrain=5000;
 for(const id of IDS)Object.assign(world.fronts[id],{morale:70,fatigue:0,ration:100});
 return {version:4,world,revision:0,missions:{fu:null,feng:null,sha:null},settings:{fu:{ration:100,pace:'normal'},feng:{ration:100,pace:'normal'},sha:{ration:100,pace:'normal'}},campUnits:[{men:2500,morale:70,fatigue:0}],queued:{},alerts:[],seen:[],orders:[],conflict:null};
}
export function validate(raw:unknown):Command[]{
 if(!Array.isArray(raw)||!raw.length||raw.length>3)throw Error('一份军令可安排一至三路。');
 const seen=new Set<Route>();return raw.map(x=>{
  if(!x||!IDS.includes(x.route)||seen.has(x.route))throw Error('请核对对象，同一路只安排一次。');seen.add(x.route);
  if(!ACTIONS.includes(x.action)||!['set','add','remove','keep'].includes(x.countMode)||!['all','leader','feng','zhang'].includes(x.goal)||!['now','fu','feng','zhang','sha'].includes(x.waitFor))throw Error('任务、人数或等待条件不完整。');
  if(x.countMode==='keep'?x.count!==null:!Number.isInteger(x.count)||x.count<0||x.count>2500)throw Error('请说明有效人数；保持现队不必重复人数。');
  if([x.grain,x.relief].some(n=>!Number.isInteger(n)||n<0||n>5000))throw Error('斤数应为0至5000的整数；未指定时自动配粮。');
  if(x.ration!==undefined&&(!Number.isInteger(x.ration)||x.ration<60||x.ration>140))throw Error('配给可在正常的60%—140%内调整。');
  if(x.pace!==undefined&&!['normal','rush','rest'].includes(x.pace))throw Error('请选择正常推进、赶路或休整。');
  if(x.grainMode!==undefined&&!['add','total'].includes(x.grainMode))throw Error('请区分总携粮和额外备用粮。');
  if(x.route!=='feng'&&['feng','zhang'].includes(x.goal))throw Error('冯习、张南属于旧营一路。');
  return {route:x.route,action:x.action,count:x.count,countMode:x.countMode,goal:x.goal,grain:x.grain,relief:x.relief,waitFor:x.waitFor,...(x.grainMode?{grainMode:x.grainMode}:{}),...(x.ration!==undefined?{ration:x.ration}:{}),...(x.pace?{pace:x.pace}:{})};
 });
}
function ready(s:State,c:Command){return c.waitFor==='now'||s.world.saved[person[c.waitFor]]!==undefined;}
function mission(s:State,c:Command):Mission {return {action:c.action==='adjust'||c.action==='supply'?(s.missions[c.route]?.action||'rescue'):c.action==='continue'?'rescue':c.action,goal:c.goal};}
export function policies(w:core.State,id:Route,m:Mission,n:number,wait:core.Wait='now'):core.Policy{
 const finish=m.action==='withdraw'?'stop':m.goal==='leader'?(id==='fu'?'fu':id==='feng'?'feng':'sha'):m.goal==='feng'?'feng':m.goal==='zhang'?'zhang':'all';
 const mode=id==='fu'?(n>=1000?'forward':'borrow'):id==='feng'?(n>=1000?'parallel':'clear'):'east';
 const guard=id==='fu'?(mode==='forward'?Math.min(500,Math.floor(n/2)):0):id==='feng'?Math.min(300,Math.floor(n*.7)):Math.min(core.guardNeed(w.turn),n);
 return {troops:n,mode,guard,native:true,package:false,finish,wait};
}
export function budget(s:State){let people=0,grain=0;for(const id of IDS){const c=s.queued[id];if(c){const add=Math.max(0,c.count!-s.world.fronts[id].men);people+=add;grain+=add+c.grain+c.relief;}}return {people,grain};}
export function pending(s:State){return s.alerts.filter(a=>!a.resolved&&s.world.fronts[a.route].status==='active');}
export function conflictText(s:State){const c=s.conflict;if(!c||c.resolved)return '';const help=Math.max(Math.min(1,c.helpers/400),c.needGrain?c.grain/c.needGrain:0);
 return (c.kind==='rear'?'侧翼追兵威胁新掩护点。':c.kind==='crowd'?'旧营新增一批饥饿散兵，需要收拢。':'西沟新发现饥饿部众，需安置后接出。')+`可再派${Math.max(0,400-c.helpers)}人接手${c.needGrain?`，或用${Math.max(0,c.needGrain-c.grain)}斤救济粮安置散兵`:''}；也可让现队休整并重整一时段，下期自动恢复。接受照旧则本冲突令接应效率为${Math.round((.5+.5*help)*100)}%${c.kind==='rear'?`、另加${Math.round(25*(1-help))}个百分点风险`:''}。加餐只影响状态，不能代替这项人手安排。`;
}
function plan(s:State,raw:unknown){
 const cs=validate(raw),copy=clone(s);if(s.world.ended)throw Error('本次接应已结束。');
 for(const c of cs){const id=c.route,f=s.world.fronts[id],previous=copy.queued[id];if(f.status!=='active')throw Error(`${META[id].name}已收队，不能再安排。`);
  const current=previous?.count??f.men,n=c.action==='withdraw'?0:c.countMode==='keep'?current:c.countMode==='add'?current+c.count!:c.countMode==='remove'?current-c.count!:c.count!;
  if(!Number.isInteger(n)||n<0||n>2500)throw Error('调遣后的兵力超出范围。');if(!n&&c.action!=='withdraw')throw Error('这一路尚未派兵，请先说明派多少人。');
  if(c.action==='withdraw'&&(c.grain||c.relief||c.ration!==undefined||c.pace))throw Error('收队时不再追加配给或推进安排。');
  const keep=['adjust','supply'].includes(c.action);if(keep&&previous?.action==='withdraw')throw Error('这一路已排定收队，请先明确改变任务。');
  const cf=s.conflict;if(c.relief&&(!cf||cf.resolved||cf.route!==id||!cf.needGrain))throw Error('这一路没有可用救济粮安置的新增散兵。');
  const rest=c.action==='rest'||c.action==='reorganize'||c.pace==='rest';
  const automatic=f.food-(n<f.men?Math.floor(f.food*(f.men-n)/f.men):0)+Math.max(0,n-f.men);
  if(c.grainMode==='total'&&c.grain<automatic)throw Error(`当前队粮与新兵自带粮至少${automatic}斤；少吃请调整配给，不会丢弃已有粮。`);
  const grain=c.action==='withdraw'?0:c.grainMode==='total'?c.grain-automatic:(previous?.grain||0)+c.grain,relief=c.action==='withdraw'?0:(previous?.relief||0)+c.relief;
  if(cf&&relief>cf.needGrain-cf.grain)throw Error('已排定的救济也计入需求，请勿重复发放。');
  const pace: Pace=rest?'rest':c.pace||previous?.pace||s.settings[id].pace;
  copy.queued[id]={...c,count:n,countMode:'set',action:rest?'rest':keep?(previous?.action==='rest'&&c.pace?'continue':previous?.action||c.action):c.action,goal:keep?(previous?.goal||s.missions[id]?.goal||'all'):c.goal,waitFor:keep&&c.waitFor==='now'?(previous?.waitFor||'now'):c.waitFor,ration:c.ration??previous?.ration??s.settings[id].ration,pace,grain,relief};delete copy.queued[id]!.grainMode;
 }
 const b=budget(copy);if(b.people>s.world.camp)throw Error(`本轮新增${b.people}人，营中待命只有${s.world.camp}人；归营兵下一次下令才可调。`);if(b.grain>s.world.stock)throw Error(`出发携粮及额外补给需${b.grain}斤，营粮只有${s.world.stock}斤。`);
 const check=clone(copy.world);check.queued={};for(const id of IDS){const c=copy.queued[id];if(c)core.queue(check,id,policies(check,id,mission(copy,c),c.count!,c.waitFor));}
 const replacements=cs.filter(c=>s.queued[c.route]&&(!['supply','adjust'].includes(c.action)||c.pace)&&s.queued[c.route]!.action!==copy.queued[c.route]!.action).map(c=>`${META[c.route].name}原待执行任务将改为：${summary(copy.queued[c.route]!)}。`);
 return {state:copy,commands:cs.map(c=>copy.queued[c.route]!),cost:b.grain,newTroops:b.people,replacements};
}
export function preview(s:State,raw:unknown){const p=plan(s,raw);return {...p,expected:project(p.state),recommended:recommend(p.state)};}
export function confirm(s:State,raw:unknown,revision:number,text:string){if(s.revision!==revision)throw Error('军情已变，请重新核对。');const p=preview(s,raw);s.queued=p.state.queued;
 for(const a of s.alerts){if(a.id==='grain-alert'){a.resolved=true;continue;}const intent=validate(raw).find(c=>c.route===a.route);if(intent&&(!['supply','adjust'].includes(intent.action)||intent.relief||p.state.queued[a.route]?.action==='rest'))a.resolved=true;}
 s.orders.push({turn:s.world.turn,text,commands:p.commands});s.revision++;return p;
}
function take(s:State,n:number){let morale=0,fatigue=0,left=n;s.campUnits.sort((a,b)=>a.fatigue-b.fatigue);for(const p of s.campUnits){const k=Math.min(left,p.men);morale+=k*p.morale;fatigue+=k*p.fatigue;p.men-=k;left-=k;}s.campUnits=s.campUnits.filter(p=>p.men>0);if(left)throw Error('营中兵力记录不一致。');return {morale:morale/n,fatigue:fatigue/n};}
export function stateEffect(morale:number,fatigue:number,pace:'normal'|'rush'){
 return {factor:(morale<45?.65:morale<65?.9:morale>=80?1.05:1)*(fatigue>=80?.6:fatigue>=60?.8:1)*(pace==='rush'?1.35:1),risk:(morale<45?15:morale<65?5:0)+(fatigue>=60?10:0)+(pace==='rush'?10:0)};
}
function alert(s:State,id:string,route:Route,title:string,text:string){if(s.seen.includes(id))return;s.seen.push(id);s.alerts.push({id,route,title,text,turn:s.world.turn-1,resolved:false});}
function invariant(s:State){core.invariant(s.world);if(s.campUnits.reduce((n,p)=>n+p.men,0)!==s.world.camp)throw Error('待命兵与归营兵记录不守恒。');}
export function step(s:State,opts:{forecast?:boolean;ignoreAlerts?:boolean}={}){
 if(s.world.ended)return null;if(!opts.ignoreAlerts&&pending(s).length)throw Error('前线有任务冲突待决断；询问不算回令，可增援、休整、救济、收队或明确接受照旧。');
 const copy=clone(s),w=copy.world,turn=w.turn,held:Route[]=[],active=new Set<Route>(),planned:Partial<Record<Route,number>>={},before:Record<string,{men:number;morale:number;fatigue:number;pace:'normal'|'rush';ration:number;rest:boolean}>={};w.queued={};let manualGrain=0;
 for(const id of IDS){const c=copy.queued[id],f=w.fronts[id];if(c&&ready(copy,c)){
   const old=f.men,n=c.count!,added=Math.max(0,n-old);if(added){const incoming=take(copy,added);f.morale=((f.morale??70)*old+incoming.morale*added)/(old+added);f.fatigue=((f.fatigue??0)*old+incoming.fatigue*added)/(old+added);}
   copy.missions[id]=mission(copy,c);copy.settings[id]={ration:c.ration??copy.settings[id].ration,pace:c.pace==='rest'?'normal':c.pace||copy.settings[id].pace};
   w.stock-=c.grain+c.relief;manualGrain+=c.grain+c.relief;f.food+=c.grain;w.relief+=c.relief;planned[id]=n;
   if(c.action==='rest'||c.action==='reorganize'||c.pace==='rest')held.push(id);
   const cf=copy.conflict;if(cf&&!cf.resolved&&cf.route===id){cf.helpers=Math.max(0,n-cf.baseMen);cf.grain+=c.relief;if(cf.helpers>=400||(cf.needGrain&&cf.grain>=cf.needGrain))cf.resolved=true;}
  }
  const m=copy.missions[id];if(m&&f.status==='active'){active.add(id);f.policy=policies(w,id,m,planned[id]??f.men);if(m.action==='hold'&&!held.includes(id))held.push(id);}
  if(c)core.queue(w,id,policies(w,id,mission(copy,c),c.count!,c.waitFor));
 }
 const needs:Record<Route,number>={fu:0,feng:0,sha:0};let carriedCost=0;
 for(const id of IDS){const f=w.fronts[id],n=planned[id]??f.men,setting=copy.settings[id],rest=held.includes(id);if(f.status!=='active')continue;
  const add=Math.max(0,n-f.men);carriedCost+=add;const returningFood=n<f.men?Math.floor(f.food*(f.men-n)/f.men):0;
  if(active.has(id)&&n>0){const effect=stateEffect(f.morale??70,f.fatigue??0,setting.pace);f.factor=rest?1:effect.factor;f.riskBonus=rest?0:effect.risk;f.ration=setting.ration;
   const cf=copy.conflict;if(cf&&!cf.resolved&&cf.route===id&&!rest){const help=Math.max(Math.min(1,cf.helpers/400),cf.needGrain?cf.grain/cf.needGrain:0);f.factor*=.5+.5*help;if(cf.kind==='rear')f.riskBonus+=25*(1-help);}
   needs[id]=Math.max(0,Math.ceil(n*setting.ration/200)-(f.food-returningFood+add));before[id]={men:n,morale:f.morale??70,fatigue:f.fatigue??0,pace:setting.pace,ration:setting.ration,rest};
  }
 }
 const available=Math.max(0,w.stock-carriedCost),totalNeed=IDS.reduce((n,id)=>n+needs[id],0);let left=Math.min(available,totalNeed);
 const allocations:Record<Route,number>={fu:0,feng:0,sha:0};for(const id of IDS){allocations[id]=totalNeed?Math.floor(Math.min(available,totalNeed)*needs[id]/totalNeed):0;left-=allocations[id];}for(const id of IDS)if(left&&allocations[id]<needs[id]){allocations[id]++;left--;}
 for(const id of IDS){w.stock-=allocations[id];w.fronts[id].food+=allocations[id];}
 const r=core.advance(w,{forecast:opts.forecast,hold:held,onReturn:row=>{if(row.men)copy.campUnits.push({men:row.men,morale:row.morale??70,fatigue:row.fatigue??0});}});if(!r)return null;r.issuedGrain=manualGrain+carriedCost+IDS.reduce((n,id)=>n+allocations[id],0);
 for(const id of IDS){const old=before[id];if(old){const f=w.fronts[id],line=r.lines.find(l=>l.route===id),fed=line?.foodUsed||0,ratio=old.men?fed/(old.men*.5):1;
   const foodDelta=ratio<1?-Math.ceil((1-ratio)*30-1e-8):ratio>=1.2?4:0;
   f.morale=clamp(Math.round(old.morale+foodDelta+(old.rest?12:old.pace==='rush'?-4:0)-(line?.loss?Math.ceil(line.loss/old.men*120):0)),0,85);f.fatigue=clamp(Math.round(old.fatigue+(old.rest?-35:old.pace==='rush'?22:5)),0,100);
   for(const returning of w.returns)if(returning.route===id&&returning.due===turn+1){returning.morale=f.morale;returning.fatigue=f.fatigue;}
   if(line){const effect=stateEffect(old.morale,old.fatigue,old.pace);line.text+=` ${old.rest?'本时段休整，任务进度暂停；下时段自动正常推进。':`${old.pace==='rush'?'加紧推进':'正常推进'}：状态与节奏修正${Math.round(effect.factor*100)}%，额外受挫风险${effect.risk}个百分点。`}${rationName(old.ration)}，本时段实发${fed}斤；士气${Math.round(old.morale)}→${f.morale}，疲劳${Math.round(old.fatigue)}→${f.fatigue}。`;f.report=line.text;}
   if(old.rest){if(copy.conflict?.route===id)copy.conflict.resolved=true;if(copy.missions[id])copy.missions[id]!.action='rescue';copy.settings[id].pace='normal';}
  }
  const c=copy.queued[id];if(c&&(ready(s,c)||w.fronts[id].status!=='active'))delete copy.queued[id];
 }
 for(const pool of copy.campUnits){pool.fatigue=clamp(pool.fatigue-15,0,100);pool.morale=clamp(pool.morale+4,0,85);}
 w.queued={};copy.revision++;
 if(!opts.forecast&&!copy.conflict){const variant=w.initialSeed%3,id:Route=variant===0?'feng':variant===1?'fu':'sha';if(copy.missions[id]&&w.fronts[id].status==='active'){copy.conflict={route:id,kind:variant===0?'crowd':variant===1?'rear':'walkers',baseMen:w.fronts[id].men,helpers:0,grain:0,needGrain:variant===1?0:variant===0?400:500,resolved:false};alert(copy,'task-conflict',id,'接应遇到新增任务',conflictText(copy));}}
 if(!opts.forecast&&!w.ended){const ids=IDS.filter(id=>w.fronts[id].status==='active'&&w.fronts[id].men>0),need=ids.reduce((n,id)=>n+Math.max(0,Math.ceil(w.fronts[id].men*copy.settings[id].ration/200)-w.fronts[id].food),0);if(need>w.stock&&ids.length)alert(copy,'grain-alert',ids[0],'营粮告急，配给需要取舍',`下一时段自动补给需${need}斤，营中仅余${w.stock}斤。可降低配给、抽回部分兵力或收队；也可明确照旧，接受缺粮后果。`);}
 for(const a of copy.alerts)if(w.fronts[a.route].status!=='active')a.resolved=true;
 invariant(copy);Object.assign(s,copy);return r;
}
export function project(s:State){const copy=clone(s),start=copy.world.eaten,finish:Partial<Record<Route,number>>={},risk:Record<Route,number>={fu:0,feng:0,sha:0},maxRisk={...risk},use={...risk};let first:core.Receipt|null=null;
 for(let i=0;i<10&&!copy.world.ended;i++){const r=step(copy,{forecast:true,ignoreAlerts:true});if(!r)break;if(!first)first=r;for(const l of r.lines){use[l.route]+=l.foodUsed||0;if(r===first)risk[l.route]=l.risk;maxRisk[l.route]=Math.max(maxRisk[l.route],l.risk);}for(const id of IDS)if(copy.world.fronts[id].status==='done'&&finish[id]===undefined)finish[id]=r.turn;}
 return {first,finish,risk,maxRisk,use,totalUse:copy.world.eaten-start,outcomes:Object.fromEntries(IDS.map(id=>[id,copy.world.fronts[id].result])),camp:copy.world.camp,saved:Object.keys(copy.world.saved),stock:copy.world.stock};
}
export function recommend(s:State){const funded=clone(s);funded.world.stock+=100000;funded.world.totalGrain=(funded.world.totalGrain??5000)+100000;const chosen=project(funded),normal=clone(funded);for(const id of IDS){normal.settings[id]={ration:100,pace:'normal'};if(normal.queued[id]){normal.queued[id]!.ration=100;if(normal.queued[id]!.pace!=='rest')normal.queued[id]!.pace='normal';}}return {normal:project(normal),chosen};}
export function summary(c:Command){const name=META[c.route].name;if(c.action==='withdraw')return `${name}：收队，携余粮归营`;return `${name}：共${c.count}人，${c.action==='rest'||c.pace==='rest'?'休整一时段，下期自动正常推进':c.action==='hold'?'守住现场，暂停接应':c.pace==='rush'?'加紧推进，持续消耗体力':'正常执行接应'}，${c.goal==='all'?'接齐后回来':'只接指定将领后回来'}；${rationName(c.ration??100)}，粮草自动配发${c.grain?`；另带备用粮${c.grain}斤`:''}${c.relief?`；救济新增散兵${c.relief}斤`:''}${c.waitFor!=='now'?`；等${person[c.waitFor]}脱险再执行`:''}`;}
export function stage(s:State,id:Route){const f=s.world.fronts[id];if(f.status==='done')return f.result==='complete'?'已接齐归营':'已收队';if(f.status==='returning')return '归营中';if(!s.missions[id])return s.queued[id]?'已排定，尚未出发':'等待接应';if(s.missions[id]?.action==='hold')return '守住现场';if(s.conflict?.route===id&&!s.conflict.resolved)return '新增任务仍牵制接应';return id==='fu'?(f.work[0]<500?'接替后阵':f.work[1]<500?'准备隘口':'接回队尾'):id==='feng'?(f.work[0]<500||f.work[1]<500?'迁旗、清路':'护送前后队'):(f.out[0]?'接应西沟部众':'搜寻两沟');}
export function suggestions(s:State,id:Route){const n=META[id].name;return s.conflict?.route===id&&!s.conflict.resolved?[`再派四百人支援${n}，按建议配粮。`,`让${n}现队休整一时段，再继续接应。`,'按原令继续，接受放慢的后果。']:!s.missions[id]?[`派五百人接应${n}，按建议配粮。`,'三路怎么分兵合适？先别下令。']:[`让${n}加紧赶路，按建议配粮。`,`给${n}多两成口粮，任务不变。`,`让${n}休整一时段再继续。`];}
export function restore(text:string):State|null{try{const s=JSON.parse(text) as State;if(s.version!==4||!Number.isInteger(s.revision)||!s.missions||!s.settings||!s.queued||!Array.isArray(s.orders)||!Array.isArray(s.alerts)||!Array.isArray(s.seen)||!Array.isArray(s.campUnits)||(s.world.totalGrain??5000)!==5000)return null;const w=core.restore(JSON.stringify(s.world));if(!w)return null;s.world=w;for(const id of IDS){const f=w.fronts[id],q=s.settings[id];if(!q||!Number.isInteger(q.ration)||q.ration<60||q.ration>140||!['normal','rush'].includes(q.pace)||!Number.isFinite(f.morale)||f.morale!<0||f.morale!>85||!Number.isFinite(f.fatigue)||f.fatigue!<0||f.fatigue!>100)return null;if(s.missions[id]&&!ACTIONS.includes(s.missions[id]!.action))return null;if(s.queued[id])validate([s.queued[id]]);}for(const p of s.campUnits)if(!Number.isInteger(p.men)||p.men<0||!Number.isFinite(p.morale)||p.morale<0||p.morale>85||!Number.isFinite(p.fatigue)||p.fatigue<0||p.fatigue>100)return null;for(const a of s.alerts)if(!IDS.includes(a.route)||typeof a.resolved!=='boolean'||typeof a.text!=='string')return null;if(s.conflict&&(!IDS.includes(s.conflict.route)||!['rear','crowd','walkers'].includes(s.conflict.kind)||[s.conflict.baseMen,s.conflict.helpers,s.conflict.grain,s.conflict.needGrain].some(n=>!Number.isInteger(n)||n<0)))return null;const b=budget(s);if(b.people>w.camp||b.grain>w.stock)return null;invariant(s);return s;}catch{return null;}}
