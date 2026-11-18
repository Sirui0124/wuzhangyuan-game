import {CampaignClient,SESSION_KEY,integrated,read} from './campaign-client.js';
import {showEnding} from './ending-report.js';
import {resolveCampaignOrders,describe,names,type Front,type Address,type Order} from './campaign-intent.js';
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const esc=(v:string)=>v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const FS:Front[]=['fu','camp','sha','ma','cheng','du','wang','huang'];
function availableFronts(){return client.session?FS.filter(f=>client.session!.fronts[f]&&client.session!.fronts[f].status!=='locked'):FS.slice(0,3);}
function timeTitle(){return client.session?.roundLimit===8?'十六时辰':'十二时辰';}
function allEightSafe(){const s=client.session;return s?.routeVersion?.startsWith('eight-front-')&&FS.every(f=>s.fronts[f]&&['safe','home'].includes(s.fronts[f].status));}
function resultText(){return allEightSafe()?'八路全部脱险':client.session?.grade||'调度结束';}
function crisisText(value:unknown){return typeof value==='number'&&Number.isFinite(value)?String(value):'—';}
function statusText(status:string){return status==='home'?'已归营':status==='safe'?'已脱险 · 返程中':status==='locked'?'尚未联络':'尚未脱险';}
type UI={front:Front;mode:'front'|'dispatch';filter:'current'|'all';address:Address;drafts:Record<string,string>;expanded:boolean;mapHeight:number|null;seen:boolean;guide?:number};
const ui: UI=read<UI>(SESSION_KEY+'-ui')||{front:'sha',mode:'front',filter:'current',address:{unit:'auto',target:'auto'},drafts:{},expanded:false,mapHeight:null,seen:false};
let preview:Order[]|null=null,drawer=false,lastMessage='';
const client=new CampaignClient(()=>render());
function save(){localStorage.setItem(SESSION_KEY+'-ui',JSON.stringify(ui));}
function key(){return (client.session?.scenarioId||'connecting')+'-'+(ui.mode==='front'?ui.front:'dispatch');}
function feedback(text:string){$('feedback').textContent=text;}
const GUIDE=[
 {title:'先看前线',text:'点军图上的军旗，看看这一路为何被困。危机度越高，越需要优先接应。',action:'查看这一路'},
 {title:'问清处境',text:'在下方输入框问话，也可点推荐问题填入。甲队500人待命，另有预备兵2000人。',action:'去问话'},
 {title:'安排接应',text:'点“传令”写下调度，军侯复诵后再确认。新编按100人调派，最多同时5队。',action:'去传令'},
 {title:'让军令执行',text:'右侧可查看各队状态。准备妥当后点“结束本轮”，部队才会行动、送回军报。',action:'查看军情'}
];
function renderGuide(){const step=ui.guide??-1,g=GUIDE[step];$('field-guide').hidden=!g;if(!g)return;$('guide-title').textContent=`${step+1} / 4 · ${g.title}`;$('guide-text').textContent=g.text;$('guide-action').textContent=g.action;}
function advanceGuide(step:number){if(ui.guide!==step)return;ui.guide=step===3?-1:step+1;save();renderGuide();}
async function guidedAct(path:'chat'|'orders'|'round',payload:Record<string,unknown>){await client.act(path,payload);advanceGuide(path==='chat'?1:path==='orders'?2:3);}
function draft(){return $<HTMLTextAreaElement>('draft');}
function chatCount(){const s=client.session;return s?.messages.filter(m=>m.kind==='question'&&m.front===ui.front&&m.round===s.round).length||0;}
let bannerTimer:ReturnType<typeof setTimeout>|undefined;
function showRoundBanner(){const s=client.session;if(!s)return;const b=$('round-banner');b.textContent=s.ended?(allEightSafe()?'八路全部脱险':s.endReason==='deadline'?timeTitle()+'已尽':'营救调度结束'):`已过${s.round*2}时辰 · 第${s.round+1}轮`;b.hidden=false;clearTimeout(bannerTimer);bannerTimer=setTimeout(()=>{b.hidden=true;},3500);}
function showReport(){const s=client.session,r=s?.lastReport;if(!r)return;
 $('round-report-title').textContent=`第${r.round}轮结报 · 已过${r.elapsed}时辰`;
 const crisis=r.fronts.filter(f=>f.status!=='locked').map(f=>{const d=f.after-f.before;return `<div class="crisis-row has-stages" data-report-front="${f.id}"><strong>${names[f.id]}</strong><small>${f.stages?f.stages.map(x=>esc(x.name)+'：'+(x.status==='home'?'已归营':x.status==='safe'?'已脱险 · 返程中':'尚未撤出')+(typeof x.urgency==='number'?' · 危机 '+crisisText(x.urgency):'')).join('；'):f.status==='home'?'已归营':f.status==='safe'?'已脱险 · 返程中':'仍受困'}</small><span>${f.after}<b class="${d>0?'rise':d<0?'fall':'unchanged'}">${d>0?'+':''}${d||'—'}</b></span></div>`;}).join('');
 const prose=r.narrative?.paragraphs.map(p=>`<article class="report-prose"><h4>${p.front==='camp-base'?'接应营':names[p.front as Front]||'前线'}</h4><p>${esc(p.text)}</p></article>`).join('')||r.events.map(t=>`<p>${esc(t)}</p>`).join('');
 const eventProse=(r.crisisEvents||r.fronts.flatMap(f=>f.lastCrisisEvent?[f.lastCrisisEvent]:[])||[]).map(e=>`<article class="report-prose" data-crisis-event="${esc(e.eventId)}"><h4>${names[e.front]} · 危机 ${e.before} → ${e.after}（${e.after-e.before>0?'+':''}${e.after-e.before}）</h4>${prose.includes(esc(e.text))?'':`<p>${esc(e.text)}</p>`}</article>`).join('');
 const pool=r.pool?`<div class="report-pool"><span>营中可调 <strong>${r.pool.reserve+r.pool.ready}</strong>人</span><span>在外 <strong>${r.pool.outside}</strong>人</span></div>`:'';
 const units=r.units.map(u=>`<tr><td><strong>${esc(u.name)}</strong><small>${u.target?names[u.target]: '接应营'}</small></td><td>${esc(u.task||'本轮差遣')}<small>${u.via==='side'?'经南侧路':''}</small></td><td>${u.before} → <strong>${u.after}</strong><small>${u.wounded||u.dead?`伤 ${u.wounded||0} · 亡 ${u.dead||0}`:'无新增伤亡'}</small></td><td>${u.state==='returning'?'返程中':u.state==='marching'?'行军中':u.state==='ready'?'营中待命':u.state==='home'?'已归营':u.state==='lost'?'无可战兵力':esc(u.status)}<small>${u.state==='returning'?'两个时辰后归营':u.state==='marching'?`${(u.eta||1)*2}个时辰后到位`:''}</small></td></tr>`).join('');
 $('round-report-body').innerHTML=`<section class="report-fronts"><div class="report-section-head"><h3>各路军情</h3><small>危机度 / 本轮变化</small></div>${crisis}</section><section class="report-narrative"><h3>本轮战报</h3>${prose}${eventProse}</section><section class="report-deployment"><div class="report-section-head"><h3>接应兵力派遣</h3></div>${pool}<div class="report-table-wrap"><table class="report-table"><thead><tr><th>队伍 / 去向</th><th>差遣</th><th>轮初 → 现有</th><th>当前去向</th></tr></thead><tbody>${units}</tbody></table></div></section>`+(r.ended?'<p class="report-end">'+(allEightSafe()?'八路人员均已脱险，本次营救成功。'+(Object.values(s.units).some(u=>u.state==='returning')?'接应部队仍有返程者，尚未计入营中可用兵力。':''):s.endReason==='deadline'?timeTitle()+'已尽，按当前军情结算。已脱险的路线计为营救成功；尚在返程的部队不会提前计入营中兵力。':'本次营救结束。')+'</p>':'');
 const dialog=$<HTMLDialogElement>('round-report');if(!dialog.open)dialog.showModal();
}
function syncRound(){const s=client.session;if(!s)return;const limit=s.roundLimit||6;
 $('round-clock').innerHTML=`<strong>${timeTitle()}</strong><span>${s.ended?'调度结束':`第${Math.min(s.round+1,limit)}轮 / 共${limit}轮`} · 已过${s.round*2}时辰</span><div class="round-ticks" aria-hidden="true">${Array.from({length:limit},(_,i)=>`<i class="${i<s.round?'done':i===s.round&&!s.ended?'current':''}"></i>`).join('')}</div>`;
 $('round-clock').setAttribute('aria-label',timeTitle()+'进度');
 const guideRule=document.querySelector('#info .guide-rule');if(guideRule)guideRule.textContent=`${timeTitle()}，共${limit}轮。每组每轮最多交谈八次，传令不占次数。结束本轮推进两个时辰；接应人马在解围前继续作战，解围后再过一轮归营。${limit===8?'第三轮、第五轮会有新的军情送到。八路全部脱险即营救成功，返程部队归营后才能再次调遣。':''}`;
 $('round-action-note').textContent=s.ended?'本次调度已结算':'推进两个时辰';$('review-round').hidden=!s.lastReport;
 $('review-ending').hidden=!s.ended;
 const seenKey='yiling-round-report-'+s.scenarioId;
 if(s.lastReport&&Number(localStorage.getItem(seenKey)||0)<s.lastReport.round&&!$<HTMLDialogElement>('info').open){showReport();}
}
function guidance(){const s=client.session;if(!s)return [];if(s.routeInfo?.[ui.front])return s.routeInfo[ui.front]!.suggestions;const f=s.fronts[ui.front];if(!f||f.status==='locked')return [];if(f.status==='home')return ui.front==='fu'?['回营后感觉怎样？','那些弟兄的事，陛下会记得的。']:['伤兵都安置好了吗？','还有没有落在后面的弟兄？'];if(f.status==='safe')return ui.front==='fu'?['你现在怎么样？','先随接应的人回营歇息吧。']:['撤出来的人怎么样？','先回接应营吧。'];
 if(ui.front==='sha'&&!s.routeVersion&&typeof f.progress==='number'&&typeof f.work==='number')return f.progress>=f.work/2?['西沟还剩多少担架？','掩护的人能再撑一阵吗？']:['东沟的人能先撤出来吗？','西沟的伤兵要怎样接走？'];
 if(ui.front==='camp'&&typeof f.progress==='number'&&typeof f.work==='number')return f.progress>=f.work/2?['冯习，后队伤兵接上了吗？','掩护队该守在哪里？']:['张南，前队撤到哪里了？','冯习，后队伤兵能走吗？'];
 if(ui.front!=='fu')return [];
 return s.facts.withdrawalAccepted?[Object.values(s.units).some(u=>u.target==='fu'&&u.task==='rescue'&&u.state==='active')?'接应的人已经到了，你现在怎样？':'等接应的人到了，就跟他们回来吧。','还有什么让你放心不下？']:s.facts.liubeiAliveVerified?['你是放不下战死的弟兄吗？','回去把他们死守的事告诉陛下，好吗？']:['你为什么不肯撤？','陛下的消息，你是听谁说的？'];
}
const STORIES:Record<Front,{image:string;caption:string;title:string;text:string}>={
 sha:{image:'sha',caption:'山林向导送来的初报',title:'两沟之间，还有人没出来',text:'沙摩柯的人分散在东沟与西沟。东沟的部众还能自行撤离，西沟却有需要担架的伤兵。他不肯只带走能走的人，留下伤兵独自面对追兵。接应要分清先后，也要留人守住撤路。'},
 camp:{image:'feng',caption:'旧营军吏带回的军情',title:'前队未齐，后队未归',text:'张南带着前队撤离，冯习收拢后队与伤兵。旧营的两支部队仍连在同一条撤路上：只护走前队，后面的伤兵就可能失去掩护。接应既要让前队通过，也要把后队接齐。'},
 ma:{image:'',caption:'联络使团的消息',title:'撤军消息尚未送到',text:'马良外出联络，尚未归营。驿卒熟悉往来的路线，可以带人寻找；找到后，还要将联络人员一起接回。'},
 cheng:{image:'',caption:'江上船工带来的消息',title:'追兵逼近末船',text:'程畿乘船撤退，仍照应着同行的人。接应须从水路靠近，转移伤员并掩护末船，岸上的援兵不能直接把人接走。'},
 du:{image:'',caption:'被围营地的消息',title:'失联之中，仍有人等待接应',text:'杜路、刘宁所部被围，断粮又失去主力消息。大营传来的可靠接应消息能让他们重新组织突围，接应还须守住出口，将伤员与部众一起带走。'},
 wang:{image:'',caption:'失散亲随送来的消息',title:'退军中寻找同行者',text:'亲随在向秭归撤离的队伍中见过王甫。接应队可循辨认标记找到他们，护送沿途伤员，从核实过的退路返回。'},
 huang:{image:'',caption:'江北使者带来的消息',title:'归路要接到最后一批',text:'黄权所部仍在江北。他愿意归来，但需要整支部队都有退路。两岸联络、接收与渡运须一一落实，最后留下掩护的人也要有船可乘。'},
 fu:{image:'fu',caption:'后阵传令兵送来的初报',title:'守住后阵，却不肯独活',text:'傅肜受刘备重恩，留下断后，为撤离争取时间。吴军诈称刘备已经遇害，他身边原有的弟兄又全部战死，悲愤之下不肯独自离开。核实刘备的消息、回应他对战死弟兄的愧疚，以及真正到位的接应，各有作用。新援军并不是他已战死的原部众。'}
};
function openStory(){const f=ui.front,story=f==='sha'&&(client.session?.routeInfo?.sha||client.session?.routeVersion)?{...STORIES.sha,title:'火夜失散，独自追寻',text:'火夜中，沙摩柯与部族失散。他听营口小卒说有人往谷中去，便独自追去；这条消息还没有核实。接应要先找到可靠的会合处，再把他与找到的部众带回。尚无消息的人不能算作已经接齐。'}:STORIES[f],route=client.session?.fronts[f];$('story-title').textContent=names[f];$('story-crisis').textContent='危机度 '+crisisText(route?.urgency);const img=$<HTMLImageElement>('story-image');img.closest('figure')!.hidden=!story.image;if(story.image)img.src='/art/intro/'+story.image+'.png';img.alt=story.caption;$('story-caption').textContent=story.caption;$('story-heading').textContent=story.title;$('story-text').textContent=story.text;$('story-current').textContent=route?.status==='home'?'当前军报：已归营。':route?.status==='safe'?'当前军报：已脱险，正在归营。':route?.assessment?.mode==='autonomous'&&route.assessment.autonomousEligible?'当前军报：已具备自行撤离条件，尚未收到脱险回报。':f==='fu'&&client.session?.facts.liubeiAliveVerified?'当前军报：刘备仍在的可信消息已经送达傅肜。':'当前军报：仍待接应。';$<HTMLDialogElement>('front-story').showModal();}
function updateCooldown(){const s=client.session,count=chatCount();
 $('compact-countdown').hidden=true;
 $('filter-hint').textContent=ui.mode==='front'&&!s?.ended?(count>=8?'本轮已交谈八次，下轮再继续。':count===7?'本轮还可问一次。':''):'';
 $<HTMLButtonElement>('send').disabled=client.busy||!s||s.ended||!!client.pending||(ui.mode==='front'&&count>=8);
 $<HTMLButtonElement>('fu-end-round').disabled=client.busy||!s||s.ended||!!client.pending;
 $<HTMLButtonElement>('reset').disabled=client.busy;
 $<HTMLButtonElement>('suggest').disabled=client.busy;
 const edit=document.getElementById('edit-order') as HTMLButtonElement|null;if(edit)edit.disabled=client.busy;
}
function resizeDraft(){draft().style.height='auto';draft().style.height=Math.min(88,Math.max(44,draft().scrollHeight))+'px';setHeight();}
function parse(){return resolveCampaignOrders(draft().value,ui.address,client.session?.units||{});}
function recognition(){const el=$('intent-summary');el.hidden=ui.mode==='front'||!!preview||!draft().value.trim();if(el.hidden)return;try{el.textContent=parse().map(describe).join('；');el.classList.remove('needs-input');}catch(e){el.textContent=(e as Error).message;el.classList.add('needs-input');}}
function renderLogs(bottom=false){const s=client.session,log=$('log'),old=log.scrollTop,tail=log.scrollHeight-old-log.clientHeight<40;
 const messages=(s?.messages||[]).filter(e=>ui.filter==='all'||(ui.mode==='front'?e.front===ui.front:ui.address.unit!=='auto'&&ui.address.unit!=='new'?e.unit===ui.address.unit:e.kind==='order'||e.speaker==='军侯'));
 log.innerHTML=messages.map(e=>`<article class="entry ${e.kind==='question'||e.kind==='order'?'mine':''}"><div class="meta"><strong>${esc(e.speaker)}</strong></div><p>${esc(e.text)}</p></article>`).join('')||'<p class="empty">这一路暂无新的往来记录。</p>';
 log.scrollTop=bottom||tail?log.scrollHeight:old;const latest=messages.at(-1)?.id||'';if(bottom||tail)$('new-reports').hidden=true;else if(latest!==lastMessage)$('new-reports').hidden=false;lastMessage=latest;
}
function render(){const s=client.session,available=availableFronts();if(!available.includes(ui.front))ui.front=available[0]||'sha';if(ui.address.target!=='auto'&&!available.includes(ui.address.target))ui.address.target='auto';const front=ui.mode==='front',input=draft(),focused=document.activeElement===input,start=input.selectionStart,end=input.selectionEnd;
 $('contacts').innerHTML=available.map(f=>`<button data-front="${f}" aria-pressed="${front&&ui.front===f}">${names[f]}${s?`<small>${statusText(s.fronts[f].status)}</small>`:''}</button>`).join('');
 $('filter-current').textContent=front?names[ui.front]+'往来':'本次调度';$('filter-all').textContent='所有传令';for(const f of ['current','all'])$('filter-'+f).setAttribute('aria-pressed',String(ui.filter===f));
 $('mode-toggle').setAttribute('aria-pressed',String(!front));$('mode-toggle').setAttribute('aria-expanded',String(!front));$('mode-label').textContent=front?'传令':'返回传话';$('mode-toggle').setAttribute('aria-label',front?'切换为传令':'切换为传话');
 $('mode-note').textContent=s?.ended?`${resultText()} · ${s.round}轮 · 伤${s.wounded} 亡${s.dead}`:front?'联络前线，了解各路处境':'军令复诵确认后入列，结束本轮执行';
 document.querySelector('.composer')!.classList.toggle('has-preview',!!preview);$('send-home').append($('send'));$('preview').hidden=!preview;$('preview').innerHTML=preview?`<h2 class="preview-title">军侯复诵</h2>${preview.map(o=>`<p class="order-line">${esc(describe(o))}</p>`).join('')}<p class="preview-note">确认后占用兵力与队伍名额；结束本轮执行。</p><button id="edit-order">修改军令</button><div id="preview-send-slot"></div>`:'';
 $('dispatch-address').hidden=front||!!preview;input.hidden=!!preview;input.disabled=!s;input.placeholder=front?'问'+names[ui.front]+'……':'写下军令，例如：派400人接应沙摩柯……';input.value=ui.drafts[key()]||'';
 $('draft-label').textContent=front?'向'+names[ui.front]+'问话':'传令内容';
 $('order-unit').innerHTML='<option value="auto">自动识别</option><option value="new">新编队 · 预备兵</option>'+Object.entries(s?.units||{}).map(([id,u])=>`<option value="${id}">${u.name||'第'+id+'队'} · ${u.men}人</option>`).join('');
 if(!['new','auto'].includes(ui.address.unit)&&!s?.units[ui.address.unit])ui.address.unit='auto';
 $('order-target').innerHTML='<option value="auto">自动识别</option>'+available.map(f=>`<option value="${f}">${names[f]}</option>`).join('');
 $<HTMLSelectElement>('order-unit').value=ui.address.unit;$<HTMLSelectElement>('order-target').value=ui.address.target;
 $('suggestions').hidden=!front||!!preview;$('suggestions').innerHTML=guidance().map(q=>`<button data-suggestion="${esc(q)}">${esc(q)}</button>`).join('');
 $('send').textContent=preview?'确认传令':front?'传话':'请军侯复诵';$('suggest').hidden=!preview;
 $('army-roster').innerHTML=s?`<div class="pool-summary"><span>预备兵 <strong>${s.reserve}</strong>人</span><small>在外 ${Object.values(s.units).filter(u=>u.state!=='ready').reduce((n,u)=>n+u.men,0)} · ${Object.keys(s.units).length}/5队${s.wounded||s.dead?` · 伤${s.wounded} 亡${s.dead}`:''}</small>${s.total!==2500?`<small>本局总兵力 ${s.total??2000}人</small>`:''}</div>`+(Object.entries(s.units).map(([id,u])=>`<button class="roster-row" data-unit="${id}"><span class="roster-seal">${u.name==='甲队'?'甲':id}</span><span class="roster-detail"><strong>${u.name||'第'+id+'队'} <small>${u.men}人</small></strong><span>${u.target?names[u.target]:'接应营'} · ${esc(u.status)}</span></span></button>`).join('')||'<p class="unit-status">尚未派遣</p>'):'<p>正在读取军情……</p>';
 $('fu-status').hidden=false;$('fu-network').textContent=client.error||(client.busy?'正等回执……':s?.ended?resultText():s?'':'尚未建立联络');$('fu-status').classList.toggle('has-error',!!client.error);$('fu-retry').hidden=!client.pending||client.busy;$<HTMLButtonElement>('fu-refresh').disabled=client.busy;
 $('fu-round-actions').hidden=false;$('fu-end-round').textContent=s?.ended?'调度结束':'结束本轮';
 $('about').textContent='军令与营救';$('reset').textContent='新开营救';$('command-panel').classList.toggle('is-dispatch',drawer&&innerWidth<=740);$('close-command').hidden=innerWidth>740;$('close-command').textContent='收起';$('open-situation').setAttribute('aria-expanded',String(drawer));
 const next=document.getElementById('campaign-next');if(next)next.hidden=!integrated||!s?.ended;
 recognition();updateCooldown();resizeDraft();renderLogs();renderMap();renderGuide();syncRound();
 if(focused&&!input.hidden&&!input.disabled){input.focus({preventScroll:true});input.setSelectionRange(start,end);}
}
async function run(action:()=>Promise<unknown>,clear=false){const savedKey=key(),text=draft().value;feedback('');try{await action();if(clear&&ui.drafts[savedKey]===text){ui.drafts[savedKey]='';preview=null;save();}render();renderLogs(true);if(integrated)parent.postMessage({type:'wzy-shared-progress'},location.origin);}catch(e){feedback((e as Error).message);}}
function setFront(f:Front){if(!availableFronts().includes(f))return;ui.front=f;ui.mode='front';ui.filter='current';preview=null;save();render();renderLogs(true);}
function fill(text:string){ui.drafts[key()]=text;preview=null;save();render();draft().focus();}
document.addEventListener('click',e=>{const b=(e.target as Element).closest<HTMLElement>('button');if(!b)return;
 if(b.dataset.front){setFront(b.dataset.front as Front);if(b.classList.contains('army-marker')||b.id==='fu-map-status')openStory();return;}
 if(b.dataset.unit){ui.mode='dispatch';ui.address.unit=b.dataset.unit;ui.address.target='auto';ui.filter='current';drawer=false;preview=null;save();render();draft().focus();return;}
 if(b.dataset.suggestion){fill(b.dataset.suggestion);return;}
 switch(b.id){
 case 'mode-toggle':ui.mode=ui.mode==='front'?'dispatch':'front';ui.filter='current';preview=null;save();render();renderLogs(true);break;
 case 'send':if(ui.mode==='front'){if(!draft().value.trim()){feedback('请写下想问的话。');break;}void run(()=>guidedAct('chat',{front:ui.front,text:draft().value.trim()}),true);}else if(preview){const batch=preview;void run(()=>guidedAct('orders',{orders:batch}),true);}else{try{preview=parse();render();}catch(e){feedback((e as Error).message);}}break;
 case 'suggest':case 'edit-order':if(!client.busy){preview=null;render();draft().focus();}break;
 case 'review-round':showReport();break;
 case 'review-ending':if(client.session)showEnding(client.session);break;
 case 'fu-end-round':void run(()=>guidedAct('round',{trigger:'endRound'}));break;
 case 'fu-refresh':void run(()=>client.load());break;
 case 'fu-retry':{const path=client.pending?.path;void run(async()=>{await client.retry();if(path==='chat'||path==='orders'||path==='round')advanceGuide(path==='chat'?1:path==='orders'?2:3);},true);break;}
 case 'open-situation':drawer=true;render();break;
 case 'close-command':drawer=false;render();break;
 case 'filter-current':ui.filter='current';save();render();renderLogs(true);break;
 case 'filter-all':ui.filter='all';save();render();renderLogs(true);break;
 case 'new-reports':renderLogs(true);break;
 case 'layout-toggle':ui.expanded=!ui.expanded;ui.mapHeight=null;save();setHeight();break;
 case 'about':$<HTMLDialogElement>('info').showModal();break;
 case 'close-story':$<HTMLDialogElement>('front-story').close();advanceGuide(0);break;
 case 'story-talk':$<HTMLDialogElement>('front-story').close();advanceGuide(0);draft().focus();break;
 case 'close-info':ui.seen=true;ui.guide=0;save();$<HTMLDialogElement>('info').close();renderGuide();break;
 case 'skip-info':ui.seen=true;ui.guide=-1;save();$<HTMLDialogElement>('info').close();renderGuide();break;
 case 'guide-dismiss':ui.guide=-1;save();renderGuide();break;
 case 'guide-action':
  if(ui.guide===0)openStory();
  else if(ui.guide===1){setFront(ui.front);draft().focus();}
  else if(ui.guide===2){ui.mode='dispatch';ui.filter='current';save();render();draft().focus();}
  else if(ui.guide===3){drawer=true;render();$('fu-end-round').focus();}
  break;
 case 'reset':$<HTMLDialogElement>('reset-dialog').showModal();break;
 case 'cancel-reset':$<HTMLDialogElement>('reset-dialog').close();break;
 case 'confirm-reset':$<HTMLDialogElement>('reset-dialog').close();preview=null;void run(()=>client.load(true,$<HTMLSelectElement>('difficulty').value));break;
 case 'campaign-next':parent.postMessage({type:'wzy-shared-next'},location.origin);break;
 case 'campaign-map':if(integrated)parent.postMessage({type:'wzy-shared-map'},location.origin);else location.assign('http://127.0.0.1:8812/?view=chapters');break;
 }
});
draft().addEventListener('input',()=>{ui.drafts[key()]=draft().value;save();resizeDraft();recognition();feedback('');});
$('front-story').addEventListener('cancel',()=>advanceGuide(0));
$('info').addEventListener('cancel',()=>{ui.seen=true;ui.guide=-1;save();renderGuide();});
draft().addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'&&!e.isComposing){e.preventDefault();$('send').click();}});
for(const id of ['order-unit','order-target'])$(id).addEventListener('change',()=>{ui.address={unit:$<HTMLSelectElement>('order-unit').value,target:$<HTMLSelectElement>('order-target').value as Address['target']};preview=null;save();recognition();});
const coords:Record<string,[number,number]>={camp:[170,268],cross:[440,202],rear:[850,115],campfire:[620,164],side:[520,237],ridge:[920,181],east:[400,220],west:[290,174]};
const edges=[['camp','cross'],['cross','rear'],['cross','campfire'],['cross','east'],['east','west'],['west','camp'],['cross','side'],['side','campfire'],['cross','ridge'],['ridge','rear']];
const bends=[[250,263,326,213],[554,181,738,166],[497,175,563,188],[423,205,423,225],[369,231,330,178],[239,203,249,251],[459,227,486,221],[563,233,565,180],[585,236,782,176],[904,150,872,152]];
for(const [i,[a,b]] of edges.entries()){const [x,y,v,w]=bends[i],d=`M${coords[a]}C${x},${y} ${v},${w} ${coords[b]}`;$('routes').insertAdjacentHTML('beforeend',`<g class="map-road"><path class="road-bed" d="${d}"/><path class="road-earth" d="${d}"/><path class="road-worn" d="${d}"/></g>`);}
function banner(front:Front){const glyph=names[front][0];return `<svg class="army-emblem" viewBox="0 0 64 68" aria-hidden="true"><ellipse class="marker-ground" cx="32" cy="61" rx="23" ry="5"/><path class="spear" d="M12 59V12M12 4l-3 9h6zM52 59V12M52 4l-3 9h6z"/><path class="flag-shadow" d="M21 11h29l-4 18 4 15-14 7-15-7z"/><path class="flag-cloth" d="M18 8h28l-4 18 4 15-14 7-14-7z"/><path class="flag-trim" d="M22 12h18l-3 14 4 13-9 5-10-5z"/><path class="flag-fold" d="M18 8l7 7v24l7 9M18 15h-6m6 22h-6"/><text x="31" y="34">${glyph}</text><path class="flag-pole" d="M18 5v54M15 5h6"/><path class="marker-base" d="M22 57h20l7 5H15z"/></svg>`;}
const frontPlaces:Record<Front,[string,number,number]>={fu:['后阵',850,100],camp:['旧营',620,131],sha:['谷道',300,216],ma:['联络方向',110,80],cheng:['上游船队',450,80],du:['被围营地',960,265],wang:['退军沿线',125,235],huang:['江北',730,285]};
function renderMap(){const s=client.session,available=availableFronts(),returned=available.filter(f=>s&&['safe','home'].includes(s.fronts[f].status));
 const focus=returned.includes(ui.front)?ui.front:returned[0];$('fu-map-status').hidden=!focus;$('fu-map-status').dataset.front=focus||'fu';$('fu-map-status').textContent=focus?names[focus]+'一路 · '+statusText(s!.fronts[focus].status)+(returned.length>1?` · 另有${returned.length-1}路已脱险`:''):'';
 const places:[string,string,number,number,Front?][]=[['接应营','',170,289],...available.filter(f=>!returned.includes(f)).map(f=>{const [place,x,y]=frontPlaces[f];return [names[f],f==='sha'&&!s?.routeInfo?.sha&&!s?.routeVersion?'东沟':place,x,y,f] as [string,string,number,number,Front];})];
 if(!s?.routeInfo?.sha&&!s?.routeVersion)places.push(['西沟 · 伤兵','',290,148]);
 $('places').innerHTML=places.map(([name,place,x,y,f])=>`<${f?'button':'span'} class="place ${f?'army-marker army-'+f:'minor'} ${f===ui.front?'selected':''}" ${f?`data-front="${f}" aria-label="联络${name}"`:''} style="left:${x/10.8}%;top:${y/3.6}%">${f?`<span class="front-urgency" data-urgency="${f}">危机度 <strong>${crisisText(s?.fronts[f].urgency)}</strong></span>`+banner(f):''}<span class="place-label">${name}${place?`<small>${place}</small>`:''}</span></${f?'button':'span'}>`).join('')+Object.entries(s?.units||{}).filter(([,u])=>u.at!=='camp').map(([id,u],i)=>{const [x,y]=u.state==='returning'?[245+(i%3)*120,230+Math.floor(i/3)*35]:coords[u.at]||(u.target?frontPlaces[u.target].slice(1) as [number,number]:coords.cross);return `<button class="rescue-marker ${u.state==='returning'?'returning':''}" data-unit="${id}" title="${u.name||'第'+id+'队'} · ${u.status}" style="left:${(x+i*12)/10.8}%;top:${Math.min(330,y+25)/3.6}%"><span>${u.name==='甲队'?'甲':id}</span>${u.state==='returning'?`<small>${u.men}人 · 返程中</small>`:''}</button>`;}).join('');positionMap();}
