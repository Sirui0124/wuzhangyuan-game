import {dialogueFixtures} from '../../tools/ai/dialogue-fixtures.mjs';
import {fileURLToPath} from 'node:url';
import {chapterOneAchievementIds} from '../web-demo/.build/GameStarter/web-demo/src/chapters/chapter-one/achievements.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {extraAchievementCatalog,milestoneAchievements} from '../web-demo/.build/GameStarter/web-demo/src/achievements/catalog.js';
import {recordAchievements,readAchievements,recoverLegacyAchievements,mergeAchievements,ACHIEVEMENTS_KEY} from '../web-demo/.build/GameStarter/web-demo/src/achievements/storage.js';
import {JietingSession,createJietingPlaytest} from '../web-demo/.build/GameStarter/web-demo/src/chapters/chapter-three/session.js';
import {jietingAchievementIds} from '../web-demo/.build/GameStarter/web-demo/src/chapters/chapter-three/achievements.js';
import {GrainSession} from '../web-demo/.build/GameStarter/web-demo/src/chapters/chapter-two/session.js';
import {grainAchievementIds} from '../web-demo/.build/GameStarter/web-demo/src/chapters/chapter-two/achievements.js';
import {fixedJudgment} from '../web-demo/.build/GameStarter/web-demo/src/chapters/chapter-two/film-dialogue.js';
const read=p=>JSON.parse(readFileSync(new URL('../../content/chapters/'+p,import.meta.url)));
const third=read('jieting/chapter-three.story.json'),grain=read('grain/chapter-two.films.json'),rubric=read('grain/chapter-two.films-rubric.json');
const memory=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
test('22 narrative cards keep story-owned ending titles and distinct early/late case records',()=>{
 const cards=extraAchievementCatalog(third);assert.equal(cards.length,22);assert.equal(milestoneAchievements.length,9);assert.equal(new Set(cards.map(e=>e.id)).size,cards.length);
 for(const e of third.endings){const card=cards.find(c=>c.id==='jieting-'+e.id);assert.equal(card.title,e.title);assert.equal(card.description,e.description);}
 assert.equal(cards.filter(e=>e.title==='认下来的罪').length,2);
});
test('same run cannot increase counts after reload or restoring an older run; archive merges preserve old endings',()=>{
 const storage=memory();recordAchievements(['grain-dates'],'grain:1',storage);recordAchievements(['grain-dates'],'grain:1',storage);recordAchievements(['grain-dates'],'grain:2',storage);recordAchievements(['grain-dates'],'grain:1',storage);
 assert.equal(readAchievements(storage).unlocked['grain-dates'].times,2);
 const legacy={schemaVersion:1,unlocked:{safe:{firstUnlockedAt:'2026-10-25T00:00:00Z',lastLoopId:'old',times:4}}};
 const merged=mergeAchievements(legacy,storage);assert.deepEqual(merged.unlocked.safe,legacy.unlocked.safe);assert.ok(merged.unlocked['grain-dates']);assert.equal(Object.keys(legacy.unlocked).length,1);
});
test('broken archive and write failures preserve original data and return failure',()=>{
 const storage=memory();storage.setItem(ACHIEVEMENTS_KEY,'broken');assert.equal(recordAchievements(['grain-dates'],'1',storage),false);assert.equal(storage.getItem(ACHIEVEMENTS_KEY),'broken');
 assert.equal(recordAchievements(['grain-dates'],'1',{getItem:()=>null,setItem:()=>{throw Error('quota');}}),false);
});
test('legacy recovery requires an authored terminal outcome and retains original dates',()=>{
 const storage=memory();storage.setItem('jieting-chapter-three-v1:endings',JSON.stringify({'great-victory':Date.parse('2026-10-25T12:00:00Z'),'invented-ending':Date.now()}));
 storage.setItem('jieting-chapter-three-v1',JSON.stringify({ending:'great-victory',run:42}));
 storage.setItem('grain-chapter-two-completed-v1','true');recoverLegacyAchievements(grain,storage);let c=readAchievements(storage);assert.equal(Object.keys(c.unlocked).length,1);assert.equal(c.unlocked['jieting-great-victory'].firstUnlockedAt,'2026-10-25T12:00:00.000Z');recordAchievements(['jieting-great-victory'],'jieting:42',storage);assert.equal(readAchievements(storage).unlocked['jieting-great-victory'].times,1);
 storage.setItem('grain-chapter-two-films-v1',JSON.stringify({version:grain.version,node:'END-E1',visited:[],run:77}));recoverLegacyAchievements(grain,storage);assert.ok(readAchievements(storage).unlocked['grain-E1']);
});
test('real reinforcement route awards water and troop milestones after arrival, never at order',()=>{
 const s=createJietingPlaytest(third,'reinforcement',{aiEnabled:false,phoneAllowed:false});assert.deepEqual(jietingAchievementIds(s),['jieting-visits']);
 const picks={'JT-R1-FIXED':'JT-O132','JT-R2-FIXED':'JT-O167','JT-R3-FIXED':'JT-O198','JT-ROUTE-CHOICE':'JT-O229','JT-LURE-METHOD':'JT-O278','JT-LURE-CONFIRM':'JT-O305','JT-LURE-SIGNAL':'lure-wait-signal','JT-R4-FIXED':'r4-none','JT-R5-FIXED':'r5-none'};
 let orderedBeforeArrival=false;
 for(let i=0;i<500&&s.current.kind!=='ending';i++){
  const records=Object.values(s.state.roundResults),ids=jietingAchievementIds(s);
  if(records.some(r=>r.ordered&&!r.arrived)&&!records.some(r=>r.arrived)){orderedBeforeArrival=true;assert.ok(!ids.includes('jieting-ten-thousand'));assert.ok(!ids.includes('jieting-water'));}
  assert.ok(s.advance(s.current.kind==='choice'?picks[s.current.id]??s.options[0]?.id:undefined),s.current.id);
 }
 assert.equal(orderedBeforeArrival,true);assert.equal(s.state.ending,'great-victory');assert.ok(jietingAchievementIds(s).includes('jieting-ten-thousand'));assert.ok(jietingAchievementIds(s).includes('jieting-water'));assert.ok(jietingAchievementIds(s).includes('jieting-great-victory'));
 const restored=new JietingSession(third,s.snapshot(),{aiEnabled:false,phoneAllowed:false});assert.deepEqual(jietingAchievementIds(restored),jietingAchievementIds(s));
});
test('real grain route awards reading and letter milestones only after their scenes complete',()=>{
 const s=new GrainSession(grain,undefined,rubric,false);let beforeLetter=false;
 const picks={'UI-N1':'N1-A','UI-N2':'N2-A','UI-N3':'N3-B','UI-N4':'N4-B','UI-N5':'N5-A'};
 for(let i=0;i<220&&s.current.kind!=='finish';i++){
  const n=s.current;if(n.kind==='open')s.submit(fixedJudgment(n.round,0,s.currentRubric).judgment);
  if(n.id==='UI-SEND'){beforeLetter=true;assert.ok(!grainAchievementIds(s).includes('grain-letter'));}
  assert.ok(s.advance(n.kind==='choice'?picks[n.id]??n.options[0].id:undefined),n.id);
 }
 assert.equal(beforeLetter,true);assert.equal(s.current.ending,'E1');const ids=grainAchievementIds(s);for(const id of ['grain-dates','grain-ledgers','grain-letter','grain-E1'])assert.ok(ids.includes(id),id);
});

test('first-chapter memorials follow the actual rewind and questioning',async()=>{
 const f=await dialogueFixtures(fileURLToPath(new URL('../web-demo/.build/',import.meta.url)));
 assert.deepEqual(chapterOneAchievementIds(f.first().snapshot()),[]);
 const s=await f.thoughts();assert.ok(chapterOneAchievementIds(s.snapshot()).includes('wuzhang-second-night'));assert.ok(chapterOneAchievementIds(s.snapshot()).includes('wuzhang-inquiry'));
});
