import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

const root='GameStarter/web-demo/.build/';
const game=readFileSync(root+'GameStarter/web-demo/src/game.js','utf8');
assert.doesNotMatch(game,/createDialogueVoice|StreamingVoice|dialogue-voice/);
const panel=readFileSync(root+'GameStarter/web-demo/src/game-ui-panels.js','utf8');
assert.doesNotMatch(panel,/ai-voice-enabled|voice-demo\.html/);
for(const name of ['voice-demo.html','voice-casting.html','voice-clone.html'])assert.equal(existsSync(root+name),false);
process.env.PORT='0';
const {gameServer:server}=await import('../../GameStarter/server/server.mjs');
try{
 if(!server.listening)await new Promise(resolve=>server.once('listening',resolve));
 for(const path of ['/api/game/tts','/api/game/tts/settings']){
  const response=await fetch(`http://127.0.0.1:${server.address().port}${path}`);
  assert.equal(response.status,410);
 }
 console.log('实时配音移除检查通过：无运行入口、无试听页面、旧接口410。');
}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
