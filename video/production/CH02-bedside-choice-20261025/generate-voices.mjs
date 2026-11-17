import {readFile,writeFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {createHash,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const base=new URL('./',import.meta.url),root=new URL('../../../',base);
const env=parseEnv(await readFile(new URL('GameStarter/server/.env',root),'utf8'));
const refs={player:new URL('source-art/audio/voice-clone/20261023/player-reference.wav',root),gouan:new URL('../CH02-films-20261025/groups/G1/user-review-20261025/gouan-reference-user-approved-V10-14p4-17p6.wav',base)};
const jobs=[
 {id:'CH2-LY02-QA',role:'player',text:'你喝酒是在五月。那这趟粮是什么时候领的？',seconds:5},
 {id:'CH2-LY02-QB',role:'player',text:'八十杖挨下来，伤还撑得住吗？',seconds:4},
 {id:'CH2-LY02-QC',role:'player',text:'喝酒误了粮，你这顿打不算冤。',seconds:4},
 {id:'CH2-LY02-RA',role:'gouan',text:'这些都有交接记录。我如今也不想争了。',seconds:5},
 {id:'CH2-LY02-RB',role:'gouan',text:'养些日子就好。你不必总挂着。',seconds:4},
];
const sha=b=>createHash('sha256').update(b).digest('hex');
await writeFile(new URL('approved-lines.json',base),JSON.stringify({authorization:'用户确认首次伤帐三选项方案，2026-10-25；未授权新增视频API',jobs},null,2));
for(const job of jobs){
 const stateFile=new URL(job.id+'-state.json',base);let prior;
 try{prior=JSON.parse(await readFile(stateFile,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 if(prior){console.log(JSON.stringify({id:job.id,status:prior.status,noRepost:true}));if(prior.status!=='succeeded')break;continue;}
 const ref=await readFile(refs[job.role]);
 const prompt=`仅采用@音频1中成年男性的音色，${job.role==='gouan'?'伤后克制、疲惫但清楚':'自然克制的普通话，语气符合问句'}。只朗读引号内唯一原句：“${job.text}”其余均为控制说明，绝不朗读姓名、角色标签、旁白、画外、编号或导演说明。不复述参考录音，不添加任何词。总长约${job.seconds}秒，开头留0.2秒气口，句末自然落音。无BGM、无背景音乐、无配乐、无音效，只有这一句干净人声。`;
 const body={model:'seed-audio-1.0',text_prompt:prompt,references:[{audio_data:ref.toString('base64')}],audio_config:{format:'wav',sample_rate:48000,enable_subtitle:true}};
 const state={...job,status:'dispatching',model:body.model,requestId:randomUUID(),endpoint:'https://openspeech.bytedance.com/api/v3/tts/create',reference:{file:fileURLToPath(refs[job.role]),sha256:sha(ref),field:'references[0].audio_data'},text_prompt:prompt,bodySha256:sha(JSON.stringify(body)),humanListeningReview:false,noPresetSpeaker:true};
 await writeFile(stateFile,JSON.stringify(state,null,2),{flag:'wx'});
 try{
  const res=await fetch(state.endpoint,{method:'POST',redirect:'error',headers:{'X-Api-Key':env.TTS_API_KEY,'X-Api-Request-Id':state.requestId,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(300000)});
  state.httpStatus=res.status;state.logId=res.headers.get('x-tt-logid');const d=await res.json();
  if(!res.ok||!d.audio)Object.assign(state,{status:'failed',serviceCode:d.code,error:JSON.stringify(d).replaceAll(env.TTS_API_KEY,'[REDACTED]').slice(0,500)});
  else{const bytes=Buffer.from(d.audio,'base64'),file=new URL(job.id+'.wav',base);await writeFile(file,bytes);Object.assign(state,{status:'succeeded',file:fileURLToPath(file),sha256:sha(bytes),duration:d.duration,subtitle:d.subtitle,referenceUploaded:true});}
 }catch(e){Object.assign(state,{status:'unknown-no-repost',error:e.message.replaceAll(env.TTS_API_KEY,'[REDACTED]')});}
 await writeFile(stateFile,JSON.stringify(state,null,2));console.log(JSON.stringify({id:job.id,status:state.status,httpStatus:state.httpStatus,duration:state.duration}));
 if(state.status!=='succeeded')break;
}
