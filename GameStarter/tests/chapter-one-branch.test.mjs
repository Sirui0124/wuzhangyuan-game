import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ChapterOneSession} from '../web-demo/.build/GameStarter/web-demo/src/chapters/chapter-one/session.js';
import {createAiService,createSigner,replay} from '../server/chapter-one-ai.mjs';
import {Dialogue,classify} from '../web-demo/.build/GameStarter/web-demo/src/chapters/chapter-one/branch-engine.js';
import {polishInput,polishDraft} from '../server/chapter-one-http.mjs';
import {chapterOneCharacters} from '../web-demo/.build/GameStarter/web-demo/src/chapters/chapter-one/characters.js';
import {encounteredCharacters} from '../web-demo/.build/GameStarter/web-demo/src/characters/encounters.js';
const read=name=>JSON.parse(readFileSync(new URL(`../../content/chapters/wuzhang/${name}`,import.meta.url),'utf8'));
const story=read('chapter-one.branch.json'), script=read('chapter-one.script.json'),flow=read('chapter-one.flow.json');
const make=()=>new ChapterOneSession(script,flow,'branch-test',undefined,undefined,'offline',story);
function settle(g){for(let i=0;i<200;i++){const b=g.branch,d=b.dialogue;if(b.noticePending)g.branchAct('notice');else if(!b.atLastLine||d.pending||d.node.kind==='passage'||d.node.autoChoice)g.branchAct('next');else return;}throw Error('无法停止');}
function start(known,branch='critical'){const g=make();g.finishCinematic();settle(g);g.branchAct(known?'ask':'choose',known?'还有谁可以帮忙处理军情？':'enemy');settle(g);for(const id of ['meet','concern',branch]){g.branchAct('choose',id);settle(g);}return g;}

function confirmJiang(){
 const g=make();g.finishCinematic();settle(g);g.branchAct('ask','还有谁可以帮忙处理军情？');settle(g);
 assert.equal(g.branch.dialogue.state.jiangAgreed,false);
 assert.ok(g.branch.dialogue.choices.some(c=>c.id==='confirm_jiang'));
 g.branchAct('choose','confirm_jiang');return g;
}
function planStart(known=false){const g=make();g.finishCinematic();settle(g);g.branchAct(known?'ask':'choose',known?'还有谁能处理军情？':'enemy');settle(g);g.branchAct('choose','meet');settle(g);assert.ok(!g.branch.dialogue.choices.some(c=>c.id==='concern'));g.branchAct('choose','concern_joint');settle(g);assert.equal(g.branch.dialogue.nodeId,'C01-AI-JOINT');return g;}
const assessment=(plan='none',extra={})=>({enemy:'missing',enemyQuote:'',plan,planQuote:'',recipientQuote:'',actionQuote:'',unsupportedClaim:false,claimQuote:'',offense:'none',offenseQuote:'',...extra});

test('新版人物志只按实际开场和姜维通传解锁，并在读档后保留',()=>{
 const people=g=>encounteredCharacters(chapterOneCharacters(g,true));
 assert.ok(!people(make()).includes('zhugeliang'));
 const g=confirmJiang();
 assert.ok(people(g).includes('zhugeliang'));
 assert.ok(!people(g).includes('jiangwei_guard'));
 settle(g);
 assert.ok(people(g).includes('jiangwei_guard'));
 const loaded=make();loaded.restore(g.serialize());
 assert.deepEqual(people(loaded),people(g));
});

test('小甲问法排除否定、引用与撤回，仍识别真正的替代接报请求',()=>{
 const cases=[
  ['不找姜维，让他处理军情也不合适。','other'],
  ['不是问谁来接报，我只想问营外的动静。','ask_enemy'],
  ['谁都不必来接报。','other'],
  ['不能让姜维来接报。','other'],
  ['有人说“请姜维来处理军情”，我不这样想。','other'],
  ['还有谁能处理军情？算了，不找人了。','other'],
  ['不找别人了。还是请伯约来听报吧。','ask_decision_maker'],
  ['不能打扰丞相，还有谁能处理军情？','ask_decision_maker'],
  ['能不能请个人来听军报？','ask_decision_maker'],
  ['除了丞相，还有谁能处置军情？','ask_decision_maker'],
  ['姜维','other'],['我来负责转呈军报。','other'],
 ];
 for(const [text,expected] of cases)assert.equal(classify(text),expected,text);
});

