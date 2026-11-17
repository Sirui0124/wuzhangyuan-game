export const IDS=['fu','feng','sha'] as const;
export type Route=typeof IDS[number];
export type Person='傅肜'|'冯习'|'张南'|'沙摩柯';
export type Finish='all'|'hold'|'fu'|'feng'|'zhang'|'sha'|'stop';
export type Wait='now'|'fu'|'feng'|'zhang'|'sha';
export interface Policy {troops:number;mode:string;guard:number;native:boolean;package:boolean;finish:Finish;wait:Wait;}
export interface Front {men:number;status:'active'|'returning'|'done';result:'open'|'complete'|'partial'|'lost';policy:Policy;work:number[];out:boolean[];supply:boolean;loss:number;report:string;}
export interface Return {route:Route;men:number;due:number;risk:number;}
export interface Line {route:Route;text:string;risk:number;loss:number;jobs:string[];}
export interface Receipt {turn:number;camp:number;stock:number;lines:Line[];saved:Person[];}
export interface State {version:1;turn:number;revision:number;seed:number;initialSeed:number;camp:number;stock:number;losses:number;fronts:Record<Route,Front>;queued:Partial<Record<Route,Policy>>;returns:Return[];saved:Partial<Record<Person,number>>;history:Receipt[];ended:boolean;commands:number;}
export const META:Record<Route,{name:string;role:string;place:string;deadline:number;image:string;x:number;y:number;brief:string}>={
 fu:{name:'傅肜',role:'后阵督将',place:'东路后阵 → 隘口',deadline:6,image:'east',x:85,y:61,brief:'后阵还未撤下。接替的人也要有退路：另派兵先守隘口，或让傅肜原部退到隘口后整队一回合，再回身接应。'},
 feng:{name:'冯习 · 张南',role:'统军主将 · 前部将领',place:'旧营 → 侧路 → 营后坡地',deadline:7,image:'camp',x:58,y:58,brief:'军旗还在旧营，侧路堵着车和伤兵。迁旗与清路都完成后，留下人维持岔口，其余人引导撤军。张南前队先过，冯习收住后队。'},
 sha:{name:'沙摩柯',role:'五溪首领',place:'东沟 / 西沟 → 共用林口',deadline:8,image:'south',x:48,y:80,brief:'东沟有沙摩柯，西沟还有一批伤兵。熟路军士可以慢慢搜寻；另派兵能加快。找到之后下一回合才出林，出口必须有人接。第4回合需500人守口，第6回合需700人。'}
};
export const clone=<T>(x:T):T=>structuredClone(x);
export function defaultPolicy(id:Route):Policy{return {troops:0,mode:id==='fu'?'borrow':id==='feng'?'clear':'east',guard:id==='sha'?500:id==='fu'?500:300,native:true,package:false,finish:'all',wait:'now'};}
export function fresh(seed=731115):State{return {version:1,turn:1,revision:0,seed:seed>>>0,initialSeed:seed>>>0,camp:2500,stock:8,losses:0,fronts:Object.fromEntries(IDS.map(id=>[id,{men:0,status:'active',result:'open',policy:{...defaultPolicy(id),native:false},work:[0,0,0],out:[false,false],supply:false,loss:0,report:META[id].brief}])) as Record<Route,Front>,queued:{},returns:[],saved:{},history:[],ended:false,commands:0};}
export function validatePolicy(id:Route,raw:unknown):Policy{
 const p=raw as Policy;
 const modes=id==='fu'?['forward','borrow']:id==='feng'?['parallel','clear','flag']:['east','west','both'];
 const finishes=id==='fu'?['all','hold','fu','stop']:id==='feng'?['all','hold','feng','zhang','stop']:['all','hold','sha','stop'];
 if(!p||!Number.isInteger(p.troops)||p.troops<0||p.troops>2500||!Number.isInteger(p.guard)||p.guard<0||p.guard>2500||!modes.includes(p.mode)||!finishes.includes(p.finish)||!['now','fu','feng','zhang','sha'].includes(p.wait)||typeof p.native!=='boolean'||typeof p.package!=='boolean')throw Error('人数、分工或执行条件不完整。');
 if((id==='fu'&&p.wait==='fu')||(id==='feng'&&['feng','zhang'].includes(p.wait))||(id==='sha'&&p.wait==='sha'))throw Error('不能让本路先等自己脱险，再开始救援。');
 if(p.guard>p.troops&&p.troops>0&&p.finish!=='stop'&&!(id==='fu'&&p.mode==='borrow'))throw Error('留守人数超过本路总人数，请调整分工。');
 return {troops:p.troops,mode:p.mode,guard:p.guard,native:p.native,package:p.package,finish:p.finish,wait:p.wait};
}
export function packageUseful(s:State,id:Route){const f=s.fronts[id];return !f.supply&&(id==='fu'?f.work[2]<500:id==='feng'?f.work[2]<1000:f.work[1]<1000&&!f.out[1]);}
export function budget(s:State,orders=s.queued){let people=0,stock=0;for(const id of IDS){const p=orders[id];if(!p)continue;const f=s.fronts[id],n=p.finish==='stop'?0:p.troops;people+=Math.max(0,n-f.men);stock+=Math.ceil(Math.max(0,n-f.men)/500)+Number(p.package);}return {people,stock};}
export function queue(s:State,id:Route,raw:unknown,revision=s.revision){
 if(s.ended||s.fronts[id].status!=='active')throw Error('这一路已在收队或已结束，不能再派兵。');
 if(revision!==s.revision)throw Error('安排已经变化，请重新核对军令。');
 const p=validatePolicy(id,raw);if(p.package&&!packageUseful(s,id))throw Error('这项物资已用过，或相应工作已经做完。');
 if(p.package&&p.troops===0)throw Error('需要现场有接应兵才能使用专项物资。');
 const q={...s.queued,[id]:p},b=budget(s,q);
 const target:Record<string,Route>={fu:'fu',feng:'feng',zhang:'feng',sha:'sha'};
 for(const start of IDS){const visited=new Set<Route>();let at:Route|undefined=start;while(at){if(visited.has(at))throw Error('几路军令互相等待，无法开始，请至少让一路先执行。');visited.add(at);const wait:Wait|undefined=q[at]?.wait;at=wait&&wait!=='now'&&s.saved[people[wait]]===undefined?target[wait]:undefined;}}
 if(b.people>s.camp)throw Error(`本轮新出动需${b.people}人，待命只有${s.camp}人；归营中的兵下回合才能调用。`);
 if(b.stock>s.stock)throw Error(`本轮共需${b.stock}份军需，现有${s.stock}份。`);
 s.queued=q;s.revision++;s.commands++;
}
export function removeQueued(s:State,id:Route){delete s.queued[id];s.revision++;}
const people:Record<Exclude<Wait,'now'>,Person>={fu:'傅肜',feng:'冯习',zhang:'张南',sha:'沙摩柯'};
export function ready(s:State,p:Policy){return p.wait==='now'||s.saved[people[p.wait]]!==undefined;}
export function guardNeed(turn:number){return turn<4?300:turn<6?500:700;}
export function exposure(actual:number,need:number){return need<=0||actual>=need?0:actual>=need*.6?25:actual>0?50:100;}
function rnd(s:State){s.seed=(Math.imul(1664525,s.seed)+1013904223)>>>0;return s.seed/4294967296;}
function mark(s:State,name:Person){s.saved[name]??=s.turn;}
function addWork(f:Front,i:number,n:number,goal:number){const gain=Math.min(Math.max(0,goal-f.work[i]),Math.max(0,n),1000);f.work[i]+=gain;return gain;}
function returning(s:State,id:Route,result:Front['result'],risk=0,immediate=false){const f=s.fronts[id];if(f.men>0)s.returns.push({route:id,men:f.men,due:s.turn+(immediate?0:1),risk});f.men=0;f.status='returning';f.result=result;}
function applyQueued(s:State,initialSaved:State['saved']){const logs:Partial<Record<Route,string>>={};for(const id of IDS){const p=s.queued[id];if(!p)continue;if(p.wait!=='now'&&initialSaved[people[p.wait]]===undefined){logs[id]=`待令：等${people[p.wait]}脱险。兵与军需额度已留，不提前执行。`;continue;}
 const f=s.fronts[id];const desired=p.finish==='stop'?0:p.troops,added=Math.max(0,desired-f.men),removed=Math.max(0,f.men-desired),cost=Math.ceil(added/500)+Number(p.package);
 if(added>s.camp||cost>s.stock){logs[id]='待令：当前兵力或军需不足，旧部署继续。';continue;}
 s.camp-=added;s.stock-=cost;if(removed)s.returns.push({route:id,men:removed,due:s.turn,risk:p.finish==='stop'&&id==='fu'&&f.work[0]>=500&&f.work[2]<500?50:0});f.men=desired;f.policy={...p,package:false,wait:'now'};if(p.package)f.supply=true;delete s.queued[id];
 if(p.finish==='stop'){f.status='returning';f.result=(Object.keys(s.saved).length&&((id==='fu'&&s.saved['傅肜']!==undefined)||(id==='feng'&&(s.saved['冯习']!==undefined||s.saved['张南']!==undefined))||(id==='sha'&&s.saved['沙摩柯']!==undefined)))?'partial':'lost';logs[id]='已停止本路接应，现场队伍本回合撤回；未接出者仍未接出。';}
 }return logs;}
