from pathlib import Path
import json,html
OUT=Path(__file__).parent;d=json.loads((OUT/'delivery.json').read_text(encoding='utf-8-sig'))
rows=[dict(id=r['group']+'-'+r['id'],file=Path(r['reviewCopy']).relative_to(OUT).as_posix(),sha256=r['sha256']) for r in json.loads((OUT/'review/reuse-candidates/sources.json').read_text(encoding='utf-8-sig'))]
rows += [dict(id=c['id'],file=Path(c['file']).relative_to(OUT).as_posix(),sha256=c['sha256']) for c in d['clips']]
for p in sorted((OUT/'edited/picture-review-final').glob('*.json')):
    r=json.loads(p.read_text(encoding='utf-8-sig'));rows.append(dict(id='SAMPLE-'+r['id'],file=Path(r['file']).relative_to(OUT).as_posix(),sha256=r['sha256']))
candidate=OUT/'review/picture-repair-candidates.json'
for folder,prefix in [('picture-review-corrected','CORRECT-'),('picture-review-presentable','PRESENT-')]:
    for p in sorted((OUT/'edited'/folder).glob('*.json')):
        r=json.loads(p.read_text(encoding='utf-8-sig'));rows.append(dict(id=prefix+r['id'],file=Path(r['file']).relative_to(OUT).as_posix(),sha256=r['sha256']))
if candidate.exists():rows += [dict(id='NEW-'+c['id'],file=Path(c['file']).relative_to(OUT).as_posix(),sha256=c['sha256']) for c in json.loads(candidate.read_text(encoding='utf-8-sig'))['clips']]
options=''.join(f'<option value="{r["id"]}">{r["id"]}</option>' for r in rows)
s='''<!doctype html><meta charset="utf-8"><title>G2 画面可用性复核</title><style>body{margin:0;background:#141a19;color:#eee;font:16px sans-serif}video{width:100%;height:80vh}pre{white-space:pre-wrap;font-size:12px}input{width:65px}</style><header><select id="pick" onchange="load()">'''+options+'''</select><label>起点<input id="start" type="number" step="0.01" value="0"></label><label>终点<input id="end" type="number" step="0.01" value="5"></label><button id="range" onclick="playRange()">1x播放指定区间</button><button id="play" onclick="v.play()">继续播放</button><button onclick="v.pause()">暂停</button><span id="clock"></span><p id="identity"></p></header><video id="v" controls muted></video><pre id="audit"></pre><script>
const rows='''+json.dumps(rows,ensure_ascii=False)+''';let active=null,rangeStart=0,limit=null,automatic=false,queue=[];
const all=document.createElement('button');all.textContent='全部新片自然播放';all.id='all-new';document.querySelector('header').append(all);all.onclick=()=>{queue=rows.filter(r=>r.id.startsWith('NEW-')).map(r=>r.id);automatic=true;pick.value=queue.shift();load()};
function load(){active=rows.find(r=>r.id===pick.value);rangeStart=0;limit=null;v.src=active.file;identity.textContent=active.file+' SHA256 '+active.sha256;start.value=0;end.value=5;v.play()}
function log(event){const record={id:active.id,sha256:active.sha256,event,start:rangeStart,end:v.currentTime,duration:v.duration,time:new Date().toISOString()};audit.textContent+=JSON.stringify(record)+'\\n';fetch('/audit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(record)})}
async function playRange(){if(v.readyState<1)await new Promise(resolve=>v.addEventListener('loadedmetadata',resolve,{once:true}));rangeStart=Number(start.value);limit=Number(end.value);v.currentTime=rangeStart;v.play()}
v.ontimeupdate=()=>{clock.textContent=v.currentTime.toFixed(3)+' / '+v.duration.toFixed(3)+' 1x静音';if(limit!==null&&v.currentTime>=limit){v.pause();log('range-ended');limit=null}};v.onended=()=>{log('ended');if(automatic&&queue.length){pick.value=queue.shift();load()}};load();
// File identities are locked to this build; deliberately reload after candidate changes.
</script>'''
(OUT/'画面可用性复核.html').write_text(s,encoding='utf-8');print('Review page rows',len(rows))