test('否定规则修复不改写旧存档经历，新旧问话均能恢复并通过服务端重放',()=>{
 for(const version of [1,2]){
  const g=make();g.finishCinematic();settle(g);
  g.branch.dialogue.ask('不找姜维，让他处理军情也不合适。',version);settle(g);
  assert.equal(g.branch.dialogue.state.knowsJiang,version===1);
  const saved=g.serialize(),restored=make();restored.restore(saved);
  assert.deepEqual(restored.branch.snapshot(),g.branch.snapshot());
  const d=replay(story,g.branch.dialogue.audit,createSigner('guard-compat'),Dialogue);
  assert.equal(d.state.knowsJiang,version===1);
 }
});

test('方案追问的预写回应不再要求送回令，故障也不替玩家补伯约答案',async()=>{
 const g=planStart(false),d=g.branch.dialogue;
 const service=createAiService({Dialogue,storyLoader:async()=>story,signer:createSigner('fallback-review'),model:async input=>{
  if(input.system.includes('语义分类器'))return {text:JSON.stringify(assessment())};
  throw Error('只模拟措辞生成故障');
 }});
 const r=await service({version:story.version,nodeId:d.nodeId,audit:d.audit,requestId:'fallback-review-123',text:'还没想好。'});
 assert.equal(r.outcome,'ASK');assert.equal(r.replySource,'fixed');
 assert.match(r.reply,/请谁来听这份军报/);assert.doesNotMatch(r.reply,/回令|姜维|伯约/);
 g.branchReply('还没想好。',r);settle(g);assert.equal(g.branch.dialogue.exchange.length,1);
});
test('新成功路线两种说法共用当面报军情，不再往返送回执，旧存档入口仍可回放',()=>{
 for(const outcome of ['INVITE_JIANG','RELAY_JIANG']){
  const g=planStart(true);g.branchAct('offline',outcome,'请伯约听取军情。');settle(g);
  assert.equal(g.branch.dialogue.nodeId,'C01-END-JOINT');
  assert.equal(g.branch.dialogue.state.orderDelivered,true);
  const ids=g.branch.dialogue.trail.map(f=>f.nodeId);
  assert.ok(ids.includes('C01-JIANG-JOINT'));assert.ok(!ids.includes('C01-ORDER-RELAY'));
  const restored=make();restored.restore(g.serialize());assert.equal(restored.branch.dialogue.nodeId,'C01-END-JOINT');
 }
 const old=planStart(true);const audit=old.branch.dialogue.audit.map(e=>e.type==='choose'&&e.id==='concern_joint'?{...e,id:'concern_plan'}:e);
 const legacy=new Dialogue(story);for(const e of audit){if(e.type==='choose')legacy.choose(e.id);else if(e.type==='next')legacy.next();else if(e.type==='guard')legacy.ask(e.text);}
 assert.equal(legacy.nodeId,'C01-AI-PLAN');assert.equal(legacy.aiRoute('RELAY_JIANG').target,'C01-JIANG-RELAY');
});
function turns(g,queue){let index=0;const histories=[];const service=createAiService({Dialogue,storyLoader:async()=>story,signer:createSigner('plan-turns'),model:async input=>{
 if(input.system.includes('语义分类器')){assert.match(input.system,/offenseQuote/);histories.push(JSON.parse(input.text));return {text:JSON.stringify(queue[index++])};}
 if(input.system.includes('校验魏延'))return {text:'{"valid":true}'};
 return {text:JSON.stringify({utterance:g.branch.dialogue.aiRoute(JSON.parse(input.text).outcome).fallback})};
 }});return {histories,submit:async text=>{const d=g.branch.dialogue;const r=await service({version:story.version,nodeId:d.nodeId,audit:d.audit,requestId:`plan-test-${index}-1234`,text});g.branchReply(text,r);settle(g);return r;}};}
