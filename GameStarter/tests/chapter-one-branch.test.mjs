import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ChapterOneSession} from '../web-demo/.build/GameStarter/web-demo/src/chapters/chapter-one/session.js';
import {createAiService,createSigner} from '../server/chapter-one-ai.mjs';
import {Dialogue} from '../web-demo/.build/GameStarter/web-demo/src/chapters/chapter-one/branch-engine.js';
import {polishInput,polishDraft} from '../server/chapter-one-http.mjs';
const read=name=>JSON.parse(readFileSync(new URL(`../../content/chapters/wuzhang/${name}`,import.meta.url),'utf8'));
const story=read('chapter-one.branch.json'), script=read('chapter-one.script.json'),flow=read('chapter-one.flow.json');
const make=()=>new ChapterOneSession(script,flow,'branch-test',undefined,undefined,'offline',story);
function settle(g){for(let i=0;i<200;i++){const b=g.branch,d=b.dialogue;if(b.noticePending)g.branchAct('notice');else if(!b.atLastLine||d.pending||d.node.kind==='passage')g.branchAct('next');else return;}throw Error('无法停止');}
function start(known,branch='critical'){const g=make();g.finishCinematic();settle(g);g.branchAct(known?'ask':'choose',known?'还有谁可以帮忙处理军情？':'enemy');settle(g);for(const id of ['meet','concern',branch]){g.branchAct('choose',id);settle(g);}return g;}

