export type RouteId='fu'|'huang'|'cheng'|'sha';
export type Point={x:number;y:number};
export type Squad={id:number;hp:number;phase:'idle'|'moving'|'working'|'returning'|'exhausted';target:RouteId|null;pos:Point;from:Point;to:Point;travel:number;duration:number};
export type Route={id:RouteId;name:string;place:string;pos:Point;deadline:number;progress:number;status:'waiting'|'active'|'saved'|'lost';eventSeen:boolean;resolved:boolean;changed:boolean;changeResolved:boolean;boat:boolean;loss:number;work:number;note:string};
export type FieldEvent={key:string;route:RouteId;change:boolean;speaker:string;text:string;facts:string[];concern:string;example:string;reply:string;effect:string};
export type State={version:1;time:number;paused:boolean;ended:boolean;speed:number;squads:Squad[];routes:Route[];event:FieldEvent|null;log:{time:number;text:string}[];reinforcements:number;changeFired:boolean;variant:number};
export const CAMP:Point={x:12,y:78};
export const ROUTE_META=[
 {id:'fu',name:'傅肜',place:'后阵山口',pos:{x:77,y:22},deadline:183,boat:false,loss:1.65,work:.77,note:'伤兵未尽，后阵还在苦战。'},
 {id:'huang',name:'黄权',place:'江北营地',pos:{x:30,y:25},deadline:240,boat:true,loss:1.1,work:.67,note:'归路隔绝，江北将士等着接应。'},
 {id:'cheng',name:'程畿',place:'江上船队',pos:{x:74,y:67},deadline:205,boat:true,loss:1.5,work:.82,note:'追兵紧逼，船上还有同行的伤员。'},
 {id:'sha',name:'沙摩柯',place:'南面林口',pos:{x:43,y:55},deadline:160,boat:false,loss:1.4,work:.86,note:'部众走散，他仍在林口找人。'}
] as const;
export function createState(variant=0):State{return {version:1,time:0,paused:true,ended:false,speed:1,squads:Array.from({length:5},(_,i)=>newSquad(i+1)),routes:ROUTE_META.map(r=>({...r,pos:{...r.pos},progress:0,status:'waiting',eventSeen:false,resolved:false,changed:false,changeResolved:false})),event:null,log:[{time:0,text:'刘备已退至接应营。还有四路人马没有回来。'}],reinforcements:0,changeFired:false,variant};}
export function newSquad(id:number):Squad{return {id,hp:100,phase:'idle',target:null,pos:{...CAMP},from:{...CAMP},to:{...CAMP},travel:0,duration:0};}
export function addLog(s:State,text:string){s.log.unshift({time:Math.floor(s.time),text});s.log=s.log.slice(0,70);}
export function routeBy(s:State,id:RouteId){return s.routes.find(r=>r.id===id)!;}
export function freeBoats(s:State){return 2-s.routes.filter(r=>r.boat&&s.squads.some(q=>q.target===r.id&&['moving','working','returning'].includes(q.phase))).length;}
function journey(q:Squad,to:Point,phase:'moving'|'returning'){q.from={...q.pos};q.to={...to};q.travel=0;q.duration=6+Math.hypot(to.x-q.pos.x,to.y-q.pos.y)*.18;q.phase=phase;}
export function deploy(s:State,id:number,target:RouteId):string|null{
 if(s.ended)return '这一轮接应已经结束。';
 const q=s.squads.find(q=>q.id===id),r=routeBy(s,target);
 if(!q||q.phase!=='idle'||q.hp<=0)return '这支队伍尚未归营。';
 if(r.status==='saved'||r.status==='lost')return '此处接应已经结束。';
 const held=s.squads.some(q=>q.target===target&&['moving','working','returning'].includes(q.phase));
 if(r.boat&&!held&&freeBoats(s)<1)return '接应船正在途中，等船回来后再派。';
 q.target=target;journey(q,r.pos,'moving');r.status='active';addLog(s,`${id}队（500人）出发接应${r.name}。`);return null;
}
export function recall(s:State,id:number):string|null{if(s.ended)return '接应已经结束。';const q=s.squads.find(q=>q.id===id);if(!q||!['moving','working'].includes(q.phase))return '这支队伍无需撤回。';journey(q,CAMP,'returning');addLog(s,`${id}队奉命撤回；已完成的接应进度保留。`);return null;}
export function eventFor(id:RouteId,change=false):FieldEvent{
 const shared={key:id+(change?'-change':'-arrival'),route:id,change};
 if(change)return {...shared,speaker:'报信军士',text:'追兵绕到了接应路上。现在继续硬顶，弟兄们怕是撑不住。人已经接出一部分，接下来怎么走？',facts:['原来的退路仍通，但追兵增多。','附近有已经核实的山口，可掩护撤离。','现有兵力与船队都未增加。'],concern:'提出利用现有队伍掩护、避开追兵或增援接应的具体安排，不要求唯一措辞。',example:'不要追击，让现有队伍守住已查明的山口，掩护接出的人先走，随后一起撤。',reply:'明白。我们守住山口，只接人，不追敌。最后一队撤下时再一道回营。',effect:'接应恢复，损伤降至原来的65%。'};
 const events:Record<RouteId,Omit<FieldEvent,'key'|'route'|'change'>>={
 fu:{speaker:'傅肜',text:'前头的伤兵还没有过去，我这里一撤，追兵就压上来了。你带来的人打算怎么接？',facts:['伤兵可以沿已查明的退路撤离。','下一道山口可由接应队掩护。','傅肜要带断后余部一起走，不肯独自离开。'],concern:'安排伤兵撤离，并给断后部队提供接应或掩护；承认合理的简短方案，不要求固定次序。',example:'我的人护送伤兵通过，守住下一道山口接应。你带断后的弟兄撤过来，接到后一起走。',reply:'好。伤兵过了，你的人接住后阵，我就带剩下的弟兄撤。别再让他们回头追敌。',effect:'开始交替掩护，接应加快，部队损伤降低。'},
 huang:{speaker:'黄权',text:'先上船的人能走，最后留下掩护的将士怎么办？若只接我一个，我不能答应。',facts:['两岸可以使用回号核实接应。','营救面向全体将士。','最后一批需要留船和接收安排。'],concern:'安排全体将士分批接应，并给最后一批留下可信的退路；合理承诺未来部署有效。',example:'接应面向全军，两岸以回号核实。留船接最后一批掩护将士，收到到岸回信后再撤接应队。',reply:'有最后一批的船，我便组织将士依次过江。两岸核对回号，人未到齐，接应不要撤。',effect:'江北开始分批渡运，接应加快，部队损伤降低。'},
 cheng:{speaker:'程畿',text:'旁边几条船还载着伤员。只接我上船，他们就要落到后面。你能把大家一并带走么？',facts:['接应船已经随队抵达。','可利用已查明的水道撤离。','同行伤员需要一并转移，追击会拖住撤离。'],concern:'安排同行伤员和程畿一并撤离，同时提出水上掩护或避免追击的办法。',example:'先接伤员，你和同行的人一起转到接应船。由现有队伍掩护，沿已查明的水道撤，不回头追击。',reply:'先把伤员扶过去。我招呼其余的人跟上，你们掩护住后面的船，我们一道走。',effect:'船队一起脱离，接应加快，部队损伤降低。'},
 sha:{speaker:'沙摩柯',text:'西边回来的人里没有他们。我得回林子里找，不能把他们丢在这里。',facts:['部众最后出现在林口东侧。','有熟悉部众的人可带路。','西侧有已查明的集合处。'],concern:'提出寻找失散部众和共同撤离的办法；可让沙摩柯带路或留在集合处，不强制唯一方案。',example:'让熟悉路的人带我的队伍去找，在西侧集合。你接住回来的人，我们掩护大家一起撤。',reply:'我把认得路的人叫来。找回的人往西侧集合，我在那里等，大家一起走。',effect:'开始寻找并集中部众，接应加快，部队损伤降低。'}
 };return {...shared,...events[id]};
}
export function applyDialogue(s:State,accepted:boolean,reply:string):boolean{
 const e=s.event;if(!e)return false;addLog(s,`${e.speaker}：${reply}`);
 if(!accepted)return false;const r=routeBy(s,e.route);if(e.change){r.changeResolved=true;r.note='已调整掩护，接应继续。';}else{r.resolved=true;r.note=e.effect;}s.event=null;s.paused=true;return true;
}
export function offlineReply(e:FieldEvent,text:string):{reply:string;accepted:boolean}{
 const normalize=(x:string)=>x.replace(/[\s，。！？、；：,.!?;:]/g,'');
 if(normalize(text)===normalize(e.example))return {reply:e.reply,accepted:true};
 return {reply:'离线演示不会判断自由发言。你的原话已保留；可使用参考说法查看接应变化，或切换真实AI继续。',accepted:false};
}
export function tick(s:State,dt:number){
 if(s.paused||s.event||s.ended||dt<=0)return;
 dt=Math.min(dt,.25);s.time=Math.min(240,s.time+dt);
 const rein=Math.min(5,Math.floor(s.time/32));while(s.reinforcements<rein){s.reinforcements++;s.squads.push(newSquad(5+s.reinforcements));addLog(s,'500名增援到营，可拖动新队伍出发。');}
 for(const q of s.squads){if(!['moving','returning'].includes(q.phase))continue;q.travel=Math.min(q.duration,q.travel+dt);const t=q.travel/q.duration;q.pos={x:q.from.x+(q.to.x-q.from.x)*t,y:q.from.y+(q.to.y-q.from.y)*t};if(t>=1){if(q.phase==='moving'){q.phase='working';addLog(s,`${q.id}队抵达${routeBy(s,q.target!).name}处。`);}else{q.phase='idle';q.target=null;q.pos={...CAMP};}}}
 for(const r of s.routes){if(['saved','lost'].includes(r.status))continue;
  if(s.time>=r.deadline){r.status='lost';r.note=r.id==='huang'?'归路未能落实，黄权率部另寻出路。':'未能赶上接应，未归者留在了乱军之中。';addLog(s,`${r.name}：${r.note}`);for(const q of s.squads.filter(q=>q.target===r.id&&['moving','working'].includes(q.phase)))journey(q,CAMP,'returning');continue;}
  const qs=s.squads.filter(q=>q.target===r.id&&q.phase==='working');if(!qs.length)continue;
  if(!r.eventSeen&&r.progress>=18){r.eventSeen=true;s.event=eventFor(r.id);s.paused=true;return;}
  if(s.time>=72&&!s.changeFired&&r.resolved&&r.progress<80){s.changeFired=true;r.changed=true;r.note='追兵压近，等待调整接应。';s.event=eventFor(r.id,true);s.paused=true;return;}
  const unhandled=(r.eventSeen&&!r.resolved)||(r.changed&&!r.changeResolved);
  const speed=r.work*Math.min(3,qs.length)*(r.resolved?1.3:1)*(.55+.45*qs.reduce((a,q)=>a+q.hp/100,0)/qs.length);
  if(!unhandled)r.progress=Math.min(100,r.progress+dt*speed);
  const damage=r.loss*(r.resolved?.6:1)*(r.changed&&!r.changeResolved?1.45:1)*(r.changeResolved?.65:1)/Math.pow(qs.length,.65);
  for(const q of qs){q.hp=Math.max(0,q.hp-dt*damage);if(q.hp<=0){q.phase='exhausted';q.target=null;addLog(s,`${q.id}队已失去接应能力，无法再调动。`);}}
  if(r.progress>=100){r.status='saved';r.note=r.id==='huang'?'最后一批将士已过江，黄权归来。':`${r.name}与同行部众已接出，正在返回。`;addLog(s,r.note);for(const q of s.squads.filter(q=>q.target===r.id&&q.hp>0&&['moving','working'].includes(q.phase)))journey(q,CAMP,'returning');}
 }
 if(s.routes.every(r=>['saved','lost'].includes(r.status))&&!s.squads.some(q=>['moving','working','returning'].includes(q.phase))){s.ended=true;s.paused=true;addLog(s,'接应结束，归营队伍已经点齐。');}
}
export function snapshotValid(value:unknown):value is State{
 const s=value as State;return !!s&&s.version===1&&typeof s.time==='number'&&Number.isFinite(s.time)&&s.time>=0&&s.time<=240&&Array.isArray(s.routes)&&s.routes.length===4&&s.routes.every(r=>ROUTE_META.some(x=>x.id===r.id)&&Number.isFinite(r.progress))&&new Set(s.routes.map(r=>r.id)).size===4&&Array.isArray(s.squads)&&s.squads.length>=5&&s.squads.length<=10&&s.squads.every(q=>Number.isFinite(q.hp)&&q.hp>=0&&q.hp<=100&&Number.isFinite(q.pos?.x)&&Number.isFinite(q.pos?.y));
}
