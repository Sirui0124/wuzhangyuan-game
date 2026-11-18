import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createStaticServer} from '../../GameStarter/web-demo/serve.mjs';

test('正式服务旧九路入口只跳转，九路API撤出，八路后端可创建最新八轮局',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'eight-only-'));
 const server=createStaticServer({root:dir,commandOptions:{directory:join(dir,'saves')}});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const origin='http://127.0.0.1:'+server.address().port;
 try{
  for(const path of ['/yiling-rescue/','/yiling-rescue/index.html','/chapter-result-import.html']){
   const response=await fetch(origin+path,{redirect:'manual'});assert.equal(response.status,302,path);assert.equal(response.headers.get('location'),'/?chapter=yiling');
  }
  assert.equal((await fetch(origin+'/api/yiling-rescue/state?session=old')).status,404);
  const response=await fetch(origin+'/api/yiling-command/session',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  assert.equal(response.status,200);const {session}=await response.json();assert.equal(session.routeVersion,'eight-front-20261118-v4');assert.equal(session.roundLimit,8);assert.equal(Object.keys(session.fronts).length,8);
  const source=await readFile('GameStarter/web-demo/build.mjs','utf8');assert.ok(!source.includes('publishRescue'));
  const html=await readFile('GameStarter/web-demo/public/chapter-result-import.html','utf8');assert.ok(!html.includes('campaign/import.js'));assert.match(html,/chapter=yiling/);
 }finally{await new Promise(ok=>server.close(ok));assert.ok(dir.startsWith(tmpdir()));await rm(dir,{recursive:true,force:true});}
});
