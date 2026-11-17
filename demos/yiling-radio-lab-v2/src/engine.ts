import * as core from './core.js';
export const IDS=core.IDS,META=core.META,clone=core.clone;
export type Route=core.Route;
export type Person=core.Person;
export type Action='rescue'|'hold'|'withdraw'|'supply'|'continue'|'reorganize';
export type Goal='all'|'leader'|'feng'|'zhang';
export interface Command {route:Route;action:Action;count:number|null;countMode:'set'|'add'|'remove'|'keep';goal:Goal;grain:number;relief:number;waitFor:core.Wait;grainMode?:'add'|'total';}
export interface Mission {action:Action;goal:Goal;}
export interface Alert {id:string;route:Route;title:string;text:string;turn:number;resolved:boolean;}
export interface Conflict {route:Route;kind:'rear'|'crowd'|'walkers';baseMen:number;helpers:number;grain:number;needGrain:number;resolved:boolean;}
export interface Order {turn:number;text:string;commands:Command[];}
export interface State {version:3;world:core.State;revision:number;missions:Record<Route,Mission|null>;queued:Partial<Record<Route,Command>>;alerts:Alert[];seen:string[];orders:Order[];conflict:Conflict|null;}
export const KEY='yiling-radio-lab-v2-20261115';
const ACTIONS:Action[]=['rescue','hold','withdraw','supply','continue','reorganize'];
const person:Record<string,Person>={fu:'傅肜',feng:'冯习',zhang:'张南',sha:'沙摩柯'};
export function fresh(seed=731115):State{return {version:3,world:core.fresh(seed),revision:0,missions:{fu:null,feng:null,sha:null},queued:{},alerts:[],seen:[],orders:[],conflict:null};}
export function validate(raw:unknown):Command[]{
 if(!Array.isArray(raw)||raw.length<1||raw.length>3)throw Error('一份军令可以安排一至三路，请说明接应对象。');
 const seen=new Set<Route>();return raw.map(x=>{if(!x||!IDS.includes(x.route)||seen.has(x.route))throw Error('请核对军令对象，一路只能有一项安排。');if(!ACTIONS.includes(x.action))throw Error('行动只能是接应、继续、坚守、重整、补粮或收队。');if(!['set','add','remove','keep'].includes(x.countMode))throw Error('人数调整须用set/add/remove/keep，抽回部分用remove。');if(!['all','leader','feng','zhang'].includes(x.goal))throw Error('goal仅支持all/leader/feng/zhang；剩下继续接应应为all。');if(!['now','fu','feng','zhang','sha'].includes(x.waitFor))throw Error('未明确等待条件时waitFor应为now。');if(x.countMode==='keep'?x.count!==null:!Number.isInteger(x.count)||x.count<0||x.count>2500)throw Error('keep的人数必须是null；其他人数须为0到2500的整数。');if([x.grain,x.relief].some(n=>!Number.isInteger(n)||n<0||n>5000))throw Error('grain和relief须为0到5000的整数，没有补粮或救济时都填0。');if(x.grainMode!==undefined&&!['add','total'].includes(x.grainMode))throw Error('请说明是另补口粮，还是出发时共带多少斤。');seen.add(x.route);if(x.route!=='feng'&&['feng','zhang'].includes(x.goal))throw Error('冯习或张南的单独接应属于旧营一路。');return {route:x.route,action:x.action,count:x.count,countMode:x.countMode,goal:x.goal,grain:x.grain,relief:x.relief,waitFor:x.waitFor,...(x.grainMode?{grainMode:x.grainMode}:{})};});
}
function ready(s:State,c:Command){return c.waitFor==='now'||s.world.saved[person[c.waitFor]]!==undefined;}
function mission(s:State,c:Command):Mission {const old=s.missions[c.route];return {action:c.action==='supply'?(old?.action==='hold'?'hold':'rescue'):c.action==='continue'?'rescue':c.action,goal:c.action==='supply'?old?.goal||'all':c.goal};}
export function policies(w:core.State,id:Route,m:Mission,n:number,wait:core.Wait='now'):core.Policy{
 const f=w.fronts[id],finish=m.action==='withdraw'?'stop':m.goal==='leader'?(id==='fu'?'fu':id==='feng'?'feng':'sha'):m.goal==='feng'?'feng':m.goal==='zhang'?'zhang':'all';
 let mode=id==='fu'?(n>=1000?'forward':'borrow'):id==='feng'?(n>=1000?'parallel':'clear'):'east';
 if(id==='fu'&&f.work[1]>=500&&n<1000)mode='borrow';
 const need=id==='feng'?300:id==='sha'?core.guardNeed(w.turn):500;
 const guard=id==='fu'?(mode==='forward'?Math.min(500,Math.floor(n/2)):0):id==='feng'?Math.min(need,Math.floor(n*.7)):Math.min(need,n);
 return {troops:n,mode,guard,native:true,package:false,finish,wait};
}
export function budget(s:State){let people=0,grain=0;for(const id of IDS){const c=s.queued[id];if(c){const add=Math.max(0,c.count!-s.world.fronts[id].men);people+=add;grain+=add+c.grain+c.relief;}}return {people,grain};}
function prepare(s:State){const w=clone(s.world);w.queued={};const held:Route[]=[];
 for(const id of IDS){const f=w.fronts[id],m=s.missions[id];f.factor=1;f.riskBonus=0;if(m&&f.status==='active'){f.policy=policies(w,id,m,f.men);if(m.action==='hold')held.push(id);}}
 for(const id of IDS){const c=s.queued[id];if(!c)continue;const m=mission(s,c);core.queue(w,id,policies(w,id,m,c.count!,c.waitFor));if(ready(s,c)){const i=held.indexOf(id);if(i>=0)held.splice(i,1);if(m.action==='hold'||m.action==='reorganize')held.push(id);}}
 return {world:w,held};
}
export function pending(s:State){return s.alerts.filter(a=>!a.resolved&&s.world.fronts[a.route].status==='active');}
export function conflictText(s:State){const c=s.conflict;if(!c||c.resolved)return '';const spent=c.helpers?`已增援${c.helpers}人。`:'';const relief=c.grain?`已救济${c.grain}斤。`:'';
 const situation=c.kind==='rear'?'侧翼追兵逼近原掩护点。现队要兼顾新掩护点，接后阵会变慢。':c.kind==='crowd'?'旧营又汇来一批饥饿散兵。军吏要兼顾收拢，原来的后队会走慢。':'西沟又找到一批饥饿部众。现队要保林口，兼顾他们会拖慢搜寻。';
 const help=Math.max(Math.min(1,c.helpers/400),c.needGrain?c.grain/c.needGrain:0),rate=Math.round((.5+.5*help)*100);
 return situation+spent+relief+`可再派${Math.max(0,400-c.helpers)}人接手${c.needGrain?`，或发${Math.max(0,c.needGrain-c.grain)}斤救济粮让散兵自行跟队`:''}；也可让现队先重整1回合，下轮自动恢复接应。照旧执行：本冲突使接应效率降至${rate}%${c.kind==='rear'?`，受挫概率另加${25*(1-help)}个百分点`:''}。少量增援或救济只能部分缓解。`;

}
export function preview(s:State,raw:unknown){const cs=validate(raw),copy=clone(s);if(s.world.ended)throw Error('本次接应已经结束。');
 for(const c of cs){const f=copy.world.fronts[c.route];if(f.status!=='active')throw Error(`${META[c.route].name}一路已经收队，不能再次派遣。`);const old=copy.queued[c.route]?.count??f.men;const n=c.action==='withdraw'?0:c.countMode==='keep'?old:c.countMode==='add'?old+c.count!:c.countMode==='remove'?old-c.count!:c.count!;
  if(n<0||n>2500)throw Error('调遣后人数超出本次兵力，请核对增援或撤回数量。');
  if(c.action==='supply'&&copy.queued[c.route]?.action==='withdraw')throw Error('这一路已排定收队，不能追加口粮；请先明确改变收队安排。');
  if(n===0&&c.action!=='withdraw')throw Error('请说明派多少人；这一路目前还没有接应兵。');
  if(c.action==='withdraw'&&(c.grain||c.relief))throw Error('收队与送粮不能放在同一路同一份军令里。');
  if(c.action==='supply'&&!s.missions[c.route]&&!copy.queued[c.route])throw Error('这一路还没有接应队，请先说明派兵安排。');
  if(c.action==='supply'&&!c.grain&&!c.relief)throw Error('请说明送多少斤粮，以及送给接应队还是新增散兵。');
  const conflict=copy.conflict;if(c.relief&&(!conflict||conflict.resolved||conflict.route!==c.route||!conflict.needGrain))throw Error('当前没有可用粮草解决的新增散兵请示；口粮请送给接应队。');
  if(c.relief&&conflict&&c.relief>conflict.needGrain-conflict.grain)throw Error(`这批人还需${conflict.needGrain-conflict.grain}斤救济粮，请勿重复发放。`);
  if(c.action==='reorganize'&&(!conflict||conflict.resolved||conflict.route!==c.route))throw Error('这一路没有待重整的任务冲突；若要暂缓接人，可以下令坚守。');
  const previous=copy.queued[c.route];
  if(c.action==='supply'&&previous?.action==='withdraw')throw Error('这一路已经排定收队；请先明确取消收队，再安排接应和送粮。');
  const carriedBack=n<f.men?Math.floor(f.food*(f.men-n)/f.men):0;
  const automatic=f.food-carriedBack+Math.max(0,n-f.men);
  if(c.grainMode==='total'&&c.grain<automatic)throw Error(`本队现有与新兵自带口粮合计至少${automatic}斤；若要额外送${c.grain}斤，请说“另补${c.grain}斤”。`);
  const grain=c.action==='withdraw'?0:c.grainMode==='total'?c.grain-automatic:(previous?.grain||0)+c.grain;
  const relief=c.action==='withdraw'?0:(previous?.relief||0)+c.relief;
  if(conflict&&relief>conflict.needGrain-conflict.grain)throw Error(`这批散兵还需${conflict.needGrain-conflict.grain}斤救济粮，已排定的救济也要计入。`);
  const keep=c.action==='supply';
  copy.queued[c.route]={...c,action:keep?(previous?.action||c.action):c.action,goal:keep?(previous?.goal||s.missions[c.route]?.goal||c.goal):c.goal,waitFor:keep&&c.waitFor==='now'?(previous?.waitFor||'now'):c.waitFor,count:n,countMode:'set',grain,relief};
  delete copy.queued[c.route]!.grainMode;
 }
 const b=budget(copy);if(b.people>s.world.camp)throw Error(`新出动共需${b.people}人，营中预备兵只有${s.world.camp}人。归营兵下回合才能调遣。`);if(b.grain>s.world.stock)throw Error(`本轮需${b.grain}斤粮草，营中只有${s.world.stock}斤。新兵每人携1斤，额外补粮与救济另计。`);
 const replacements=cs.filter(c=>s.queued[c.route]&&c.action!=='supply'&&s.queued[c.route]!.action!==copy.queued[c.route]!.action).map(c=>`${META[c.route].name}：原待执行的“${summary(s.queued[c.route]!)}”将改为“${summary(copy.queued[c.route]!)}”。`);prepare(copy);return {state:copy,commands:cs.map(c=>copy.queued[c.route]!),replacements,cost:b.grain,newTroops:b.people,expected:project(copy)};
}
export function confirm(s:State,raw:unknown,revision:number,text:string){if(revision!==s.revision)throw Error('军情或原话已经变化，请重新核对军令。');const p=preview(s,raw);s.queued=p.state.queued;const routes=p.commands.map(c=>c.route);for(const a of s.alerts)if(routes.includes(a.route)){const intent=validate(raw).find(c=>c.route===a.route)!;if(intent.action!=='supply'||intent.relief>0||(p.state.queued[a.route]?.action==='reorganize'))a.resolved=true;}s.orders.push({turn:s.world.turn,text,commands:p.commands});s.revision++;return p;}
function addAlert(s:State,id:string,route:Route,title:string,text:string){if(s.seen.includes(id)||s.world.fronts[route].status!=='active')return;s.seen.push(id);s.alerts.push({id,route,title,text,turn:s.world.turn-1,resolved:false});}
export function step(s:State,opts:{forecast?:boolean;ignoreAlerts?:boolean}={}){
 if(s.world.ended)return null;if(!opts.ignoreAlerts&&pending(s).length)throw Error('有任务冲突需要决断。询问不算回令，请明确增援、重整、收队或接受原令的后果。');
 const copy=clone(s),old=clone(copy.world),p=prepare(copy),reorg:Route[]=[];
 for(const id of IDS){const c=copy.queued[id];if(!c||!ready(copy,c))continue;const f=p.world.fronts[id];copy.missions[id]=mission(copy,c);p.world.stock-=c.grain+c.relief;f.food+=c.grain;p.world.relief+=c.relief;
  const conflict=copy.conflict;if(conflict&&!conflict.resolved&&conflict.route===id){conflict.helpers+=Math.max(0,c.count!-old.fronts[id].men);conflict.grain+=c.relief;if(conflict.helpers>=400||(conflict.needGrain>0&&conflict.grain>=conflict.needGrain))conflict.resolved=true;}
  if(c.action==='reorganize')reorg.push(id);
 }
 const conflict=copy.conflict;if(conflict&&!conflict.resolved&&!reorg.includes(conflict.route)){const f=p.world.fronts[conflict.route];const help=Math.max(Math.min(1,conflict.helpers/400),conflict.needGrain?conflict.grain/conflict.needGrain:0);f.factor=.5+.5*help;if(conflict.kind==='rear')f.riskBonus=25*(1-help);}
 const r=core.advance(p.world,{forecast:opts.forecast,hold:p.held});if(!r)return null;copy.world=p.world;
 for(const id of IDS){const c=copy.queued[id];if(c&&(ready(s,c)||copy.world.fronts[id].status!=='active'))delete copy.queued[id];}
 copy.world.queued={};copy.revision++;
 for(const id of reorg){if(copy.conflict?.route===id)copy.conflict.resolved=true;if(copy.missions[id])copy.missions[id]!.action='rescue';const line=r.lines.find(l=>l.route===id);if(line){line.text='现有队伍本轮先处理新增任务，接应进度暂缓；重整已完成，下轮自动恢复原接应。'+line.text;copy.world.fronts[id].report=line.text;}}
 // Forecasts must not reveal an incident that has not been reported in actual play.
 if(!opts.forecast&&!copy.conflict){const variant=copy.world.initialSeed%3,route:Route=variant===0?'feng':variant===1?'fu':'sha';if(copy.missions[route]&&copy.world.fronts[route].status==='active'){
  copy.conflict={route,kind:variant===0?'crowd':variant===1?'rear':'walkers',baseMen:copy.world.fronts[route].men,helpers:0,grain:0,needGrain:variant===1?0:variant===0?400:500,resolved:false};const title=variant===0?'旧营新增散兵，接应分身乏术':variant===1?'原掩护点受威胁，需要调整':'西沟又发现一批饥饿部众';const text=conflictText(copy);addAlert(copy,'task-conflict',route,title,text);const line=r.lines.find(l=>l.route===route);if(line)line.text+=' 新请示：'+title+'。请查看该路军情。';
 }}
 for(const a of copy.alerts)if(copy.world.fronts[a.route].status!=='active')a.resolved=true;
 core.invariant(copy.world);Object.assign(s,copy);return r;
}
export function project(s:State){const copy=clone(s),cost=budget(copy);const first=step(copy,{forecast:true,ignoreAlerts:true});const finish:Partial<Record<Route,number>>={},risk:Record<Route,number>={fu:0,feng:0,sha:0},maxRisk:Record<Route,number>={fu:0,feng:0,sha:0};for(const id of IDS)if(copy.world.fronts[id].status==='done')finish[id]=first?.turn;
 for(const l of first?.lines||[])risk[l.route]=maxRisk[l.route]=l.risk;
 for(let i=0;i<9&&!copy.world.ended;i++){const r=step(copy,{forecast:true,ignoreAlerts:true});for(const l of r?.lines||[])maxRisk[l.route]=Math.max(maxRisk[l.route],l.risk);for(const id of IDS)if(copy.world.fronts[id].status==='done'&&finish[id]===undefined)finish[id]=r?.turn;}
 return {first,finish,risk,maxRisk,outcomes:Object.fromEntries(IDS.map(id=>[id,copy.world.fronts[id].result])),camp:copy.world.camp,saved:Object.keys(copy.world.saved),stock:copy.world.stock,cost:cost.grain,newTroops:cost.people};
}
export function summary(c:Command){const whom=META[c.route].name;if(c.action==='withdraw')return `停止${whom}一路接应，现场队伍携余粮撤回`;const action=c.action==='hold'?'坚守现场，暂不接人':c.action==='supply'?'保持原任务':c.action==='reorganize'?'现有队伍先重整一回合，下轮自动恢复接应':c.action==='continue'?'继续原接应':'接应撤离';return `${whom}：共${c.count}人，${action}${c.goal!=='all'?'，只接'+(c.goal==='leader'?(c.route==='fu'?'傅肜':c.route==='sha'?'沙摩柯':'冯习'):c.goal==='feng'?'冯习':'张南')+'后收队':'，接齐后回来'}${c.grain?`；另给接应队送${c.grain}斤口粮`:''}${c.relief?`；给新增散兵发${c.relief}斤救济粮`:''}${c.waitFor!=='now'?'；等'+person[c.waitFor]+'脱险再执行':''}`;}
export function stage(s:State,id:Route){const f=s.world.fronts[id];if(f.status==='done')return f.result==='complete'?'已接齐并归营':'已收队';if(f.status==='returning')return '接应队归营中';if(!s.missions[id])return s.queued[id]?'已排定接应，尚未执行':'等待接应';if(s.missions[id]?.action==='hold')return '坚守现场，暂停接人';if(s.conflict?.route===id&&!s.conflict.resolved)return '新增任务尚未安排';if(id==='fu')return f.work[0]<500?'接替后阵':f.work[1]<500?'原部整队，准备接后队':'交替接回队尾';if(id==='feng')return f.work[0]<500||f.work[1]<500?'迁旗、清理退路':s.world.saved['张南']!==undefined?'张南已出，接应后队':'引导前部通过';return f.out[0]?'首批已出，接应西沟':f.work[0]>=500?'东沟已找到，接人出林':'寻找两沟部众';}
export function suggestions(s:State,id:Route){const f=s.world.fronts[id],name=META[id].name,c=s.conflict;if(c?.route===id&&!c.resolved)return [s.world.camp>=400-c.helpers?`给${name}这一路再增派${Math.max(0,400-c.helpers)}人，继续接应。`:'没有足够预备兵，怎样用现有队伍处理？',c.needGrain&&s.world.stock>=c.needGrain-c.grain?`给新增散兵发${c.needGrain-c.grain}斤救济粮，按原令继续接应。`:'照原令继续接应，接受进展放慢和额外风险。','让现有队伍先重整一回合，再自动继续接应。'];if(!s.missions[id])return [`派五百人接应${name}，接齐后回来。`,`派八百人接应${name}。`,'多派三百人能快多少，要多用多少粮？'];const need=Math.ceil(f.men/2);if(f.food<need*2)return [`给${name}的接应队补${need*2}斤口粮，继续接应。`,`从${name}这一路抽回两百人，其余继续接应。`,'不补粮继续接应，会有什么后果？'];return ['现在三路各有多少兵，粮还能撑多久？',`给${name}这一路再增派三百人。`,'停止这一路接应，带已经接到的人收队。'];}
export function restore(text:string):State|null{try{const s=JSON.parse(text) as State;if(s.version!==3||!Number.isInteger(s.revision)||s.revision<0||!s.missions||!s.queued||!Array.isArray(s.alerts)||!Array.isArray(s.seen)||!Array.isArray(s.orders))return null;const w=core.restore(JSON.stringify(s.world));if(!w)return null;for(const id of IDS){const m=s.missions[id];if(m&&(!ACTIONS.includes(m.action)||!['all','leader','feng','zhang'].includes(m.goal)))return null;if(s.queued[id])validate([s.queued[id]]);}for(const a of s.alerts)if(!IDS.includes(a.route)||typeof a.id!=='string'||typeof a.text!=='string'||typeof a.title!=='string'||typeof a.resolved!=='boolean')return null;const c=s.conflict;if(c&&(!IDS.includes(c.route)||!['rear','crowd','walkers'].includes(c.kind)||[c.baseMen,c.helpers,c.grain,c.needGrain].some(n=>!Number.isInteger(n)||n<0)||typeof c.resolved!=='boolean'))return null;s.world=w;const b=budget(s);if(b.people>w.camp||b.grain>w.stock)return null;return s;}catch{return null;}}