export function advance(s:State,options:{forecast?:boolean;hold?:Route[]}={}){
 if(s.ended)return null;
 const turn=s.turn,initialSaved=clone(s.saved),orderLogs=applyQueued(s,initialSaved),lines:Line[]=[];
 // Fixed draws per front and turn keep the same battlefield shocks when comparing policies.
 const rolls=Object.fromEntries(IDS.map(id=>[id,rnd(s)])),returnRolls=Object.fromEntries(IDS.map(id=>[id,rnd(s)]));
 for(const id of IDS){const f=s.fronts[id];if(f.status!=='active'){if(orderLogs[id])lines.push({route:id,text:orderLogs[id]!,risk:0,loss:0,jobs:[]});continue;}
 const p=f.policy,old=[...f.work],oldOut=[...f.out],jobs:string[]=[];let risk=0,complete=false;let text=orderLogs[id]||'';
 const job=(t:string)=>jobs.push(t);
 if(options.hold?.includes(id)){risk=f.men?exposure(f.men,id==='sha'?guardNeed(turn):id==='fu'?500:300):0;text='部队奉令稳住现场，暂不推进接应。';job(f.men+'人坚守，等待下一道军令');}
 else if(id==='fu'){
  const guard=p.mode==='forward'?Math.min(f.men,p.guard):0,workers=p.mode==='forward'?f.men-guard:f.men;
  if(old[0]<500){const g=addWork(f,0,workers,500);if(g)job(`${workers}人换防，完成${g}/500工作量`);if(workers)risk=exposure(workers,500);}
  if(p.mode==='forward'&&old[1]<500){const g=addWork(f,1,guard,500);if(g)job(`${guard}人准备隘口，完成${g}/500`);}
  if(p.native&&old[0]>=500&&old[1]<500){addWork(f,1,500,500);job('傅肜原部在隘口整队，本轮结束可回身掩护');}
  const crossGoal=f.supply?300:500;
  if(old[0]>=500&&old[1]>=500){const cover=p.mode==='borrow'&&p.native?500:guard;const movers=p.mode==='borrow'?f.men:workers;risk=Math.max(risk,exposure(cover,500));if(cover>0&&movers>0){const g=addWork(f,2,movers,crossGoal);job(`${cover===guard?guard+'名接应兵':'傅肜原部'}掩护，${movers}人接队尾，完成${g}/${crossGoal}`);}}
  if(p.finish==='fu'&&f.work[0]>=500){mark(s,'傅肜');text='傅肜先随原部离开，接替队仍在后阵，退路尚未交接。';}
  complete=f.work[2]>=crossGoal;if(complete){mark(s,'傅肜');text='傅肜与队尾已过隘口，最后掩护队也撤下。';}
  else if(!text)text=f.work[0]<500?'后阵正在换防，已接替的缺口保留。':f.work[1]<500?'傅肜已退到隘口，接替队仍守后阵，等隘口整队。':'隘口已经准备好，后队按旗号交替撤。';
 }else if(id==='feng'){
  if(old[0]<500||old[1]<500){let flag=0,clear=0;if(p.mode==='parallel'&&old[0]<500&&old[1]<500){flag=Math.floor(f.men/2);clear=f.men-flag;}else if(p.mode==='flag'&&old[0]<500)flag=f.men;else if(old[1]<500)clear=f.men;else flag=f.men;
   if(old[0]<500){const g=addWork(f,0,flag+(p.native?250:0),500);if(g)job(`${flag}名接应兵${p.native?'与原军吏':''}迁旗，完成${g}/500`);}
   if(old[1]<500){const g=addWork(f,1,clear,500);if(g)job(`${clear}人清侧路，完成${g}/500`);}
  }else{
   const need=f.supply?200:300,guard=Math.min(f.men,p.guard),escort=Math.max(0,f.men-guard),goal=f.supply?500:1000;
   risk=exposure(guard,need);if(guard>0&&escort>0){const g=addWork(f,2,escort,goal);job(`${guard}人引导岔口，${escort}人护送，完成${g}/${goal}`);}
   if(p.finish==='feng'&&f.men>=100){mark(s,'冯习');job('先由原部护送冯习离开，旗与军吏仍留在收兵点');}
   if(f.work[2]>=goal/2)mark(s,'张南');complete=f.work[2]>=goal;if(complete)mark(s,'冯习');
  }
  text=complete?'冯习与后续部众已通过，岔口最后留守的人准备收队。':s.saved['张南']!==undefined?'张南与前队已脱险，冯习仍在收后队。':f.work[0]>=500&&f.work[1]>=500?'新旗已立，侧路已清，下一步需留人分流、护送队伍通过。':f.work[1]>=500?'侧路已清，原军吏还在迁旗；前部暂等新旗。':f.work[0]>=500?'旗已移到坡上，侧路仍有车和伤兵。':'迁旗和清路正在进行，两项已做的工作都会保留。';
 }else{
  const guard=Math.min(f.men,p.guard),workers=f.men-guard,need=guardNeed(turn);risk=(f.men>0||f.work.some(n=>n>0))?exposure(guard,need):0;
  for(const i of [0,1])if(old[i]>=(i===0?500:f.supply?750:1000)&&!oldOut[i]&&guard>0){f.out[i]=true;job(`${i===0?'东':'西'}沟部众通过林口`);if(i===0)mark(s,'沙摩柯');}
  const targets=p.mode==='west'?[1,0]:[0,1],unfinished=targets.filter(i=>old[i]<(i===0?500:f.supply?750:1000));
  if(unfinished.length){const primary=unfinished[0];for(const i of unfinished){const assigned=p.mode==='both'&&unfinished.length===2?(i===primary?Math.floor(workers/2):workers-Math.floor(workers/2)):i===primary?workers:0;const local=i===primary&&p.native?250:0;const g=addWork(f,i,assigned+local,i===0?500:f.supply?750:1000);if(g)job(`${assigned}名接应兵${local?'与本部熟路军士':''}搜${i===0?'东':'西'}沟，完成${g}/${i===0?500:f.supply?750:1000}`);}}
  complete=f.out.every(Boolean);text=complete?'两沟已知待接部众均通过林口，最后守口队可以撤回。':f.out[0]?'沙摩柯与首批已脱险，西沟部众仍需接应。':f.work[0]>=500?'东沟已经接上，下一回合可过林口；出口仍需守住。':'熟路军士正在沟内搜寻，找到之后仍需通过林口。';
  if(guard===0&&f.work.some(n=>n>0))text+=' 林口无人接应，出林暂停。';
 }
 let loss=0;const roll=rolls[id];if(!options.forecast&&f.men>0&&risk>0&&roll<risk/100){loss=Math.min(f.men,risk<=25?25:50);f.men-=loss;f.loss+=loss;s.losses+=loss;text+=` 本轮${loss}人负伤或掉队，退出可用兵力。`;}
 const stopPerson=p.finish==='fu'?'傅肜':p.finish==='feng'?'冯习':p.finish==='zhang'?'张南':p.finish==='sha'?'沙摩柯':null;
 if(complete){f.result='complete';if(p.finish!=='hold'){returning(s,id,'complete');text+=' 接应队下回合归营。';}}
 else if(stopPerson&&s.saved[stopPerson]!==undefined){returning(s,id,'partial',id==='fu'?50:0);text+=' 按令先收队，其余未接出者不算获救。';}
 if(f.status==='active'&&turn>=META[id].deadline){returning(s,id,complete?'complete':'lost',complete?0:50);text+=complete?' 按末轮安排收队。':' 本路救援窗口关闭，接应队下回合紧急撤回；未接出者失联。';delete s.queued[id];}
 f.report=text;lines.push({route:id,text,risk,loss,jobs});
 }
 // Arrival is deliberately last: troops arriving this round cannot work on another front this round.
 const due=s.returns.filter(r=>r.due<=turn);s.returns=s.returns.filter(r=>r.due>turn);
 for(const r of due){let loss=0;const roll=returnRolls[r.route];if(!options.forecast&&r.risk>0&&roll<r.risk/100){loss=Math.min(50,r.men);s.losses+=loss;s.fronts[r.route].loss+=loss;}s.camp+=r.men-loss;const f=s.fronts[r.route];if(f.status==='returning'&&!s.returns.some(x=>x.route===r.route)){f.status='done';delete s.queued[r.route];}
 const suffix=`${r.men-loss}名接应兵已归营${loss?`，撤回途中${loss}人减员`:''}，下回合可调用。`;f.report=suffix;const line=lines.find(l=>l.route===r.route);if(line){line.text+=' '+suffix;line.loss+=loss;line.risk=Math.max(line.risk,r.risk);}else lines.push({route:r.route,text:suffix,risk:r.risk,loss,jobs:[]});}
 for(const id of IDS){const f=s.fronts[id];if(f.status==='returning'&&!s.returns.some(r=>r.route===id)){f.status='done';delete s.queued[id];}}
 s.ended=IDS.every(id=>s.fronts[id].status==='done');const receipt={turn,camp:s.camp,stock:s.stock,lines,saved:Object.keys(s.saved).filter(n=>s.saved[n as Person]===turn) as Person[]};s.history.push(receipt);s.turn++;s.revision++;invariant(s);return receipt;
}
export function forecast(s:State){const copy=clone(s);const receipt=advance(copy,{forecast:true});return {state:copy,receipt};}
export function invariant(s:State){const total=s.camp+s.losses+IDS.reduce((n,id)=>n+s.fronts[id].men,0)+s.returns.reduce((n,r)=>n+r.men,0);if(total!==2500||s.stock<0||s.stock>8||s.camp<0)throw Error('兵力或军需账本不守恒。');}
export function restore(text:string):State|null{try{const s=JSON.parse(text) as State;if(s.version!==1||!Number.isInteger(s.turn)||s.turn<1||s.turn>10||!Number.isInteger(s.seed)||s.seed<0||s.seed>4294967295||!Number.isInteger(s.initialSeed)||!Number.isInteger(s.revision)||!Number.isInteger(s.stock)||!Number.isInteger(s.camp)||!Number.isInteger(s.losses)||s.losses<0||typeof s.ended!=='boolean'||!Array.isArray(s.returns)||!Array.isArray(s.history)||!s.saved||typeof s.saved!=='object')return null;
 for(const id of IDS){const f=s.fronts[id];if(!f||!Number.isInteger(f.men)||f.men<0||!Number.isInteger(f.loss)||f.loss<0||!['active','returning','done'].includes(f.status)||!['open','complete','partial','lost'].includes(f.result)||typeof f.supply!=='boolean'||typeof f.report!=='string'||!Array.isArray(f.work)||f.work.length!==3||f.work.some(n=>!Number.isFinite(n)||n<0||n>1000)||!Array.isArray(f.out)||f.out.length!==2||f.out.some(x=>typeof x!=='boolean'))return null;validatePolicy(id,f.policy);if(s.queued[id])validatePolicy(id,s.queued[id]);}
 if(Object.entries(s.saved).some(([name,t])=>!['傅肜','冯习','张南','沙摩柯'].includes(name)||!Number.isInteger(t)||Number(t)<1||Number(t)>9))return null;
 for(const r of s.returns)if(!IDS.includes(r.route)||!Number.isInteger(r.men)||r.men<0||!Number.isInteger(r.due)||r.due<1||r.due>9||![0,25,50,100].includes(r.risk))return null;
 invariant(s);return s;}catch{return null;}}
