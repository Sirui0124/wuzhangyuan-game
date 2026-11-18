import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {talk} from './fu-ai.mjs';
import {narrateReport} from './report-ai.mjs';
import {VERSION,FRONTS,fresh,orders,settle,derive,message,publicSession,fail} from './campaign-engine.mjs';

function preset(s,front,text){
 const r=s.fronts[front];if(r.status==='home')return '人都已接回，伤兵正在安置。接应队的伤亡已经报给军侯。';
 if(r.status==='safe')return '已经撤出来了，正往接应营走。';
 if(/人数|多少|几人/.test(text))return '前线人数还未清点齐，不能给你一个确数。接应营的可用兵力以军侯账册为准。';
 if(/敌|吴军|追兵/.test(text))return '后面还有追兵。让一队掩护，一队接人，别把护送的人全堵在后面。';
 if(front==='sha')return r.progress>=r.work/2?'东沟的人已接上，西沟还有担架。让接应的人继续往西沟走，掩护的队伍别先撤。':'东沟的人能先走，西沟的伤兵要有人抬。先护送东沟，再把西沟的人接出来。';
 return r.progress>=r.work/2?'张南前队已接上，冯习带的后队还在后面。留下掩护，把后队也接齐。':'张南在前，冯习带后队伤兵。前后两队都要接，先护送前队，再回收后队。';
}
export function createCampaignRuntime({directory=fileURLToPath(new URL('../../outputs/yiling-shared-saves/',import.meta.url)),model,reportModel=model?false:undefined}={}){
 const locks=new Map();
 async function locked(id,fn){const prior=locks.get(id)||Promise.resolve();let release;const gate=new Promise(r=>release=r);const tail=prior.then(()=>gate);locks.set(id,tail);await prior;try{return await fn();}finally{release();if(locks.get(id)===tail)locks.delete(id);}}
 function path(id){if(typeof id!=='string'||!/^[a-f\d-]{36}$/i.test(id))fail('存档编号无效。');return join(directory,id+'.json');}
 async function load(id){try{const s=JSON.parse(await readFile(path(id),'utf8'));if(![VERSION,'shared-2000-v1'].includes(s.balanceVersion))fail('此存档属于旧兵力方案，请新开营救；原记录保留。',409);s.roundLimit??=6;if(s.round>=6&&!s.ended){s.ended=true;s.endReason="deadline";}return s;}catch(e){if(e.code==='ENOENT')fail('营救存档不存在，请新开营救。',404);throw e;}}
 async function persist(s){await mkdir(directory,{recursive:true});const dest=path(s.scenarioId),tmp=dest+'.'+randomUUID()+'.tmp';await writeFile(tmp,JSON.stringify(s));await rename(tmp,dest);}
 return {
  async session(id,difficulty){if(id)return publicSession(await load(id));const s=fresh({seed:randomBytes(4).readUInt32LE()||1,difficulty:difficulty||'normal'});await persist(s);return publicSession(s);},
  async act(kind,input,signal){
   if(!['chat','orders','round'].includes(kind))fail('未知操作。');
   if(typeof input.requestId!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(input.requestId))fail('请求编号无效。');
   return locked(input.scenarioId,async()=>{
    const current=await load(input.scenarioId),hash=createHash('sha256').update(JSON.stringify({kind,...input})).digest('hex');
    if(current.requests[input.requestId]){if(current.requests[input.requestId]!==hash)fail('请求编号不能重复用于不同军令。',409);return publicSession(current);}
    if(input.expectedRevision!==current.revision)throw Object.assign(Error('军情已更新，请按最新兵力重新复诵。'),{status:409,session:publicSession(current)});
    if(current.ended)fail('本次营救已结算，请新开一局。');
    const s=structuredClone(current);
    if(kind==='orders')orders(s,input.orders);
    if(kind==='round'){if(input.trigger!=='endRound')fail('请明确结束本轮。');settle(s);const narrative=await narrateReport(s,{model:reportModel,signal});s.lastReport.narrative=narrative;s.messages=s.messages.filter(m=>!(m.round===s.round&&m.kind==='report'));for(const p of narrative.paragraphs)message(s,'前线军报',p.text,'report',p.front==='camp-base'?null:p.front);}
    if(kind==='chat'){
     const f=input.front;if(!Object.hasOwn(FRONTS,f)||typeof input.text!=='string'||!input.text.trim()||input.text.length>500)fail('请写1至500字的问话。');
     const count=s.messages.filter(m=>m.kind==='question'&&m.front===f&&m.round===s.round).length;
     if(count>=8)fail('本轮已交谈八次，可先安排接应，下轮再继续。');
     const text=input.text.trim(),phase=s.phase;
     // The AI authority adapter sees only the units actually at Fu's rear.
     const result=f==='fu'?await talk(s,text,{signal,model}):null;
     if(signal?.aborted)fail('本次请求已取消，原文保留。',499);
     const playerId=message(s,'我',text,'question',f),reply=result?.reply||preset(s,f,text);
     const replyId=message(s,FRONTS[f].name,reply,'dialogue',f);
     if(result){s.facts.withdrawalAccepted=result.accepted;derive(s);const turn={phase,playerId,player:text,replyId,reply,outcomeId:result.classified.outcomeId,classification:result.classified,promptVersion:result.promptVersion,model:result.model};s.turns.push(turn);if(phase!==s.phase)s.turns.push({...turn,phase:s.phase,transitionCarry:true});}
    }
    s.revision++;s.nextSendAt=0;s.requests[input.requestId]=hash;await persist(s);return publicSession(s);
   });
  }
 };
}
export function campaignHandler(runtime=createCampaignRuntime()){
 return async(req,res)=>{
  const send=(status,body)=>{if(!res.destroyed){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body));}};
  if(req.method!=='POST')return send(405,{ok:false,error:'请使用POST。'});
  if(req.headers.origin){let host;try{host=new URL(req.headers.origin).host;}catch{}if(host!==req.headers.host)return send(403,{ok:false,error:'请求来源不符。'});}
  if(!req.headers['content-type']?.startsWith('application/json'))return send(415,{ok:false,error:'需要JSON请求。'});
  const controller=new AbortController();res.on('close',()=>{if(!res.writableEnded)controller.abort();});const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(90000)]);
  try{let body='';for await(const part of req){body+=part.toString('utf8');if(Buffer.byteLength(body)>16000)fail('请求过长。',413);}let input;try{input=JSON.parse(body);}catch{fail('JSON格式错误。');}if(!input||typeof input!=='object'||Array.isArray(input))fail('请求格式错误。');
   const kind=new URL(req.url,'http://localhost').pathname.split('/').at(-1);
   const session=kind==='session'?await runtime.session(input.scenarioId,input.difficulty):await runtime.act(kind,input,signal);send(200,{ok:true,session});
  }catch(e){send(signal.aborted?504:e.status||502,{ok:false,error:signal.aborted?'等待回复超时，请重试原请求。':e.message,...(e.session?{session:e.session}:{})});}
 };
}
