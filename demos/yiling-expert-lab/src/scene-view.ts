import {currentStage,type StoryWorld,type RouteId} from './story-engine.js';

type CameraKey='camp'|'river'|'east'|'south'|'imperial'|'overview';
type Point={x:number;y:number;label?:string;inFrame?:boolean};
type Layout={points:Record<string,Point>;routes:Record<string,Point[]>};
type CameraLayout={cameras:Record<CameraKey,{image:string;points:Record<string,Point>}>};
type Snapshot=StoryWorld&{saved:number};
export interface SceneView{
 reportImage:string;
 update(world:Snapshot,selected:RouteId,opened:boolean,busy:boolean):void;
 renderMap(world:StoryWorld,selected:RouteId,layout:Layout):void;
 reset():void;
}
const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const keys:CameraKey[]=['camp','river','east','south','imperial','overview'];
const routes:RouteId[]=['fu','huang','cheng','sha'];
const names:Record<CameraKey,string>={camp:'大本营',river:'江岸渡口',east:'东面山路',south:'南面林地',imperial:'御营方向',overview:'接应总览'};
const descriptions:Record<CameraKey,string>={camp:'刘备御营附近的集结营。',river:'从营门下坡，望向江岸与两岸泊点。',east:'山路通向傅肜所在的后阵方向。',south:'岔路与林地之间，是沙摩柯部众失散的方向。',imperial:'近处集结营与刘备御营之间，有道路相连。',overview:'四路接应的位置与进度。'};
const alts:Record<CameraKey,string>={camp:'刘备御营附近集结营，木营门、旧布帐与发令空地',river:'从南岸营门看向长江渡口与北岸山地',east:'林木与岩壁间的东面陆路',south:'山间岔路和向南延伸的林地',imperial:'从高处望向刘备御营和附近集结营',overview:'长江两岸、集结营和御营附近的四路接应总览'};
const storageKey='yiling-camp-scene-view-v1';
const setText=(node:HTMLElement,text:string)=>{if(node.textContent!==text)node.textContent=text;};

