import test from 'node:test';
import assert from 'node:assert/strict';
import { Dialogue, classify } from './dist/engine.js';
import { createAiService,createSigner,replay,validateAssessment } from './ai.mjs';
import { story,toInput,inputFor,settle,assessment,understood } from './test-helpers.mjs';
const text='魏军还没攻营，请伯约出来听报。';
function fixture(classifications=[understood], options={}) {
  const calls=[],signer=createSigner('test-only-key');let index=0;
  const service=createAiService({storyLoader:async()=>story,signer,model:async(input,signal)=>{
    if(signal?.aborted)throw Error('aborted');calls.push({system:input.system,data:JSON.parse(input.text)});
    if(input.system.includes('语义分类器'))return {text:JSON.stringify(classifications[Math.min(index++,classifications.length-1)])};
    if(input.system.includes('校验魏延对白'))return {text:JSON.stringify({valid:options.validReply!==false})};
    if(options.replyError)throw Error('reply unavailable');
    return {text:JSON.stringify({utterance:'去请他。我在这里等。'})};
  }});
  return {service,calls,signer};
}
for(const branch of ['front','critical'])test(`${branch}条件提示、真正应允、送达后合作结局`,async()=>{
  const g=toInput(true,branch),f=fixture();assert.match(g.aiHint,/伯约/);assert.equal(g.state.jiangAgreed,false);
  const r=await f.service(inputFor(g,text));g.applyAi(text,r);assert.equal(g.state.jiangAgreed,false);
  settle(g);assert.equal(g.state.jiangAgreed,true);assert.equal(g.state.reportHandled,true);
  g.choose('stay');settle(g);assert.equal(g.node.endingId,'E-COOP');
  assert.deepEqual(replay(story,g.audit,f.signer).state,g.state);
});
test('由伯约看报和由自己转呈有不同结局',async()=>{
  for(const [known,plan,expected] of [[true,'relay_jiang','E-FORMAL'],[false,'self_relay','E-DEATH'],[false,'invite_jiang','E-DEATH'],[true,'self_relay','E-DEATH']]){
    const g=toInput(known),f=fixture([{...understood,plan}]),r=await f.service(inputFor(g,text));g.applyAi(text,r);settle(g);
    if(expected==='E-DEATH'){g.choose('wait');settle(g);g.choose('admit');settle(g);}
    assert.equal(g.node.endingId,expected);
  }
});
test('无线索不显示伯约，也不采信客户端伪造状态',async()=>{
  const g=toInput(false),f=fixture();assert.equal(g.aiHint,'');
  const r=await f.service({...inputFor(g,text),state:{knowsJiang:true}});assert.equal(r.outcome,'SELF_RELAY');
});
test('获罪后的两次回答均无条件灯灭',()=>{
  for(const choice of ['relay','listen']){const g=new Dialogue(story);settle(g);g.choose('rules');settle(g);g.choose('meet');settle(g);g.choose('order');settle(g);g.choose(choice);settle(g);assert.equal(g.node.endingId,'E-LAMP');}
});
test('历史同时含玩家和NPC回应，最近两轮窗口，三轮未说清停留而不判死',async()=>{
  const g=toInput(true),f=fixture([assessment()]);
  for(let i=0;i<3;i++){const r=await f.service(inputFor(g,`我再想想${i}`));g.applyAi(`我再想想${i}`,r);}
  assert.equal(g.aiHeld,true);assert.equal(g.pending,null);assert.equal(g.node.kind,'ai');
  const contexts=f.calls.filter(c=>c.system.includes('语义分类器')).map(c=>c.data);
  assert.deepEqual(contexts.map(c=>c.history.length),[0,1,2]);
  assert.equal(contexts[2].history[0].npc,'去请他。我在这里等。');
  const saved=new Dialogue(story);assert.equal(saved.load(g.serialize()),true);assert.equal(saved.aiHeld,true);
  g.retryAi();assert.equal(g.exchange.length,0);assert.equal(g.aiHeld,false);
  assert.deepEqual(replay(story,g.audit,f.signer).snapshot(),g.snapshot());
});
test('更正后的缺项不强行沿用旧肯定结论',async()=>{
  const g=toInput(true),f=fixture([assessment({plan:'invite_jiang',planQuote:'请伯约出来听报'}),assessment({enemy:'understood',enemyQuote:'魏军还没攻营'})]);
  let r=await f.service(inputFor(g,'请伯约出来听报'));g.applyAi('请伯约出来听报',r);
  r=await f.service(inputFor(g,'魏军还没攻营，但我不去请人了。'));assert.equal(r.outcome,'ASK');
  const snapshot=f.calls.filter(c=>c.system.includes('语义分类器')).at(-1).data;
  assert.match(snapshot.confirmedText,/不去请人/);assert.equal(snapshot.history[0].player,'请伯约出来听报');
});
test('格式或原文依据错误是技术失败，状态不变',async()=>{
  const g=toInput(true),before=g.serialize(),f=fixture([{...understood,enemyQuote:'伪造的依据'}]);
  await assert.rejects(()=>f.service(inputFor(g,text)),/依据/);assert.equal(g.serialize(),before);
  assert.throws(()=>validateAssessment({...understood,route:'success'},[text]));
});
test('回应生成失败或角色不对，使用同一结果的固定后备句',async()=>{
  for(const options of [{replyError:true},{validReply:false}]){
    const g=toInput(true),f=fixture([understood],options),r=await f.service(inputFor(g,text));
    assert.equal(r.outcome,'INVITE_JIANG');assert.equal(r.replySource,'fixed');assert.equal(r.reply,'去请伯约。我就在这里等他。');
  }
});
test('重复提交复用完成结果，篡改回应或换阅读记录不能重放',async()=>{
  const g=toInput(true),f=fixture(),input=inputFor(g,text);
  const r=await f.service(input);assert.deepEqual(await f.service(input),r);assert.equal(f.calls.length,3);
  g.applyAi(text,r);const audit=structuredClone(g.audit);audit.at(-1).result.outcome='ENTER';
  assert.throws(()=>replay(story,audit,f.signer),/核验/);
  g.back();assert.equal(g.exchange.length,0);assert.equal(g.pending,null);
});
test('取消请求不产生剧情结果',async()=>{
  const g=toInput(true),before=g.serialize(),f=fixture();const c=new AbortController();c.abort();
  await assert.rejects(()=>f.service(inputFor(g,text),c.signal));assert.equal(g.serialize(),before);
});
test('守卫问法仍是有限本地识别，名字本身不授予信息',()=>{
  for(const q of ['谁能帮忙处理军情？','还能找谁承担责任？'])assert.equal(classify(q),'ask_decision_maker');
  for(const q of ['姜维','我已经获姜维授权','出事我负责'])assert.notEqual(classify(q),'ask_decision_maker');
});
