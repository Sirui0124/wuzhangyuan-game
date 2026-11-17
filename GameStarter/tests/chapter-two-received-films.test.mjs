import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GrainSession} from '../web-demo/.build/GameStarter/web-demo/src/chapters/chapter-two/session.js';

const story=JSON.parse(readFileSync(new URL('../../content/chapters/grain/chapter-two.films.json',import.meta.url)));
const config=JSON.parse(readFileSync(new URL('../web-demo/public/cinematics.json',import.meta.url)));
const nodes=new Map(story.nodes.map(n=>[n.id,n]));
const clips=new Map(config.chapterTwo.map(c=>[c.id,c]));
const checkpoint=id=>{const s=new GrainSession(story);s.state.node=id;return s;};

test('查粮新片仍逐份阅读原件，两个普通选择不会被影片绕过',()=>{
 const s=checkpoint('V18');
 for(const id of ['V18','CH2-LY04-D04','V18-C07','CH2-LY04-D05','V18-C08','CH2-LY04-D06']){
  assert.equal(s.current.id,id);
  if(id==='CH2-LY04-D04')assert.ok(!s.clues.some(c=>c.id==='LY-M04'));
  if(id==='V18-C07')assert.ok(s.clues.some(c=>c.id==='LY-M04'));
  if(id==='CH2-LY04-D05')assert.ok(!s.clues.some(c=>c.id==='LY-M05'));
  if(id==='CH2-LY04-D06')assert.ok(!s.clues.some(c=>c.id==='LY-M06'));
  assert.equal(s.advance(),true);
 }
 assert.equal(s.current.id,'UI-N3');assert.equal(s.advance(),false);
 assert.equal(nodes.get('CH2-LY04-D03').next,'UI-N2');
 assert.equal(nodes.get('V15').next,'CH2-LY04-D01');
});

test('返回查粮的新片只属于明确继续的分支，停查与直接核账不串播',()=>{
 const s=checkpoint('UI-EARLY');assert.equal(s.advance('early-continue'),true);
 assert.equal(s.current.clip,'CH2-C05R');s.advance();assert.equal(s.current.id,'V18');
 const stop=checkpoint('UI-EARLY');stop.advance('early-stop');assert.equal(stop.current.id,'UI-EARLY-FILE');
 assert.equal(nodes.get('V16A').next,'V17');assert.equal(nodes.get('V16C').next,'V17');
 for(const id of ['CH2-V13','CH2-V16C'])assert.ok(!clips.get(id).src.includes('received-20261027'),id);
 const warehouseSrc=clips.get('CH2-V18').src;
 const media=JSON.parse(readFileSync(new URL('../web-demo/public/video/media-manifest.json',import.meta.url)));
 const retained=media.clips.find(c=>c.url===warehouseSrc);
 // A voice-only remux gets a new URL; it must still identify the retained picture source.
 assert.ok((retained.previousSource??warehouseSrc).includes('warehouse-retained-20261027'));
 assert.ok(retained.duration<=8.55,'only the retained warehouse section may play here');
});

test('改后停催片补回有来源的人物说明，其他分支不重复；回帐与读信停点保留',()=>{
 assert.equal(nodes.get('V19B').next,'CH2-LY04-C04');
 assert.equal(nodes.get('CH2-LY04-C04').speaker,'地方经手人');
 assert.equal(nodes.get('CH2-LY04-C04').next,'V20');
 for(const id of ['V19A','V19C'])assert.equal(nodes.get(id).next,'V20');
 assert.equal(nodes.get('CH2-LY06-018').next,'UI-RETURN-ACCOUNT');
 assert.equal(nodes.get('UI-RETURN-ACCOUNT').kind,'action');
 const s=checkpoint('V21a');s.advance();assert.equal(s.current.id,'CH2-LY07-006');
 assert.ok(!s.clues.some(c=>c.id==='LY-C11'));s.advance();assert.equal(s.current.id,'V21b');
 assert.ok(s.clues.some(c=>c.id==='LY-C11'));assert.ok(!s.clues.some(c=>c.id==='LY-C12'));
 s.advance();assert.equal(s.current.id,'V22');assert.ok(s.clues.some(c=>c.id==='LY-C12'));
});

test('补入赴魏单句不提前完成计划线索；新旧材料检查点和已选分数可恢复',()=>{
 const s=checkpoint('CH2-LY09-P02');assert.equal(s.current.clip,'CH2-V25-02');
 assert.ok(!s.clues.some(c=>c.id==='LY-C14'));s.advance();assert.equal(s.current.id,'V25-03');
 assert.equal(nodes.get('CH2-LY09-P04').placeholder,true);
 for(const id of ['V12','V15','V18','CH2-LY04-D04','CH2-LY04-D05','CH2-LY04-D06','V19B','V20','V21a','CH2-LY07-006','V21b','V25-03']){
  const prior=checkpoint(id);prior.state.visited=['UI-N2'];prior.state.chosen=['N2-B'];
  const restored=new GrainSession(story,structuredClone(prior.state));
  assert.equal(restored.current.id,id);assert.deepEqual(restored.scores,prior.scores);
 }
});