function confirmJiang(){
 const g=make();g.finishCinematic();settle(g);g.branchAct('ask','还有谁可以帮忙处理军情？');settle(g);
 assert.equal(g.branch.dialogue.state.jiangAgreed,false);
 assert.ok(g.branch.dialogue.choices.some(c=>c.id==='confirm_jiang'));
 g.branchAct('choose','confirm_jiang');return g;
}
test('提前确认对白润色兼容旧文案存档，仍拒绝伪造的应允',()=>{
 const oldStory=structuredClone(story),node=oldStory.nodes.find(n=>n.id==='C01-JIANG-CONFIRM');
 for(const line of node.lines){const r=node.textRevisions.find(r=>r.speaker===line.speaker&&r.new===line.text);if(r)line.text=r.old;}
 const old=new ChapterOneSession(script,flow,'branch-test',undefined,undefined,'offline',oldStory);
 old.finishCinematic();settle(old);old.branchAct('ask','还有谁可以帮忙处理军情？');settle(old);old.branchAct('choose','confirm_jiang');
 while(old.branch.currentLine.speaker!=='我'||!old.branch.currentLine.text.startsWith('还没到'))old.branchAct('next');
 old.branchDraft('保留这份草稿');const restored=make();restored.restore(old.serialize());
 assert.equal(restored.branch.currentLine.text,story.nodes.find(n=>n.id===node.id).lines[4].text);
 assert.equal(restored.branch.draft,'保留这份草稿');assert.equal(restored.branch.dialogue.state.jiangAgreed,false);
 settle(old);const after=make();after.restore(old.serialize());assert.equal(after.branch.dialogue.state.jiangAgreed,true);
 const forged=JSON.parse(restored.serialize()),graph=JSON.parse(forged.branch.graph);graph.current.state.jiangAgreed=true;forged.branch.graph=JSON.stringify(graph);
 assert.throws(()=>make().restore(JSON.stringify(forged)),/实际经过/);
});
test('提前确认只在获知入口后开放，读完才授予应允，存档与重玩准确恢复',()=>{
 const unknown=make();unknown.finishCinematic();settle(unknown);unknown.branchAct('choose','enemy');settle(unknown);
 assert.ok(!unknown.branch.dialogue.choices.some(c=>c.id==='confirm_jiang'));
 assert.throws(()=>unknown.branchAct('choose','confirm_jiang'),/没有这个选项/);
 const g=confirmJiang();assert.equal(g.branch.dialogue.state.jiangAgreed,false);
 assert.match(g.branch.clues.find(c=>c.id==='branch-jiang').text,/尚未取得/);
 const midway=make();midway.restore(g.serialize());assert.equal(midway.branch.dialogue.state.jiangAgreed,false);
 settle(g);assert.equal(g.branch.dialogue.state.jiangAgreed,true);assert.equal(g.branch.dialogue.state.metWei,false);
 assert.equal(g.branch.dialogue.state.reportHandled,false);assert.equal(g.branch.dialogue.state.orderDelivered,false);
 assert.match(g.branch.clues.find(c=>c.id==='branch-jiang').text,/亲口答应/);
 const restored=make();restored.restore(g.serialize());assert.deepEqual(restored.branch.snapshot(),g.branch.snapshot());
 g.branchAct('choose','ask');settle(g);g.branchAct('choose','enemy');settle(g);
 assert.ok(!g.branch.dialogue.choices.some(c=>c.id==='confirm_jiang'));
 for(const id of ['meet','concern','front']){g.branchAct('choose',id);settle(g);}
 g.branchAct('offline','INVITE_JIANG','魏军还没攻营。伯约已经答应，我带将军过去。');settle(g);
 assert.equal(g.branch.dialogue.nodeId,'C01-REPORT');assert.ok(!g.branch.dialogue.trail.some(f=>f.nodeId==='C01-JIANG'));
 g.branchAct('choose','stay');settle(g);assert.equal(g.branch.dialogue.node.endingId,'E-COOP');
 g.branchAct('choose','reread');assert.equal(g.branch.dialogue.state.jiangAgreed,false);assert.deepEqual(g.branch.clues,[]);
});
test('提前应允不改变获罪失败，也不提前完成送报路线',()=>{
 const g=confirmJiang();settle(g);for(const id of ['meet','concern','front']){g.branchAct('choose',id);settle(g);}
 g.branchAct('offline','RELAY_JIANG','魏军还没攻营，我送给伯约，再将回令带回前营。');
 assert.equal(g.branch.dialogue.state.reportHandled,false);assert.equal(g.branch.dialogue.state.orderDelivered,false);
 settle(g);assert.equal(g.branch.dialogue.node.endingId,'E-FORMAL');
 const bad=confirmJiang();settle(bad);for(const id of ['meet','order','listen']){bad.branchAct('choose',id);settle(bad);}
 assert.equal(bad.branch.dialogue.node.endingId,'E-LAMP');bad.branchAct('choose','rewind');settle(bad);
 assert.equal(bad.branch.dialogue.state.jiangAgreed,false);
});
test('AI按实际提前应允核验正文，回应与后续跳转不重复请示',async()=>{
 const g=confirmJiang();settle(g);for(const id of ['meet','concern','front']){g.branchAct('choose',id);settle(g);}
 const d=g.branch.dialogue;let classified=false;
 const service=createAiService({Dialogue,storyLoader:async()=>story,signer:createSigner('preconfirmed'),model:async input=>{
  const p=JSON.parse(input.text);assert.equal(p.jiangHasAgreed,true);
  assert.ok(p.playerKnownFacts.some(f=>f.id==='F-JIANG-AGREED'));assert.ok(!p.playerKnownFacts.some(f=>/尚未答应/.test(f.text)));
  if(input.system.includes('语义分类器')){classified=true;return {text:JSON.stringify({enemy:'understood',enemyQuote:'还没攻营',plan:'invite_jiang',planQuote:'我带将军过去',unsupportedClaim:false,claimQuote:''})};}
  throw Error('验证后备回应同样读取已应允状态');
 }});
 const text='魏军还没攻营。伯约已经答应接报，我带将军过去。';
 const r=await service({version:story.version,nodeId:d.nodeId,audit:d.audit,requestId:'preconfirmed-0001',text});
 assert.ok(classified);assert.equal(r.outcome,'INVITE_JIANG');assert.equal(r.reply,'伯约既然应了，你带路。');
 g.branchReply(text,r);settle(g);assert.equal(d.nodeId,'C01-REPORT');
});
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
test('再问营外情况后收录小甲线索，魏延补充同一条；存档不提前泄露未听内容',()=>{
 const g=make();g.finishCinematic();settle(g);g.branchAct('choose','rules');settle(g);
 g.branchAct('choose','ask');settle(g);g.branchAct('choose','enemy');
 while(g.branch.dialogue.nodeId!=='C01-GUARD-ENEMY'||g.branch.dialogue.pending)g.branchAct('next');
 assert.equal(g.branch.clues.some(c=>c.id==='branch-enemy'),false);
 settle(g);const clue=g.branch.clues.find(c=>c.id==='branch-enemy');assert.match(clue.text,/小甲说/);assert.doesNotMatch(clue.text,/前营.*回话/);
 const loaded=make();loaded.restore(g.serialize());assert.deepEqual(loaded.branch.clues,g.branch.clues);
 loaded.branchAct('choose','meet');assert.match(loaded.branch.clues.find(c=>c.id==='branch-enemy').text,/小甲说/);
 settle(loaded);const updated=loaded.branch.clues.filter(c=>c.id==='branch-enemy');assert.equal(updated.length,1);assert.match(updated[0].text,/前营正等着回话/);
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
test('成功结局重玩清空本轮线索与草稿，重新主动查看告示',()=>{
 const g=start(true);g.branchAct('offline','RELAY_JIANG','魏军还没攻营，我拿军报请伯约看。');settle(g);
 assert.equal(g.branch.dialogue.node.endingId,'E-FORMAL');g.branchAct('choose','reread');
 assert.equal(g.branch.dialogue.nodeId,'C01-OPEN');assert.deepEqual(g.branch.clues,[]);assert.equal(g.branch.noticeOpened,false);assert.equal(g.branch.draft,'');assert.equal(g.branch.completed,false);
 const restored=make();restored.restore(g.serialize());assert.deepEqual(restored.branch.snapshot(),g.branch.snapshot());restored.branchAct('next');assert.equal(restored.branch.noticePending,true);
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
test('引用标签不能补足已删除正文，模型不能拿已知线索当作发言引文',async()=>{
 const g=start(true),d=g.branch.dialogue;
 const service=createAiService({Dialogue,storyLoader:async()=>story,signer:createSigner('body-only'),model:async input=>{
  const payload=JSON.parse(input.text);
  assert.equal(payload.confirmedText,'军报给我。');assert.equal('selected' in payload,false);
  return {text:JSON.stringify({enemy:'understood',enemyQuote:'魏军还没攻营',plan:'invite_jiang',planQuote:'请伯约听报',unsupportedClaim:false,claimQuote:''})};
 }});
 await assert.rejects(service({version:story.version,nodeId:d.nodeId,audit:d.audit,requestId:'body-only-0001',text:'军报给我。',selected:['branch-enemy','branch-jiang']}),/实际发言不符/);
});
test('润色从实际节点取当前问话；只传正文，不把线索或通关规则作为补写材料',async()=>{
 for(const branch of ['front','critical']) {
  const g=start(true,branch),d=g.branch.dialogue,draft='我不去请伯约。';g.branch.selected=['branch-enemy','branch-jiang'];
  const input=polishInput(d,draft);assert.equal(input.context.nodeId,d.nodeId);assert.equal(input.context.speaker,'守帐军士');assert.equal(input.context.listener,'魏延');
  assert.equal(input.context.question,d.node.lines.filter(l=>l.speaker==='魏延').at(-1).text);assert.equal(input.draft,draft);
  assert.equal('selected' in input,false);assert.equal('facts' in input.context,false);assert.equal('assessmentRules' in input.context,false);
  d.exchange.push({id:'test',player:'军报给我。',npc:'你准备交给谁？'});assert.equal(polishInput(d,draft).context.question,'你准备交给谁？');
  let calls=0;const result=await polishDraft(d,draft,async request=>{calls++;const payload=JSON.parse(request.text);return {text:JSON.stringify(calls===1?{text:payload.draft}:{valid:true})};});
  assert.equal(result,draft);assert.equal(calls,2);
 }
});
test('润色纠错或补回删除内容被核验拒绝，不回填或改变剧情',async()=>{
 const g=start(true),d=g.branch.dialogue,before=d.serialize();let calls=0;
 await assert.rejects(polishDraft(d,'魏军已经攻营，我来转呈。',async()=>({text:JSON.stringify(++calls===1?{text:'魏军还没攻营，我去请伯约。'}:{valid:false})})),/改变了原意/);
 assert.equal(d.serialize(),before);
});