export async function createSceneView(callbacks:{openRoute(id:RouteId):void;closeRoute():void}):Promise<SceneView>{
 const response=await fetch('/scene-view-layout.json');if(!response.ok)throw Error('场景布局未能载入。');
 const layout:CameraLayout=await response.json();
 const stage=el('scene-stage'),landscape=el<HTMLImageElement>('landscape'),nav=el('view-nav');
 let current:CameraKey='camp',generation=0,opened=false,busy=false,previousOpen=false,returnFocus:HTMLElement|null=null,showLabels=true;
 const cache=new Map<CameraKey,Promise<HTMLImageElement>>();
 try{const saved=JSON.parse(sessionStorage.getItem(storageKey)||'null');if(keys.includes(saved?.view))current=saved.view;if(saved?.labels===false)showLabels=false;}catch{}
 const persist=()=>sessionStorage.setItem(storageKey,JSON.stringify({view:current,labels:showLabels}));
 function load(key:CameraKey){
  let pending=cache.get(key);
  if(!pending){pending=(async()=>{const img=new Image();img.src=layout.cameras[key].image;await img.decode();return img;})();cache.set(key,pending);pending.catch(()=>cache.delete(key));}
  return pending;
 }
 function renderLocalMarkers(key:CameraKey){
  const markers:HTMLElement[]=[];
  if(key!=='overview')for(const [id,p]of Object.entries(layout.cameras[key].points)){
   if((key==='camp'&&id!=='dock')||(key==='east'&&id!=='fu'))continue;
   if(!p.inFrame||p.x<0.06||p.x>0.94||p.y<0.1||p.y>0.9)continue;
   const route=routes.includes(id as RouteId);
   const target:CameraKey|undefined=({dock:'river',junction:'south',camp:'camp'} as Record<string,CameraKey>)[id];
   const label=route?(p.label||'')+' · 听报':target&&target!==key?'看向'+names[target]:p.label||'';
   if(!label)continue;
   const marker=document.createElement(route||(target&&target!==key)?'button':'span');
   marker.className='local-marker';marker.style.left=p.x*100+'%';marker.style.top=p.y*100+'%';marker.textContent=label;
   if(marker instanceof HTMLButtonElement){marker.disabled=busy;marker.onclick=()=>{if(route)callbacks.openRoute(id as RouteId);else if(target)void switchView(target);};}
   markers.push(marker);
  }
  el('local-markers').replaceChildren(...markers);
 }
 async function switchView(key:CameraKey){
  if(opened||busy)return;
  const request=++generation;el('scene-error').hidden=true;el('scene-loading').hidden=false;
  stage.setAttribute('aria-busy','true');
  try{
   const image=await load(key);if(request!==generation)return;
   current=key;landscape.src=image.src;landscape.alt=alts[key];landscape.hidden=key==='overview';
   el('overview-map').hidden=key!=='overview';stage.dataset.view=key;stage.setAttribute('aria-label',alts[key]);
   setText(el('view-title'),names[key]);setText(el('view-description'),descriptions[key]);
   for(const button of Array.from(nav.querySelectorAll<HTMLButtonElement>('button[data-view]')))button.setAttribute('aria-pressed',String(button.dataset.view===key));
   renderLocalMarkers(key);persist();
  }catch{if(request===generation){el('scene-error').hidden=false;el('retry-scene').onclick=()=>void switchView(key);}}
  finally{if(request===generation){el('scene-loading').hidden=true;stage.setAttribute('aria-busy','false');}}
 }
 for(const button of Array.from(nav.querySelectorAll<HTMLButtonElement>('button[data-view]')))button.onclick=()=>void switchView(button.dataset.view as CameraKey);
 nav.addEventListener('keydown',event=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)||opened||busy)return;
  event.preventDefault();const i=keys.indexOf(current),index=event.key==='Home'?0:event.key==='End'?keys.length-1:(i+(event.key==='ArrowRight'?1:-1)+keys.length)%keys.length;
  nav.querySelector<HTMLButtonElement>(`[data-view="${keys[index]}"]`)?.focus();void switchView(keys[index]);
 });
 function applyLabels(){stage.classList.toggle('hide-labels',!showLabels);el('toggle-labels').setAttribute('aria-pressed',String(showLabels));el('toggle-labels').title=showLabels?'隐藏场景标记':'显示场景标记';}
 el('toggle-labels').onclick=()=>{showLabels=!showLabels;applyLabels();persist();};applyLabels();
 el('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await el('game-root').requestFullscreen();}catch{el('message').textContent='浏览器未能进入全屏，仍可在当前窗口继续。';}};
 document.addEventListener('fullscreenchange',()=>setText(el('fullscreen'),document.fullscreenElement?'退出全屏':'全屏'));
 document.addEventListener('keydown',event=>{
  if(!opened)return;
  if(event.key==='Escape'&&!busy){event.preventDefault();callbacks.closeRoute();return;}
  if(event.key!=='Tab')return;
  const targets=Array.from(el('event').querySelectorAll<HTMLElement>('button:not(:disabled),textarea:not(:disabled),select:not(:disabled),summary,a[href]')).filter(node=>node.getClientRects().length>0);
  if(!targets.length)return;
  const first=targets[0],last=targets[targets.length-1];
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
 });
 const cards=new Map<RouteId,{button:HTMLButtonElement;name:HTMLElement;hint:HTMLElement;flag:HTMLElement;action:HTMLElement}>();
 for(const id of routes){
  const button=document.createElement('button');button.className='route-card';button.dataset.route=id;
  const heading=document.createElement('span'),name=document.createElement('strong'),flag=document.createElement('span'),hint=document.createElement('span'),action=document.createElement('span');
  heading.className='route-card-heading';flag.className='route-flag';hint.className='route-hint';action.className='route-action';heading.append(name,flag);button.append(heading,hint,action);
  button.onclick=()=>callbacks.openRoute(id);cards.set(id,{button,name,hint,flag,action});el('route-cards').append(button);
 }
 const mapButtons=new Map<string,HTMLButtonElement|HTMLSpanElement>(),lines=new Map<string,SVGPolylineElement>(),units=new Map<string,SVGCircleElement>();
 let mapReady=false;
 function renderMap(world:StoryWorld,selected:RouteId,map:Layout){
  if(!mapReady){
   for(const [key,p]of Object.entries(map.points)){
    const route=routes.includes(key as RouteId),destination:CameraKey|undefined=({camp:'camp',imperial:'imperial',dock:'river',north:'river'} as Record<string,CameraKey>)[key];
    const marker=document.createElement(route||destination?'button':'span');marker.className='map-label'+(route?'':' minor');marker.style.left=p.x*100+'%';marker.style.top=p.y*100+'%';
    if(route){marker.dataset.scene=key;marker.innerHTML='<strong></strong><i></i>';if(marker instanceof HTMLButtonElement)marker.onclick=()=>callbacks.openRoute(key as RouteId);}
    else{marker.textContent=p.label||key;if(marker instanceof HTMLButtonElement&&destination)marker.onclick=()=>void switchView(destination);}
    el('map-labels').append(marker);mapButtons.set(key,marker);
   }
   for(const [key,path]of Object.entries(map.routes)){
    const line=document.createElementNS('http://www.w3.org/2000/svg','polyline');line.setAttribute('points',path.map(p=>`${p.x*1000},${p.y*562.5}`).join(' '));line.setAttribute('fill','none');line.setAttribute('stroke-dasharray','6 5');el('map-routes').append(line);lines.set(key,line);
    const unit=document.createElementNS('http://www.w3.org/2000/svg','circle');unit.setAttribute('r','5');unit.setAttribute('fill','#e8ce86');unit.setAttribute('stroke','#243d32');unit.setAttribute('stroke-width','2');el('map-routes').append(unit);units.set(key,unit);
   }
   mapReady=true;
  }
  for(const id of routes){
   const marker=mapButtons.get(id)!,route=world.routes[id],unread=route.reports.length>route.readReports;
   marker.classList.toggle('active',id===selected);marker.classList.toggle('done',route.status==='done');marker.classList.toggle('unread',unread);
   setText(marker.querySelector('strong')!,world.content.routes[id].name);setText(marker.querySelector('i')!,unread?'新回报':route.status==='camp'?'听取军情':route.status==='done'?'已归营':route.label);
   marker.title=world.content.routes[id].name+'：'+(route.status==='camp'?currentStage(world,id).mapHint:route.label);
   const line=lines.get(id)!;line.setAttribute('stroke',id===selected?'#ffe6a5':'#ede9d2ab');line.setAttribute('stroke-width',id===selected?'2.5':'1.5');
   const unit=units.get(id)!,moving=['outbound','working','returning'].includes(route.status);unit.style.display=moving?'':'none';
   if(moving){
    const progress=route.status==='outbound'?1-route.remaining/route.stepDuration:route.status==='returning'?route.remaining/route.stepDuration:1;
    const path=map.routes[id],lengths=path.slice(1).map((p,i)=>Math.hypot(p.x-path[i].x,p.y-path[i].y));let distance=Math.max(0,Math.min(1,progress))*lengths.reduce((a,b)=>a+b,0),point=path[path.length-1];
    for(let i=0;i<lengths.length;i++){if(distance<=lengths[i]){const t=distance/(lengths[i]||1);point={x:path[i].x+(path[i+1].x-path[i].x)*t,y:path[i].y+(path[i+1].y-path[i].y)*t};break;}distance-=lengths[i];}
    unit.setAttribute('cx',String(point.x*1000));unit.setAttribute('cy',String(point.y*562.5));
   }
  }
 }
 await switchView(current);
 // Complete the first view before loading other full-size images. Failed preloads remain retryable.
 for(const key of keys)if(key!==current)void load(key).catch(()=>{});
 return {
  reportImage:layout.cameras.camp.image,
  renderMap,
  reset(){void switchView('camp');},
  update(world,selected,nextOpen,nextBusy){
   opened=nextOpen;busy=nextBusy;
   let unreadRoutes=0;
   for(const id of routes){
    const r=world.routes[id],card=cards.get(id)!,unread=r.reports.length>r.readReports;if(unread)unreadRoutes++;
    setText(card.name,world.content.routes[id].name);setText(card.hint,r.status==='camp'?currentStage(world,id).mapHint:r.label);
    setText(card.flag,unread?'新回报':r.status==='done'?'已归营':r.status==='camp'?(r.choiceId?'待发令':'军情待阅'):'接应中');
    setText(card.action,r.status==='camp'?'听取军情 →':unread?'听取回报 →':'查看接应记录 →');
    card.button.classList.toggle('active',selected===id);card.button.classList.toggle('unread',unread);card.button.classList.toggle('done',r.status==='done');card.button.disabled=busy;
   }
   setText(el('report-notice'),unreadRoutes?`${unreadRoutes}路有新回报。`:world.saved===4?'四路人员已归营。':'可先听报，再定安排。');
   for(const node of Array.from(document.querySelectorAll<HTMLButtonElement>('#view-nav button,#map-labels button,#local-markers button')))node.disabled=busy;
   if(opened&&!previousOpen){returnFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;el('camp-interface').inert=true;document.body.classList.add('dialogue-open');el('close-event').focus({preventScroll:true});}
   if(!opened&&previousOpen){el('camp-interface').inert=false;document.body.classList.remove('dialogue-open');(returnFocus?.isConnected?returnFocus:cards.get(selected)!.button).focus({preventScroll:true});}
   previousOpen=opened;
  }
 };
}
