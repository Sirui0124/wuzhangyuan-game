
export const IDS=['a','b','c','d'] as const;
export type Id=typeof IDS[number];
export type Node='camp'|'cross'|'rear'|'campfire'|'side'|'ridge'|'east'|'west';
export type Command={units:Id[];action:'rescue'|'move'|'attack'|'hold'|'retreat'|'rest';target:Node;via?:'normal'|'side'|'ridge';rush?:boolean;slow?:boolean;seconds?:number;route?:Node[]};
export type Unit={id:Id;men:number;stamina:number;at:Node;pos:[number,number];status:'idle'|'moving'|'working'|'fighting'|'resting'|'home';task:(Command & {route:Node[]})|null;resume:Command|null;path:Node[];pending:{cmd:Command;due:number}|null;cargo:string[];restTo:number;reported:{at:Node;time:number;men:number;stamina:number;status:string;location?:string;pos?:[number,number]};damage:number;approach:string};
export type ReportLog={time:number;speaker:string;text:string;important:boolean;node?:Node};
export type State={version:1;time:number;revision:number;started:boolean;ended:boolean;units:Record<Id,Unit>;goals:Record<string,{node:Node;need:number;deadline:number;work:number;carrier:Id|null;safe:boolean;lost:boolean}>;enemy:Record<'rear'|'campfire',{hp:number;known:boolean}>;logs:{time:number;speaker:string;text:string;important:boolean;node?:Node}[];radio:{due:number;units:Id[];topic:string}[];losses:number};
export const NAMES:Record<Id,string>={a:'甲队',b:'乙队',c:'丙队',d:'丁队'};
export const NODES:Record<Node,{name:string;x:number;y:number}>={camp:{name:'接应营',x:17,y:83},cross:{name:'岔口',x:44,y:64},rear:{name:'后阵',x:85,y:39},campfire:{name:'旧营',x:62,y:53},side:{name:'南侧路',x:52,y:74},ridge:{name:'东岭',x:92,y:58},east:{name:'东沟',x:40,y:69},west:{name:'西沟',x:29,y:56}};
export const GOALS={fu:{node:'rear' as Node,need:55,deadline:265,name:'傅肜及断后部众'},zhang:{node:'campfire' as Node,need:45,deadline:355,name:'张南与前队'},feng:{node:'campfire' as Node,need:50,deadline:355,name:'冯习及后队'},east:{node:'east' as Node,need:35,deadline:440,name:'沙摩柯与东沟部众'},west:{node:'west' as Node,need:55,deadline:440,name:'西沟伤兵'}};
export const clone=<T>(x:T):T=>structuredClone(x);
const point=(n:Node):[number,number]=>[NODES[n].x,NODES[n].y];
const dist=(a:[number,number],b:[number,number])=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function log(s:State,speaker:string,text:string,important=false,node?:Node){const id=IDS.find(id=>NAMES[id]===speaker);if(id){const u=s.units[id];u.reported={at:node??u.at,time:s.time,men:u.men,stamina:u.stamina,status:stateName(u),location:reportedLocation(u),pos:clone(u.pos)};}s.logs.push({time:s.time,speaker,text,important,node});s.revision++;}
export function fresh():State{return {version:1,time:0,revision:0,started:false,ended:false,units:Object.fromEntries(IDS.map(id=>[id,{id,men:{a:700,b:800,c:600,d:400}[id],stamina:100,at:'camp',pos:[17,83],status:'idle',task:null,resume:null,path:[],pending:null,cargo:[],restTo:0,reported:{at:'camp',time:0,men:{a:700,b:800,c:600,d:400}[id],stamina:100,status:'待命'},damage:0,approach:'normal'}])) as unknown as Record<Id,Unit>,goals:Object.fromEntries(Object.entries(GOALS).map(([key,g])=>[key,{...g,work:0,carrier:null,safe:false,lost:false}])),enemy:{rear:{hp:470,known:false},campfire:{hp:280,known:false}},logs:[],radio:[],losses:0};}
export function stateName(u:Unit){return u.status==='idle'?'待命':u.status==='home'?'已归营':u.status==='resting'?'正在休整':u.status==='moving'?'行军途中':u.status==='working'?'正在接应':'遭遇敌军，接应受阻';}
export function info(s:State,id:Id){const u=s.units[id];return `${NAMES[id]} ${Math.ceil(u.men)}人，${u.stamina>=70?'尚有余力':u.stamina>=35?'已有些疲惫':'已经疲惫'}，${stateName(u)}。`;}
function reportedLocation(u:Unit){if(dist(u.pos,point(u.at))<1)return NODES[u.at].name;const target=(u.status==='resting'||u.status==='idle'?u.resume:u.task)?.target;return NODES[u.at].name+(target&&target!==u.at?'至'+NODES[target].name+'途中':'附近');}
function advancePosition(u:Unit,target:Node){const goal=NODES[target],d=Math.hypot(u.pos[0]-goal.x,u.pos[1]-goal.y),amount=Math.min(d,.7*(u.task?.rush?1.65:u.task?.slow?.7:1)*(u.stamina<35?.65:1));if(d<.01){u.pos=[goal.x,goal.y];u.at=target;return true;}u.pos=[u.pos[0]+(goal.x-u.pos[0])*amount/d,u.pos[1]+(goal.y-u.pos[1])*amount/d];u.stamina=Math.max(0,u.stamina-(u.task?.rush?.44:u.task?.slow?.035:.065));if(amount>=d-.01){u.at=target;return true;}return false;}
function makeRoute(u:Unit,to:Node,via='normal'){if(via==='side'&&to==='campfire'&&u.at==='side')return ['campfire'] as Node[];if(via==='ridge'&&to==='rear'&&u.at==='ridge')return ['rear'] as Node[];const stops=via==='side'&&to==='campfire'?['cross','side','campfire'] as Node[]:via==='ridge'&&to==='rear'?['cross','ridge','rear'] as Node[]:[to];return stops.filter(n=>dist(u.pos,point(n))>1);}
function underFire(s:State,u:Unit){return u.status!=='moving'&&dist(u.pos,point(u.at))<1.5&&(u.at==='rear'||u.at==='campfire')&&!(u.at==='campfire'&&u.approach==='side')&&s.enemy[u.at as 'rear'|'campfire'].hp>0;}
function check(s:State,cs:Command[]){if(s.ended||!cs.length||cs.length>4)throw Error('请选择当前部队和目标。');const seen=new Set<Id>();for(const c of cs){if(!NODES[c.target]||!['rescue','move','attack','hold','retreat','rest'].includes(c.action))throw Error('军令行动不明确。');for(const id of c.units){if(!IDS.includes(id)||seen.has(id)||s.units[id].men<=0)throw Error('请选择有效部队。');seen.add(id);const u=s.units[id];if(underFire(s,u)&&c.target!==u.at&&!['attack','retreat','rest','hold'].includes(c.action))throw Error('遭射击时不能普通移动；应突击、撤退或请求增援。');if(c.action==='rest'&&underFire(s,u))throw Error('遭射击时不能休整。可以突击或撤退，也可以派另一队支援。');}}}
function depart(s:State,u:Unit,c:Command){c={...c,rush:c.rush??u.task?.rush??false,slow:c.slow??u.task?.slow??false};
 if(c.action==='hold'){u.resume=clone(u.task);u.task=null;u.status=underFire(s,u)?'fighting':'idle';return;}if(c.action==='rest'){u.resume=clone(u.task);u.task={...c,target:u.at,route:[]};u.restTo=s.time+(c.seconds||45);u.status='resting';return;}
 if(c.action==='retreat'){u.resume=null;c={...c,target:'camp'};}else u.resume=null;
 const target=c.target;if(dist(u.pos,point(target))<1){u.at=target;u.task={...c,route:[]};u.approach=c.via||'normal';u.status='working';arrive(s,u);return;}
 u.task={...c,route:makeRoute(u,target,c.via)};u.approach=c.via||'normal';u.status='moving';}
