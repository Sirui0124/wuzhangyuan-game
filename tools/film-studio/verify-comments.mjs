import {spawn} from 'node:child_process';
import {mkdtempSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const here=path.dirname(fileURLToPath(import.meta.url));
const dataDir=mkdtempSync(path.join(tmpdir(),'film-comments-'));
const base='http://127.0.0.1:18927';
let child;
async function start(){
 child=spawn(process.execPath,[path.join(here,'server.mjs')],{env:{...process.env,FILM_STUDIO_PORT:'18927',FILM_STUDIO_DATA_DIR:dataDir},stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('启动超时')),15000);child.once('error',reject);child.once('exit',code=>reject(Error(`服务退出 ${code}`)));child.stdout.on('data',data=>{if(String(data).includes(base)){clearTimeout(timer);resolve();}});child.stderr.on('data',data=>process.stderr.write(data));});
}
async function stop(){if(!child||child.exitCode!==null)return;await new Promise(resolve=>{child.once('exit',resolve);child.kill();});}
async function post(body,origin=base){return fetch(base+'/api/review',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});}
try{
 await start();
 const {clips}=await(await fetch(base+'/api/catalog')).json();
 const clip=clips[0], other=clips[1],key=`${clip.id}:${clip.version}`;
 const note={action:'note',clip:clip.id,version:clip.version,time:3,text:'原有时间点意见',category:'画面'};
 assert.equal((await post(note)).status,200);
 const edit={action:'comment',clip:clip.id,version:clip.version,revision:0,text:'灯灭后转场太快。\n人物站位需要核对。'};
 assert.equal((await post(edit,'http://example.com')).status,403);
 assert.equal((await post({...edit,version:'old'})).status,409);
 let response=await post(edit);assert.equal(response.status,200);
 let state=await response.json();assert.equal(state.comments[key].text,edit.text);assert.equal(state.comments[key].revision,1);assert.equal(state.notes[0].text,note.text);
 response=await post({...edit,text:'旧页面输入'});assert.equal(response.status,409);assert.equal((await response.json()).comment.text,edit.text);
 assert.equal((await post({...edit,clip:other.id,version:other.version,text:'另一段的意见'})).status,200);
 assert.equal((await post({...edit,revision:1,text:'修改后的评论'})).status,200);
 await stop();await start();
 state=await(await fetch(base+'/api/review')).json();assert.equal(state.comments[key].text,'修改后的评论');assert.equal(state.notes.length,1);assert.equal(Object.keys(state.comments).length,2);
 assert.equal((await post({...edit,revision:2,text:''})).status,200);
 state=JSON.parse(readFileSync(path.join(dataDir,'review.json'),'utf8'));assert.equal(state.comments[key].text,'');assert.equal(state.comments[key].revision,3);assert.equal(state.notes.length,1);
 const html=await(await fetch(base)).text();assert(html.includes('/comments.js'));assert(!html.includes('/app.js'));
 for(const file of ['comments.js','comments.css','workbench.html'])assert.equal((await fetch(`${base}/${file}`)).status,200);
 console.log(JSON.stringify({passed:true,videos:clips.length,checks:['独立评论与修改','刷新及重启持久化','阻止并发覆盖','旧意见保留','清空评论','同源和视频版本校验','简版首页与旧版入口'],testData:dataDir},null,2));
}finally{await stop();}
