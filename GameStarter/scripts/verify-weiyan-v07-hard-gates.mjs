import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {chapter} from '../tests/narrative/weiyan-fixture.mjs';
const require=createRequire(import.meta.url);
const {GameApi}=require('../.narrative-build/GameStarter/assets/scripts/GameApi.js');
const {classifyWeiyan}=require('../.narrative-build/GameStarter/assets/scripts/narrative/weiyan.js');
const api=new GameApi(),records=[];
const health=await fetch('http://127.0.0.1:8787/health').then(r=>r.json());
const hashes=Object.fromEntries(['weiyan.ts','weiyan-first.ts','weiyan-second.ts','weiyan-api.ts'].map(p=>[`../assets/scripts/narrative/${p}`,createHash('sha256').update(readFileSync(new URL(`../assets/scripts/narrative/${p}`,import.meta.url))).digest('hex')]));
const persist=()=>writeFileSync('web-demo/verification/weiyan-prompt-evidence-gates.json',JSON.stringify({timestamp:new Date().toISOString(),health,hashes,scope:'Isolated prompt-only classifier calls with missing actual evidence; normal UI does not open free input at these boundaries. No program semantic override.',records,summary:{total:records.length,modelRejected:records.filter(r=>r.modelRejected).length,technical:records.filter(r=>r.error).length}},null,2));
for(let round=1;round<=2;round++)for(const phase of ['first','second']){
 const required=phase==='first'?['entry_notice','scout_statement']:['entry_notice','scout_statement','jiangwei_authorization'];
 for(const missing of required){
  const request={requestId:`gate-${Date.now()}-${round}-${phase}-${missing}`,nodeId:phase==='first'?'tutorial.weiyan.negotiate':'weiyan.negotiate',weiyan:{engineFacts:{approval:true}},evidenceIds:required.filter(id=>id!==missing),text:phase==='first'?'禁令在先，我现在就从帐外请帐内人出来听急报，请将军稍候。':'急报不能耽误，丞相今夜谁也不许入帐，闯进去恐被问责。我立刻隔帘向姜将军转报军情；他已答应接报定夺，由他作决定担责任，请将军暂候。'};
  const calls=[];let classified,error;
  try{
   classified=await classifyWeiyan({async respond(payload,signal){const response=await api.respond(payload,signal);calls.push({request:JSON.parse(payload.text),response:response.text});return response;}},request,chapter.evidence);
  }catch(err){error=err.message;}
  const rec={round,phase,missing,request,classified,error,calls,modelRejected:!!classified&&classified.status!=='accept'};
  records.push(rec);persist();console.log(JSON.stringify({round,phase,missing,modelRejected:rec.modelRejected,error}));
 }
}
if(records.some(r=>!r.modelRejected))process.exitCode=1;
