import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { filmForRows, filmForLine } from '../web-demo/.build/GameStarter/web-demo/src/game/story-films.js';
import { endingFilmForState } from '../web-demo/.build/GameStarter/web-demo/src/game/ending-films.js';
const movies=JSON.parse(readFileSync(new URL('../web-demo/public/cinematics.json',import.meta.url)));
const flow=JSON.parse(readFileSync(new URL('../../content/chapters/wuzhang/chapter-one.flow.json',import.meta.url)));
const branch=JSON.parse(readFileSync(new URL('../../content/chapters/wuzhang/chapter-one.branch.json',import.meta.url)));
const rowFilms=movies.chapterDialogue.filter(clip=>Array.isArray(clip.rows));

test('结局影片只呈现已发生的结果，次日问责不借用结局影片',()=>{
 const legacyFilms=[{id:'C1END-EXEC',ending:'weiyan-execution'},{id:'C1END-TENT',ending:'tent-execution'}];
 const state={phase:'reply',end:'weiyan-execution',tent:'caught',story:{flags:{}}};
 assert.equal(endingFilmForState(legacyFilms,state),null);
 state.phase='death';
 assert.equal(endingFilmForState(legacyFilms,state).id,'C1END-EXEC');
 state.end='tutorial-sacrifice';assert.equal(endingFilmForState(legacyFilms,state),null);
 state.end='tent-execution';assert.equal(endingFilmForState(legacyFilms,state),null);
 state.tent='dead';assert.equal(endingFilmForState(legacyFilms,state).id,'C1END-TENT');
 assert.deepEqual(movies.chapterEndings,[]);
 const failure=branch.nodes.find(node=>node.id==='C01-FAIL-NIGHT');
 assert.equal(failure.film.src,'/video/current/EN02B-A-full-speed-20261022.mp4');
 assert.equal(branch.nodes.find(node=>node.id===failure.film.afterNode).endingId,'E-DEATH');
 assert.notEqual(failure.film.src,movies.branchDialogue.find(clip=>clip.id==='C1END-EXEC').src);
});

test('片段只覆盖现有连续剧情行，旧存档在片段中途时保留原文，不从片头重造事件',()=>{
 for(const film of rowFilms){
  const section=flow.sections.find(s=>s.rows.some((id,i)=>film.rows.every((v,j)=>v===s.rows[i+j])));
  assert.ok(section,film.id);
  assert.equal(filmForRows([film],section.rows.slice(section.rows.indexOf(film.rows[0]))),film);
  if(film.rows.length>1) assert.equal(filmForRows([film],film.rows.slice(1)),null);
 }
});
test('缺失、错说话人、待重拍的影片与动态AI接受句不能作为预置对白导入',()=>{
 for(const film of movies.chapterDialogue){
  assert.ok(!/C1T(09|15|20|21)-/.test(film.id),film.id);
  if (film.id.startsWith('C1T03-')) {
   assert.match(film.src, /C1T03-scout-answer-20261024-cba52c25/);
   assert.deepEqual(film.rows, ['A-23','A-24']);
  }
  if (/C1T(13|14|18)-/.test(film.id)) assert.match(film.src, /20261024/);
  // The new T14 still has the guard mouthing the player's first request; keep J03 as dialogue.
  if (film.id.startsWith('C1T14-')) assert.ok(!film.rows.includes('J03'));
  assert.ok(!film.rows?.some(id=>['A-40B','W07','P2-SAY'].includes(id)),film.id);
 }
});
test('固定分支只播放本轮已知的军情，动态改词仍走实时对白',()=>{
 const source='营前有急报。营门未破。';
 const canonical={id:'known',rows:['A-42','A-43'],src:'/known.mp4',title:'已核实'};
 const variant={...canonical,id:'unknown',src:'/unknown.mp4',firstLineText:'营前有急报。'};
 assert.equal(filmForLine([canonical,variant],['A-42','A-43'],source,source),canonical);
 assert.equal(filmForLine([canonical,variant],['A-42','A-43'],'营前有急报。',source),variant);
 assert.equal(filmForLine([canonical,variant],['A-42','A-43'],'玩家自定义的新发言',source),null);
 assert.equal(filmForLine([canonical,variant],['A-43'],'营前有急报。',source),null);
});
test('第一章分支影片与字幕均在发布清单，只接入已采用的镜头',()=>{
 const filmNodes=branch.nodes.filter(node=>node.film);
 assert.ok(filmNodes.length>0);
 const registry=Object.values(movies).flat();
 const emptyTracks=JSON.parse(readFileSync(new URL('../../video/subtitles/empty-tracks.json',import.meta.url))).entries;
 for(const {id,film} of filmNodes){
  for(const clip of [...(film.leadIn??[]),film]){
   const registered=registry.find(entry=>entry.src===clip.src);
   assert.ok(registered,id);
   if(clip.subtitles)assert.equal(clip.subtitles,registered.subtitles,id);
   else assert.ok(emptyTracks.some(entry=>entry.id===registered.id&&entry.status==='planned-no-dialogue'),id);
   assert.doesNotMatch(clip.src,/CH01-(J02|F02)-h3-v6-/);
  }
 }
 const joint=filmNodes.find(node=>node.id==='C01-JIANG-JOINT');
 assert.match(joint.film.src,/CH01-J04-h3-v6-1\.3x-/);
 assert.equal(joint.film.afterNode,'C01-JOINT-DAWN');
});
