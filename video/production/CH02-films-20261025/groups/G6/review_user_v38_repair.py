from pathlib import Path
import json,av,hashlib
from PIL import Image,ImageDraw
OUT=Path(__file__).resolve().parent;ROOT=OUT/'user-review-20261025'
info=json.loads((ROOT/'V38-local-repair.json').read_text(encoding='utf-8'));p=Path(info['newFile']);assert hashlib.sha256(p.read_bytes()).hexdigest()==info['newSha256']
targets=set(round(x*24) for x in [i*.5 for i in range(69)])
targets.update(range(220,339,3));targets.update(range(444,471,3))
frames=[]
with av.open(str(p)) as c:
    for i,f in enumerate(c.decode(video=0)):
        if i not in targets:continue
        im=f.to_image();im.thumbnail((400,225));frames.append((float(f.pts*f.time_base),im))
sheets=[]
for page in range((len(frames)+23)//24):
    subset=frames[page*24:page*24+24];out=Image.new('RGB',(1600,((len(subset)+3)//4)*250),'#161616');d=ImageDraw.Draw(out)
    for i,(t,im) in enumerate(subset):
        x=i%4*400;y=i//4*250;out.paste(im,(x,y));d.text((x+5,y+228),f'V38 R3 verified {t:.3f}s',fill='white')
    dest=ROOT/f'V38-R3-scan-{page+1:02d}.jpg';out.save(dest);sheets.append(str(dest))
(ROOT/'V38-R3-scan-evidence.json').write_text(json.dumps(dict(file=str(p),sha256=info['newSha256'],sampling='2fps full-film +8fps replacement-window/seam auxiliary ordered frames, not continuous human frame-by-frame',frameTimes=[x[0] for x in frames],sheets=sheets),ensure_ascii=False,indent=2),encoding='utf-8')
m=ROOT/'playback-manifest.json';r=json.loads(m.read_text(encoding='utf-8'));r=[x for x in r if x['id']!='V38-R3'];r.append(dict(id='V38-R3',name='救下眼前的人 新标准修版',oldFile=str(p)));m.write_text(json.dumps(r,ensure_ascii=False),encoding='utf-8')
print(json.dumps(dict(frames=len(frames),sheets=sheets),ensure_ascii=False))
