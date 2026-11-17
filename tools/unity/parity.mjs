import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {ChapterSession} from '../../GameStarter/web-demo/.build/GameStarter/web-demo/src/chapter-session.js';
const read=p=>JSON.parse(readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const content=read('content/chapters/wuzhang/chapter-one.script.json'),flow=read('content/chapters/wuzhang/chapter-one.flow.json');
let checks=0;
for(const branch of ['a','b']){
 const commands=['next','next','action:read-notice','next','move:report_post','action:meet-first-scout','next',`choice:${branch}`,'next','next','action:intercept-first',...Array(6).fill('next')];
 const file=resolve(`outputs/unity-commands-${branch}.json`);writeFileSync(file,JSON.stringify(commands));
 const native=spawnSync(resolve('outputs/UnityPortTests.exe'),[resolve('UnityPort/Assets/Resources/chapter-one-slice.json'),file],{encoding:'utf8',windowsHide:true});assert.equal(native.status,0,native.stderr);
 const trace=JSON.parse(native.stdout),web=new ChapterSession(content,flow,'unity-parity',async()=>{throw Error('No AI in slice');});web.finishCinematic();
 commands.forEach((command,index)=>{
  const [kind,id]=command.split(':');const accepted=kind==='next'?web.nextLine():kind==='move'?web.move(id):kind==='action'?web.act(id):web.chooseScout(id);assert.equal(accepted,true,command);
  const state=web.snapshot();const actual=trace[index];if(actual.phase==='boundary')actual.phase='expression';
  assert.deepEqual(actual,{phase:state.phase,scene:state.scene,row:web.row()?.id??null,clues:[...state.story.collected].sort()},`${branch} ${index} ${command}`);checks++;
 });
}
console.log(`PASS ${checks} C#/web state comparisons across both real branches`);
