import {freshStory,updateStory,storyWork,storyEvac,type StoryState} from './story.js';
import {advanceOrders,type MilitaryTask} from './orders.js';
export type RouteId='fu'|'huang'|'sha';
export type Task='rescue'|'hold'|'feint';
export type Approach='direct'|'safe';
export const VERSION=2;
export const LIMIT=480;
export const IDS:RouteId[]=['fu','huang','sha'];
export const TASKS:Record<Task,string>={rescue:'接应撤离',hold:'支援坚守',feint:'佯攻牵制'};
export const DATA={
 fu:{name:'傅肜',place:'东面营门',scene:'east',color:'#b9693d',quote:'“西路不能丢，陛下还在前面。”',brief:'两次突围被逼回。伤兵仍在营内，吴军援队在附近游动。',base:1.65,travel:36,evac:38,tactic:'传达御驾平安',effect:'接应队抵达后传令：撤离效率提高30%。',questions:[['为何一直向西突围？','将军只看见陛下往西去了，后来的改道没人告诉他。你若有确切消息，我愿意带回去。'],['吴军哪里可以调动？','西坡那面旗一直在。方才北口打得紧，旗下面就分了一队过去。再往后的事，我没看清。']]},
 huang:{name:'黄权',place:'江北泊点',scene:'river',color:'#397c92',quote:'“船若到了，岸上总得有人守。”',brief:'北岸退路将断。接应队搭小舟往返；成建制撤回须另派运输船队。',base:1.25,travel:48,evac:50,tactic:'约定分批登船',effect:'接应队抵达后联络：渡运时间由50秒缩为30秒。',questions:[['船到了就能撤吗？','岸上还得留人。黄将军说，船靠岸的时候最乱，没人挡住吴兵，谁都走不了。'],['怎样缩短渡运？','先把上船的次序告诉他们。别等船来了，才在人堆里找各队的领头人。']]},
 sha:{name:'沙摩柯',place:'南面山林',scene:'south',color:'#62805b',quote:'“林中还有弟兄，别把他们落下。”',brief:'失散部众藏在山林。派兵搜索集结，追骑正在沿大路逼近。',base:1.45,travel:28,evac:32,tactic:'请向导分段会合',effect:'接应队抵达后布置：搜索集结效率提高30%。',questions:[['为什么迟迟不能会合？','人散在几条沟里，有的还在躲追兵。我认得路，得进去带他们，光在外面喊没用。'],['哪条路不易撞上追骑？','走林子慢，可马追不进来。大路倒是快，你们若走那边，就得防着骑兵。']]}
} as const;
export interface Route {id:RouteId;health:number;progress:number;status:'active'|'evacuating'|'saved'|'lost';tactic:boolean;asked:number[];evacLeft:number;evacTotal:number;reason:string;warned:boolean;supplied:boolean}
export interface Unit {id:number;name:string;kind:string;strength:number;fatigue:number;route:RouteId|null;task:Task;approach:Approach;state:'camp'|'travel'|'field'|'return';remaining:number;duration:number;autoRetreat:boolean;loss:number}
export interface Report {time:number;text:string;kind:'order'|'good'|'danger'|'intel'}
export interface Snapshot {time:number;health:number[];progress:number[]}
export interface State {version:number;time:number;started:boolean;ended:boolean;routes:Record<RouteId,Route>;units:Unit[];reserve:RouteId|null;nextReserve:RouteId|null;reserveDue:number;nextDecision:number;boat:{state:'camp'|'out'|'north'|'back';left:number};reports:Report[];history:Snapshot[];commands:number;revision:number;supplies:number;tasks:MilitaryTask[];receipts:string[];story:StoryState;conversations:{route:RouteId;question:string;reply:string;time:number}[]}
export const clamp=(n:number,a=0,b=100)=>Math.max(a,Math.min(b,n));
export function fresh():State{const routes={} as Record<RouteId,Route>;for(const id of IDS)routes[id]={id,health:id==='fu'?72:id==='huang'?85:68,progress:0,status:'active',tactic:false,asked:[],evacLeft:0,evacTotal:0,reason:'',warned:false,supplied:false};return {version:VERSION,time:0,started:false,ended:false,routes,units:['甲队','乙队','丙队','丁队','戊队'].map((name,id)=>({id,name,kind:id===0?'盾兵':id===4?'轻卒':'步卒',strength:500,fatigue:0,route:null,task:'rescue',approach:'direct',state:'camp',remaining:0,duration:0,autoRetreat:true,loss:0})),reserve:'fu',nextReserve:null,reserveDue:0,nextDecision:65,boat:{state:'camp',left:0},reports:[{time:0,text:'三路同时求援。御驾已脱险；五支接应队、一支船队听候调遣。',kind:'intel'}],history:[],commands:0,revision:0,supplies:4,tasks:[],receipts:[],story:freshStory(),conversations:[]};}
export function report(s:State,text:string,kind:Report['kind']='intel'){s.reports.unshift({time:Math.floor(s.time),text,kind});s.reports=s.reports.slice(0,120);}
export function power(u:Unit){return u.strength/500*(1-u.fatigue*.005);}
export function field(s:State,id:RouteId){return s.units.filter(u=>u.route===id&&u.state==='field');}
export function pressure(s:State,id:RouteId){return DATA[id].base+(s.time>=240?.3:0)+(s.time>=360?.25:0)+(s.reserve===id?.85:0);}
export function rates(s:State,id:RouteId){
 const r=s.routes[id],us=field(s,id),enemy=pressure(s,id);
 const defense=us.reduce((n,u)=>n+power(u)*(u.task==='hold'?(u.kind==='盾兵'?2.1:1.8):u.task==='feint'?.75:1),0);
 const rescuers=us.filter(u=>u.task==='rescue');
 const work=rescuers.reduce((n,u)=>n+power(u)*(u.approach==='safe'?.9:1),0);
 const modifier=r.tactic&&id!=='huang'?1.3:1;
 const speed=.36*work*modifier*storyWork(s,id)*Math.min(1.1,1.65/enemy);
 return {enemy,defense,health:Math.max(-.025,(enemy-defense)*.22),progress:speed};
}
export function travelTime(u:Unit,id:RouteId,a:Approach){return Math.round((DATA[id].travel+(a==='safe'?18:0))*(u.kind==='轻卒'?.8:1)*(1+u.fatigue/200));}
export function ask(s:State,id:RouteId,q:number):string{
 if(!Number.isInteger(q)||q<0||q>1)return '请选一条军情。';
 const r=s.routes[id];if(!r.asked.includes(q)){r.asked.push(q);report(s,`${DATA[id].name}军报：${DATA[id].questions[q][1]}`,'intel');}
 return DATA[id].questions[q][1];
}
export function tactic(s:State,id:RouteId):string{if(s.ended||s.routes[id].status!=='active')return '这一路已不能追加军令。';s.routes[id].tactic=!s.routes[id].tactic;s.commands++;s.revision++;report(s,`${DATA[id].name}：${s.routes[id].tactic?DATA[id].tactic:'撤销附加军令'}。`,'order');return '军令已更新，接应队到场后执行。';}
export function deploy(s:State,unitIds:number[],id:RouteId,task:Task,a:Approach,autoRetreat=true):string{
 if(s.ended||s.routes[id].status!=='active')return '该路已结束接应，请选择其他方向。';
 const units=[...new Set(unitIds)].map(i=>s.units.find(u=>u.id===i));
 if(!units.length||units.some(u=>!u))return '先选一支队伍。';
 if(units.some(u=>u!.state!=='camp'&&!(u!.state==='field'&&u!.route===id)))return '跨路转调需先撤回；行军中的队伍可召回。';
 if(units.some(u=>u!.strength<100))return '该队伤亡过重，无法再次出战。';
 for(const u of units as Unit[]){u.task=task;u.approach=a;u.autoRetreat=autoRetreat;u.route=id;if(u.state==='camp'){u.state='travel';u.duration=travelTime(u,id,a);u.remaining=u.duration;}}
 s.commands++;s.revision++;report(s,`${units.map(u=>u!.name).join('、')} → ${DATA[id].name}，${TASKS[task]}，${a==='safe'?'绕行保全':'直路急援'}。`,'order');return '军令已下达。';
}
export function recall(s:State,i:number,reason='奉令撤回'){
 const u=s.units.find(u=>u.id===i);if(!u||!u.route||u.state==='camp'||u.state==='return'||s.ended)return;
 const r=s.routes[u.route];if(r.status==='evacuating')return;
 const fraction=u.state==='travel'?1-u.remaining/u.duration:1;
 u.duration=Math.max(4,Math.round(travelTime(u,u.route,u.approach)*fraction));u.remaining=u.duration;u.state='return';report(s,`${u.name}${reason}，约${u.duration}秒归营。`,'order');s.commands++;
}
export function sendBoat(s:State):string{
 if(s.ended||s.routes.huang.status==='saved'||s.routes.huang.status==='lost')return '江北接应已经结束。';
 if(s.boat.state!=='camp')return '船队已在执行渡运。';
 s.boat={state:'out',left:45};s.commands++;s.revision++;report(s,'船队离开南岸，45秒后抵达江北泊点。','order');return '船队已出发。';
}
function returnUnits(s:State,id:RouteId){for(const u of s.units.filter(u=>u.route===id&&u.state!=='camp'&&u.state!=='return')){u.state='return';u.duration=DATA[id].travel;u.remaining=u.duration;}}
function finishRoute(s:State,id:RouteId,saved:boolean,reason:string){const r=s.routes[id];r.status=saved?'saved':'lost';r.reason=reason;report(s,`${DATA[id].name}：${reason}`,saved?'good':'danger');returnUnits(s,id);if(id==='huang'&&s.boat.state!=='camp')s.boat={state:'back',left:35};}
function reserveDecision(s:State){
 const active=IDS.filter(id=>s.routes[id].status==='active'||s.routes[id].status==='evacuating');
 if(!active.length)return;
 const scored=active.map(id=>({id,score:field(s,id).reduce((n,u)=>n+(u.task==='feint'?5:1)*power(u),0)+(id===s.reserve?-.2:0)})).sort((a,b)=>b.score-a.score);
 const target=scored[0].id;
 if(target!==s.reserve){s.nextReserve=target;s.reserveDue=s.time+20;report(s,`吴军援队正转向${DATA[target].place}，20秒后抵达。其他方向将出现空隙。`,'danger');}
 else report(s,`吴军援队继续压住${DATA[target].place}。可在另一方向牵制调动。`,'intel');
 s.nextDecision=s.time+65;
}
export function tick(s:State,seconds:number){
 if(!s.started||s.ended||!Number.isFinite(seconds)||seconds<=0||s.story.pending)return;
 let left=Math.min(seconds,LIMIT+1);while(left>0&&!s.ended&&!s.story.pending){const dt=Math.min(1,left);left-=dt;step(s,dt);}
}
function step(s:State,dt:number){
 advanceOrders(s);const previous=s.time;s.time=Math.min(LIMIT,s.time+dt);
 if(s.nextReserve&&s.time>=s.reserveDue){s.reserve=s.nextReserve;s.nextReserve=null;report(s,`吴军援队抵达${DATA[s.reserve].place}，当地压力上升。`,'danger');}
 if(s.time>=s.nextDecision)reserveDecision(s);
 for(const u of s.units){
  if(u.state==='camp'){u.fatigue=clamp(u.fatigue-dt*.45);continue;}
  if(u.state==='travel'||u.state==='return'){
   // Returning escorts remain with the rescued group until the evacuation finishes.
   u.remaining=Math.max(0,u.remaining-dt);u.fatigue=clamp(u.fatigue+dt*.025);
   if(u.remaining===0){if(u.state==='return'){u.state='camp';u.route=null;report(s,`${u.name}归营，剩余${Math.round(u.strength)}人，正在整顿。`,'good');}else{u.state='field';report(s,`${u.name}抵达${DATA[u.route!].place}，开始${TASKS[u.task]}。`,'good');}}
  }
 }
 if(s.boat.state==='out'||s.boat.state==='back'){s.boat.left=Math.max(0,s.boat.left-dt);if(s.boat.left===0){s.boat.state=s.boat.state==='out'?'north':'camp';report(s,s.boat.state==='north'?'船队抵达北岸，等待黄权部集结。':'船队已回南岸。','good');}}
 for(const id of IDS){
  const r=s.routes[id];if(r.status==='saved'||r.status==='lost')continue;
  const rr=rates(s,id),us=field(s,id);
  r.health=clamp(r.health-rr.health*dt);
  for(const u of us){
   const dmg=rr.enemy*.12*(u.approach==='safe'?.48:1)*(u.task==='hold'?.65:1)*(r.status==='evacuating'?.65:1)*dt;
   u.strength=Math.max(0,u.strength-dmg);u.loss+=dmg;u.fatigue=clamp(u.fatigue+dt*(u.task==='hold'?.09:.15));
   if(u.autoRetreat&&(u.strength<220||u.fatigue>=85)&&r.status==='active')recall(s,u.id,'达到保全条件，自动撤回');
  }
  if(r.health<=0){finishRoute(s,id,false,id==='huang'?'泊点失守，联络中断。':id==='sha'?'追骑封住林口，部众失散。':'后阵被冲散，未能接出傅肜。');continue;}
  if(r.health<30&&!r.warned){r.warned=true;report(s,`${DATA[id].name}已危急！增派坚守队可减缓恶化。`,'danger');}
  if(r.status==='evacuating'){
   // Escorts protect the column; abandoning other active fronts still has a cost.
   r.evacLeft=Math.max(0,r.evacLeft-dt);
   if(r.evacLeft===0)finishRoute(s,id,true,id==='fu'?'傅肜与伤兵已到接应线。':id==='huang'?'黄权部渡江脱险。':'沙摩柯与失散部众已会合脱险。');
  }else{
   r.progress=clamp(r.progress+rr.progress*dt);
   if(r.progress>=100){
    if(id==='huang'&&s.boat.state!=='north'){if(previous%10<dt)report(s,'黄权部已集结，正在等船；请派出船队。','danger');}
    else{r.status='evacuating';r.evacTotal=storyEvac(s,id,id==='huang'&&r.tactic?30:DATA[id].evac);r.evacLeft=r.evacTotal;report(s,`${DATA[id].name}开始${id==='huang'?'登船':'撤离'}，还需${r.evacTotal}秒；接应队继续掩护。`,'good');}
   }
  }
 }
 if(previous<240&&s.time>=240)report(s,'更多吴军逼近，各路基础压力上升。不要让疲惫的队伍独撑。','danger');
 if(previous<360&&s.time>=360)report(s,'最后两分钟：追军加紧封路，请集中完成尚未撤出的接应。','danger');
 if(Math.floor(previous/5)!==Math.floor(s.time/5))s.history.push({time:Math.floor(s.time),health:IDS.map(id=>s.routes[id].health),progress:IDS.map(id=>s.routes[id].progress)});
 if(s.time>=LIMIT){for(const id of IDS){if(!['saved','lost'].includes(s.routes[id].status))finishRoute(s,id,false,'撤离窗口关闭，未完成接应。');}s.ended=true;}
 if(IDS.every(id=>['saved','lost'].includes(s.routes[id].status)))s.ended=true;
 updateStory(s);advanceOrders(s);
 if(s.ended)report(s,`本次接应结束：${IDS.filter(id=>s.routes[id].status==='saved').length}/3路脱险。`,'good');
}
export function restore(raw:string):State|null{
 try{const s=JSON.parse(raw) as State;if(s.version!==VERSION||!Number.isFinite(s.time)||s.time<0||s.time>LIMIT||!Array.isArray(s.units)||s.units.length!==5||!Array.isArray(s.reports)||!Array.isArray(s.history))return null;
 if(!s.story||!Array.isArray(s.tasks)||!Array.isArray(s.receipts)||!Array.isArray(s.conversations)||!Number.isFinite(s.supplies)||!Number.isInteger(s.revision))return null;
 if(!s.boat||!['camp','out','north','back'].includes(s.boat.state)||!Number.isFinite(s.boat.left))return null;
 if(!IDS.every(id=>{const r=s.routes?.[id];return r&&['active','evacuating','saved','lost'].includes(r.status)&&Number.isFinite(r.health)&&Number.isFinite(r.progress)&&Array.isArray(r.asked);}))return null;
 if(!s.units.every(u=>['camp','travel','field','return'].includes(u.state)&&Number.isFinite(u.strength)&&Number.isFinite(u.fatigue)&&(u.route===null||IDS.includes(u.route))))return null;return s;}catch{return null;}
}
