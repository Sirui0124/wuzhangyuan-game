import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const build=resolve(process.env.GAME_BUILD||'GameStarter/web-demo/.build');
const {chapterAccess,recordChapterHistory,startNewChapterProgress,CHAPTER_HISTORY_KEY}=await import(pathToFileURL(resolve(build,'GameStarter/web-demo/src/chapters/progression.js')));
const specs=JSON.parse(readFileSync(resolve(build,'story/chapter-access.json')));
const store=(seed={})=>{const values=new Map(Object.entries(seed));return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key),values};};
const unlocked=storage=>Object.entries(chapterAccess(storage,specs)).filter(([,v])=>v.unlocked).map(([id])=>id);
const oldThird={schema:1,version:'old-supported-history',node:specs[2].nodes[0],visited:[],chosen:[]};

test('新玩家开放第一章和夷陵抢先体验；其余章节暂不开放，即使有通关记录',()=>{
 const s=store();assert.deepEqual(unlocked(s),['wuzhang','yiling']);
 recordChapterHistory('wuzhang',false,s);assert.deepEqual(unlocked(s),['wuzhang','yiling']);
 s.setItem('wuzhang-chapter-endings-v2',JSON.stringify({schemaVersion:1,unlocked:{'tent-execution':{firstUnlockedAt:'2026-10-27',times:1}}}));
 assert.deepEqual(unlocked(s),['wuzhang','yiling']);
 for(const [id,expected] of [['wuzhang',['wuzhang','yiling']],['grain',['wuzhang','yiling']],['jieting',['wuzhang','yiling']]]){
  recordChapterHistory(id,true,s);assert.deepEqual(unlocked(s),expected);
 }
});
test('旧档历史保留，但当前只开放第一章与第四章',()=>{
 const s=store({'jieting-chapter-three-v1':JSON.stringify(oldThird)});
 const progress=chapterAccess(s,specs);assert.deepEqual(unlocked(s),['wuzhang','yiling']);
 assert.equal(progress.wuzhang.replayable,true);assert.equal(progress.grain.replayable,true);
 assert.equal(progress.wuzhang.completed,false);assert.equal(progress.jieting.replayable,false);
 s.values.delete('jieting-chapter-three-v1');recordChapterHistory('wuzhang',false,s);
 assert.deepEqual(unlocked(s),['wuzhang','yiling'],'chapter replay / earlier save cannot erase history');
});
test('手动槽和重玩备份可恢复历史，隔离试玩、损坏档和仅有电影记录不能授予资格',()=>{
 for(const suffix of [':slot:1',':slot:2',':before-new'])assert.equal(chapterAccess(store({['jieting-chapter-three-v1'+suffix]:JSON.stringify(oldThird)}),specs).jieting.unlocked,false);
 for(const [key,value] of [['jieting-chapter-three-v1:playtest:reinforcement',oldThird],['jieting-chapter-three-v1',{}],['jieting-chapter-three-v1',{...oldThird,node:'missing'}],['wuzhang-session-films-v1',{completed:['safe']}],[CHAPTER_HISTORY_KEY,{version:99,entered:['yiling'],completed:['yiling']}]] ){
  assert.deepEqual(unlocked(store({[key]:JSON.stringify(value)})),['wuzhang','yiling']);
 }
});
test('历史通关标志与终点自动档保留；不开放暂停章节或伪造前章通关',()=>{
 assert.deepEqual(unlocked(store({'grain-chapter-two-completed-v1':'true'})),['wuzhang','yiling']);
 const first=store({'wuzhang-chapter-endings-v2':JSON.stringify({schemaVersion:1,unlocked:{safe:{firstUnlockedAt:'2026-10-27',times:1}}})});
 assert.deepEqual(unlocked(first),['wuzhang','yiling']);
 const terminal={...oldThird,node:specs[2].successNodes[0]};
 assert.equal(chapterAccess(store({'jieting-chapter-three-v1':JSON.stringify(terminal)}),specs).yiling.unlocked,true);
 const final={game:{schemaVersion:1,chapterId:'yiling',contentVersion:'old',nodeId:specs[3].nodes[0],actions:[]}};
 const migrated=chapterAccess(store({'yiling-chapter-four-v1:slot:3':JSON.stringify(final)}),specs);
 assert.ok(['wuzhang','yiling'].every(id=>migrated[id].unlocked));assert.equal(migrated.jingzhou.unlocked,false);assert.ok(['wuzhang','grain','jieting'].every(id=>migrated[id].replayable&&!migrated[id].completed));
 const completedFourth=store({'yiling-chapter-four-completed-v1':'true'});assert.equal(chapterAccess(completedFourth,specs).jingzhou.unlocked,false);
});