function arrive(s:State,u:Unit){
 const c=u.task!;
 if(u.at==='ridge'&&s.enemy.rear.hp>0&&!s.enemy.rear.known){s.enemy.rear.known=true;log(s,NAMES[u.id],'东岭可看见后阵。吴军正在压阵脚，山脊这面尚未被封住，可以从侧面接应。',true,'ridge');}
 if(u.at==='camp'){u.status='home';u.task=null;log(s,NAMES[u.id],'本队已到营门，清点归营人员。',false,'camp');return;}
 if(underFire(s,u)){s.enemy[u.at as 'rear'|'campfire'].known=true;u.status='fighting';log(s,NAMES[u.id],u.at==='rear'?'傅肜：后阵正在接敌。接替的人守住阵脚，等后队过隘口再撤。':'旧营军士：营门遭射击，伤兵还在木栅后。南侧路可绕行。',true,u.at);return;}
 if(c.action==='move'||c.action==='hold'){u.task=null;u.status='idle';log(s,NAMES[u.id],`已到${NODES[u.at].name}，原地待命。`,false,u.at);return;}
 u.status='working';log(s,NAMES[u.id],`已到${NODES[u.at].name}，开始接应。`,false,u.at);
}
function collectGoal(s:State,u:Unit,key:string){
 const g=s.goals[key];g.carrier=u.id;u.cargo.push(key);const words:Record<string,string>={zhang:'张南：前队已经接上，冯将军还在后面收最后的伤兵。接应队先别撤。',fu:'傅肜：后面还有换防的弟兄。让他们跟上，我最后走。',feng:'冯习：最后一副担架也过来了。让前队跟紧，别走散。',east:'沙摩柯：东沟的人找到了，西沟还有伤兵。先去找他们。',west:'军士：西沟的担架接出来了，正在往林口走。'};log(s,'前线',words[key],false,u.at);
 if(key==='zhang'&&!s.goals.feng.carrier&&!s.goals.feng.lost)depart(s,u,{units:[u.id],action:'rescue',target:'campfire',via:u.approach as 'side'|'normal',rush:u.task?.rush});else if(key==='east'&&!s.goals.west.carrier&&!s.goals.west.lost)depart(s,u,{units:[u.id],action:'rescue',target:'west',rush:u.task?.rush});else depart(s,u,{units:[u.id],action:'retreat',target:'camp',rush:u.task?.rush});
}
export function confirm(s:State,commands:Command[]){check(s,commands);s.started=true;for(const c of commands)for(const id of c.units){depart(s,s.units[id],clone(c));log(s,NAMES[id],'收到军令，开始执行。');}}
function one(s:State){
 const start=s.logs.length;s.time++;
 for(const u of Object.values(s.units))if(u.pending&&u.pending.due<=s.time){const c=u.pending.cmd;u.pending=null;depart(s,u,c);}
 for(const u of Object.values(s.units)){
 if(u.men<=0)continue;if((u.status==='idle'||u.status==='home')&&!underFire(s,u))u.stamina=Math.min(100,u.stamina+.85);if(u.status==='moving'){if(advancePosition(u,u.task!.route[0])){u.task!.route.shift();if(!u.task!.route.length){u.status='working';arrive(s,u);}}continue;}
 if(u.status==='resting'){u.stamina=Math.min(100,u.stamina+.85);if(s.time>=u.restTo){u.task=u.resume?{...u.resume,route:u.resume.route||[]}:null;u.resume=null;u.status=u.task?(u.task.route.length?'moving':'working'):'idle';log(s,NAMES[u.id],'休整结束，自动恢复原任务。');}continue;}}
 for(const node of ['rear','campfire'] as const){const enemy=s.enemy[node],fighters=Object.values(s.units).filter(u=>u.men>0&&u.at===node&&dist(u.pos,point(node))<1.5&&u.status!=='moving'&&!(u.at==='campfire'&&u.approach==='side'));if(!fighters.length||enemy.hp<=0)continue;
 const flank=fighters.some(u=>u.approach==='ridge')&&fighters.some(u=>u.approach!=='ridge'),power=fighters.reduce((sum,u)=>sum+u.men*u.stamina/100*(u.task?.action==='attack'?1.6:.3)*(flank?1.7:1),0);
 let harm=0;for(const u of fighters){const hit=enemy.hp*.0018*(u.task?.action==='attack'?1.1:.3)/fighters.length;u.damage+=hit;if(u.damage>=1){const lost=Math.floor(u.damage);u.men=Math.max(0,u.men-lost);s.losses+=lost;u.damage-=lost;}}enemy.hp=Math.max(0,enemy.hp-power*.015);if(enemy.hp<=0){log(s,'军侯',`${NODES[node].name}的敌军已退开，继续接应。`,false,node);for(const u of fighters){u.status=!u.task||u.task.action==='hold'||u.task.action==='move'?'idle':'working';log(s,NAMES[u.id],`敌军已退开，本队现有${Math.ceil(u.men)}人。`,false,node);}}}
 for(const u of Object.values(s.units)){if(u.status!=='working'||!u.task)continue;const key=Object.keys(GOALS).find(k=>s.goals[k].node===u.at&&!s.goals[k].carrier&&!s.goals[k].lost&&!s.goals[k].safe);if(!key){if(!['rescue','attack'].includes(u.task.action)){u.status='idle';continue;}if(u.at==='east'&&!s.goals.west.carrier&&!s.goals.west.lost)depart(s,u,{units:[u.id],action:'rescue',target:'west',rush:u.task.rush});else depart(s,u,{units:[u.id],action:'retreat',target:'camp',rush:u.task.rush});continue;}const g=s.goals[key];g.work+=u.men/700*Math.max(.6,u.stamina/100)*(u.approach==='side'?.8:1);if(g.work>=GOALS[key as keyof typeof GOALS].need)collectGoal(s,u,key);}
 for(const u of Object.values(s.units))if(dist(u.pos,point('camp'))<1&&u.cargo.length){for(const key of u.cargo){s.goals[key].safe=true;log(s,'军侯',`${GOALS[key as keyof typeof GOALS].name}已归营。`,false);}u.cargo=[];u.task=null;u.status='home';}
 for(const q of s.radio.filter(q=>q.due<=s.time))for(const id of q.units){const u=s.units[id];u.reported={at:u.at,time:s.time,men:u.men,stamina:u.stamina,status:stateName(u),location:reportedLocation(u),pos:clone(u.pos)};log(s,NAMES[id],q.topic==='position'?`现报位置：${u.status==='moving'?'前往'+NODES[u.task!.target].name+'途中':NODES[u.at].name}。${info(s,id)}`:q.topic==='story'?story(s,id):info(s,id),false,u.at);}s.radio=s.radio.filter(q=>q.due>s.time);
 for(const key of Object.keys(GOALS)){const g=s.goals[key];if(!g.carrier&&!g.safe&&!g.lost&&s.time>g.deadline){g.lost=true;log(s,'军侯',`${GOALS[key as keyof typeof GOALS].name}的窗口已关闭，未能接上。`,true,g.node);}}
 const all=Object.values(s.goals).every(g=>g.safe||g.lost),home=Object.values(s.units).every(u=>u.men<=0||dist(u.pos,point('camp'))<1);if((all&&home)||s.time>=610){s.ended=true;log(s,'军侯',`接应结束。将领${savedCount(s)}/4，部众${batchCount(s)}/3，接应兵减员${s.losses}人。`,true);}return s.logs.slice(start);
}
export function tick(s:State,seconds=1):State["logs"]{if(!s.started)return [];let out:State["logs"]=[];for(let i=0;i<Math.min(700,seconds)&&!s.ended;i++)out.push(...one(s));return out;}
export function nextReport(s:State):ReportLog[]{if(!s.started||s.ended)return [];const out:ReportLog[]=[];for(let i=0;i<610&&!s.ended;i++){out.push(...one(s));if(out.length)break;}return out;}
export function inquire(s:State,units:Id[],topic:string){for(const id of units){const u=s.units[id];log(s,NAMES[id],topic==='story'?story(s,id):topic==='position'?`位置回报：${u.status==='moving'?'正向'+NODES[u.task!.target].name+'行军':reportedLocation(u)}。${info(s,id)}`:info(s,id),false,u.at);}}
export const savedCount=(s:State)=>Number(s.goals.fu.safe)+Number(s.goals.zhang.safe)+Number(s.goals.feng.safe)+Number(s.goals.east.safe);
export const batchCount=(s:State)=>Number(s.goals.fu.safe)+Number(s.goals.zhang.safe&&s.goals.feng.safe)+Number(s.goals.east.safe&&s.goals.west.safe);
export function story(s:State,id:Id){
 const u=s.units[id],key=u.cargo[0],target=u.task?.target||u.at;
 if(key==='fu'||target==='rear')return '傅肜：接替的人都退过隘口了吗？等最后那队过来，你们再撤，我的人守着。';
 if(key==='feng')return '冯习：旗已收回，最后的伤兵也接上了，前队先走，我随后队。';if(key==='zhang'||target==='campfire')return s.goals.zhang.carrier||s.goals.zhang.safe?'张南：前队已经过去了。冯将军还在后面收伤兵，接应队先别撤。':'张南：前队还在营门里。冯将军在后头等最后那批伤兵。';
 if(key==='east'||key==='west'||target==='east'||target==='west')return key==='west'?'五溪军士：西沟的担架也带出来了，沙将军在林口等。':'沙摩柯：我的人分在两沟，报的是东沟，西沟还有伤兵，不能丢下。';
 return '接应军士：后阵、旧营和两沟都有自己的人等着。先报去向，到位再回信。';
}
export function openingReports(s:State){if(s.logs.length)return;s.logs.push({time:0,speaker:'军侯',text:'御驾已脱险。四支接应队听你调遣，先接上各路将士，再一同回营。',important:false},{time:0,speaker:'断后军士',text:'傅将军还在后阵。回去换下他的人，还得有人替我们守退路。',important:false},{time:0,speaker:'旧营军士',text:'张将军带前队，冯将军收后队，伤兵还在木栅后面。先把路接通，再分批带走。',important:false},{time:0,speaker:'五溪向导',text:'沙将军在东沟认人。西沟的担架得走两个人抬，我带你们去找。',important:false});}
export function restore(text:string):State|null{try{const s=JSON.parse(text) as State;if(s.version!==1||!Number.isFinite(s.time)||s.time<0||s.time>610||!IDS.every(id=>s.units[id])||!Object.keys(GOALS).every(k=>s.goals?.[k]))return null;const total=Object.values(s.units).reduce((sum,u)=>sum+u.men,0)+s.losses;if(Math.abs(total-2500)>.01)return null;return s;}catch{return null;}}