test('新入口四次未说明办法后强闯灯灭，不允许重置轮数',async()=>{
 const g=planStart(),t=turns(g,[assessment(),assessment(),assessment(),assessment()]);
 assert.equal((await t.submit('将军请回。')).outcome,'ASK');assert.equal(g.branch.dialogue.exchange.length,1);
 assert.throws(()=>g.branchAct('retry'),/下一次发言/);
 const restored=make();restored.restore(g.serialize());assert.equal(restored.branch.dialogue.exchange.length,1);
 assert.equal((await t.submit('总会有人处理。')).outcome,'ASK');
 assert.equal((await t.submit('你再等等。')).outcome,'ASK');
 const last=await t.submit('再给我些工夫。');assert.equal(last.outcome,'FORCE_ENTER');assert.equal(last.reply,'磨磨唧唧的，我自己去讲');assert.equal(g.branch.dialogue.node.endingId,'E-LAMP');
 assert.deepEqual(t.histories.map(h=>h.history.length),[0,1,2,3]);
 g.branchAct('choose','rewind');settle(g);assert.equal(g.branch.dialogue.nodeId,'C01-GUARD-1');
});
test('新交涉不强制复述敌情，可承接补充并统一送伯约处理',async()=>{
 const g=planStart(true),t=turns(g,[assessment(),assessment('relay_jiang',{planQuote:'送给姜将军，再把回令带回来',recipientQuote:'姜将军',actionQuote:'送给姜将军，再把回令带回来'})]);
 await t.submit('我去办。');const result=await t.submit('送给姜将军，再把回令带回来。');
 assert.equal(result.outcome,'RELAY_JIANG');assert.equal(g.branch.dialogue.node.endingId,'E-FORMAL');assert.equal(t.histories[1].history[0].player,'我去办。');
});
test('第四次给出可行安排仍能成功',async()=>{
 const g=planStart(true),t=turns(g,[assessment(),assessment(),assessment(),assessment('invite_jiang',{planQuote:'我带将军去见伯约',recipientQuote:'伯约',actionQuote:'我带将军去见伯约'})]);
 for(const line of ['容我想想。','稍候。','还有个办法。'])assert.equal((await t.submit(line)).outcome,'ASK');
 assert.equal((await t.submit('我带将军去见伯约。')).outcome,'INVITE_JIANG');
 assert.equal(g.branch.dialogue.node.endingId,'E-FORMAL');
});
test('重说按最新撤回判断，自行转呈仍进小甲和天亮失败',async()=>{
 const g=planStart(true),t=turns(g,[assessment(),assessment('self_relay',{planQuote:'我自己转呈，有回令便送回前营',recipientQuote:'',actionQuote:'我自己转呈，有回令便送回前营'})]);
 await t.submit('我想请伯约。');await t.submit('不去找伯约了，我自己转呈，有回令便送回前营。');assert.equal(g.branch.dialogue.node.endingId,'E-DEATH');
});
test('严重冒犯单独处斩；没有原话依据不能处斩',async()=>{
 const g=planStart(),t=turns(g,[assessment('none',{offense:'grave',offenseQuote:'我要投敌，替魏军打开营门'})]);
 assert.equal((await t.submit('我要投敌，替魏军打开营门。')).outcome,'EXECUTION');assert.equal(g.branch.dialogue.node.endingId,'E-ANGER');
 const invalid=planStart(),bad=turns(invalid,[assessment('none',{offense:'grave',offenseQuote:''}),assessment('none',{offense:'grave',offenseQuote:''})]);
 await assert.rejects(bad.submit('将军何必发怒？'),/原话依据/);assert.equal(invalid.branch.dialogue.exchange.length,0);
});
test('提前确认对白润色兼容旧文案存档，仍拒绝伪造的应允',()=>{
 const oldStory=structuredClone(story),node=oldStory.nodes.find(n=>n.id==='C01-JIANG-CONFIRM');
 for(const line of node.lines){
  for(const revision of [...node.textRevisions].reverse()){
   if(revision.speaker===line.speaker&&revision.new===line.text)line.text=revision.old;
  }
 }
 const old=new ChapterOneSession(script,flow,'branch-test',undefined,undefined,'offline',oldStory);
 old.finishCinematic();settle(old);old.branchAct('ask','还有谁可以帮忙处理军情？');settle(old);old.branchAct('choose','confirm_jiang');
 for(let i=0;i<node.lines.length&&old.branch.line!==4;i++)old.branchAct('next');
 assert.equal(old.branch.dialogue.nodeId,node.id);
 assert.match(old.branch.currentLine.text,/^还没到/);
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
 for(let i=0;i<30&&(g.branch.dialogue.nodeId!=='C01-GUARD-ENEMY'||g.branch.dialogue.pending);i++)g.branchAct('next');
 assert.equal(g.branch.dialogue.nodeId,'C01-GUARD-ENEMY');
 assert.equal(g.branch.dialogue.pending,null);
 assert.equal(g.branch.clues.some(c=>c.id==='branch-enemy'),false);
 settle(g);const clue=g.branch.clues.find(c=>c.id==='branch-enemy');assert.match(clue.text,/小甲说/);assert.doesNotMatch(clue.text,/前营.*回话/);
 const loaded=make();loaded.restore(g.serialize());assert.deepEqual(loaded.branch.clues,g.branch.clues);
 loaded.branchAct('choose','meet');assert.match(loaded.branch.clues.find(c=>c.id==='branch-enemy').text,/小甲说/);
 settle(loaded);const updated=loaded.branch.clues.filter(c=>c.id==='branch-enemy');assert.equal(updated.length,1);assert.match(updated[0].text,/前营正等着回话/);
});
test('四种结局及失职重试，不从提示直接授予应允与送达',()=>{
 for(const [known,outcome,end] of [[true,'INVITE_JIANG','E-COOP'],[true,'RELAY_JIANG','E-FORMAL'],[false,'SELF_RELAY','E-DEATH'],[false,'ENTER','E-LAMP']]){
  const g=start(known);assert.equal(g.branch.dialogue.state.jiangAgreed,false);assert.equal(g.branch.completed,false);
  g.branchAct('offline',outcome,'魏军还没攻营，我会把军报交到。');settle(g);
  if(end==='E-COOP'){g.branchAct('choose','stay');settle(g);}

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


test('冒犯复核否定初判时保留补充机会，不误入处斩',async()=>{
 const g=planStart(),d=g.branch.dialogue;
 const service=createAiService({Dialogue,storyLoader:async()=>story,signer:createSigner('offense-check'),model:async input=>{
  if(input.system.includes('语义分类器'))return {text:JSON.stringify(assessment('none',{offense:'grave',offenseQuote:'投敌'}))};
  if(input.system.includes('严重冒犯'))return {text:'{"valid":false}'};
  throw Error('使用对应后备问话');
 }});
 const text='我岂会投敌？';const r=await service({version:story.version,nodeId:d.nodeId,audit:d.audit,requestId:'offense-check-0001',text});
 assert.equal(r.outcome,'ASK');g.branchReply(text,r);settle(g);assert.equal(d.nodeId,'C01-AI-JOINT');assert.equal(d.exchange.length,1);
});


test('未问伯约的死亡回溯保留线索，在小甲处直接给出问人做主的入口',()=>{
 const g=planStart(false);g.branch.offline('SELF_RELAY','我来转呈军报，有回令便送回前营。');g.branchChanged();settle(g);
 assert.equal(g.branch.dialogue.node.endingId,'E-DEATH');const clues=structuredClone(g.branch.clues);assert.equal(clues.some(c=>c.id==='branch-jiang'),false);
 g.branchAct('choose','rewind');settle(g);assert.equal(g.branch.dialogue.nodeId,'C01-GUARD-2');assert.deepEqual(g.branch.clues,clues);
 assert.equal(g.branch.dialogue.choices[0].label,'问问遇上事儿了谁能做主');assert.equal(g.branch.dialogue.state.jiangAgreed,false);
 const loaded=make();loaded.restore(g.serialize());assert.deepEqual(loaded.branch.clues,clues);
 loaded.branchAct('choose','decision');settle(loaded);assert.equal(loaded.branch.dialogue.state.knowsJiang,true);assert.equal(loaded.branch.dialogue.state.jiangAgreed,false);
 assert.ok(loaded.branch.dialogue.choices.some(c=>c.id==='confirm_jiang'));loaded.branchAct('choose','confirm_jiang');settle(loaded);assert.equal(loaded.branch.dialogue.state.jiangAgreed,true);
});

test('回溯不抹掉已问得的伯约线索，也不把上次应允当作本轮授权',()=>{
 const g=confirmJiang();settle(g);g.branchAct('choose','meet');settle(g);g.branchAct('choose','concern_joint');settle(g);
 g.branch.offline('SELF_RELAY','我来转呈军报，有回令便送回前营。');g.branchChanged();settle(g);g.branchAct('choose','rewind');settle(g);
 const clue=g.branch.clues.find(c=>c.id==='branch-jiang');assert.ok(clue);assert.match(clue.text,/上一次/);assert.equal(g.branch.dialogue.state.jiangAgreed,false);
 const loaded=make();loaded.restore(g.serialize());assert.deepEqual(loaded.branch.clues,g.branch.clues);
});
