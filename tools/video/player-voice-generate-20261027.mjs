import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {parseEnv} from 'node:util';
import {createHash,randomUUID} from 'node:crypto';
const out=resolve('video/production/player-voice-repair-20261027');
const plan=JSON.parse(await readFile(resolve(out,'plan.json'),'utf8'));
const env=parseEnv(await readFile('GameStarter/server/.env','utf8'));
if(!env.TTS_API_KEY)throw new Error('Configured speech key missing');
const args=process.argv.slice(2),selected=args.filter(x=>!x.startsWith('--'));
const queue=plan.jobs.filter(j=>!selected.length||selected.includes(j.id));
if(args.includes('--reverse'))queue.reverse();
await mkdir(resolve(out,'generated'),{recursive:true});
const hash=b=>createHash('sha256').update(b).digest('hex');
const clean=x=>String(x).replaceAll(env.TTS_API_KEY,'[REDACTED]');
let halt=false;
async function generate(job){
 const statePath=resolve(out,'generated',job.id+'-state.json');
 try{const prior=JSON.parse(await readFile(statePath,'utf8'));console.log(JSON.stringify({id:job.id,status:prior.status,noRepost:true}));if(prior.status!=='succeeded')halt=true;return;}catch(e){if(e.code!=='ENOENT')throw e;}
 const refs=await Promise.all(job.referenceFiles.map(async file=>{const bytes=await readFile(file);return {file,bytes,sha256:hash(bytes)};}));
 const seconds=job.targetSeconds;
 const prompt=`@音频1和@音频2是同一名成年男性演员在${job.kind==='regular-dialogue'?'常规交谈':'思考和沉重'}场景中的原声参考。只参考这个人的声线、共鸣、自然咬字和口语节奏，保持同一人的中低沉声线和胸声厚度，不变成通用播报音色，不复述参考录音。${job.context}唯一允许发声的原句：“${job.text}”仅朗读引号内的原句，角色名、我、心声、旁白、画外等标签和全部控制说明均不得读出；原句本来有“我”等词时照读原句。全句约${seconds}秒内自然说完，句首与句尾各只留约0.05秒气口，不加长叹气，不添加语助词，不漏字、不重复、不匆忙吞字。只生成单人干净近讲人声，无BGM、无背景音乐、无配乐、无音效、无其他人声。`;
 const body={model:'seed-audio-1.0',text_prompt:prompt,references:refs.map(r=>({audio_data:r.bytes.toString('base64')})),audio_config:{format:'wav',sample_rate:48000,enable_subtitle:true}};
 const state={id:job.id,node:job.node,text:job.text,kind:job.kind,targetSeconds:seconds,context:job.context,model:body.model,endpoint:'https://openspeech.bytedance.com/api/v3/tts/create',requestId:randomUUID(),status:'dispatching',startedAt:new Date().toISOString(),text_prompt:prompt,references:refs.map((r,i)=>({file:r.file,sha256:r.sha256,bytes:r.bytes.length,field:`references[${i}].audio_data`,userApproved:true})),requestSha256:hash(JSON.stringify(body)),noPresetSpeaker:true,noCloneRegistration:true,userApproved:false,humanListeningReview:false};
 await writeFile(statePath,JSON.stringify(state,null,2),{flag:'wx'});
 try{
  const res=await fetch(state.endpoint,{method:'POST',redirect:'error',headers:{'X-Api-Key':env.TTS_API_KEY,'X-Api-Request-Id':state.requestId,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(300000)});
  state.httpStatus=res.status;state.logId=res.headers.get('x-tt-logid');
  const data=await res.json();
  if(!res.ok||!data.audio){state.status='failed';state.code=data.code;state.error=clean(JSON.stringify(data)).slice(0,1200);halt=true;}
  else{const bytes=Buffer.from(data.audio,'base64'),file=resolve(out,'generated',job.id+'-v1.wav');await writeFile(file,bytes,{flag:'wx'});Object.assign(state,{status:'succeeded',file,sha256:hash(bytes),duration:data.duration,originalDuration:data.original_duration,subtitle:data.subtitle,referenceUploaded:true});}
 }catch(e){Object.assign(state,{status:'unknown-no-repost',error:clean(e.message)});halt=true;}
 state.finishedAt=new Date().toISOString();await writeFile(statePath,JSON.stringify(state,null,2));
 console.log(JSON.stringify({id:job.id,status:state.status,duration:state.duration,error:state.error}));
}
// Bounded concurrency, and no automatic retries after an uncertain paid request.
await Promise.all(Array.from({length:selected.length?1:2},async()=>{while(queue.length&&!halt)await generate(queue.shift());}));
