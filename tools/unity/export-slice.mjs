import {readFileSync,writeFileSync,mkdirSync,copyFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'../..');
const read=p=>JSON.parse(readFileSync(resolve(root,p),'utf8'));
const script=read('content/chapters/wuzhang/chapter-one.script.json');
const flow=read('content/chapters/wuzhang/chapter-one.flow.json');
const ids=['awakening','notice','first-scout','scout-option-a','scout-option-b','first-weiyan'];
const sections=flow.sections.filter(s=>ids.includes(s.id)).map(s=>({id:s.id,title:s.title,scene:s.scene,rows:s.rows,nextKind:s.next.kind,nextId:s.next.id}));
const rowIds=new Set(sections.flatMap(s=>s.rows));
const collections={'A-17':'C06','A-24':'T02','A-34':'C05'};
const source=readFileSync(resolve(root,'GameStarter/web-demo/src/chapters/chapter-one/thought-canvas-model.ts'),'utf8');
for(const [row,clue] of Object.entries(collections))if(!source.includes(`'${row}': '${clue}'`))throw Error('线索来源映射变化，请核对移植契约：'+row);
const rows=script.rows.filter(r=>rowIds.has(r.id)).map(r=>({id:r.id,speaker:r.speaker,text:r.text,clue:collections[r.id]||''}));
if(rows.length!==rowIds.size)throw Error('Missing source row');
const data={version:1,chapter:'wuzhang',entry:'awakening',sections,rows,
 actions:flow.actions.filter(a=>a.round===1&&ids.includes(a.section)),
 scenes:flow.scenes.filter(s=>['camp_gate','report_post'].includes(s.id)),
 choices:[{id:'a',row:'A-23',section:'scout-option-a'},{id:'b',row:'A-23B',section:'scout-option-b'}]};
data.contentHash=createHash('sha256').update(JSON.stringify(data)).digest('hex');
const out=resolve(root,'UnityPort/Assets/Resources');mkdirSync(out,{recursive:true});
writeFileSync(resolve(out,'chapter-one-slice.json'),JSON.stringify(data,null,2)+'\n');
const manifestPath=resolve(root,'GameStarter/web-demo/.build/media/manifest.json');
if(existsSync(manifestPath)){
 const manifest=JSON.parse(readFileSync(manifestPath,'utf8'));mkdirSync(resolve(out,'Backgrounds'),{recursive:true});
 for(const id of ['camp_gate','report_post'])copyFileSync(resolve(root,'GameStarter/web-demo/.build',manifest.scenes[id].replace(/^\//,'')),resolve(out,'Backgrounds',id+'.png'));
}
console.log(`Unity source slice: ${sections.length} sections, ${rows.length} rows; ${data.contentHash}`);
