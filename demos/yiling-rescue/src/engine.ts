import {ROUTES,BY_ID,CAMP,CAMP_DIALOGUES,CAMP_BRIEFINGS,campReply,INITIAL_TROOPS,REINFORCEMENT,TOTAL_TROOPS,ROUNDS,ROUND_PRESSURE} from './data.js';
export type Status='active'|'saved'|'failed';
export type Track={discovered:boolean;risk:number;spent:number;known:string[];used:string[];thought:boolean;agreed:boolean;status:Status;outcome:string;draw:number;chance?:number;latest?:string};
export type Chat={role:'user'|'assistant';text:string;round:number;speaker?:string};
export type Order={id:string;troops:number;text:string};
export type Assessment={id:string;matched:string[];reason:string};
export type Change={id:string;name:string;before:number;after:number;troops:number;effect:number;matched:string[];status:Status;outcome:string;chance?:number;message?:string;pressure?:number;execution?:string};
export type Report={round:number;spent:number;changes:Change[];text:string};
export type State={version:2;battleSeed?:string;campVisits?:Record<string,{round:number;route:string;reply:string}>;campDecisions:Record<string,{choice:string;releaseRound:number;releasePhase:'orders'|'results';reply:string}>;notices:string[];id:string;revision:number;round:number;phase:'orders'|'results'|'ended';troops:number;tracks:Record<string,Track>;chats:Record<string,Chat[]>;reports:Report[];createdAt:string};
export function probability(risk:number):number {if(risk<=0)return 1;if(risk<10)return .95;if(risk>=50)return 0;return .9*(50-risk)/40;}
export function seededDraw(seed:string,id:string):number {let h=2166136261;for(const c of seed+':'+id){h^=c.charCodeAt(0);h=Math.imul(h,16777619);} h^=h>>>16;return (h>>>0)/4294967296;}
export function createState(id:string,seed:string):State{return {version:2,battleSeed:seed,campDecisions:{},notices:[],id,revision:0,round:1,phase:'orders',troops:INITIAL_TROOPS,tracks:Object.fromEntries(ROUTES.map(r=>[r.id,{discovered:false,risk:r.initial,spent:0,known:[],used:[],thought:false,agreed:false,status:'active',outcome:'',draw:seededDraw(seed,r.id)}])),chats:{},reports:[],createdAt:new Date().toISOString()};}
export function assertOrdersPhase(s:State){if(s.phase!=='orders')throw new Error('请先读完本轮军报，再进入下一轮。');}
export function currentHour(s:State):number{return (s.round-1)*2+(s.phase==='orders'?1:2);}
export function campUsed(s:State,npcId:string){return s.campVisits?.[npcId]?.round===s.round||(s.chats[npcId]??[]).some(c=>c.role==='user'&&c.round===s.round);}
export function campVisitReply(s:State,npcId:string){
 const visit=s.campVisits?.[npcId];if(visit?.round===s.round)return visit.reply;
 if(campUsed(s,npcId))return s.round===6?'消息都交代过了，赶紧去安排接应吧。':'这一趟的消息已经交代过了，余下的等下回军报。';
 return '我知道的消息都已送到，先去安排接应吧。';
}
function campRouteReady(s:State,id:string){const d=s.campDecisions[id];return !s.tracks[id].discovered&&(!d||(d.releaseRound-1)*2+(d.releasePhase==='results'?2:1)<=currentHour(s));}
export function campBriefing(s:State,npcId:string){
 const npc=CAMP.find(n=>n.id===npcId);
 if(!npc)return null;
 if(campUsed(s,npcId)||s.phase==='ended'||currentHour(s)<npc.unlockHour)return null;
 const b=CAMP_BRIEFINGS[npcId].find(b=>b.routes.some(id=>!s.tracks[id].discovered));
 if(!b)return null;
 const choices=b.routes.flatMap((id,i)=>campRouteReady(s,id)?[{id,text:b.choices[i]}]:[]);
 if(!choices.length)return null;
 return {prompt:choices.length===b.routes.length?b.prompt:`还有${BY_ID[choices[0].id].name}的消息，交给你安排。`,choices};
}
export function chooseCampPriority(s:State,npcId:string,id:string){
 const brief=campBriefing(s,npcId);
 if(!brief?.choices.some(c=>c.id===id))throw new Error('这次交谈已结束，或这一路尚未轮到。');
 const group=CAMP_BRIEFINGS[npcId].find(b=>b.routes.includes(id))!;
 const selected=CAMP_DIALOGUES[id].options.find(o=>!o.delay)!;
 const deferred=group.routes.filter(other=>other!==id&&!s.tracks[other].discovered&&!s.campDecisions[other]);
 const reply=selected.reply+(deferred.length?(s.round===6?'另一路的消息要等到天亮，恐怕来不及了。':group.later):'');
 chooseCamp(s,npcId,id,selected.id,reply);
 for(const other of deferred){const option=CAMP_DIALOGUES[other].options.find(o=>o.delay)!;s.campDecisions[other]={choice:option.id,releaseRound:s.round+1,releasePhase:s.phase==='results'?'results':'orders',reply:option.reply};}
 s.campVisits??={};s.campVisits[npcId]={round:s.round,route:id,reply};
 // Store the actual priority choice, not the old investigation-method wording.
 s.chats[npcId][s.chats[npcId].length-2].text=brief.choices.find(c=>c.id===id)!.text;
 return reply;
}
export function targetRoute(s:State,target:string,subject?:string):string|null {
 const camp=CAMP.find(n=>n.id===target);
 if(camp){
  if(currentHour(s)<camp.unlockHour)throw new Error('船工尚未靠岸，第4个时辰才能交谈。');
  if(subject&&!camp.routes.includes(subject))throw new Error('此人没有这一路的消息。');
  return subject??camp.routes.find(id=>!s.tracks[id].discovered)??camp.routes.find(id=>offeredFacts(s,id).length)??camp.routes[0];
 }
 if(BY_ID[target]&&s.tracks[target].discovered)return target;
 throw new Error('尚未见到这位报信人。');
}
export function campOption(s:State,npcId:string,id:string,choice:string){
 if(s.phase==='ended')throw new Error('这一夜已经结束。');
 const npc=CAMP.find(n=>n.id===npcId);
 if(!npc||!npc.routes.includes(id))throw new Error('这不是此人的消息。');
 if(campUsed(s,npcId))throw new Error('本轮已交谈，请等下一轮军报。');
 targetRoute(s,npcId,id);
 if(!campRouteReady(s,id))throw new Error('此事已经安排，或消息尚未查明。');
 const dialogue=CAMP_DIALOGUES[id],option=dialogue.options.find(o=>o.id===choice);
 if(!option)throw new Error('请选择眼前的一项问话。');
 return {npc,dialogue,option};
}
function revealRoute(s:State,id:string){const t=s.tracks[id];t.discovered=true;t.known=[...new Set([...t.known,BY_ID[id].facts[0].id])];}
export function chooseCamp(s:State,npcId:string,id:string,choice:string,reply?:string){
 const {npc,option}=campOption(s,npcId,id,choice);
 const releaseRound=s.round+(option.delay?1:0),answer=reply??option.reply;
 s.campDecisions[id]={choice,releaseRound,releasePhase:s.phase==='results'?'results':'orders',reply:answer};
 if(!option.delay)revealRoute(s,id);
 s.chats[npcId]??=[];s.chats[npcId].push({role:'user',text:option.text,round:s.round},{role:'assistant',text:answer,round:s.round,speaker:npc.name});
 s.revision++;
}
export function offeredFacts(s:State,id:string):string[]{const t=s.tracks[id];if(t.status!=='active')return[];const next=BY_ID[id].facts.find(f=>!t.known.includes(f.id));return next?[next.id]:[];}
export const QUESTIONS_PER_ROUND=3;
export function questionsUsed(s:State,id:string){return (s.chats[id]??[]).filter(c=>c.role==='user'&&c.round===s.round).length;}
export function assertCanAsk(s:State,id:string){if(questionsUsed(s,id)>=QUESTIONS_PER_ROUND)throw new Error('这支队伍本轮已问满3次，请安排军令或等下一轮。');}
export function recordChat(s:State,target:string,question:string,reply:string,facts:string[],accepted=false,speaker?:string,subject?:string){
 if(s.phase==='ended')throw new Error('这一夜已经结束。');if(CAMP.some(n=>n.id===target))throw new Error('营中交谈请使用选项。');const id=targetRoute(s,target,subject);
 if(id){assertCanAsk(s,id);const t=s.tracks[id],allowed=offeredFacts(s,id);if(facts.some(f=>!allowed.includes(f))||facts.length>1)throw new Error('回复超出了本次允许透露的情报。');
 if(facts.length){t.discovered=true;t.known=[...new Set([...t.known,...facts])];}
 if(accepted&&s.phase==='orders'&&BY_ID[id].core&&t.thought&&t.status==='active'&&!t.agreed){t.agreed=true;t.risk=Math.max(0,t.risk-8);if(t.risk===0){t.status='saved';t.outcome=BY_ID[id].success;}}
 }
 s.chats[target]??=[];s.chats[target].push({role:'user',text:question,round:s.round},{role:'assistant',text:reply,round:s.round,speaker});s.revision++;
}
export function think(s:State,id:string,facts:string[]){assertOrdersPhase(s);const r=BY_ID[id],t=s.tracks[id];if(!r?.core||!t?.discovered||t.status!=='active')throw new Error('此处没有待整理的问题。');if(!Array.isArray(facts)||facts.length!==2||!r.facts.slice(1).every(f=>facts.includes(f.id)&&t.known.includes(f.id)))throw new Error('还需把接应办法和最后的退路联系起来；先向报信人问清两件事。');t.thought=true;s.revision++;}
export function validateOrders(s:State,orders:Order[]){assertOrdersPhase(s);if(!Array.isArray(orders)||orders.length>ROUTES.length)throw new Error('军令格式不正确。');let total=0;const seen=new Set<string>();for(const o of orders){const t=s.tracks[o?.id];if(!t?.discovered||t.status!=='active'||seen.has(o.id))throw new Error('营救对象已结算、未发现或重复。');if(!Number.isInteger(o.troops)||o.troops<100||o.troops%100!==0)throw new Error('每道军令至少派100人，并按100人递增。');if(typeof o.text!=='string'||!o.text.trim()||o.text.length>1400)throw new Error('请写明军令，最多1400字。');seen.add(o.id);total+=o.troops;}if(total>s.troops)throw new Error('本轮拟派兵力超过剩余可调兵力。');return total;}
export function battleBounds(s:State,id:string,matched=0){
 const p=ROUND_PRESSURE[s.round-1],r=BY_ID[id];
 // A complete, informed order narrows the downside; it does not remove uncertainty.
 return {minFactor:p.efficiency[0]+matched*.02,maxFactor:p.efficiency[1],minGrowth:r.growth+p.growth[0],maxGrowth:r.growth+p.growth[1]};
}
export function actionEffect(s:State,o:Order,a:Assessment){
 const r=BY_ID[o.id],t=s.tracks[o.id];const allowed=r.actions.filter(x=>t.known.includes(x.fact)).map(x=>x.id);
 const matched=[...new Set(a.matched)].filter(x=>allowed.includes(x));const fresh=matched.filter(x=>!t.used.includes(x));
 const quality=.55+.15*matched.length,cooperation=r.core&&!t.agreed?.75:1;
 const troops=Math.floor(100*o.troops/r.cost*quality*cooperation),effect=troops+fresh.length*6;
 const bounds=battleBounds(s,o.id,matched.length);
 return {matched,effect,troopEffect:troops,planEffect:fresh.length*6,quality,cooperation,...bounds,minEffect:Math.floor(effect*bounds.minFactor),maxEffect:Math.floor(effect*bounds.maxFactor)};
}
function battleDraw(s:State,id:string,kind:string){
 // Existing saves already contain private draws; use them without resetting progress.
 const seed=s.battleSeed??ROUTES.map(r=>s.tracks[r.id].draw).join(':');
 return seededDraw(seed,`battle:${s.round}:${id}:${kind}`);
}
function pressureFor(s:State,id:string){const b=battleBounds(s,id);return b.minGrowth+Math.floor(battleDraw(s,id,'pressure')*(b.maxGrowth-b.minGrowth+1));}
export function orderOutlook(s:State,o:Order,a:Assessment){
 const e=actionEffect(s,o,a),risk=s.tracks[o.id].risk;
 const best=Math.max(0,Math.min(100,risk+e.minGrowth-e.maxEffect));
 const worst=Math.max(0,Math.min(100,risk+e.maxGrowth-e.minEffect));
 if(worst===0)return '接应较有把握';
 if(best===0)return '有望接回，仍有变数';
 if(best>=risk)return '兵力恐难稳住局面';
 if(worst>=risk)return '接应可能受阻，危机未必下降';
 return '可缓解危机，仍需后续接应';
}
export function requiredTroops(s:State,id:string){
 const r=BY_ID[id],t=s.tracks[id],b=battleBounds(s,id,3);
 return Math.ceil((t.risk+(b.minGrowth+b.maxGrowth)/2)*r.cost/100/(r.core&&!t.agreed?.75:1)/((b.minFactor+b.maxFactor)/2)/100)*100;
}
export function resolveRound(s:State,orders:Order[],assessments:Assessment[]):Report{
 const total=validateOrders(s,orders);if(assessments.length!==orders.length||new Set(assessments.map(a=>a.id)).size!==orders.length)throw new Error('军令核验不完整。');for(const o of orders)if(!assessments.some(a=>a.id===o.id))throw new Error('军令核验缺少对象。');
 const changes:Change[]=[];s.troops-=total;
 for(const r of ROUTES){const t=s.tracks[r.id];if(t.status!=='active'||(r.id==='sun'&&s.round<3))continue;
 const before=t.risk,o=orders.find(x=>x.id===r.id),pressure=pressureFor(s,r.id);let effect=0,matched:string[]=[],execution='尚无接应，局势继续恶化。';
 if(o){const e=actionEffect(s,o,assessments.find(a=>a.id===r.id)!);const roll=battleDraw(s,r.id,'execution');effect=e.minEffect+Math.floor(roll*(e.maxEffect-e.minEffect+1));matched=e.matched;execution=roll<.25?'接应受阻，进展慢于预期。':roll>.75?'接应推进较顺利。':'接应队按军令推进。';t.used=[...new Set([...t.used,...matched])];t.spent+=o.troops;}
 t.risk=Math.max(0,Math.min(100,t.risk+pressure-effect));
 if(t.risk===0){t.status='saved';t.outcome=r.success;t.chance=1;}
 else if(s.round>=r.deadline){t.chance=probability(t.risk);t.status=t.draw<t.chance?'saved':'failed';t.outcome=t.status==='saved'?r.success:r.failure;}
 if(t.discovered)changes.push({id:r.id,name:r.name,before,after:t.risk,troops:o?.troops??0,effect,pressure,execution,matched,status:t.status,outcome:t.outcome,...(t.chance!==undefined?{chance:t.chance}:{})});
 }
 s.phase='results';
 const report={round:s.round,spent:total,changes,text:''};s.reports.push(report);s.revision++;return report;
}
export function nextRound(s:State){if(s.phase!=='results')throw new Error('当前还没有可确认的军报。');if(s.round>=ROUNDS)s.phase='ended';else{s.round++;s.phase='orders';s.troops+=REINFORCEMENT;s.notices=[`本轮增补${REINFORCEMENT}人，已编入可调兵力。`];}s.revision++;}
export function publicView(s:State){return {id:s.id,revision:s.revision,round:s.round,phase:s.phase,troops:s.troops,total:TOTAL_TROOPS,received:INITIAL_TROOPS+(s.round-1)*REINFORCEMENT,nextReinforcement:s.round<ROUNDS?REINFORCEMENT:0,futureReinforcements:(ROUNDS-s.round)*REINFORCEMENT,notices:s.notices,
 hour:currentHour(s),
 camp:CAMP.map(n=>({...n,briefing:campBriefing(s,n.id),visited:campUsed(s,n.id),selectedRoute:s.campVisits?.[n.id]?.round===s.round?s.campVisits[n.id].route:null,visitReply:campVisitReply(s,n.id),locked:currentHour(s)<n.unlockHour,topics:n.routes.map((id,i)=>({id,label:s.tracks[id].discovered?BY_ID[id].name:n.topics[i],discovered:s.tracks[id].discovered,prompt:currentHour(s)<n.unlockHour?'':CAMP_DIALOGUES[id].prompt,choices:[],decision:s.campDecisions[id]?{arrival:CAMP_DIALOGUES[id].options.find(o=>o.id===s.campDecisions[id].choice)!.delay&&s.tracks[id].discovered?(s.tracks[id].status==='active'?CAMP_DIALOGUES[id].arrival:s.tracks[id].outcome):null,text:CAMP_DIALOGUES[id].options.find(o=>o.id===s.campDecisions[id].choice)!.text,reply:campReply(id,s.campDecisions[id].choice,s.campDecisions[id].releaseRound>6),releaseRound:s.campDecisions[id].releaseRound,releasePhase:s.campDecisions[id].releasePhase,releaseHour:(s.campDecisions[id].releaseRound-1)*2+(s.campDecisions[id].releasePhase==='orders'?1:2)}:null}))})),
 routes:ROUTES.filter(r=>s.tracks[r.id].discovered||s.phase==='ended').map(r=>{const {draw,...t}=s.tracks[r.id];const left=Math.max(0,r.deadline-s.round+(s.phase==='orders'?1:0));return {id:r.id,name:r.name,role:r.role,place:r.place,messenger:r.messenger,intro:r.intro,core:r.core,thoughtQuestion:r.thought,conclusion:t.thought?r.conclusion:undefined,deadline:r.deadline,growth:r.growth,...t,remaining:left*2,operations:left,questionsUsed:questionsUsed(s,r.id),questionsLeft:Math.max(0,QUESTIONS_PER_ROUND-questionsUsed(s,r.id)),roundTroops:s.reports.find(x=>x.round===s.round)?.changes.find(c=>c.id===r.id)?.troops??0,required:requiredTroops(s,r.id),facts:r.facts.filter(f=>t.known.includes(f.id)),questions:r.facts.filter(f=>!t.known.includes(f.id)).slice(0,1).map(f=>f.question),presets:r.actions.filter(a=>t.known.includes(a.fact)).map(a=>a.text)};}),chats:s.chats,reports:s.reports};}
