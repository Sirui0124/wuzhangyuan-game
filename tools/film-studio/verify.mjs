import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here,'../..');
const dataDir=path.join(root,'outputs/film-studio',`qa-${Date.now()}`);
const port=18926;
const base=`http://127.0.0.1:${port}`;
const checks=[];
let child;
async function start(){
 child=spawn(process.execPath,[path.join(here,'server.mjs')],{env:{...process.env,FILM_STUDIO_PORT:String(port),FILM_STUDIO_DATA_DIR:dataDir},stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Server timeout')),15000);child.once('error',reject);child.once('exit',code=>reject(Error(`Server exited ${code}`)));child.stdout.on('data',chunk=>{if(String(chunk).includes(base)){clearTimeout(timeout);resolve();}});});
}
async function stop(){if(!child||child.exitCode!==null)return;const closed=new Promise(r=>child.once('exit',r));child.kill();await closed;}
try {
 await start();
 const catalog=await (await fetch(base+'/api/catalog')).json();
 const chapter=await(await fetch(base+'/api/chapter')).json();
 assert.equal(chapter.source.revision,271);assert.equal(chapter.stats.activeRows,113);assert.equal(chapter.stats.videos,34);assert.equal(chapter.stats.affectedVideos,15);
 assert.equal(chapter.lines['A-40B'].kind,'dynamic');assert.equal(chapter.lines.W07.kind,'dynamic');
 for(const route of chapter.routes){const ids=route.unitIds;assert.equal(new Set(ids).size,ids.length);assert.equal(ids.filter(id=>id.startsWith('video:')).length,32);assert(ids.includes('gate:ai-first'));assert(ids.includes('gate:ai-second'));assert(ids.every(id=>chapter.units[id]));if(route.branch==='A'){assert(ids.includes('video:C1T03-scout-answer-20261024'));assert(!ids.includes('video:C1T04-04'));assert(!ids.includes('video:C1FIX06B'));}else{assert(ids.includes('video:C1T04-04'));assert(ids.includes('video:C1FIX06B'));assert(!ids.includes('video:C1T03-scout-answer-20261024'));assert(!ids.includes('video:C1T06-06'));}const guard=ids.indexOf('video:C1FIX09'),relay=ids.indexOf('video:C1FIX10Q');assert.equal(guard<relay,route.investigation==='guard-first');}
 checks.push('四条路线覆盖32段视频，首轮互斥片与转呈版本成对，甲乙顺序和互动停点正确');
 const chapterChange={baseHash:chapter.baseHash,revision:0,changes:[{kind:'line',id:'A-08',fields:{text:'独立验证目录：五丈原……第六夜。'}}]};
 let edit=await fetch(base+'/api/chapter/draft',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(chapterChange)});assert.equal(edit.status,200);assert.equal((await edit.json()).revision,1);
 edit=await fetch(base+'/api/chapter/draft',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(chapterChange)});assert.equal(edit.status,409);
 checks.push('台词编辑独立保存，拒绝旧修订覆盖并发修改');
 assert(catalog.clips.length>0);assert.equal(catalog.prompts.length,13);assert(catalog.prompts.every(p=>p.refs.every(r=>r.exists)));checks.push('34段现用影片、13份准备稿和参考图路径可读');
 for(const c of catalog.clips){const r=await fetch(base+encodeURI(c.url),{method:'HEAD'});assert.equal(r.status,200);assert.equal(Number(r.headers.get('content-length')),c.bytes);}
 checks.push('全部现用影片实际文件可访问，长度一致');
 for(const p of catalog.prompts)for(const ref of p.refs){if(ref.url){const r=await fetch(base+encodeURI(ref.url),{method:'HEAD'});assert.equal(r.status,200);}}
 const clip=catalog.clips[0];
 let r=await fetch(base+clip.url,{headers:{Range:'bytes=0-127'}});assert.equal(r.status,206);assert.equal((await r.arrayBuffer()).byteLength,128);checks.push('视频支持字节范围请求，可拖动进度');
 r=await fetch(base+clip.url,{headers:{Range:'bytes=999999999999-'}});assert.equal(r.status,416);
 r=await fetch(base+'/files/package.json');assert.equal(r.status,403);
 r=await fetch(base+'/files/video/current/%2e%2e%2f%2e%2e%2fGameStarter/server/.env');assert.equal(r.status,403);
 checks.push('禁止素材目录外读取与路径穿越');
 const note={action:'note',clip:clip.id,version:clip.version,time:1.25,category:'验证',text:'仅限独立验证目录的测试意见'};
 r=await fetch(base+'/api/review',{method:'POST',headers:{Origin:'https://other.invalid','Content-Type':'application/json'},body:JSON.stringify(note)});assert.equal(r.status,403);
 r=await fetch(base+'/api/review',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({...note,version:'wrong'})});assert.equal(r.status,409);checks.push('拒绝跨站写入与过期视频版本');
 r=await fetch(base+'/api/review',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(note)});assert.equal(r.status,200);assert.equal((await r.json()).notes.length,1);
 await stop();await start();const state=await(await fetch(base+'/api/review')).json();assert.equal(state.notes[0].time,1.25);assert.equal(state.notes[0].version,clip.version);checks.push('时间点意见写入磁盘，服务重启后保留');
 const restored=await(await fetch(base+'/api/chapter')).json();assert.equal(restored.draft.lines['A-08'].text,chapterChange.changes[0].fields.text);assert.equal(restored.draft.history.length,1);assert.equal(restored.lines['A-08'].runtimeText,chapter.lines['A-08'].runtimeText);checks.push('台词草稿和历史重启后保留，程序正文未被覆盖');
 fs.mkdirSync(path.join(root,'outputs/film-studio'),{recursive:true});fs.writeFileSync(path.join(root,'outputs/film-studio/chapter-verification.json'),JSON.stringify({at:new Date().toISOString(),checks,testData:dataDir,browserReview:'另用工作台可见页面检查'},null,2));
 console.log(JSON.stringify({passed:checks.length,checks},null,2));
} finally {await stop();}
