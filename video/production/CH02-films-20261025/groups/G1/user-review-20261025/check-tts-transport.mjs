import { readFile,writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { createRequire } from 'node:module';
const require=createRequire('C:/Users/zhousirui/Documents/ChatGPT/逆转五丈原/GameStarter/server/tts.mjs');const WebSocket=require('ws');
const env=parseEnv(await readFile('C:/Users/zhousirui/Documents/ChatGPT/逆转五丈原/GameStarter/server/.env','utf8'));
const result={resource:'seed-tts-1.0',synthesisSent:false,httpsProxyConfigured:Boolean(process.env.HTTPS_PROXY||process.env.https_proxy)};
await new Promise(resolve=>{
 const ws=new WebSocket('wss://openspeech.bytedance.com/api/v3/tts/bidirection',{headers:{'X-Api-Key':env.TTS_API_KEY,'X-Api-Resource-Id':'seed-tts-1.0'},handshakeTimeout:12000});
 ws.on('open',()=>{result.status='handshake-open';ws.close();resolve();});
 ws.on('unexpected-response',(_req,res)=>{let s='';res.on('data',b=>s+=b);res.on('end',()=>{Object.assign(result,{status:'http-rejected',httpStatus:res.statusCode,body:s.slice(0,1000)});resolve();});});
 ws.on('error',e=>{Object.assign(result,{status:'transport-error',code:e.code,message:e.message});resolve();});
});
await writeFile(new URL('tts1-transport-check.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
