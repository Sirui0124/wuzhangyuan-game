from pathlib import Path
import json,hashlib,av,urllib.parse
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parent;OUT=ROOT/'user-review-batch2'
records=[]
for p in sorted(OUT.glob('V*-candidate.json')):
    r=json.loads(p.read_text(encoding='utf-8'));v=Path(r['path']);assert hashlib.sha256(v.read_bytes()).hexdigest()==r['sha256']
    boundaries=sorted(set(round(t*24) for b in r['edl'] for t in b['timelineRange']))
    wanted=set(range(0,r['videoTrack']['videoFrames'],12))
    for k in boundaries:wanted.update(i for i in range(k-6,k+7,3) if 0<=i<r['videoTrack']['videoFrames'])
    frames=[]
    with av.open(str(v)) as c:
        for i,f in enumerate(c.decode(video=0)):
            if i not in wanted:continue
            im=f.to_image();im.thumbnail((320,180));frames.append((float(f.pts*f.time_base),im))
    sheets=[]
    for page in range((len(frames)+23)//24):
        ss=frames[page*24:page*24+24];im=Image.new('RGB',(1280,((len(ss)+3)//4)*205),'#171717');d=ImageDraw.Draw(im)
        for i,(t,fr) in enumerate(ss):x=i%4*320;y=i//4*205;im.paste(fr,(x,y));d.text((x+5,y+183),f'{r["id"]} {v.stem.split("-")[-1]} {t:.3f}',fill='white')
        dest=OUT/f'{r["id"]}-candidate-sheet-{page+1}.jpg';im.save(dest);sheets.append(str(dest))
    evidence=dict(id=r['id'],path=str(v),sha256=r['sha256'],sampling='2fps full film plus 8fps around each EDL boundary; ordered stills auxiliary, no claim continuous frame-by-frame review',sheets=sheets,frameTimes=[t for t,_ in frames],videoTrack=r['videoTrack'])
    (OUT/(r['id']+'-picture-evidence.json')).write_text(json.dumps(evidence,ensure_ascii=False,indent=2),encoding='utf-8')
    records.append(dict(id=r['id'],path=str(v),sha256=r['sha256'],url=urllib.parse.quote('/groups/G6/user-review-batch2/'+v.name,safe='/'),duration=r['duration']))
(OUT/'playback-manifest.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
(OUT/'candidate-player.html').write_text('''<!doctype html><meta charset="utf-8"><title>G6 第二批修版核对</title><style>body{background:#181818;color:#eee;font:18px sans-serif;margin:20px}video{display:block;width:min(960px,95vw);background:#000}button{padding:9px;margin:4px}pre{white-space:pre-wrap}</style><h1>G6 第二批修版核对</h1><nav id="clips"></nav><h2 id="title"></h2><video id="v" controls muted preload="metadata"></video><p id="status"></p><button id="play">从头播放</button><button id="pause">暂停</button><pre id="log"></pre><script>
let rows=[],current=null,history=[];const v=document.querySelector('#v'),status=document.querySelector('#status');
fetch('playback-manifest.json').then(x=>x.json()).then(rs=>{rows=rs;for(const r of rows){let b=document.createElement('button');b.textContent=r.id;b.onclick=()=>load(r);document.querySelector('#clips').append(b);}load(rows[0]);});
function load(r){current=r;v.src=r.url;document.querySelector('#title').textContent=r.id+' | SHA '+r.sha256;status.textContent='载入';}
document.querySelector('#play').onclick=()=>{v.currentTime=0;v.play();history.push(current.id+' start=0');};document.querySelector('#pause').onclick=()=>v.pause();
function state(){status.textContent=current?.id+' time='+v.currentTime.toFixed(3)+' / '+v.duration.toFixed(3)+' ended='+v.ended+' paused='+v.paused+' error='+(v.error?.code||0);document.querySelector('#log').textContent=history.join('\\n');}
v.ontimeupdate=state;v.onloadedmetadata=state;v.onended=()=>{history.push(current.id+' ended at '+v.currentTime.toFixed(3));state();};v.onerror=state;
</script>''',encoding='utf-8')
print(json.dumps(dict(films=len(records),frames='all decoded; auxiliary samples rendered'),ensure_ascii=False))
