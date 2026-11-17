import { readFile, writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { createHash } from 'node:crypto';
import { streamTts } from 'file:///C:/Users/zhousirui/Documents/ChatGPT/%E9%80%86%E8%BD%AC%E4%BA%94%E4%B8%88%E5%8E%9F/GameStarter/server/tts.mjs';
const root=new URL('./',import.meta.url);
const env=parseEnv(await readFile('C:/Users/zhousirui/Documents/ChatGPT/逆转五丈原/GameStarter/server/.env','utf8'));
const text='我没打算去魏国。',speaker='zh_male_yuanboxiaoshu_moon_bigtts',resource='seed-tts-1.0';
const state=new URL('gouan-probe-state.json',root);let prior;
try{prior=JSON.parse(await readFile(state,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
if(prior){console.log(JSON.stringify({status:prior.status,alreadyDispatched:true}));process.exit(0);}
const meta={node:'CH2-LY02-008',role:'苟安',text,speaker,provider:'ByteDance Doubao',resource,endpoint:'wss://openspeech.bytedance.com/api/v3/tts/bidirection',status:'dispatching',textSha256:createHash('sha256').update(text).digest('hex'),noClone:true,centralVoiceChanged:false};
await writeFile(state,JSON.stringify(meta,null,2));
try{
 const chunks=[];await streamTts({text,speaker,resource,apiKey:env.TTS_API_KEY,onAudio:b=>chunks.push(Buffer.from(b))});
 const pcm=Buffer.concat(chunks);if(!pcm.length)throw new Error('empty');
 const wav=Buffer.alloc(44);wav.write('RIFF');wav.writeUInt32LE(36+pcm.length,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(24000,24);wav.writeUInt32LE(48000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(pcm.length,40);
 const file=new URL('CH2-LY02-008-gouan-tts1.wav',root);const bytes=Buffer.concat([wav,pcm]);await writeFile(file,bytes);Object.assign(meta,{status:'succeeded',file:decodeURIComponent(file.pathname).replace(/^\/(C:)/,'$1'),sha256:createHash('sha256').update(bytes).digest('hex'),duration:pcm.length/48000,listeningReview:'not-yet-reviewed',modelClaim:'requested and accepted resource seed-tts-1.0; no claim of voice clone or exact native-actor match'});
}catch(e){Object.assign(meta,{status:'failed',errorClass:e.constructor.name,error:String(e.message).slice(0,150)});}
await writeFile(state,JSON.stringify(meta,null,2));console.log(JSON.stringify(meta));
