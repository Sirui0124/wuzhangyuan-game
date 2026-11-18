import {spawnSync} from 'node:child_process';
import {mkdirSync,cpSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
export const publishedEntryGuard='<script>const q=new URLSearchParams(location.search);if(window.top===window||q.get("campaign")!=="1"||q.get("chapter")!=="yiling"){document.documentElement.hidden=true;window.top.location.replace("/?chapter=yiling");}</script>';
export function publishCommandMap(destination){
 const home=dirname(fileURLToPath(import.meta.url));
 const build=spawnSync(process.execPath,[resolve(home,'build.mjs')],{stdio:'inherit',windowsHide:true});if(build.status!==0)throw Error('第四章军图构建失败');
 const target=resolve(destination,'yiling-command');mkdirSync(target,{recursive:true});cpSync(resolve(home,'public'),target,{recursive:true});
 for(const name of ['campaign-app','campaign-client','campaign-intent','ending-report','front-story'])cpSync(resolve(home,'.build',name+'.js'),resolve(target,name==='campaign-app'?'app.js':name+'.js'));
 cpSync(resolve(home,'../yiling-radio-lab-v6/public/terrain-night-v1.png'),resolve(target,'terrain.png'));
 for(const name of ['index.html','style.css','ui-heavy.css','app.js','campaign-client.js','front-story.js']){
  let text=readFileSync(resolve(target,name),'utf8');
  for(const path of ['/style.css','/ui-heavy.css','/ending-report.css','/app.js','/terrain.png','/art/'])text=text.replaceAll(path,'/yiling-command'+path);
  if(name==='index.html'){
   // Only the formal chapter iframe may render the published board. Direct or
   // legacy embedded URLs return to the chapter shell and its save checks.
   text=text.replace('<head>', '<head>'+publishedEntryGuard);
   text=text.replace('</head>', '<link rel="stylesheet" href="/subtitles.css"><script type="module">import { initializeFilmFocus } from "/GameStarter/web-demo/src/film-focus.js"; initializeFilmFocus();</script></head>');
  }
  text=text.replaceAll('/api/campaign/','/api/yiling-command/');writeFileSync(resolve(target,name),text);
 }
}
