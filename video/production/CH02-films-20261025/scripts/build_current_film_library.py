"""Single current-version library. Links preserve originals and review version keys."""
from pathlib import Path
import json, os, re, hashlib, datetime, html, urllib.parse
from concurrent.futures import ThreadPoolExecutor
import cv2
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'deliveries/最新成片'
AUDIT=ROOT/'audit/current-library-cleanup'
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
plan=read(AUDIT/'deletion-plan.json')
dispatch=read(ROOT/'dispatch.json')['groups']
groups={x['group']:f'{i:02d}-{x["title"]}' for i,x in enumerate(dispatch,1)}
groups['ENDINGS']='07-独立结局与尾声'
picture={x['id']:x for x in read(ROOT/'audit/picture-usability/current.json')['clips']}
source={x['id']:x for x in read(ROOT/'deliveries/当前候选索引.json')['slots']}
ending=read(ROOT.parent/'ENDINGS-20261025/chapter-two/delivery.json')
ending={x['id']:x for x in ending['films']+ending.get('epilogues',[])}
reviews=ROOT/'reviews/saved/review-state.json'
history=ROOT/'reviews/saved/review-history.jsonl'
before={'reviewStateSha256':sha(reviews),'reviewHistorySha256':sha(history)}
OUT.mkdir(exist_ok=True)
rows=[]
for n,x in enumerate(plan['current'],1):
    src=Path(x['file']); dst=OUT/groups[x['group']]/f'{n:02d}-{x["id"]}-{re.sub(r"[<>:\"/\\|?*]", "", x["name"])}{src.suffix}'
    dst.parent.mkdir(exist_ok=True)
    if not dst.exists():os.link(src,dst)
    assert os.path.samefile(src,dst), f'Existing library file differs: {dst}'
    digest=sha(src)
    p=picture.get(x['id'],{})
    e=ending.get(x['id'],{})
    assert digest==(p.get('sha256') or e.get('sha256')),x['id']
    row={**x,'libraryPath':str(dst),'relativePath':dst.relative_to(OUT).as_posix(),'sha256':digest,'bytes':src.stat().st_size,'mtimeNs':str(src.stat().st_mtime_ns),
      'entry':source.get(x['id'],{}).get('entry') or e.get('entryPrerequisite',''),
      'integrationConditions':p.get('integrationConditions',e.get('integrationConditions',[])),
      'status':'补音未完成，保留当前版本' if x['id']=='V25' else '制作自查已记录，用户复审状态请见审片台',
      'commentUrl':'http://127.0.0.1:8894/', 'hardLink':True}
    rows.append(row)

SAMPLES=AUDIT/'samples';SAMPLES.mkdir(exist_ok=True)
def sample(row):
    cap=cv2.VideoCapture(row['file'])
    assert cap.isOpened(),row['file']
    fps=cap.get(cv2.CAP_PROP_FPS); total=int(cap.get(cv2.CAP_PROP_FRAME_COUNT));duration=total/24
    points=[min(.25,duration/4),duration*.5,max(0,duration-.25)]
    frames=[]
    for t in points:
        cap.set(cv2.CAP_PROP_POS_MSEC,t*1000)
        ok,frame=cap.read();assert ok,(row['id'],t)
        im=Image.fromarray(cv2.cvtColor(frame,cv2.COLOR_BGR2RGB)); im.thumbnail((384,216));frames.append(im)
    cap.release()
    row.update(duration=duration,fps=fps,frames=total,sampleTimes=points)
    return frames
with ThreadPoolExecutor(max_workers=4) as pool:
    frames=list(pool.map(sample,rows))
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',18)
small=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',15)
sheets=[]
for group,title in groups.items():
    pairs=[(r,f) for r,f in zip(rows,frames) if r['group']==group]
    for start in range(0,len(pairs),5):
        batch=pairs[start:start+5]; sheet=Image.new('RGB',(1152,len(batch)*254+42),'#eeeae0'); d=ImageDraw.Draw(sheet)
        d.text((8,8),title+' · 开头 / 中段 / 结尾',fill='#111111',font=font)
        for j,(r,fs) in enumerate(batch):
            y=42+j*254
            d.text((8,y),f'{r["id"]}  {r["name"]}  {r["duration"]:.2f}s',fill='#111111',font=font)
            for k,im in enumerate(fs):
                sheet.paste(im,(k*384,y+28));d.text((k*384+5,y+29),f'{r["sampleTimes"][k]:.2f}s',fill='white',stroke_fill='black',stroke_width=1,font=small)
        dst=SAMPLES/f'{group}-{start//5+1:02d}.jpg';sheet.save(dst,quality=86);sheets.append(str(dst))

