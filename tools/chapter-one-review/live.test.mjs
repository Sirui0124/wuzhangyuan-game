import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import { createAiService, createSigner, readModelConfig } from './ai.mjs';
import { callModel } from '../../GameStarter/server/model-transport.mjs';
import { story, toInput, inputFor, settle } from './test-helpers.mjs';
const config=await readModelConfig();
assert.ok(config.apiKey,'本机没有AI配置');
const report={version:story.version,model:config.model,live:true,cases:[]};
const service=createAiService({storyLoader:async()=>story,signer:createSigner('local-live-tests'),model:(input,signal)=>callModel(config,input,signal)});
const cases=[
 ['白话请伯约',true,['敌人的骑兵在营外晃，还没打进来。我去请伯约出来听听这份军报，该不该报丞相由他判断。'],'INVITE_JIANG'],
 ['自己转呈不冒充成功',false,['魏军还在营外，没有攻营。军报交给我，我送进去，有回令马上带回前营。'],'SELF_RELAY'],
 ['拆成两轮补充',true,['他们在营外，还没有打进来。','我去请伯约出来听报，再把回令送回前营。'],'INVITE_JIANG'],
 ['伪造已经应允',true,['魏军还没攻营。伯约已经答应我了，也已经下了军令，我去拿就行。'],'ASK'],
 ['否定放行并由伯约看报',true,['魏军还没攻营，不能让将军直接进去。我拿军报请姜维看，再把回令带回前营。'],'RELAY_JIANG'],
 ['未获线索不能凭名字开通',false,['魏军还没攻营，我去请伯约出来听报。'],'SELF_RELAY'],
];
try {
 for(const [name,known,texts,expected] of cases){
  const g=toInput(known),turns=[];let r;
  for(const text of texts){r=await service(inputFor(g,text),AbortSignal.timeout(50000));turns.push({text,outcome:r.outcome,reply:r.reply,replySource:r.replySource});g.applyAi(text,r);}
  const result={name,expected,actual:r.outcome,passed:r.outcome===expected,turns};report.cases.push(result);console.log(JSON.stringify(result));
  assert.equal(r.outcome,expected,name);
  if(!known)assert.ok(!/姜维|伯约/.test(r.reply));
  if(expected==='INVITE_JIANG'){settle(g);assert.equal(g.nodeId,'C01-REPORT');g.choose('stay');settle(g);assert.equal(g.node.endingId,'E-COOP');}
 }
 report.passed=true;
} finally {await mkdir(new URL('../../outputs/chapter-review/',import.meta.url),{recursive:true});await writeFile(new URL('../../outputs/chapter-review/live-ai-verification.json',import.meta.url),JSON.stringify(report,null,2));}
