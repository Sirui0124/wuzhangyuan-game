import {resolve, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {homedir} from 'node:os';
import {mkdirSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {once} from 'node:events';

const root=dirname(fileURLToPath(import.meta.url));
const data=resolve(process.env.WUZHANG_TEST_DATA || resolve(homedir(),'Library/Application Support/WuzhangyuanWeb'));
mkdirSync(resolve(data,'settings'),{recursive:true});
for(const key of Object.keys(process.env)) if(/^(DEEPSEEK|OPENAI|TTS|VOLC|ARK|DOUBAO|GAME_)/i.test(key)) delete process.env[key];
process.env.GAME_SETTINGS_FILE=resolve(data,'settings/.env');
process.env.PORT='0';
process.env.NODE_ENV='production';
const {gameServer}=await import(pathToFileURL(resolve(root,'game/GameStarter/server/server.mjs')));
if(!gameServer.listening) await once(gameServer,'listening');
const apiPort=gameServer.address().port;
const {createStaticServer}=await import(pathToFileURL(resolve(root,'game/GameStarter/web-demo/serve.mjs')));
const server=createStaticServer({root:resolve(root,'game/web'),
 commandOptions:{directory:resolve(data,'yiling-command/saves')},
 onRequest:async(req,res)=>{
  if(req.headers.host!=='127.0.0.1:18812'){res.writeHead(403);res.end();return true;}
  const url=new URL(req.url,'http://127.0.0.1:18812');
  if(url.searchParams.has('playtest')&&!(url.searchParams.get('chapter')==='yiling'&&url.searchParams.get('playtest')==='command')){
   url.searchParams.delete('playtest');res.writeHead(302,{Location:url.pathname+url.search});res.end();return true;
  }
  if(req.url.startsWith('/api/game/')||req.url==='/health'){
   try{
    const headers={...req.headers,host:`127.0.0.1:${apiPort}`};delete headers.connection;
    const response=await fetch(`http://127.0.0.1:${apiPort}${req.url}`,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:req,duplex:'half'}:{})});
    res.writeHead(response.status,Object.fromEntries(response.headers));
    if(response.body)for await(const chunk of response.body){if(res.destroyed)break;res.write(chunk);}res.end();
   }catch{if(!res.headersSent)res.writeHead(502);res.end();}
   return true;
  }
  return false;
 }});
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'游戏端口18812已被占用，请关闭之前的网页版启动窗口。':error);gameServer.close();process.exitCode=1;});
server.listen(18812,'127.0.0.1',()=>{
 console.log('逆转五丈原：http://127.0.0.1:18812/\n关闭此终端或按Ctrl+C退出。存档目录：'+data);
 if(process.platform==='darwin'&&!process.env.WUZHANG_NO_OPEN)spawn('open',['http://127.0.0.1:18812/'],{stdio:'ignore'}).unref();
});
function close(){server.closeAllConnections();gameServer.closeAllConnections();server.close();gameServer.close();}
process.on('SIGINT',close);process.on('SIGTERM',close);
