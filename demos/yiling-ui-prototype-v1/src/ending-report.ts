import type {Session, RouteStage} from './campaign-client.js';
import {batchName,type Front} from './campaign-intent.js';

// Stories are authored; outcomes come only from the saved campaign.
export const ENDING_STORIES: Record<Front, {name:string; title:string; image:string; caption:string; before:string; saved:string; waiting:string}> = {
 sha:{name:'沙摩柯',title:'火夜寻人',image:'shamoke',caption:'沙摩柯',before:'火起时，沙摩柯与部族失散。听说有人往谷中去了，他便独自追去。跟他出征的人，他还想带回去。',saved:'沙摩柯和重逢的族人一道走出了山谷。',waiting:'谷中还有人未撤出来，沙摩柯这一部的消息尚未收齐。'},
 camp:{name:'冯习 · 张南',title:'最后一队',image:'camp',caption:'旧营',before:'张南护着前队，冯习留下收拢伤兵。前面的人要走，后面的人也在等。两队都得从旧营撤出来。',saved:'前后两队均已脱险，后队的伤兵也接出来了。',waiting:'旧营还有人未撤出，前后两队的回报分别列在下方。'},
 fu:{name:'傅肜',title:'后阵孤军',image:'furong',caption:'断后时的傅肜',before:'弟兄们都战死了，吴军又喊刘备已经遇害。傅肜不肯降吴，也不肯独自退走。',saved:'接应的人到了。傅肜随他们撤出了后阵。',waiting:'后阵尚未传来傅肜脱险的消息。'},
 ma:{name:'马良',title:'迟到的军令',image:'valley',caption:'联络山路',before:'马良带随员在外联络，撤军的消息迟迟未到。驿卒认得来路，带着接应的人回去找他。',saved:'马良与随员都已脱险。这一趟同行的人，终于有了归路。',waiting:'马良一行的回报尚未收齐，仍有同行者未脱险。'},
 cheng:{name:'程畿',title:'末船',image:'river',caption:'江上撤路',before:'追兵逼近，程畿的船落在后头。同行的伤员还没转走，他仍守着末船。',saved:'伤员已转出，程畿与末船同行者也已脱险。',waiting:'江上还有人未撤出，接应船队的消息尚未收齐。'},
 du:{name:'杜路 · 刘宁',title:'围中来信',image:'camp',caption:'被围营地',before:'营中粮食将尽，主力又断了消息。杜路、刘宁守着部众和伤员，等一条能出去的路。',saved:'两将与部众已一同突围，同行伤员也在脱险名册中。',waiting:'两将与部众尚无突围的确报。'},
 wang:{name:'王甫',title:'退军之中',image:'valley',caption:'秭归方向',before:'退军挤满了道路，王甫一行失去了联系。亲随认得队伍的标记，带人去找，也去接那些落后的伤员。',saved:'王甫与同行伤员均已脱险。',waiting:'王甫与同行伤员的脱险消息尚未送到。'},
 huang:{name:'黄权',title:'江北归路',image:'river',caption:'江北渡口',before:'黄权留在江北，归路已断。他等着两岸接应，也等着最后留下掩护的将士有船可渡。',saved:'前批已渡过险处，黄权与末批将士也已脱险。',waiting:'江北尚未传来黄权与末批将士脱险的回报。'}
};
const ORDER:Front[]=['sha','camp','fu','ma','cheng','du','wang','huang'];
const safe=(status:string)=>status==='safe'||status==='home';
const dead=(status:string)=>status==='dead'||status==='killed';
const esc=(v:string)=>v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function endingModel(s:Session){
 const routes=ORDER.filter(id=>s.fronts[id]).map(id=>{
  const r=s.fronts[id],story=ENDING_STORIES[id];
  const stages:RouteStage[]=r.stages?.length?r.stages.map(st=>({...st,name:batchName(id,st,s.routeInfo?.sha?.searchVerified)})):[{id:'person',name:story.name,status:r.status}];
  const saved=stages.filter(x=>safe(x.status)),fallen=stages.filter(x=>dead(x.status)),waiting=stages.filter(x=>!safe(x.status)&&!dead(x.status));
  return {id,story,stages,saved,fallen,waiting,complete:saved.length===stages.length};
 });
 return {routes,complete:routes.filter(r=>r.complete).length,total:routes.length,
  saved:routes.flatMap(r=>r.saved),waiting:routes.flatMap(r=>r.waiting),fallen:routes.flatMap(r=>r.fallen)};
}
function stageLine(st:RouteStage){return `<li><span>${esc(st.name)}</span><small class="${safe(st.status)?'is-safe':dead(st.status)?'is-dead':'is-waiting'}">${st.status==='home'?'已归营':st.status==='safe'?'脱险 · 归途中':dead(st.status)?'牺牲':st.status==='locked'?'未联络':'尚未脱险'}</small></li>`;}
type Route=ReturnType<typeof endingModel>['routes'][number];
const routeTag=(r:Route)=>r.complete?'已脱险':r.saved.length?'部分脱险':r.fallen.length?'有牺牲':'未脱险';
function resultCopy(r:Route){
 if(r.fallen.length)return `${r.fallen.map(x=>x.name).join('、')}已确认牺牲。`;
 if(r.complete)return r.story.saved;
 if(r.saved.length)return `${r.saved.map(x=>x.name).join('、')}已脱险。${r.waiting.map(x=>x.name).join('、')}尚未撤出。`;
 return r.story.waiting;
}
function routePage(r:Route,index:number){
 return `<section id="ending-panel-${r.id}" class="ending-page" role="tabpanel" aria-labelledby="ending-tab-${r.id}" ${index?'hidden':''}>
 <div class="folio-scene"><img src="./art/ending/${r.story.image}.png" alt="${r.story.caption}"><div class="folio-intro"><strong>${r.story.name}</strong><h2>${r.story.title}</h2><p>${r.story.before}</p></div></div>
 <article class="ending-prose folio-result"><div><h3>此役</h3><p>${esc(resultCopy(r))}</p></div><div><h3>人员去向</h3><ul class="ending-stage-list">${r.stages.map(stageLine).join('')}</ul></div></article></section>`;
}
export function endingMarkup(s:Session){
 const m=endingModel(s);
 return `<div class="ending-topbar"><div><span class="ending-chapter">肆</span><span>夷陵 · 战后军报</span></div><div class="ending-brief"><span>历时 <b>${s.round*2}</b> 时辰</span><span>脱险 <b>${m.complete}</b> / ${m.total} 路</span><button type="button" data-ending-close aria-label="关闭结局军报">合卷 <span aria-hidden="true">×</span></button></div></div>
 <div class="ending-book"><aside class="ending-roster"><div class="ending-book-title"><h1 id="ending-heading">归人录</h1><p>${m.complete===m.total?'各路俱已脱险。':m.saved.length?'各路回报已收录。':'各路尚待归讯。'}</p></div><nav class="ending-tabs" role="tablist" aria-label="人物与祭告" aria-orientation="vertical">${m.routes.map((r,i)=>`<button type="button" role="tab" id="ending-tab-${r.id}" aria-controls="ending-panel-${r.id}" aria-selected="${i===0}" tabindex="${i===0?0:-1}" data-ending-select="${r.id}"><span>${r.story.name}</span><small class="${r.complete?'is-safe':'is-waiting'}">${routeTag(r)}</small></button>`).join('')}<button type="button" role="tab" id="ending-tab-memorial" aria-controls="ending-panel-memorial" aria-selected="false" tabindex="-1" data-ending-select="memorial" class="ending-memorial-tab"><span>记取牺牲</span></button></nav></aside>
 <div class="ending-pages">${m.routes.map(routePage).join('')}<section id="ending-panel-memorial" class="ending-page" role="tabpanel" aria-labelledby="ending-tab-memorial" hidden><figure class="ending-art art-memorial"><img src="./art/ending/camp.png" alt="军帐中的灯火"><figcaption>后阵 · 旧部</figcaption></figure><article class="ending-prose ending-memorial"><div class="ending-page-label"><span>夷陵 · 祭告</span></div><p class="ending-name">留在这一夜的人</p><h2>记取牺牲</h2>${s.fronts.fu?'<h3>傅肜旧部</h3><p>接应到来以前，他们已全部战死在后阵。傅肜不肯走，放不下的正是这些弟兄。</p>':''}${m.fallen.length?`<ul class="ending-stage-list">${m.fallen.map(stageLine).join('')}</ul>`:''}<h3>接应将士</h3><div class="ending-losses"><div><b>${s.dead}</b><span>阵亡</span></div><div><b>${s.wounded}</b><span>负伤</span></div></div><p>${s.dead?'这次派出去的将士，有人没能回来。阵亡者姓名尚缺，先将人数记下。':'此次接应，无人阵亡。'}</p><div class="ending-page-foot"><span>接应营录</span><span class="ending-seal" aria-hidden="true">祭</span></div></article></section>
 <div class="ending-pagination"><button type="button" data-ending-step="-1" aria-label="上一页">← 上一页</button><span data-ending-count>01 / ${String(m.total+1).padStart(2,'0')}</span><button type="button" data-ending-step="1" aria-label="下一页">下一页 →</button></div></div></div>`;
}
export function bindEnding(root:HTMLElement){
 const tabs=Array.from(root.querySelectorAll<HTMLButtonElement>('[data-ending-select]'));
 function select(index:number,focus=false){
  const current=Math.max(0,Math.min(tabs.length-1,index));
  tabs.forEach((tab,i)=>{const active=i===current;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;const panel=root.querySelector<HTMLElement>('#'+tab.getAttribute('aria-controls'))!;panel.hidden=!active;if(active)panel.querySelector<HTMLElement>('.ending-prose')!.scrollTop=0;});
  root.querySelector('[data-ending-count]')!.textContent=`${String(current+1).padStart(2,'0')} / ${String(tabs.length).padStart(2,'0')}`;
  root.querySelector<HTMLButtonElement>('[data-ending-step="-1"]')!.disabled=current===0;
  root.querySelector<HTMLButtonElement>('[data-ending-step="1"]')!.disabled=current===tabs.length-1;
  if(focus)tabs[current].focus();
 }
 root.onclick=e=>{const target=(e.target as Element).closest<HTMLElement>('button');if(!target)return;if(target.hasAttribute('data-ending-select'))select(tabs.indexOf(target as HTMLButtonElement));if(target.dataset.endingStep)select(tabs.findIndex(t=>t.getAttribute('aria-selected')==='true')+Number(target.dataset.endingStep));if(target.hasAttribute('data-ending-close')&&root instanceof HTMLDialogElement)root.close();};
 root.onkeydown=e=>{if(!(e.target as Element).matches('[role="tab"]'))return;const index=tabs.indexOf(e.target as HTMLButtonElement);if(['ArrowUp','ArrowDown','Home','End'].includes(e.key)){e.preventDefault();select(e.key==='Home'?0:e.key==='End'?tabs.length-1:index+(e.key==='ArrowDown'?1:-1),true);}};
 select(0);
}
export function showEnding(s:Session){
 if(!s.ended)return;
 let dialog=document.getElementById('ending-report') as HTMLDialogElement|null;
 if(!dialog){dialog=document.createElement('dialog');dialog.id='ending-report';dialog.className='ending-report';dialog.setAttribute('aria-labelledby','ending-heading');document.body.append(dialog);}
 dialog.innerHTML=endingMarkup(s);bindEnding(dialog);if(!dialog.open)dialog.showModal();
 dialog.querySelector<HTMLButtonElement>('[data-ending-select]')!.focus({preventScroll:true});
}
