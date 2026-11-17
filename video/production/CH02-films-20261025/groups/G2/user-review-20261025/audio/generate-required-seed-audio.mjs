import {readFile,writeFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {createHash,randomUUID} from 'node:crypto';
const base=new URL('./',import.meta.url),env=parseEnv(await readFile('C:/Users/zhousirui/Documents/ChatGPT/逆转五丈原/GameStarter/server/.env','utf8'));
const jobs=JSON.parse(await readFile(new URL('required-jobs.json',base),'utf8')).jobs;
for(const job of jobs){
 const state=new URL(job.id+'-seed-audio-state.json',base);let prior;
 try{prior=JSON.parse(await readFile(state,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 if(prior){console.log(JSON.stringify({id:job.id,status:prior.status,alreadyDispatched:true}));continue;}
 const ref=await readFile(job.referenceFile);if(createHash('sha256').update(ref).digest('hex')!==job.referenceSha256)throw new Error('Reference SHA mismatch');
 const prompt='只采用@音频1中成年男性的音色，不复述参考原句。用克制、自然、不夸张的普通话陈述，仅朗读引号内唯一原话：“'+job.text+'”其他所有文字都是控制说明，不得朗读姓名、角色标签、某某说、旁白、画外、编号或导演说明，不新增词句。总长约'+job.targetSeconds+'秒，开头留0.25秒后说话，句末安静。没有BGM、背景音乐、配乐、吟唱、环境声或音效，只有这一句干净人声。';
 const body={model:'seed-audio-1.0',text_prompt:prompt,references:[{audio_data:ref.toString('base64')}],audio_config:{format:'wav',sample_rate:48000,enable_subtitle:true}};
 const m={...job,status:'dispatching',endpoint:'https://openspeech.bytedance.com/api/v3/tts/create',requestId:randomUUID(),text_prompt:prompt,bodySha256:createHash('sha256').update(JSON.stringify(body)).digest('hex'),referenceUploadField:'references[0].audio_data',referenceUploaded:false,noStandardTTS:true,noClone:true,noPresetSpeaker:true,userApproved:false};
 await writeFile(state,JSON.stringify(m,null,2),{flag:'wx'});
 try{
  const res=await fetch(m.endpoint,{method:'POST',redirect:'error',headers:{'X-Api-Key':env.TTS_API_KEY,'X-Api-Request-Id':m.requestId,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(300000)});m.httpStatus=res.status;m.logId=res.headers.get('x-tt-logid');const data=await res.json();
  if(!res.ok||!data.audio){Object.assign(m,{status:'failed',serviceCode:data.code,error:JSON.stringify(data).replaceAll(env.TTS_API_KEY,'[REDACTED]').slice(0,800)});}
  else{const bytes=Buffer.from(data.audio,'base64'),file=new URL(job.id+'-seed-audio1-reference.wav',base);await writeFile(file,bytes);Object.assign(m,{status:'succeeded',file:decodeURIComponent(file.pathname).replace(/^\/(C:)/,'$1'),sha256:createHash('sha256').update(bytes).digest('hex'),duration:data.duration,originalDuration:data.original_duration,subtitle:data.subtitle,referenceUploaded:true,referenceAcceptedInRequest:true,listeningReview:'not-heard; subtitles and ASR cannot replace actual listening'});}
 }catch(e){Object.assign(m,{status:'unknown-no-repost',errorClass:e.constructor.name,error:e.message.replaceAll(env.TTS_API_KEY,'[REDACTED]')});}
 await writeFile(state,JSON.stringify(m,null,2));console.log(JSON.stringify({id:job.id,status:m.status,model:m.model,httpStatus:m.httpStatus,sha256:m.sha256,duration:m.duration,referenceUploaded:m.referenceUploaded}));
}
