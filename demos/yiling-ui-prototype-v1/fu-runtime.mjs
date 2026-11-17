import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {createState,evaluate,resolveRound,crisisView} from '../../docs/design/chapter-four-ai-library-20261117/furong-rescue.ts';
import {design,talk} from './fu-ai.mjs';

const CAPACITY={甲:700,乙:800,丙:600,丁:400};
export const TASKS={
 rescue:{label:'护送傅肜',minMen:100,turns:2},
 scout:{label:'探查撤路',minMen:50,turns:1},
 relieve:{label:'接替断后',minMen:200,turns:2},
 suppress:{label:'压制追兵',minMen:300,turns:2},
 verify:{label:'核实刘备消息',minMen:10,turns:2},
 signal:{label:'传撤离信号',minMen:10,turns:1},
 hold:{label:'原地待命',minMen:0,turns:1},
 rest:{label:'原地休整',minMen:0,turns:1},
 retreat:{label:'撤回接应营',minMen:0,turns:1}
};
function fail(message,status=400){throw Object.assign(new Error(message),{status});}
function message(s,speaker,text,kind='report',round=s.round){const m={id:String(++s.seq),speaker,text,kind,round};s.messages.push(m);return m.id;}
function receipt(s,text){const id=s.scenarioId+'/event-'+(++s.eventSeq);s.receipts.push({id,round:s.round,text});message(s,'军侯',text);return id;}
function fresh(){
 const scenarioId=randomUUID(),seed=randomBytes(4).readUInt32LE()||1;
 const s={schemaVersion:1,scenarioId,revision:0,round:0,phase:'deceived_and_bereaved',core:createState(design,scenarioId,seed),facts:Object.fromEntries(Object.keys(design.factDefinitions).map(k=>[k,false])),units:Object.fromEntries(Object.entries(CAPACITY).map(([id,men])=>[id,{men,deployed:0,status:'营中待命',at:'camp',task:null,progress:0}])),pendingOrders:[],messages:[],receipts:[],turns:[],requests:{},seq:0,eventSeq:0,nextSendAt:0,homeAt:null};
 message(s,'傅肜','吴人说陛下已经遇害。跟着我的人也都死在这里了……我不走，叫他们再来。','dialogue');
 message(s,'军侯','傅肜仍在后阵，刘备的消息尚未核实。四支接应队可分派探路、换防、护送，也可派人查明消息。','report');
 return s;
}
function derive(s){
 // 每队只占一个岗位；知识型事实保留，岗位型事实每次从当前驻防重新投影。
 for(const key of ['reliefInPosition','enemySuppressed','escortReady'])s.facts[key]=false;
 for(const u of Object.values(s.units)){
  if(u.at!=='rear'||!u.task||u.progress<u.task.duration)continue;
  if(u.task.action==='relieve')s.facts.reliefInPosition=true;
  if(u.task.action==='suppress')s.facts.enemySuppressed=true;
  if(u.task.action==='rescue')s.facts.escortReady=true;
 }
 if(s.core.status==='safe')return;
 s.phase=s.facts.withdrawalAccepted?'withdrawal_accepted':s.facts.liubeiAliveVerified?'truth_verified':'deceived_and_bereaved';
}
export function publicSession(s){
 const view=crisisView(design,s.core,s.facts,true,'planning');
 view.revision=s.revision;view.tacticalRoundId='round-'+(s.round+1);
 if(s.phase==='home'){view.crisis.reasons=['傅肜已归营，营救结束'];view.withdrawal.blockers=['已归营'];}
 const last=s.core.journal.at(-1);
 if(last)view.lastResolution={roundId:last.roundId,resolutionId:last.resolutionId,outcome:last.outcome,probability:last.probability,crisis:last.crisis,pressureAfter:last.pressureAfter};
 return {scenarioId:s.scenarioId,revision:s.revision,round:s.round,phase:s.phase,view,messages:s.messages,units:Object.fromEntries(Object.entries(s.units).map(([id,u])=>[id,{men:u.men,deployed:u.deployed,status:u.status,at:u.at,task:u.task?.action||null}])),pendingOrders:s.pendingOrders,facts:s.facts,nextSendAt:s.nextSendAt,tasks:TASKS,
 suggestions:s.phase==='home'?['这一仗的事，你想怎样告诉陛下？','先歇一歇吧。']:s.phase==='safe'?['总算出来了，你伤得重吗？','先回营歇一歇吧。']:s.facts.withdrawalAccepted?['你现在怎么样？','等接应的人到了，就跟他们回来吧。']:s.facts.liubeiAliveVerified?['陛下还在，他还需要你。','你是放不下战死的弟兄吗？','回去把他们死守的事告诉陛下，好吗？']:['你还在后阵吗？','你为什么不肯撤？','陛下的消息，你是听谁说的？'],
 scope:'傅肜独立营救；沙摩柯和旧营仍为交互演示',designVersion:design.version};
}
function validateOrders(s,orders){
 if(!Array.isArray(orders)||orders.length<1||orders.length>4)fail('每批安排1至4支队伍。');
 const seen=new Set();
 return orders.map(o=>{
  if(!o||!Object.hasOwn(CAPACITY,o.unit)||seen.has(o.unit)||!Object.hasOwn(TASKS,o.action))fail('队伍重复或任务不明确。');
  seen.add(o.unit);
  if(o.target!==null&&o.target!=='fu')fail('本轮真实营救只接傅肜，其他两路仍为演示。');
  if(o.rush!==undefined&&typeof o.rush!=='boolean')fail('行军方式不正确。');
  if(o.via!==undefined&&!['normal','side'].includes(o.via))fail('路线不正确。');
  const task=TASKS[o.action],men=task.minMen?(o.men??CAPACITY[o.unit]):0;
  if(!Number.isInteger(men)||men<task.minMen||men>CAPACITY[o.unit])fail(task.label+'需要'+task.minMen+'至'+CAPACITY[o.unit]+'人。');
  if(o.action==='signal'&&!s.facts.withdrawalAccepted)fail('傅肜尚未接受撤离，先与他把回去的打算说清楚。');
  return {unit:o.unit,action:o.action,target:task.minMen?'fu':null,men,rush:!!o.rush,via:o.via||'normal'};
 });
}
function applyOrders(s){
 for(const o of s.pendingOrders){
  const u=s.units[o.unit];
  u.deployed=o.men;u.progress=0;
  u.task={...o,duration:Math.max(1,TASKS[o.action].turns-(o.rush&&['rescue','relieve','suppress'].includes(o.action)?1:0))};
  u.status=TASKS[o.action].label+'中';
  // 换任务即不再占旧岗位，事实在本轮行动后统一重算。
  if(['rescue','relieve','suppress','scout','verify','signal'].includes(o.action))u.at='cross';
  receipt(s,o.unit+'队执行：'+TASKS[o.action].label+(o.men?'，'+o.men+'人':'')+'。');
 }
 s.pendingOrders=[];
}
function advanceTasks(s){
 for(const [id,u] of Object.entries(s.units)){
  const t=u.task;if(!t)continue;
  if(u.progress>=t.duration)continue;
  u.progress++;
  if(t.action==='verify'&&u.progress===1&&!s.facts.liubeiAliveVerified){
   s.facts.liubeiAliveVerified=true;
   receipt(s,id+'队派出的传令兵已与刘备随行队取得联系，确认陛下仍在。这条回报已经传给傅肜，吴军所说的死讯是假的。');
  }
  if(u.progress<t.duration){u.status='行军途中';receipt(s,id+'队仍在途中，本轮尚未到位。');continue;}
  const finish=(text,back=false)=>{receipt(s,id+'队'+text);u.status=back?'已回营':TASKS[t.action].label+'已到位';u.at=back?'camp':'rear';if(back){u.deployed=0;u.task=null;}};
  switch(t.action){
   case 'verify':s.facts.liubeiAliveVerified=true;s.facts.liubeiSafeConfirmed=true;finish('再次核实：刘备已脱离当下追击。回报已送达傅肜。',true);break;
   case 'scout':s.facts.routeScouted=true;if(t.via==='side')s.facts.alternateRouteOpen=true;finish(t.via==='side'?'已探通替代撤路，并将路线报给接应营。':'已探明后阵撤路，并将路线报给接应营。',true);break;
   case 'relieve':finish('已到后阵，接替傅肜牵制追兵。');break;
   case 'suppress':finish('已到后阵，压住追兵，为傅肜撤离争取空隙。');break;
   case 'rescue':finish('已与傅肜会合，准备护送。他原先的部众均已战死，不能一同接回。');break;
   case 'signal':s.facts.withdrawalSignalDelivered=true;finish('已将撤离信号送达傅肜和接应人员。',true);break;
   case 'retreat':finish('已撤回接应营，原岗位不再有人承担。',true);break;
   case 'rest':finish('已休整完毕。',u.at==='camp');u.task=null;break;
   case 'hold':u.status='原地待命';u.task=null;receipt(s,id+'队留在原地待命，不承担掩护或护送岗位。');break;
  }
 }
 derive(s);
}
export function settle(s){
 if(s.phase==='home')fail('傅肜已归营，不再推进本次营救。');
 s.round++;
 if(s.core.status==='safe'){
  for(const u of Object.values(s.units)){u.at='camp';u.deployed=0;u.task=null;u.status='已回营';}
  s.phase='home';s.pendingOrders=[];
  receipt(s,'傅肜与本次接应人员已回到接应营。原部众战死的事实保留。');
  message(s,'傅肜','我回来了。跟我留下的那些人，都没能回来。','dialogue');
  return;
 }
 const before=s.receipts.length;
 const batchIds=s.pendingOrders.length?['batch-round-'+s.round]:[];
 applyOrders(s);advanceTasks(s);
 const currentPressure=s.core.pressure;
 const result=resolveRound(design,s.core,{scenarioId:s.scenarioId,round:s.round,expectedRevision:s.core.revision,trigger:'endRound',commandBatchIds:batchIds,receiptIds:s.receipts.slice(before).map(x=>x.id),facts:s.facts,contact:true});
 s.core=result.state;
 const r=result.resolution,pct=(r.probability*100).toFixed(2);
 if(r.outcome==='safe'){
  s.phase='safe';s.homeAt=s.round+1;s.pendingOrders=[];
  receipt(s,s.facts.escortReady?'傅肜已脱离后阵险境，正由新接应队护送回营。本次撤离没有新增伤亡。':'傅肜抓住追兵间隙撤出了后阵，正在返回接应营。本次撤离没有新增伤亡。');
  message(s,'傅肜',s.facts.withdrawalAccepted?'已经出来了，正往营里走。':s.facts.escortReady?'你们把我接出来了……可我的人还留在那里。':'追兵阵脚松了，我撤出来了……可我的人还留在那里。','dialogue');
 }else message(s,'军侯','第'+s.round+'轮：危机'+r.crisis+'/99，本轮脱险概率'+pct+'%；尚未撤出。下一轮持续受困压力增加'+(r.pressureAfter-currentPressure)+'点（上限20）。','round');
}
export function createRuntime({directory=fileURLToPath(new URL('../../outputs/furong-playtest-saves/',import.meta.url)),cooldownMs=10000,model}={}){
 const locks=new Map();
 const locked=async(id,fn)=>{const prior=locks.get(id)||Promise.resolve();let release;const hold=new Promise(r=>release=r);const tail=prior.then(()=>hold);locks.set(id,tail);await prior;try{return await fn();}finally{release();if(locks.get(id)===tail)locks.delete(id);}};
 const path=id=>{if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(id))fail('存档编号无效。');return join(directory,id+'.json');};
 async function load(id){try{const s=JSON.parse(await readFile(path(id),'utf8'));if(s.core.designVersion!==design.version)fail('此存档属于旧设计版本，请新开营救；原存档保留。',409);return s;}catch(e){if(e.code==='ENOENT')fail('没有找到这次营救存档，请新开营救。',404);throw e;}}
 async function persist(s){await mkdir(directory,{recursive:true});const dest=path(s.scenarioId),tmp=dest+'.'+randomUUID()+'.tmp';await writeFile(tmp,JSON.stringify(s),'utf8');await rename(tmp,dest);}
 return {
  async session(id){if(id)return publicSession(await load(id));const s=fresh();await persist(s);return publicSession(s);},
  async act(kind,input,signal){
   if(!['chat','orders','round'].includes(kind))fail('未知操作。');
   if(typeof input.requestId!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(input.requestId))fail('请求编号无效。');
   return locked(input.scenarioId,async()=>{
    const current=await load(input.scenarioId);
    const hash=createHash('sha256').update(JSON.stringify({kind,...input})).digest('hex');
    if(current.requests[input.requestId]){if(current.requests[input.requestId]!==hash)fail('同一请求编号不能提交不同内容。',409);return publicSession(current);}
    if(input.expectedRevision!==current.revision)throw Object.assign(new Error('军情已更新，请按最新回报再试。'),{status:409,session:publicSession(current)});
    if(kind!=='round'&&current.nextSendAt>Date.now())throw Object.assign(new Error('传话尚在间隔中，请稍等。'),{status:429,session:publicSession(current)});
    const s=structuredClone(current);
    if(kind==='chat'){
     if(typeof input.text!=='string'||!input.text.trim()||input.text.length>1200)fail('请写1至1200字的问话。');
     const text=input.text.trim(),phase=s.phase;
     const result=await talk(s,text,{signal,model});
     if(signal?.aborted)fail('请求已取消，原话未提交。',499);
     const playerId=message(s,'我',text,'question');
     const replyId=message(s,'傅肜',result.reply,'dialogue');
     s.facts.withdrawalAccepted=result.accepted;derive(s);
     s.turns.push({phase,playerId,player:text,replyId,reply:result.reply,outcomeId:result.classified.outcomeId,classification:result.classified,promptVersion:result.promptVersion,model:result.model});
     if(s.phase!==phase)s.turns.push({...s.turns.at(-1),phase:s.phase,transitionCarry:true});
    }else if(kind==='orders'){
     if(['safe','home'].includes(s.phase))fail('傅肜已脱险，继续结束本轮即可护送归营。');
     const orders=validateOrders(s,input.orders);
     for(const o of orders){s.pendingOrders=s.pendingOrders.filter(x=>x.unit!==o.unit);s.pendingOrders.push(o);}
     message(s,'我',orders.map(o=>o.unit+'队：'+TASKS[o.action].label+(o.men?'，'+o.men+'人':'')+(o.via==='side'?'，绕行':'')).join('；'),'order');
     message(s,'军侯','军令已记入本轮，结束本轮后执行。','report');
    }else{
     if(!['endRound','explicitWait'].includes(input.trigger))fail('请明确结束本轮或等待一轮。');
     settle(s);
    }
    s.revision++;if(kind!=='round')s.nextSendAt=Date.now()+cooldownMs;
    s.requests[input.requestId]=hash;
    await persist(s);
    return publicSession(s);
   });
  }
 };
}
