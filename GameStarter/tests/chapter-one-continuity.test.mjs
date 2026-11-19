import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BranchProgress} from '../web-demo/.build/GameStarter/web-demo/src/chapters/chapter-one/branch-progress.js';
const story=JSON.parse(readFileSync(new URL('../../content/chapters/wuzhang/chapter-one.branch.json',import.meta.url),'utf8'));
const make=(entry=story.entry,source=story)=>new BranchProgress({...source,entry});
function settle(b){for(let i=0;i<200;i++){if(b.noticePending)b.openNotice();else if(!b.atLastLine||b.dialogue.pending||b.dialogue.node.kind==='passage'||b.dialogue.node.autoChoice)b.next();else return;}throw Error('loop');}
function start(b){settle(b);b.choose('enemy');settle(b);b.choose('meet');settle(b);b.choose('concern_joint');settle(b);}
test('天亮与粮册先于结算和询问显示，隐藏旧祁山入口',()=>{
 const dawn=make('C01-JOINT-DAWN');assert.match(dawn.currentLine.text,/天色渐明/);assert.equal(dawn.dialogue.nodeId,'C01-JOINT-DAWN');dawn.next();assert.equal(dawn.dialogue.nodeId,'C01-END-JOINT');
 const tail=make('C01-EPILOGUE'),texts=[];while(!tail.atLastLine){texts.push(tail.currentLine.text);tail.next();}texts.push(tail.currentLine.text);
 assert.match(texts[0],/七日期满/);assert(texts.findIndex(t=>t.includes('祁山粮运'))<texts.findIndex(t=>t.includes('那次的粮册')));assert.deepEqual(tail.dialogue.choices.map(c=>c.id),['stop']);
});
test('转呈只显示我与小甲的交接对白，随后播守夜问责合片，再进入死亡结局及回溯',()=>{
 const b=make('C01-FAIL-HANDOFF');
 assert.deepEqual(b.currentLine,{speaker:'我',text:'小甲，这是魏将军的军报，劳你递进去。'});
 b.next();
 assert.deepEqual(b.currentLine,{speaker:'小甲',text:'好吧，我看情况找人传话'});
 b.next();
 assert.equal(b.dialogue.nodeId,'C01-FAIL-NIGHT');
 const film=b.dialogue.node.film;
 assert.equal(b.line,film.beforeLine);
 assert.deepEqual([...(film.leadIn??[]),film].map(clip=>clip.title),['守到天明与天亮问责']);
 assert.equal(film.afterNode,'C01-END-DEATH');
 const end=make('C01-END-DEATH');assert.equal(end.dialogue.node.title,'诸葛亮活了，但你挂了');assert.match(end.currentLine.text,/没?等不到回令.*处死/);end.choose('rewind');settle(end);assert.equal(end.dialogue.nodeId,'C01-GUARD-2');
});
test('重复询问小甲不重播初见招呼和首次到场提醒',()=>{
 const b=make();settle(b);b.choose('enemy');settle(b);const first=b.currentLine.text;b.choose('ask');assert.equal(b.currentLine.text,'还有什么要问的？');b.choose('rules');settle(b);assert.notEqual(b.currentLine.text,first);
});
test('旧档读到交报叙述时恢复到对白，读到等待叙述时恢复到守夜影片',()=>{
 const previous=structuredClone(story);
 for(const id of ['C01-FAIL-HANDOFF','C01-FAIL-NIGHT']){
  const node=previous.nodes.find(n=>n.id===id);
  for(const line of node.lines){
   const revision=node.textRevisions.find(r=>r.speaker===line.speaker&&r.new===line.text);
   if(revision)line.text=revision.old;
  }
  node.lines[0].visible=true;
 }
 const old=make('C01-FAIL-HANDOFF',previous);
 const current=make('C01-FAIL-HANDOFF');
 current.restore(old.snapshot());
 assert.equal(current.currentLine.text,'小甲，这是魏将军的军报，劳你递进去。');
 while(old.dialogue.nodeId==='C01-FAIL-HANDOFF')old.next();
 assert.equal(old.line,0);
 current.restore(old.snapshot());
 assert.equal(current.dialogue.nodeId,'C01-FAIL-NIGHT');
 assert.equal(current.line,current.dialogue.node.film.beforeLine);
});
test('旧版失职路线存档可迁移，草稿与真实状态保留，伪造状态仍拒绝',()=>{
 const old=structuredClone(story);
 for(const n of old.nodes){for(const l of n.lines){delete l.visible;for(const r of [...(n.textRevisions??[])].reverse())if(l.speaker===r.speaker&&l.text===r.new)l.text=r.old;}if(n.titleRevisions?.length)n.title=n.displayTitle=n.titleRevisions.at(-1);}
 const b=make(old.entry,old);start(b);b.offline('SELF_RELAY','军报交给我，我去转呈，有回令便送回前营。');settle(b);assert.equal(b.dialogue.nodeId,'C01-END-DEATH');assert.equal(b.dialogue.node.title,'失了职守');b.draft='保留草稿';const saved=b.snapshot();const restored=make();restored.restore(saved);assert.equal(restored.draft,'保留草稿');assert.equal(restored.dialogue.node.title,'诸葛亮活了，但你挂了');
 const forged=structuredClone(saved),graph=JSON.parse(forged.graph);graph.current.state.jiangAgreed=true;forged.graph=JSON.stringify(graph);assert.throws(()=>make().restore(forged),/实际经过/);
 b.choose('rewind');settle(b);const replay=make();replay.restore(b.snapshot());assert.equal(replay.dialogue.nodeId,'C01-GUARD-2');
});
