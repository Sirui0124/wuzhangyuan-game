import readline from 'node:readline';
import {openRun} from './session.mjs';
const r=await openRun(process.argv[2]||'bridge',Number(process.argv[3]||0));
console.log(JSON.stringify({ready:true,text:await r.observe()}));
for await(const line of readline.createInterface({input:process.stdin})){try{const a=JSON.parse(line);let out;
 if(a.action==='observe')out=await r.observe();
 else if(a.action==='say')out=await r.say(a.text);
 else if(a.action==='click')out=await r.click(a.selector);
 else if(a.action==='shot')out=await r.shot(a.name);
 else if(a.action==='finish'){out=await r.finish();console.log(JSON.stringify({ok:true,out}));break;}
 else throw Error('Unknown test action');console.log(JSON.stringify({ok:true,out}));
 }catch(e){console.log(JSON.stringify({ok:false,error:e.message}));}}
