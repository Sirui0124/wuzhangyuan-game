import http from 'node:http';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {resolve,extname,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID,randomBytes} from 'node:crypto';
import {ROUTES,BY_ID,CAMP} from './.build/data.js';
import {createState,publicView,targetRoute,offeredFacts,recordChat,think,validateOrders,orderOutlook,resolveRound,nextRound,chooseCampPriority,assertCanAsk} from './.build/engine.js';
import {liveAI,modelConfig,validateTalk,validateAssess} from './ai.mjs';
const home=fileURLToPath(new URL('.',import.meta.url));
export function createDemoServer({ai=liveAI,saveDir=resolve(home,'.cache/saves'),settingsFile}={}){
 const runAI=(kind,input,signal)=>ai(kind,input,signal,settingsFile);
 const busy=new Set(),previews=new Map();
 const pathFor=id=>{if(typeof id!=='string'||!/^[0-9a-f-]{36}$/.test(id))throw new Error('存档标识无效。');return resolve(saveDir,id+'.json');};
 const load=async id=>{const s=JSON.parse(await readFile(pathFor(id),'utf8'));if(s.version!==2)throw new Error('军营选项和补兵规则已更新，请刷新页面后开启新版试玩；旧存档已保留。');for(const d of Object.values(s.campDecisions))d.releasePhase??='orders';return s;};
 const save=async s=>{await mkdir(saveDir,{recursive:true});const path=pathFor(s.id),tmp=path+'.'+randomUUID()+'.tmp';await writeFile(tmp,JSON.stringify(s));await rename(tmp,path);};
 return http.createServer(async(req,res)=>{
  const send=(status,data)=>{if(res.destroyed)return;res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  let lock;
  try{
   const host=req.headers.host??'';if(!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host))return send(403,{error:'此试玩仅供本机访问。'});
   if(req.headers.origin&&new URL(req.headers.origin).host!==host)return send(403,{error:'不接受其他网页的请求。'});
   const url=new URL(req.url,'http://'+host);
   if(req.method==='GET'&&url.pathname==='/api/health'){const c=await modelConfig(settingsFile);return send(200,{ok:true,configured:!!c.apiKey,model:c.model,demo:'yiling-rescue-v1'});}
   if(req.method==='GET'&&url.pathname==='/api/state')return send(200,{state:publicView(await load(url.searchParams.get('session')))});
   if(req.method==='POST'&&url.pathname.startsWith('/api/')){
    let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>50000)throw new Error('请求过长。');}const body=JSON.parse(raw||'{}');
    if(url.pathname==='/api/start'){const s=createState(randomUUID(),randomBytes(16).toString('hex'));await save(s);return send(200,{state:publicView(s)});}
    if(busy.has(body.session))return send(409,{error:'上一项操作还在进行，请稍候。'});lock=body.session;busy.add(lock);
    const s=await load(body.session);
    if(url.pathname==='/api/commit'&&s.lastCommit===body.token)return send(200,{state:publicView(s)});
    if(body.revision!==s.revision)return send(409,{error:'进度已变化，请刷新后继续，尚未扣兵。'});
    // Checkpoints stay on the server, including private deterministic battle seeds.
    if(url.pathname==='/api/checkpoint'){
     const snapshot={...structuredClone(s),id:randomUUID(),checkpoint:true};await save(snapshot);
     return send(200,{checkpoint:{id:snapshot.id,round:snapshot.round,phase:snapshot.phase}});
    }
    if(url.pathname==='/api/restore'){
     const snapshot=await load(body.checkpoint);if(snapshot.checkpoint!==true)throw new Error('请选择有效的手动存档。');
     const restored={...structuredClone(snapshot),id:randomUUID()};delete restored.checkpoint;await save(restored);
     return send(200,{state:publicView(restored)});
    }
    if(s.checkpoint)throw new Error('手动存档不能直接推进，请先读档。');
    const controller=new AbortController();res.once('close',()=>{if(!res.writableEnded)controller.abort();});const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(90000)]);
    if(url.pathname==='/api/camp-select'){const reply=chooseCampPriority(s,body.target,body.route);await save(s);previews.delete(s.id);return send(200,{state:publicView(s),reply});}
    if(url.pathname==='/api/camp-choice')throw new Error('军营问话已更新，请刷新页面后选择接应路线。');
    if(url.pathname==='/api/talk'){
     if(s.phase==='ended')throw new Error('这一夜已经结束。');const target=body.target,question=body.question;
     if(CAMP.some(n=>n.id===target))throw new Error('营中交谈请使用选项；已发现路线可向报信人追问。');
     if(typeof question!=='string'||!question.trim()||question.length>1400)throw new Error('请输入1至1400字的问话。');
     const id=targetRoute(s,target,body.subject),r=id?BY_ID[id]:null,t=id?s.tracks[id]:null;
     assertCanAsk(s,id);
     const traderRumor=target==='boat'&&!(s.chats.boat?.length)&&!s.tracks.sun.discovered;
     const offered=id&&!traderRumor?offeredFacts(s,id):[];
     const persuasionEnabled=!!(s.phase==='orders'&&r?.core&&t?.thought&&!t.agreed&&target===id&&t.status==='active');
     const input={speaker:persuasionEnabled?r.name:(CAMP.find(n=>n.id===target)?.name??r?.messenger),round:s.round,topic:r?.name,question,history:(s.chats[target]??[]).slice(-10),traderRumor,persuasionEnabled,specificConcerns:persuasionEnabled?r.facts.slice(1).map(f=>f.text):[],known:r?r.facts.filter(f=>t.known.includes(f.id)):[{id:'authority',text:'刘备已授权玩家调遣接应兵；开局2500人，第2至第6轮各补500人，总共5000人；张南、冯习与马良需要接应，其余消息应向营地的人询问。'}],offered:r?r.facts.filter(f=>offered.includes(f.id)):[],situation:t?{risk:t.risk,spent:t.spent,status:t.status,outcome:t.outcome}:null};
     if(persuasionEnabled)input.successChecklist=id==='sha'?['安排寻找失散部众并约定集合位置。','安排接应队掩护共同撤离，避免单骑回头迎战。']:['安排两岸接收/联络回号，并分批渡运将士。','安排最后一批的退路，通道有变及时通报停止。'];
     if(t?.latest)input.latestReport=t.latest;
     const result=validateTalk(await runAI('talk',input,signal),offered,{traderRumor,persuasionEnabled,known:t?.known??[]});
     signal.throwIfAborted();recordChat(s,target,question,result.reply,result.reveal,result.accepted,input.speaker,id);await save(s);previews.delete(s.id);return send(200,{state:publicView(s),reply:result.reply});
    }
    if(url.pathname==='/api/think'){think(s,body.id,body.facts);await save(s);previews.delete(s.id);return send(200,{state:publicView(s)});}
    if(url.pathname==='/api/preview'){
     validateOrders(s,body.orders);const input=body.orders.map(o=>({...o,known:BY_ID[o.id].facts.filter(f=>s.tracks[o.id].known.includes(f.id)),allowedActions:BY_ID[o.id].actions.filter(a=>s.tracks[o.id].known.includes(a.fact))}));
     const assessments=input.length?validateAssess(await runAI('assess',{orders:input},signal),input):[];signal.throwIfAborted();
     const entries=body.orders.map(o=>{const a=assessments.find(x=>x.id===o.id);return {...o,name:BY_ID[o.id].name,reason:a.reason,outlook:orderOutlook(s,o,a)};});
     const token=randomUUID();previews.set(s.id,{token,revision:s.revision,orders:body.orders,assessments});return send(200,{token,entries,total:body.orders.reduce((v,o)=>v+o.troops,0)});
    }
    if(url.pathname==='/api/commit'){
     const p=previews.get(s.id);if(!p||p.token!==body.token||p.revision!==s.revision)throw new Error('军令预览已失效，请重新核对。');
     const candidate=structuredClone(s),report=resolveRound(candidate,p.orders,p.assessments);
     const result=await runAI('report',{round:s.round,changes:report.changes.map(c=>({...c,known:BY_ID[c.id].facts.filter(f=>candidate.tracks[c.id].known.includes(f.id))})),spent:report.spent,remaining:candidate.troops},signal);
     if(typeof result?.text!=='string'||result.text.length<2||result.text.length>2400||!Array.isArray(result.messages)||result.messages.length!==report.changes.length||new Set(result.messages.map(m=>m.id)).size!==report.changes.length)throw new Error('军报生成不完整，军令尚未提交，请重试。');
     for(const c of report.changes){const m=result.messages.find(m=>m.id===c.id);if(typeof m?.message!=='string'||m.message.length<2||m.message.length>900)throw new Error('有一路军报缺失，本次未提交。');c.message=m.message;candidate.tracks[c.id].latest=m.message;}
     signal.throwIfAborted();report.text=result.text;candidate.lastCommit=body.token;await save(candidate);previews.delete(s.id);return send(200,{state:publicView(candidate)});
    }
    if(url.pathname==='/api/next'){nextRound(s);await save(s);return send(200,{state:publicView(s)});}
    return send(404,{error:'没有这个操作。'});
   }
   if(req.method!=='GET')return send(405,{error:'不支持的请求。'});
   const files={'/':'public/index.html','/style.css':'public/style.css','/chapter-ui.css':'public/chapter-ui.css','/shared/dialogue-ink.css':'../../GameStarter/web-demo/public/dialogue-ink.css','/portrait-staging.css':'../../GameStarter/web-demo/public/portrait-staging.css','/ui/dialogue-ink-wash-v1.png':'../../GameStarter/web-demo/public/ui/dialogue-ink-wash-v1.png','/ui/folio-cover-neutral-v1.png':'../../GameStarter/web-demo/public/ui/folio-cover-neutral-v1.png','/art/retreat-map.png':'public/art/yiling-retreat-map-v1.png','/selection-view.js':'.build/selection-view.js','/shared/thought-final.css':'../../GameStarter/web-demo/public/thought-final.css','/app.js':'.build/app.js','/result-handoff.js':'.build/result-handoff.js','/background.png':'../../source-art/visuals/runtime/scenes/yiling/yiling_reception_camp-v1.png'};
   for(const id of ['liu','clerk','attendant','boat'])files['/portraits/'+id+'.png']='public/art/portraits/'+id+'-v1.png';
   const file=files[url.pathname];if(!file)return send(404,{error:'没有这个文件。'});
   const data=await readFile(resolve(home,file));res.writeHead(200,{'Content-Type':{'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png'}[extname(file)],'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(data);
  }catch(e){send(e.code==='ENOENT'?404:400,{error:e.name==='TimeoutError'?'AI回应超时，本次未提交；请重试。':e.message??'请求失败，请重试。'});}finally{if(lock)busy.delete(lock);}
 });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const port=Number(process.env.YILING_DEMO_PORT||8828);createDemoServer().listen(port,'127.0.0.1',()=>console.log(`Yiling rescue demo: http://127.0.0.1:${port}`));}