function positionMap(){const h=$('map-world').parentElement!.clientHeight,w=$('map-world').parentElement!.clientWidth,[,x,anchor]=frontPlaces[ui.front]||frontPlaces.sha;const fit=innerWidth>650&&h>=180;$('map-world').style.minHeight=fit?'0px':'330px';const shift=fit||h>=330?0:Math.max(h-330,Math.min(0,h/2-anchor/360*330));$('map-world').style.setProperty('--map-shift',shift+'px');$('map-world').style.setProperty('--map-x',(innerWidth<=650?Math.max(w-760,Math.min(0,w/2-x/1080*760)):0)+'px');}
function layoutLimits(){
 const desk=$('desk'),style=getComputedStyle(desk);
 const chrome=parseFloat(style.paddingTop)+parseFloat(style.paddingBottom)+document.querySelector('header')!.getBoundingClientRect().height+document.querySelector('.divider')!.getBoundingClientRect().height+document.querySelector('footer')!.getBoundingClientRect().height;
 const available=Math.max(0,innerHeight-chrome);
 const work=Math.min(available,innerWidth<=740?450:ui.mode==='dispatch'?340:300);
 return {max:Math.max(0,available-work)};
}
function setHeight(){const {max}=layoutLimits(),h=Math.max(0,Math.min(max,ui.mapHeight??(ui.expanded?100:innerHeight*.34)));$('desk').style.setProperty('--map-h',h+'px');$('resize').setAttribute('aria-valuemin','0');$('resize').setAttribute('aria-valuenow',String(Math.round(h)));$('resize').setAttribute('aria-valuemax',String(Math.round(max)));$('layout-toggle').textContent=ui.expanded?'恢复军图 ↑':'展开军报 ↓';requestAnimationFrame(positionMap);}
let drag:{y:number;h:number}|null=null;const handle=$('resize');handle.addEventListener('pointerdown',e=>{drag={y:e.clientY,h:$('map-world').parentElement!.clientHeight};handle.setPointerCapture(e.pointerId);});handle.addEventListener('pointermove',e=>{if(drag){ui.mapHeight=Math.max(0,Math.min(layoutLimits().max,drag.h+e.clientY-drag.y));setHeight();}});handle.addEventListener('pointerup',()=>{drag=null;save();});handle.addEventListener('pointercancel',()=>{drag=null;save();});handle.addEventListener('keydown',e=>{if(!['ArrowUp','ArrowDown','Home','End'].includes(e.key))return;e.preventDefault();ui.mapHeight=e.key==='Home'?0:e.key==='End'?layoutLimits().max:$('map-world').parentElement!.clientHeight+(e.key==='ArrowUp'?-20:20);setHeight();save();});
window.addEventListener('resize',()=>{setHeight();render();});
window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===parent&&e.data?.type==='wzy-shared-error')feedback(String(e.data.message));});
render();setHeight();void run(async()=>{await client.load();showRoundBanner();});
if(!ui.seen)$<HTMLDialogElement>('info').showModal();
$('round-report').addEventListener('close',()=>{const s=client.session;if(s?.lastReport)localStorage.setItem('yiling-round-report-'+s.scenarioId,String(s.lastReport.round));showRoundBanner();if(s?.ended)showEnding(s);});
$('info').addEventListener('close',syncRound);
