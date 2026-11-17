import {readFile,writeFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {createHash,randomUUID} from 'node:crypto';
const base=new URL('./',import.meta.url);
const env=parseEnv(await readFile('C:/Users/zhousirui/Documents/ChatGPT/逆转五丈原/GameStarter/server/.env','utf8'));
const refFile=new URL('gouan-reference-user-approved-V10-14p4-17p6.wav',base),ref=await readFile(refFile);
const jobs={
 'CH2-LY02-007':{text:'我认栽，没什么委屈，养好伤就行了。',seconds:4},
 'CH2-LY03-021':{text:'好，我先不走。',seconds:2.5},
 'CH2-LY03-012':{text:'这回把粮送到了，下一回呢？',seconds:3.5},
 'CH2-LY03-013':{text:'难道换个人挨打，粮就自己长出来了？',seconds:4},
 'CH2-LY03-015':{text:'那我就换个肯听的地方。',seconds:3},
 'CH2-LY03-017':{text:'我也没底。你想让我留下，就给我指条路。',seconds:4.5},
 'CH2-LY02-022':{text:'你说得对，我是委屈。',seconds:2.5},
 'CH2-LY02-027':{text:'真把话说明白，往后还在谁手底下领粮？',seconds:4.5},
 'CH2-O1-RT':{text:'你这么说，叫我怎么信你？……要说粮的事，就说粮的事。',seconds:6},
 'CH2-O1-RD':{text:'你肯替我遮掩，我领情。可遮过这一回，下回呢？',seconds:5.5}
};
for(const node of process.argv.slice(2)){
 const j=jobs[node];if(!j)throw new Error('unlisted node');
 const state=new URL(node+'-seed-audio1-state.json',base);let prior;
 try{prior=JSON.parse(await readFile(state,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 if(prior){console.log(JSON.stringify({node,status:prior.status,noRepost:true}));continue;}
 const prompt=`仅使用@音频1中成年男性的音色，伤后克制、自然、吐字清楚。仅朗读下面引号内这一句中文原话：“${j.text}”不得朗读任何控制说明，不复述参考原句，不增加姓名、角色标签、某某说、旁白、画外或其他词句。总长约${j.seconds}秒，0.2秒后开始说话，末尾安静。无BGM、无背景音乐、无配乐、无音效，只有这一句干净人声。`;
 const body={model:'seed-audio-1.0',text_prompt:prompt,references:[{audio_data:ref.toString('base64')}],audio_config:{format:'wav',sample_rate:48000,enable_subtitle:true}};
 const m={status:'dispatching',node,text:j.text,requestedSeconds:j.seconds,text_prompt:prompt,model:body.model,endpoint:'https://openspeech.bytedance.com/api/v3/tts/create',requestId:randomUUID(),reference:{file:decodeURIComponent(refFile.pathname).replace(/^\/(C:)/,'$1'),sha256:createHash('sha256').update(ref).digest('hex'),bytes:ref.length,field:'references[0].audio_data',speakerNotSent:true},bodySha256:createHash('sha256').update(JSON.stringify(body)).digest('hex'),noClone:true,wrongTts2Adopted:false,authorization:'user-20261025-batch2: actual listening gate removed as execution blocker; output remains pending listening'};
 await writeFile(state,JSON.stringify(m,null,2),{flag:'wx'});
 try{
  const res=await fetch(m.endpoint,{method:'POST',redirect:'error',headers:{'X-Api-Key':env.TTS_API_KEY,'X-Api-Request-Id':m.requestId,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(300000)});
  m.httpStatus=res.status;m.logId=res.headers.get('x-tt-logid');const d=await res.json();
  if(!res.ok||!d.audio)Object.assign(m,{status:'failed',serviceCode:d.code,error:JSON.stringify(d).replaceAll(env.TTS_API_KEY,'[REDACTED]').slice(0,800)});
  else{const bytes=Buffer.from(d.audio,'base64'),f=new URL(node+'-seed-audio1-reference.wav',base);await writeFile(f,bytes);Object.assign(m,{status:'succeeded',file:decodeURIComponent(f.pathname).replace(/^\/(C:)/,'$1'),sha256:createHash('sha256').update(bytes).digest('hex'),duration:d.duration,original_duration:d.original_duration,subtitle:d.subtitle,reference:{...m.reference,uploaded:true,acceptedInRequest:true},listeningReview:'pending; this tool/model cannot hear audio'});}
 }catch(e){Object.assign(m,{status:'unknown-no-repost',errorClass:e.constructor.name,error:e.message.replaceAll(env.TTS_API_KEY,'[REDACTED]')});}
 await writeFile(state,JSON.stringify(m,null,2));console.log(JSON.stringify({node,status:m.status,duration:m.duration,subtitle:m.subtitle}));
 if(m.status!=='succeeded')break;
}
