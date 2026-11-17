import {readFile,writeFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {createHash,randomUUID} from 'node:crypto';
const root=new URL('./user-review-batch2/audio/',import.meta.url);
const env=parseEnv(await readFile('C:/Users/zhousirui/Documents/ChatGPT/逆转五丈原/GameStarter/server/.env','utf8'));
const jobs=JSON.parse(await readFile(new URL('required-jobs.json',root),'utf8')).jobs;
for(const id of process.argv.slice(2)){
 const job=jobs.find(j=>j.id===id);if(!job)throw new Error('Job is not in required whitelist');
 const state=new URL(id+'-state.json',root);let previous;
 try{previous=JSON.parse(await readFile(state,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 if(previous){console.log(JSON.stringify({id,status:previous.status,noRepost:true}));continue;}
 const ref=await readFile(job.referenceFile);if(createHash('sha256').update(ref).digest('hex')!==job.referenceSha256)throw new Error('Reference SHA changed');
 const text_prompt=`仅采用@音频1中成年男性的音色，克制自然的普通话，吐字清楚，不复述参考原句。只朗读引号内唯一原句：“${job.text}”其余文字都是控制说明，绝不朗读姓名、某某说、角色标签、旁白、画外、编号、导演说明或其他词。总长约${job.targetSeconds}秒，开始留0.2秒气口，句末安静。无BGM、无背景音乐、无配乐、无音效，只有这一句干净人声。`;
 const body={model:'seed-audio-1.0',text_prompt,references:[{audio_data:ref.toString('base64')}],audio_config:{format:'wav',sample_rate:48000,enable_subtitle:true}};
 const m={...job,status:'dispatching',model:body.model,endpoint:'https://openspeech.bytedance.com/api/v3/tts/create',text_prompt,requestId:randomUUID(),bodySha256:createHash('sha256').update(JSON.stringify(body)).digest('hex'),referenceUploadField:'references[0].audio_data',referenceBytes:ref.length,noClone:true,noPresetSpeaker:true,userApproved:false,authorization:'20261025-batch2 explicitly allows necessary missing lines; no listening gate as execution blocker'};
 await writeFile(state,JSON.stringify(m,null,2),{flag:'wx'});
 try{
  const res=await fetch(m.endpoint,{method:'POST',redirect:'error',headers:{'X-Api-Key':env.TTS_API_KEY,'X-Api-Request-Id':m.requestId,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(300000)});m.httpStatus=res.status;m.logId=res.headers.get('x-tt-logid');const d=await res.json();
  if(!res.ok||!d.audio)Object.assign(m,{status:'failed',serviceCode:d.code,error:JSON.stringify(d).replaceAll(env.TTS_API_KEY,'[REDACTED]').slice(0,700)});
  else{const bytes=Buffer.from(d.audio,'base64'),file=new URL(id+'-seed-audio1.wav',root);await writeFile(file,bytes);Object.assign(m,{status:'succeeded',file:decodeURIComponent(file.pathname).replace(/^\/(C:)/,'$1'),sha256:createHash('sha256').update(bytes).digest('hex'),duration:d.duration,originalDuration:d.original_duration,subtitle:d.subtitle,referenceUploaded:true,referenceAcceptedInRequest:true,listeningReview:'pending; tool does not support hearing, provider subtitle and ASR are not listening approval'});}
 }catch(e){Object.assign(m,{status:'unknown-no-repost',errorClass:e.constructor.name,error:e.message.replaceAll(env.TTS_API_KEY,'[REDACTED]')});}
 await writeFile(state,JSON.stringify(m,null,2));console.log(JSON.stringify({id,status:m.status,model:m.model,duration:m.duration,subtitle:m.subtitle}));
 if(m.status!=='succeeded')break;
}
