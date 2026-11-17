import {readFile,writeFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {createHash,randomUUID} from 'node:crypto';
const base=new URL('./',import.meta.url),id='CH2-E4-LATE-002-R1',state=new URL(id+'-seed-audio-state.json',base);
try{const prior=JSON.parse(await readFile(state,'utf8'));console.log(JSON.stringify({id,status:prior.status,alreadyDispatched:true}));process.exit(0);}catch(e){if(e.code!=='ENOENT')throw e;}
const contract=JSON.parse(await readFile(new URL('../../../reviews/user-20261025-batch2/military-voice-reference.json',base),'utf8'));
const ref=await readFile(contract.file),hash=b=>createHash('sha256').update(b).digest('hex');
if(hash(ref)!==contract.sha256)throw Error('Frozen military reference SHA mismatch');
const text='苟安认下的责任先录在案，其他的还要核。';
const prompt='只采用@音频1中成年男性的音色，不复述参考原句。用克制、自然、不夸张的普通话陈述，仅朗读引号内唯一原话：“'+text+'”其他所有文字都是控制说明，不得朗读姓名、角色标签、某某说、旁白、画外、编号或导演说明，不新增词句。总长约4.5秒，开头留0.2秒后说话，句末安静。“核”读hé，是核查的核，句末不加任何词。没有BGM、背景音乐、配乐、吟唱、环境声或音效，只有这一句干净人声。';
const body={model:'seed-audio-1.0',text_prompt:prompt,references:[{audio_data:ref.toString('base64')}],audio_config:{format:'wav',sample_rate:48000,enable_subtitle:true}};
const m={id,node:'CH2-E4-LATE-002',role:'军吏',model:body.model,text,status:'dispatching',endpoint:'https://openspeech.bytedance.com/api/v3/tts/create',requestId:randomUUID(),referenceFile:contract.file,referenceSha256:contract.sha256,referenceSourceFile:contract.sourceFile,referenceSourceRange:contract.sourceRange,referenceUploadField:'references[0].audio_data',referenceUploaded:false,bodySha256:hash(JSON.stringify(body)),text_prompt:prompt,noClone:true,noPresetSpeaker:true,userApproved:false,promptVersion:1,reason:'Existing original end-word boundary unstable across independent ASR; preserve exact whitelist without blind truncation. Actual hearing unavailable.'};
await writeFile(state,JSON.stringify(m,null,2),{flag:'wx'});
const env=parseEnv(await readFile('C:/Users/zhousirui/Documents/ChatGPT/逆转五丈原/GameStarter/server/.env','utf8'));
try{
 const res=await fetch(m.endpoint,{method:'POST',redirect:'error',headers:{'X-Api-Key':env.TTS_API_KEY,'X-Api-Request-Id':m.requestId,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(300000)});m.httpStatus=res.status;m.logId=res.headers.get('x-tt-logid');const d=await res.json();
 if(!res.ok||!d.audio){Object.assign(m,{status:'failed',serviceCode:d.code,error:JSON.stringify(d).replaceAll(env.TTS_API_KEY,'[REDACTED]').slice(0,700)});}
 else{const bytes=Buffer.from(d.audio,'base64'),file=new URL(id+'-seed-audio1-reference.wav',base);await writeFile(file,bytes);Object.assign(m,{status:'succeeded',file:decodeURIComponent(file.pathname).replace(/^\/(C:)/,'$1'),sha256:hash(bytes),duration:d.duration,originalDuration:d.original_duration,subtitle:d.subtitle,referenceUploaded:true,referenceAcceptedInRequest:true,listeningReview:'pending; no hearing/timbre/no-BGM approval claimed'});}
}catch(e){Object.assign(m,{status:'unknown-no-repost',errorClass:e.constructor.name,error:e.message.replaceAll(env.TTS_API_KEY,'[REDACTED]')});}
await writeFile(state,JSON.stringify(m,null,2));console.log(JSON.stringify({id,status:m.status,httpStatus:m.httpStatus,sha256:m.sha256,duration:m.duration,referenceUploaded:m.referenceUploaded}));
