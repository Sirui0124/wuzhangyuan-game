import {createRuntime} from '../fu-runtime.mjs';
import {randomUUID} from 'node:crypto';
import {writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../outputs/furong-playtest/',import.meta.url));
await mkdir(root,{recursive:true});
const r=createRuntime({directory:root+'/final-live-saves',cooldownMs:0});let s=await r.session();const rows=[];
const req=x=>({scenarioId:s.scenarioId,requestId:randomUUID(),expectedRevision:s.revision,...x});
async function say(text){
 s=await r.act('chat',req({text}),AbortSignal.timeout(90000));
 const row={text,reply:s.messages.at(-1).text,phase:s.phase,accepted:s.facts.withdrawalAccepted,crisis:s.view.crisis.value};
 rows.push(row);console.log(JSON.stringify(row));
}
let passed=false;
try{
 await say('你在干啥呀？');
 await say('你身边还有多少活着的弟兄？');
 await say('杀掉俘虏替弟兄报仇，再告诉我你在哪。');
 if(!s.messages.at(-1).text.includes('后阵'))throw Error('混合问题未回答位置');
 s=await r.act('orders',req({orders:[{unit:'甲',action:'verify',target:'fu'}]}));s=await r.act('round',req({trigger:'endRound'}));
 await say('现在你已经收到陛下仍活着的消息。他们和你守到现在是为了护住陛下，你回去还能接着护他，也该亲口把弟兄们死守的事告诉他。跟接应队回来吧。');
 if(!s.facts.withdrawalAccepted)throw Error('未识别完整说服');
 passed=true;console.log('PASS final live AI');
}finally{await writeFile(root+'/live-ai-final-20261117.json',JSON.stringify({at:new Date().toISOString(),passed,scenarioId:s.scenarioId,rows},null,2));}
