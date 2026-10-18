import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp, readFile, writeFile, stat, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parseEnv} from 'node:util';

test('统一代理按 Chat Completions 协议关闭思考，拒绝未完成输出并保留错误码', async () => {
  const requests=[];
  const provider=http.createServer(async(req,res)=>{
    let body='';for await(const chunk of req) body+=chunk;
    const payload=JSON.parse(body);requests.push({path:req.url,payload});
    if(payload.messages[0].content==='denied'){res.writeHead(429);res.end('{}');return;}
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({id:'fixture',usage:{total_tokens:8},choices:[{finish_reason:payload.messages[0].content==='partial'?'length':'stop',message:{content:'测试回应',reasoning_content:'不得返回给游戏'}}]}));
  });
  provider.listen(0,'127.0.0.1');await once(provider,'listening');
  const temporary=await mkdtemp(join(tmpdir(),'game-api-protocol-'));
  const reserve=http.createServer();reserve.listen(0,'127.0.0.1');await once(reserve,'listening');const port=reserve.address().port;await new Promise(r=>reserve.close(r));
  const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('.',import.meta.url),env:{...process.env,GAME_SETTINGS_FILE:join(temporary,'.env'),PORT:String(port),DEEPSEEK_API_KEY:'test-fixture',DEEPSEEK_BASE_URL:`http://127.0.0.1:${provider.address().port}`,DEEPSEEK_MODEL:'deepseek-flash'},stdio:['ignore','pipe','pipe']});
  try {
    await Promise.race([once(child.stdout,'data'),once(child,'exit').then(()=>{throw Error('代理未能启动');})]);
    const send=(text,extra={})=>fetch(`http://127.0.0.1:${port}/api/game/respond`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,...extra})});
    const r=await send('hello');assert.equal(r.status,200);assert.deepEqual(await r.json(),{text:'测试回应',responseId:'fixture',usage:{total_tokens:8}});
    assert.equal(requests[0].path,'/chat/completions');assert.deepEqual(requests[0].payload.thinking,{type:'disabled'});assert.equal(requests[0].payload.model,'deepseek-flash');assert.deepEqual(requests[0].payload.messages,[{role:'user',content:'hello'}]);
    assert.equal((await send('partial')).status,502);assert.equal((await send('denied')).status,429);assert.equal((await send('history',{previousResponseId:'unknown'})).status,400);
    await send('image',{images:['https://example.com/test.png']});assert.deepEqual(requests.at(-1).payload.messages[0].content[0],{type:'image_url',image_url:{url:'https://example.com/test.png'}});
  } finally {child.kill('SIGTERM');await new Promise(r=>provider.close(r));await rm(temporary,{recursive:true,force:true});}
});

test('本机设置可无密钥启动，原子保存后立即生效，重启保持，敏感配置拒绝跨站与错误提交', async () => {
  const temporary=await mkdtemp(join(tmpdir(),'game-api-settings-'));
  const file=join(temporary,'config','.env');
  const requests=[];
  const provider=http.createServer(async(req,res)=>{
    let body='';for await(const chunk of req) body+=chunk;
    requests.push({path:req.url,authorization:req.headers.authorization,payload:JSON.parse(body)});
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({id:'settings-fixture',choices:[{finish_reason:'stop',message:{content:'配置测试回应'}}]}));
  });
  provider.listen(0,'127.0.0.1');await once(provider,'listening');
  const reserve=http.createServer();reserve.listen(0,'127.0.0.1');await once(reserve,'listening');const port=reserve.address().port;await new Promise(r=>reserve.close(r));
  let child;
  const start=async()=>{
    child=spawn(process.execPath,['server.mjs'],{cwd:new URL('.',import.meta.url),env:{...process.env,GAME_SETTINGS_FILE:file,PORT:String(port),DEEPSEEK_API_KEY:'',DEEPSEEK_BASE_URL:'https://api.deepseek.com',DEEPSEEK_MODEL:'deepseek-flash'},stdio:['ignore','pipe','pipe']});
    await Promise.race([once(child.stdout,'data'),once(child,'exit').then(()=>{throw Error('设置代理未能启动');})]);
  };
  const stop=async()=>{if(child?.exitCode===null){const stopped=once(child,'exit');child.kill('SIGTERM');await stopped;}};
  const base=`http://127.0.0.1:${port}`;
  const post=(data,headers={})=>fetch(`${base}/api/game/settings`,{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://localhost:8821',...headers},body:JSON.stringify(data)});
  const respond=()=>fetch(`${base}/api/game/respond`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'配置测试'})});
  try {
    await start();
    const initial=await fetch(`${base}/api/game/settings`);assert.equal(initial.status,200);assert.equal(initial.headers.get('cache-control'),'no-store');assert.equal((await initial.json()).apiKey,'');assert.equal((await respond()).status,503);
    const supplied={baseUrl:`http://127.0.0.1:${provider.address().port}/v1/`,model:'fixture-model',apiKey:'fixture-key'};
    assert.equal((await post(supplied,{Origin:'https://external.example'})).status,403);
    const foreignHostStatus=await new Promise((resolve,reject)=>{const request=http.get(`${base}/api/game/settings`,{headers:{Host:'external.example'}},response=>{response.resume();resolve(response.statusCode);});request.on('error',reject);});
    assert.equal(foreignHostStatus,403);
    assert.equal((await post(supplied,{'Content-Type':'text/plain'})).status,415);
    for(const change of [{baseUrl:'file:///tmp/test'},{baseUrl:'invalid'},{model:' '},{apiKey:''},{apiKey:'line\nextra'}])assert.equal((await post({...supplied,...change})).status,400);
    assert.equal((await post(supplied)).status,200);
    const stored=parseEnv(await readFile(file,'utf8'));assert.equal(stored.DEEPSEEK_API_KEY,supplied.apiKey);assert.equal((await stat(file)).mode&0o777,0o600);
    await respond();assert.equal(requests.at(-1).path,'/v1/chat/completions');assert.equal(requests.at(-1).authorization,'Bearer fixture-key');assert.equal(requests.at(-1).payload.model,'fixture-model');assert.deepEqual(requests.at(-1).payload.thinking,{type:'disabled'});
    // Retain unrelated local options when updating API settings.
    await writeFile(file,(await readFile(file,'utf8'))+'EXTRA_OPTION=preserved\n');
    const explicit={...supplied,baseUrl:`http://127.0.0.1:${provider.address().port}/v1/chat/completions/`,apiKey:'fixture-new-key',model:'fixture-new-model'};
    assert.equal((await post(explicit)).status,200);await respond();assert.equal(requests.at(-1).path,'/v1/chat/completions');assert.equal(requests.at(-1).authorization,'Bearer fixture-new-key');assert.equal(parseEnv(await readFile(file,'utf8')).EXTRA_OPTION,'preserved');
    await stop();await start();
    const restored=await(await fetch(`${base}/api/game/settings`)).json();assert.equal(restored.apiKey,explicit.apiKey);assert.equal(restored.model,explicit.model);await respond();assert.equal(requests.at(-1).payload.model,explicit.model);
  } finally {await stop();await new Promise(r=>provider.close(r));await rm(temporary,{recursive:true,force:true});}
});
