from pathlib import Path
import json,html,sys
O=Path(__file__).parent;R=O/'user-review-20261025';latest={}
for p in sorted((R/'candidates').glob('*.json'),key=lambda x:x.stat().st_mtime):
    c=json.loads(p.read_text(encoding='utf-8'));latest[c['id']]=dict(id='UR-'+c['id'],file=Path(c['file']).relative_to(O).as_posix(),sha256=c['sha256'])
d=json.loads((R/'prior-delivery.json').read_text(encoding='utf-8'));b=next(c for c in d['clips'] if c['id']=='V16B');latest['V16B-preserved']=dict(id='UR-V16B-preserved',file=Path(b['file']).relative_to(O).as_posix(),sha256=b['sha256'])
rows=list(latest.values())
if len(sys.argv)>1:
    requested=sys.argv[1:];rows=[latest[x] for x in requested if x in latest]
options=''.join('<option value="'+r['id']+'">'+r['id']+'</option>' for r in rows)
s='''<!doctype html><meta charset="utf-8"><title>G2 用户返修独立审片</title><style>body{margin:0;background:#141a19;color:#eee;font:16px sans-serif}video{width:100%;height:82vh}pre{white-space:pre-wrap;font-size:12px}</style><header><select id="pick" onchange="load()">'''+options+'''</select><button id="all" onclick="playAll()">逐段1x播放</button><button id="replay" onclick="load()">从头播放当前</button><button onclick="v.pause()">暂停</button><span id="clock"></span><p id="identity"></p></header><video id="v" controls></video><pre id="audit"></pre><script>const rows='''+json.dumps(rows,ensure_ascii=False)+''';let active,queue=[],automatic=false;function load(){active=rows.find(r=>r.id===pick.value);v.src=active.file;identity.textContent=active.file+' SHA256 '+active.sha256;v.play()}function playAll(){queue=rows.map(x=>x.id);automatic=true;pick.value=queue.shift();load()}v.ontimeupdate=()=>clock.textContent=v.currentTime.toFixed(3)+' / '+v.duration.toFixed(3)+' 1x';v.onended=()=>{const r={id:active.id,sha256:active.sha256,event:'ended',start:0,end:v.currentTime,duration:v.duration,time:new Date().toISOString()};audit.textContent+=JSON.stringify(r)+'\\n';fetch('/audit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(r)});if(automatic&&queue.length){pick.value=queue.shift();load()}};load();</script>'''
(O/'用户返修审片.html').write_text(s,encoding='utf-8');print('rows',len(rows))