test('新游戏备份自动档并重锁后章，旧手动档、成就和备份不再自动恢复资格',()=>{
 const seed={
  'jieting-chapter-three-v1':JSON.stringify(oldThird),
  'jieting-chapter-three-v1:slot:1':JSON.stringify(oldThird),
  'jieting-chapter-three-v1:before-new':JSON.stringify(oldThird),
  'grain-chapter-two-completed-v1':'true',
  'wuzhang-chapter-endings-v2':JSON.stringify({schemaVersion:1,unlocked:{safe:{firstUnlockedAt:'2026-10-27',times:1}}})
 };
 const s=store(seed);assert.deepEqual(unlocked(s),['wuzhang','yiling']);
 startNewChapterProgress(s,specs);
 assert.deepEqual(unlocked(s),['wuzhang','yiling']);assert.deepEqual(unlocked(s),['wuzhang','yiling']);
 assert.equal(s.getItem('jieting-chapter-three-v1'),null);
 assert.equal(s.getItem('grain-chapter-two-completed-v1'),null);
 assert.equal(s.getItem('jieting-chapter-three-v1:slot:1'),seed['jieting-chapter-three-v1:slot:1']);
 assert.equal(s.getItem('wuzhang-chapter-endings-v2'),seed['wuzhang-chapter-endings-v2']);
 assert.equal(JSON.parse(s.getItem(CHAPTER_HISTORY_KEY+':before-new'))['jieting-chapter-three-v1'],seed['jieting-chapter-three-v1']);
 recordChapterHistory('wuzhang',false,s);assert.deepEqual(unlocked(s),['wuzhang','yiling']);
 recordChapterHistory('wuzhang',true,s);assert.deepEqual(unlocked(s),['wuzhang','yiling']);
 recordChapterHistory('grain',false,s);assert.deepEqual(unlocked(s),['wuzhang','yiling']);
 recordChapterHistory('grain',true,s);assert.deepEqual(unlocked(s),['wuzhang','yiling']);
});

test('抢先进入、通关及刷新夷陵均不越级解锁；主线追上后沿用结果',()=>{
 const s=store();
 assert.equal(chapterAccess(s,specs).yiling.earlyAccess,true);
 recordChapterHistory('yiling',false,s);
 assert.deepEqual(unlocked(s),['wuzhang','yiling']);
 recordChapterHistory('yiling',true,s);
 const restored=store(Object.fromEntries(s.values));
 assert.deepEqual(unlocked(restored),['wuzhang','yiling']);
 assert.equal(chapterAccess(restored,specs).yiling.completed,true);
 for(const id of ['wuzhang','grain'])assert.equal(chapterAccess(restored,specs)[id].replayable,false);
 recordChapterHistory('wuzhang',true,restored);
 assert.deepEqual(unlocked(restored),['wuzhang','yiling']);
 recordChapterHistory('grain',true,restored);
 assert.deepEqual(unlocked(restored),['wuzhang','yiling']);
 recordChapterHistory('jieting',false,restored);
 assert.equal(chapterAccess(restored,specs).jingzhou.unlocked,false);
 recordChapterHistory('jieting',true,restored);
 assert.deepEqual(unlocked(restored),['wuzhang','yiling']);
 assert.equal(chapterAccess(restored,specs).yiling.earlyAccess,false);
 assert.equal(chapterAccess(restored,specs).luofengpo.unlocked,false);
 startNewChapterProgress(restored,specs);
 assert.deepEqual(unlocked(restored),['wuzhang','yiling']);
 assert.equal(chapterAccess(restored,specs).yiling.completed,false);
 recordChapterHistory('yiling',true,restored);
 assert.deepEqual(unlocked(restored),['wuzhang','yiling']);
});

test('新游戏备份失败时不清空当前进度',()=>{
 const s=store({'jieting-chapter-three-v1':JSON.stringify(oldThird)});
 chapterAccess(s,specs);const before=[...s.values];
 assert.throws(()=>startNewChapterProgress({...s,setItem(){throw Error('quota');}},specs),/quota/);
 assert.deepEqual([...s.values],before);
});