export function tasks(s:State,id:Route){const f=s.fronts[id];return id==='fu'?[['换下后阵',f.work[0],500],['隘口准备',f.work[1],500],['队尾过隘',f.work[2],f.supply?300:500]] as const:id==='feng'?[['迁旗收兵',f.work[0],500],['清出侧路',f.work[1],500],['引导撤军',f.work[2],f.supply?500:1000]] as const:[['东沟联络',f.work[0],500],['西沟搜寻',f.work[1],f.supply?750:1000],['批次出林',f.out.filter(Boolean).length,2]] as const;}
export function describe(id:Route,p:Policy){const modes:Record<string,string>={forward:'分兵准备隘口，再接后队',borrow:'借原部回身接应',parallel:'迁旗、清路并行',clear:'先清侧路',flag:'先迁军旗',east:'先搜东沟',west:'先搜西沟',both:'分头搜两沟'};const ends:Record<Finish,string>={all:'接齐后归营',hold:'完成后留守',fu:'傅肜先脱险即收队',feng:'先接冯习后收队',zhang:'张南脱险即收队',sha:'沙摩柯脱险即收队',stop:'停止接应、撤回'};return `${p.finish==='stop'?'现场全部撤回':p.troops+'人；'+modes[p.mode]+'；'+(id==='fu'?(p.mode==='forward'?p.guard+'人准备并守隘口':'原部整队后掩护'):p.guard+'人守'+(id==='feng'?'岔口':'林口'))}；${p.native?'安排本部配合':'不调本部'}；${ends[p.finish]}${p.package?'；送1份专项物资':''}${p.wait!=='now'?'；等'+people[p.wait]+'脱险再执行':''}`;}
