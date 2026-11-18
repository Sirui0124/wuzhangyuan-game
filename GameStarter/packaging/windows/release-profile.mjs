import {cpSync,mkdirSync,readFileSync,writeFileSync,readdirSync,rmSync,statSync,existsSync} from 'node:fs';
import {resolve,relative,dirname,sep} from 'node:path';

export const releaseChapters=['wuzhang','yiling'];
const slash=s=>s.replaceAll('\\','/');
const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(resolve(dir,e.name)):[resolve(dir,e.name)]);
/** Operates exclusively on a fresh packaging copy, never on authored content. */
export function prepareReleaseWeb(build,target,excludedReason){
 if(existsSync(target))throw Error('Release web copy already exists; use a fresh stage');
 mkdirSync(target,{recursive:true});cpSync(build,target,{recursive:true});
 const removed=[];
 function remove(path,reason){const p=resolve(target,path);if(!p.startsWith(target+sep))throw Error('Unsafe release path');if(!existsSync(p))return;removed.push({path:slash(path),bytes:statSync(p).size,reason});rmSync(p);}
 const read=p=>JSON.parse(readFileSync(resolve(target,p),'utf8'));
 const write=(p,v)=>writeFileSync(resolve(target,p),JSON.stringify(v,null,2)+'\n');
 for(const p of walk(target)){const n=slash(relative(target,p)),reason=excludedReason(n);if(reason)remove(n,reason);}
 const profile='GameStarter/web-demo/src/release-profile.js';
 if(!existsSync(resolve(target,profile)))throw Error('Rebuild web with release-profile.ts before packaging');
 const text=readFileSync(resolve(target,profile),'utf8');
 if(!text.includes('packagedChapters = null'))throw Error('Unexpected release profile module');
 writeFileSync(resolve(target,profile),text.replace('packagedChapters = null',`packagedChapters = ${JSON.stringify(releaseChapters)}`));
 write('release-profile.json',{version:1,chapters:releaseChapters,omitted:['grain','jieting','jingzhou','luofengpo']});
 // Local compiler output retains all chapter entry points; remove their import edges only in this package.
 const entry=resolve(target,'GameStarter/web-demo/src/entry.js');
 writeFileSync(entry,readFileSync(entry,'utf8')
  .replace(/else if \(chapter === 'luofengpo'\) \{[\s\S]*?\n\}/,"else if (chapter === 'luofengpo') { throw new Error('该章节未包含在本次试玩包中'); }")
  .replace(/import\(['"]\.\/chapter-(?:two|three|five|seven)\.js['"]\)/g,"Promise.reject(new Error('该章节未包含在本次试玩包中'))"));
 for(const p of walk(resolve(target,'story'))){const n=slash(relative(target,p));if(/chapter-(two|three|five|seven)\./.test(n))remove(n,'chapter-not-in-release');}
 const access=read('story/chapter-access.json');
 for(const spec of access)if(!releaseChapters.includes(spec.id)){spec.nodes=[];spec.successNodes=[];spec.successEndings=[];}
 write('story/chapter-access.json',access);
 const movies=read('cinematics.json');
 for(const key of ['chapterPreview','chapterScenes','chapterTwo','reviewOnly'])movies[key]=[];
 write('cinematics.json',movies);
 const films=new Set(Object.values(movies).flat().filter(x=>x&&typeof x==='object').flatMap(x=>[x.src,x.subtitles,x.endFrame].filter(Boolean)));
 // Chapter scripts may embed clips directly rather than list them in cinematics.json.
 for(const p of walk(resolve(target,'story'))){
  for(const m of readFileSync(p,'utf8').matchAll(/"(\/video\/[^"\s]+)"/g))films.add(m[1]);
 }
 for(const p of walk(resolve(target,'video'))){const n=slash(relative(target,p));if(!films.has('/'+n))remove(n,'unselected-video-or-subtitle');}
 for(const url of films)if(!existsSync(resolve(target,'.'+url)))throw Error(`Release film resource missing: ${url}`);
 const media=read('media/manifest.json');
 const people=new Set(['weiyan','scout','guard','relay','jiangwei','jiangwei_guard','zhugeliang','weiyan_alert','weiyan_resolved','jiangwei_concerned','jiangwei_resolved','zhugeliang_weary','zhugeliang_resolved']);
 for(const id of Object.keys(media.characters))if(!people.has(id))delete media.characters[id];
 for(const id of Object.keys(media.scenes))if(/^(grain_|jieting_|luocheng_|pangtong_)/.test(id))delete media.scenes[id];
 const art=new Set(['characters','scenes','cinematics','ui'].flatMap(k=>Object.values(media[k]??{})));
 write('media/manifest.json',media);
 for(const p of walk(resolve(target,'media'))){const n=slash(relative(target,p));if(n!=='media/manifest.json'&&!art.has('/'+n))remove(n,'chapter-art-not-in-release');}
 for(const n of ['chapter-two.html','chapter-result-import.html','ending-achievements.html','ending-video.json'])remove(n,'unused-entry-or-legacy-catalog');

 // Traverse HTML, imports, CSS and literal asset references; retain dynamic-prefix assets conservatively.
 const all=new Set(walk(target).map(p=>slash(relative(target,p))));
 const keep=new Set(['release-profile.json','package.json','cinematics.json','media/manifest.json','audio/manifest.json',...all].filter(n=>n.endsWith('.html')||n.startsWith('story/')||n.startsWith('audio/licenses/')||['release-profile.json','package.json','cinematics.json','media/manifest.json','audio/manifest.json'].includes(n)));
 const queue=[...keep];
 function add(n){if(all.has(n)&&!keep.has(n)){keep.add(n);queue.push(n);}}
 add('GameStarter/assets/scripts/narrative/state.js');
 function reference(raw,from){
  if(!raw||raw.startsWith('${')||/^(?:[a-z]+:|#|\?)/i.test(raw))return;
  raw=raw.split(/[?#]/)[0];if(!raw)return;
  let p;try{p=decodeURIComponent(raw);}catch{return;}
  const absolute=p.startsWith('/')?resolve(target,'.'+p):resolve(dirname(resolve(target,from)),p);
  if(!absolute.startsWith(target+sep))return;
  const n=slash(relative(target,absolute));
  if(p.includes('${')){const prefix=n.split('${')[0];for(const candidate of all)if(candidate.startsWith(prefix))add(candidate);}
  else add(n);
 }
 while(queue.length){const n=queue.shift();if(!/\.(?:html|js|mjs|css|json)$/.test(n))continue;const content=readFileSync(resolve(target,n),'utf8');
  for(const m of content.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)(['"])(\.[^'"\s]+)\1/g))reference(m[2],n);
  for(const m of content.matchAll(/(?:src|href)\s*=\s*['"]([^'"]+)['"]|url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/g))reference(m[1]??m[2],n);
  for(const m of content.matchAll(/['"`]((?:\/|\.\/|\.\.\/)[^'"`\s<>]+)['"`]/g))reference(m[1],n);
 }
 for(const n of all)if(!keep.has(n))remove(n,'unreferenced-runtime-file');
 const report={chapters:releaseChapters,removedFiles:removed.length,removedBytes:removed.reduce((s,x)=>s+x.bytes,0),removed};
 return {directory:target,report};
}
