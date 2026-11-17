import type {State,RouteId} from './engine.js';
export interface StoryState {seen:string[];pending:RouteId|null;choices:Partial<Record<RouteId,string>>;lines:{speaker:string;text:string}[];history:{time:number;speaker:string;text:string}[]}
export const opening=[{speaker:'军侯',text:'陛下已经过岭了。留下的五队兵都在营外，你来调遣。只是刚收拢回来，不能当生力军使。'},{speaker:'传令兵',text:'东边是傅将军的求援，江北还在等船。南边的人没找到沙摩柯，只带回一名向导。'},{speaker:'我',text:'把他们带来。先说眼前的情形。'}];
export function freshStory():StoryState{return {seen:[],pending:null,choices:{},lines:opening,history:opening.map(x=>({time:0,...x}))};}
export function say(s:State,lines:StoryState['lines']){s.story.lines=lines;s.story.history.push(...lines.map(x=>({time:Math.floor(s.time),...x})));}
export const EVENTS={
 fu:{title:'营门后还有伤兵',lines:[{speaker:'传令兵',text:'傅将军肯往北撤了，可伤兵还靠在营门后。他说，先把这些人接出去。'},{speaker:'军侯',text:'抬人得腾出手来。拨一份军需，让接应队多撑一阵；或者慢些撤，靠现有的人轮换。'}],choices:[{id:'carry',label:'拨军需，先把伤兵接出来',cost:1,detail:'消耗1份军需；防线恢复8，后续接应略快。'},{id:'cover',label:'让接应队轮换掩护，一起慢慢撤',cost:0,detail:'不消耗军需；后续接应慢15%，护送多12秒。'}]},
 huang:{title:'船不能一直停在明处',lines:[{speaker:'渡口军士',text:'北岸已经有人往泊点来。黄将军问，船到以后，是一批上，还是等人齐了再走？'},{speaker:'军侯',text:'分批登船快，可岸上的掩护不能先撤。也可以多留军需，稳住泊点再一起走。'}],choices:[{id:'batches',label:'分批上船，接应队留到最后',cost:0,detail:'渡运30秒；接应队必须全程护送。'},{id:'bank',label:'拨军需稳住泊点，集齐再渡',cost:1,detail:'消耗1份军需；防线恢复16，渡运50秒。'}]},
 sha:{title:'山沟里还有回应',lines:[{speaker:'向导',text:'将军找到了。西边沟里还有人应声，可他们绕不过倒木。我再回去一趟，能把人带出来。'},{speaker:'军侯',text:'追骑快到林口了。要等，就多留一点时间；先走，沟里那些人便未必赶得上。'}],choices:[{id:'search',label:'继续找，把应声的人带出来',cost:0,detail:'后续集结慢15%；找到的部众一同撤离。'},{id:'leave',label:'先护送已经会合的人',cost:0,detail:'后续集结快15%；结局保留未会合部众的去向。'}]}
} as const;
export function chooseStory(s:State,choice:string):string{
 const id=s.story.pending;if(!id)return '当前没有待定的军情。';const c=EVENTS[id].choices.find(c=>c.id===choice);if(!c)return '请重新选择。';if(s.supplies<c.cost)return '军需不足，不能这样安排。';
 s.supplies-=c.cost;s.story.choices[id]=choice;s.story.pending=null;
 const r=s.routes[id];if(choice==='carry')r.health=Math.min(100,r.health+8);if(choice==='bank')r.health=Math.min(100,r.health+16);
 const replies:Record<string,string>={carry:'明白。我让人带上担架和水，先接伤兵。傅将军那边也会知道，你没把他们丢下。',cover:'那就轮换着抬。后队没出来以前，我不让接应队走。',batches:'我去传话。先上船的人到南岸等，留岸上的人最后撤。',bank:'军需送过去，我让他们守住泊点。等人到齐了再开船。',search:'我再回沟里一趟。你们在林口等我，别让他们出来找不到人。',leave:'知道了。我把会合的人先带走。沟里的人……只盼他们还能找到别的路。'};
 say(s,[{speaker:'我',text:c.label+'。'},{speaker:id==='sha'?'向导':'军侯',text:replies[choice]}]);s.revision++;return '军令已传，按这个安排继续。';
}
export function storyWork(s:State,id:RouteId){const c=s.story.choices[id];return c==='cover'||c==='search'?.85:c==='leave'?1.15:c==='carry'?1.1:1;}
export function storyEvac(s:State,id:RouteId,base:number){const c=s.story.choices[id];return c==='cover'?base+12:c==='batches'?30:c==='bank'?50:base;}
export function updateStory(s:State){
 if(!s.story.pending){for(const id of ['fu','huang','sha'] as RouteId[]){if(s.routes[id].status==='active'&&s.routes[id].progress>=35&&!s.story.seen.includes(id)){s.story.seen.push(id);s.story.pending=id;say(s,[...EVENTS[id].lines]);break;}}}
 for(const id of ['fu','huang','sha'] as RouteId[]){const r=s.routes[id],key='end-'+id;if(['saved','lost'].includes(r.status)&&!s.story.seen.includes(key)){s.story.seen.push(key);if(!s.story.pending)say(s,ending(s,id));}}
}
export function ending(s:State,id:RouteId){const r=s.routes[id];if(r.status==='active'||r.status==='evacuating')return [];if(r.status==='lost')return [{speaker:'传令兵',text:id==='fu'?'东路断了。最后回来的人说，傅将军还在营门边。后面的消息……没人能带出来。':id==='huang'?'泊点让吴军占了，船靠不过去。黄将军还在江北，我们接不上他了。':'林口已经封住。向导走了两遍，都没找到能过去的地方。'}];
 if(id==='fu')return [{speaker:'傅肜',text:'陛下无恙就好。营门后的伤兵呢？'},{speaker:'军侯',text:s.story.choices.fu==='cover'?'都接到后面了，走得慢些。接应的弟兄轮换着抬，没先走。':'都在后面。你先坐下，我叫人来裹伤。'}];
 if(id==='huang')return [{speaker:'黄权',text:'我在北岸一直看着江面。看见船头转过来，才敢让后队往下撤。'},{speaker:'军侯',text:'先清点人。留岸上掩护的弟兄，也得一个个接过来。'}];
 return [{speaker:'沙摩柯',text:s.story.choices.sha==='leave'?'这边的人到了。沟里没跟上的那些，我还得想办法找。':'向导把沟里的人也带来了。他说林口有人等着，他们才肯往外走。'}];
}
export function missionStage(s:State,id:RouteId){const r=s.routes[id];if(r.status==='saved')return '已脱险';if(r.status==='lost')return '接应失利';if(r.status==='evacuating')return id==='huang'?'渡江中':'护送后队';if(!s.units.some(u=>u.route===id&&u.state==='field'))return '等待接应队';if(r.progress<35)return id==='fu'?'打开营门出口':id==='huang'?'联络与稳住泊点':'搜索失散部众';if(s.story.pending===id)return '等待你的决定';if(r.progress>=100&&id==='huang'&&s.boat.state!=='north')return '已集结 · 等待船队';return id==='fu'?'转移伤兵':id==='huang'?'组织登船':'集结与会合';}
