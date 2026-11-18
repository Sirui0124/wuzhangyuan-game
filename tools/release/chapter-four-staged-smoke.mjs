import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {once} from 'node:events';
import {verifyChapterFour} from './chapter-four-check.mjs';
const game=resolve(process.argv[2]);
const data=await mkdtemp(join(tmpdir(),'staged-four-'));
for(const key of Object.keys(process.env))if(/^(DEEPSEEK|OPENAI|TTS|VOLC|ARK|DOUBAO|GAME_)/i.test(key))delete process.env[key];
process.env.GAME_SETTINGS_FILE=join(data,'settings/.env');process.env.PORT='0';process.env.NODE_ENV='production';
const {gameServer}=await import(pathToFileURL(join(game,'GameStarter/server/server.mjs')));
if(!gameServer.listening)await once(gameServer,'listening');const apiPort=gameServer.address().port;
const {createStaticServer}=await import(pathToFileURL(join(game,'GameStarter/web-demo/serve.mjs')));
const server=createStaticServer({root:join(game,'web'),commandOptions:{directory:join(data,'command')},onRequest:async(req,res)=>{
 if(!req.url.startsWith('/api/game/')&&req.url!=='/health')return false;
 const response=await fetch(`http://127.0.0.1:${apiPort}${req.url}`,{method:req.method,headers:{...req.headers,host:`127.0.0.1:${apiPort}`},...(!['GET','HEAD'].includes(req.method)?{body:req,duplex:'half'}:{})});
 res.writeHead(response.status,Object.fromEntries(response.headers));if(response.body)for await(const chunk of response.body)res.write(chunk);res.end();return true;
}});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'chrome',headless:true});
const report={passed:false,game,origin,hostPlatform:process.platform,packagedWebServer:true,installerBuilt:false,macDeviceTested:false,errors:[],missing:[]};
try{
 const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()===404)report.missing.push(r.url());});
 const health=await(await page.request.get(origin+'/health')).json();assert.equal(health.configured,false);
 report.chapterFour=await verifyChapterFour(page,origin);
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.missing,[]);report.passed=true;
}catch(e){report.failure=String(e.stack);throw e;}finally{
 await browser.close();server.closeAllConnections();gameServer.closeAllConnections();await Promise.all([new Promise(ok=>server.close(ok)),new Promise(ok=>gameServer.close(ok))]);
 await mkdir('outputs/chapter-four-review-20261119',{recursive:true});await writeFile('outputs/chapter-four-review-20261119/staged-four-browser.json',JSON.stringify(report,null,2));
 assert.ok(data.startsWith(tmpdir()));await rm(data,{recursive:true,force:true});
}
console.log(JSON.stringify(report,null,2));