now=datetime.datetime.now().astimezone().isoformat()
manifest={'updatedAt':now,'scope':'63 current logical films + 7 independent ending/tail versions; no mutually exclusive branch concatenation','rows':rows,'sampleSheets':sheets,'reviewFilesBeforeCleanup':before,'userApproval':'Not granted by this library','openIssue':'V25 missing requested reference-audio result; no duplicate POST'}
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
payload=json.dumps({'groups':groups,'rows':rows},ensure_ascii=False).replace('<','\\u003c')
page=r'''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>第二章 · 最新成片</title>
<style>body{margin:0;background:#f4f1e8;color:#243632;font:16px/1.6 system-ui}main{max-width:1400px;margin:auto;padding:24px}h1{font-size:28px;margin:0}a{color:#385c48}header{margin-bottom:24px}.layout{display:grid;grid-template-columns:minmax(360px,1.4fr) minmax(300px,1fr);gap:24px}.viewer{position:sticky;top:20px;align-self:start}video{width:100%;background:#161b19;border-radius:10px}section{margin-bottom:24px}h2{font-size:19px}.clip{display:block;width:100%;text-align:left;background:#fffdf7;border:1px solid #d8ddcc;border-radius:8px;margin:8px 0;padding:12px;cursor:pointer;color:inherit;font:inherit}.clip.active{border:2px solid #41654c}.muted{color:#657267;font-size:14px}#detail{white-space:pre-wrap}.issue{color:#9b4b28}@media(max-width:850px){.layout{display:block}.viewer{position:static}}</style>
<main><header><h1>第二章 · 最新成片</h1><div>63 段剧情视频 · 7 条独立结局／尾声</div><p class="muted">按场景排序，每个剧情片段只列当前版本。不同选择分开播放。<br>评论、通过与复审筛选仍在 <a href="http://127.0.0.1:8894/">原审片台</a> 保存。</p><p class="issue">V25 补音尚未完成，当前版保留。新音频仍需实际听审。</p></header><div class="layout"><div class="viewer"><video id="player" controls preload="metadata"></video><h2 id="playing"></h2><p id="detail" class="muted"></p><a id="download" target="_blank">单独打开本片</a></div><nav id="list"></nav></div></main>
<script>const data=__DATA__;let buttons=[];function select(r,b){buttons.forEach(x=>x.classList.remove('active'));b.classList.add('active');const u=r.relativePath.split('/').map(encodeURIComponent).join('/');player.src=u;playing.textContent=r.id+' · '+r.name;detail.textContent=r.duration.toFixed(2)+' 秒\n'+r.status+(r.entry?'\n进入条件：'+r.entry:'')+(r.integrationConditions.length?'\n衔接约束：'+r.integrationConditions.join('；'):'');download.href=u;}
Object.entries(data.groups).forEach(([g,title])=>{const s=document.createElement('section'),h=document.createElement('h2');h.textContent=title;s.append(h);data.rows.filter(r=>r.group===g).forEach(r=>{const b=document.createElement('button');b.className='clip';b.textContent=r.id+' · '+r.name+'　'+r.duration.toFixed(1)+'s'+(r.id==='V25'?'　[补音待完成]':'');b.onclick=()=>select(r,b);s.append(b);buttons.push(b);if(buttons.length===1)select(r,b)});list.append(s)});</script>'''
page=page.replace('__DATA__',payload)
(OUT/'index.html').write_text(page,encoding='utf-8')
print(json.dumps({'currentFilms':len(rows),'sheets':len(sheets),'index':str(OUT/'index.html'),'reviewRecordsUntouched':before},ensure_ascii=False))
