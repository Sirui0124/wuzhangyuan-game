import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {resolve,dirname,sep} from 'node:path';
import {prepareReleaseWeb} from './release-profile.mjs';
import {workspaceRoot} from './stage-payload.mjs';

test('release profile removes omitted chapter content and orphan imports without touching local originals',()=>{
 const cache=resolve(workspaceRoot,'.cache');mkdirSync(cache,{recursive:true});
 const folder=mkdtempSync(resolve(cache,'profile-test-')),build=resolve(folder,'build'),target=resolve(folder,'release-web');
 const put=(n,s)=>{const p=resolve(build,n);mkdirSync(dirname(p),{recursive:true});writeFileSync(p,s);};
 const json=(n,s)=>put(n,JSON.stringify(s));
 try{
  put('index.html','<script type="module" src="/GameStarter/web-demo/src/entry.js"></script>');
  json('package.json',{type:'module'});
  put('GameStarter/web-demo/src/entry.js',"import './release-profile.js'; import('./chapter-two.js'); import('./game.js');");
  put('GameStarter/web-demo/src/release-profile.js','export const packagedChapters = null;');
  put('GameStarter/web-demo/src/chapter-two.js',"import './grain-only.js';");put('GameStarter/web-demo/src/grain-only.js','export {};');
  put('GameStarter/web-demo/src/game.js','const html=`<img src="${portrait}"><img src="/ui/achievements/${id}.png">`;');
  put('ui/achievements/first.png','used-dynamic');put('unused.png','unused');
  json('story/chapter-access.json',[{id:'wuzhang',nodes:['a']},{id:'grain',nodes:['b'],successNodes:['b'],successEndings:['E1']}]);
  json('story/chapter-one.branch.json',{id:'a',film:{src:'/video/current/branch.mp4',subtitles:'/video/subtitles/branch.vtt'}});json('story/chapter-two.films.json',{id:'b'});
  put('video/current/branch.mp4','branch');put('video/subtitles/branch.vtt','WEBVTT');
  json('cinematics.json',{opening:[{src:'/video/current/first.mp4'}],chapterTwo:[{src:'/video/current/grain.mp4'}]});
  put('video/current/first.mp4','first');put('video/current/grain.mp4','grain');
  json('media/manifest.json',{characters:{weiyan:'/media/weiyan.png',masu:'/media/masu.png'},scenes:{camp_gate:'/media/camp.png',jieting_camp:'/media/hill.png'}});
  for(const n of ['weiyan','masu','camp','hill'])put(`media/${n}.png`,n);
  json('audio/manifest.json',{music:{}});
  const result=prepareReleaseWeb(build,target,()=>null);
  for(const n of ['story/chapter-two.films.json','video/current/grain.mp4','media/masu.png','media/hill.png','GameStarter/web-demo/src/chapter-two.js','GameStarter/web-demo/src/grain-only.js','unused.png']){
   assert.equal(existsSync(resolve(target,n)),false,n);assert.equal(existsSync(resolve(build,n)),true,'Local original '+n);
  }
  for(const n of ['story/chapter-one.branch.json','video/current/first.mp4','video/current/branch.mp4','video/subtitles/branch.vtt','media/weiyan.png','media/camp.png','ui/achievements/first.png'])assert.ok(existsSync(resolve(target,n)),n);
  assert.match(readFileSync(resolve(target,'GameStarter/web-demo/src/release-profile.js'),'utf8'),/wuzhang.*yiling/);
  assert.equal(JSON.parse(readFileSync(resolve(target,'story/chapter-access.json')))[1].nodes.length,0);
  assert.ok(result.report.removedBytes>0);
 }finally{if(!folder.startsWith(cache+sep))throw Error('Unsafe cleanup');rmSync(folder,{recursive:true,force:true});}
});
