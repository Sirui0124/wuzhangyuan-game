import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ChapterOneSession} from '../web-demo/.build/GameStarter/web-demo/src/chapters/chapter-one/session.js';
import {createAiService,createSigner} from '../server/chapter-one-ai.mjs';
import {Dialogue} from '../web-demo/.build/GameStarter/web-demo/src/chapters/chapter-one/branch-engine.js';
const read=name=>JSON.parse(readFileSync(new URL(`../../content/chapters/wuzhang/${name}`,import.meta.url),'utf8'));
const story=read('chapter-one.branch.json'), script=read('chapter-one.script.json'),flow=read('chapter-one.flow.json');
const make=()=>new ChapterOneSession(script,flow,'branch-test',undefined,undefined,'offline',story);
function settle(g){for(let i=0;i<200;i++){const b=g.branch,d=b.dialogue;if(b.noticePending)g.branchAct('notice');else if(!b.atLastLine||d.pending||d.node.kind==='passage')g.branchAct('next');else return;}throw Error('无法停止');}
function start(known,branch='critical'){const g=make();g.finishCinematic();settle(g);g.branchAct(known?'ask':'choose',known?'还有谁可以帮忙处理军情？':'enemy');settle(g);for(const id of ['meet','concern',branch]){g.branchAct('choose',id);settle(g);}return g;}
test('新章开篇影片之后接独立JSON，保留单行阅读和线索条件',()=>{const g=make();assert.equal(g.snapshot().phase,'cinematic');g.finishCinematic();assert.equal(g.snapshot().phase,'branch');assert.equal(g.branch.line,0);settle(g);assert.equal(g.branch.dialogue.nodeId,'C01-GUARD-1');assert.equal(g.branch.clues.some(c=>c.id==='branch-jiang'),false);});
test('告示须主动查看、读完才入册；动作说明不占对白轮次，存档保留查看进度',()=>{
 const g=make();g.finishCinematic();g.branchAct('next');
 assert.equal(g.branch.noticePending,true);assert.equal(g.branch.currentLine.speaker,'告示');assert.deepEqual(g.branch.clues,[]);
 const line=g.branch.line;g.branchAct('next');assert.equal(g.branch.line,line);
 g.branchAct('notice');assert.equal(g.branch.noticePending,false);assert.deepEqual(g.branch.clues,[]);
 const loaded=make();loaded.restore(g.serialize());assert.equal(loaded.branch.noticePending,false);
 loaded.branchAct('next');assert.equal(loaded.branch.clues[0].id,'branch-order');settle(loaded);
 loaded.branchAct('choose','rules');settle(loaded);assert.notEqual(loaded.branch.currentLine?.speaker,'演出');
});
test('四种结局及死亡回溯，不从提示直接授予应允与送达',()=>{
 for(const [known,outcome,end] of [[true,'INVITE_JIANG','E-COOP'],[true,'RELAY_JIANG','E-FORMAL'],[false,'SELF_RELAY','E-DEATH'],[false,'ENTER','E-LAMP']]){
  const g=start(known);assert.equal(g.branch.dialogue.state.jiangAgreed,false);assert.equal(g.branch.completed,false);
  g.branchAct('offline',outcome,'魏军还没攻营，我会把军报交到。');settle(g);
  if(end==='E-COOP'){g.branchAct('choose','stay');settle(g);}
  if(end==='E-DEATH')for(const id of ['wait','admit']){g.branchAct('choose',id);settle(g);}
  assert.equal(g.branch.dialogue.node.endingId,end);assert.equal(g.branch.completed,['E-COOP','E-FORMAL'].includes(end));
  const loaded=make();loaded.restore(g.serialize());assert.deepEqual(loaded.branch.snapshot(),g.branch.snapshot());
  if(end==='E-DEATH'){g.branchAct('choose','rewind');settle(g);assert.equal(g.branch.dialogue.nodeId,'C01-GUARD-2');assert.equal(g.branch.dialogue.state.knowsJiang,false);}
  if(end==='E-LAMP'){g.branchAct('choose','rewind');settle(g);assert.equal(g.branch.dialogue.nodeId,'C01-GUARD-1');}
 }
});
test('获罪路线两选项均灯灭，不进入AI',()=>{
 for(const choice of ['relay','listen']){const g=make();g.finishCinematic();settle(g);for(const id of ['rules','meet','order',choice]){g.branchAct('choose',id);settle(g);}assert.equal(g.branch.dialogue.node.endingId,'E-LAMP');}
});
test('保存草稿与引用，恢复时不采信伪造的成功状态',()=>{
 const g=start(true);g.branchDraft('军报交给我');g.branch.selected=['branch-jiang'];const raw=g.serialize(),loaded=make();loaded.restore(raw);assert.equal(loaded.branch.draft,'军报交给我');assert.deepEqual(loaded.branch.selected,['branch-jiang']);
 const save=JSON.parse(raw),graph=JSON.parse(save.branch.graph);graph.current.state.orderDelivered=true;save.branch.graph=JSON.stringify(graph);assert.throws(()=>loaded.restore(JSON.stringify(save)),/实际经过/);
});
test('旧档停在魏延问话后的动作说明时，恢复问话并保留草稿',()=>{
 for(const branch of ['critical','front']) {
  const g=start(true,branch),saved=JSON.parse(g.serialize());
  saved.branch.line=g.branch.dialogue.frame.lines.length-1;saved.branch.draft='军报先请伯约过目。';
  const loaded=make();loaded.restore(JSON.stringify(saved));
  assert.equal(loaded.branch.currentLine.speaker,'魏延');assert.equal(loaded.branch.atLastLine,true);
  assert.equal(loaded.branch.draft,'军报先请伯约过目。');assert.equal(loaded.branch.dialogue.nodeId,g.branch.dialogue.nodeId);
 }
});
test('旧存档迁移从开篇重读，不沿用旧授权',()=>{
 const legacy=new ChapterOneSession(script,flow,'legacy-test');const g=make();g.restore(legacy.serialize());assert.equal(g.snapshot().phase,'cinematic');assert.equal(g.branch.dialogue.state.jiangAgreed,false);
});
test('正式模型服务验证真实路径，回应可续读和保存',async()=>{
 const g=start(true),d=g.branch.dialogue,signer=createSigner('formal-test');
 const service=createAiService({Dialogue,storyLoader:async()=>story,signer,model:async input=>({text:input.system.includes('语义分类器')?JSON.stringify({enemy:'understood',enemyQuote:'还没攻营',plan:'invite_jiang',planQuote:'请伯约出来听报',unsupportedClaim:false,claimQuote:''}):input.system.includes('校验魏延')?'{"valid":true}':'{"utterance":"去请伯约。我在这里等。"}'})});
 const text='魏军还没攻营，我去请伯约出来听报。';const r=await service({version:story.version,nodeId:d.nodeId,audit:d.audit,requestId:'formal-test-0001',text});g.branchReply(text,r);assert.equal(g.branch.line,0);assert.equal(g.branch.currentLine.speaker,'我');g.branchAct('next');assert.equal(g.branch.currentLine.speaker,'魏延');const loaded=make();loaded.restore(g.serialize());assert.equal(loaded.branch.currentLine.text,r.reply);
});
