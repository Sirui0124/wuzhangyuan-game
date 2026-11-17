from pathlib import Path
import json, hashlib, av
from PIL import Image, ImageDraw
R=Path(__file__).resolve().parents[3]
O=Path(__file__).resolve().parent
(O/'audit/frames').mkdir(parents=True,exist_ok=True)
c=json.loads((R/'GameStarter/web-demo/public/cinematics.json').read_text(encoding='utf-8'))
rows=[]
for group in ['opening','chapterDialogue','sacrifice','safe']:
 for x in c[group]:
  if group=='chapterDialogue' and not x['id'].startswith('C1'): continue
  p=R/x['src'].lstrip('/')
  with av.open(str(p)) as con:
   s=con.streams.video[0]; dur=float(s.duration*s.time_base)
   times=sorted(set([0.1, max(.1,dur-.15)]+[round(i*1.5+.5,2) for i in range(int(dur/1.5)) if i*1.5+.5<dur]))
   imgs=[]; actual=[]
   for t in times:
    con.seek(int(t/s.time_base),stream=s)
    for f in con.decode(s):
     if float(f.time)>=t:
      im=f.to_image(); actual.append(round(float(f.time),3)); imgs.append(im); break
  key=f'{len(rows)+1:02d}'
  sheet=Image.new('RGB',(1280,202*((len(imgs)+3)//4)), '#202020'); draw=ImageDraw.Draw(sheet)
  for i,(im,t) in enumerate(zip(imgs,actual)):
   im.save(O/f'audit/frames/{key}-{t:.3f}.jpg',quality=92)
   thumb=im.resize((320,180)); xx=i%4*320; yy=i//4*202
   sheet.paste(thumb,(xx,yy));draw.text((xx+4,yy+182),f'{key} {x["id"]} {t:.2f}s',fill='white')
  sheet.save(O/f'audit/{key}-contact.jpg',quality=90)
  sub=R/x.get('subtitles','').lstrip('/')
  row=dict(index=key,group=group,**x,path=str(p),duration=dur,sha256=hashlib.sha256(p.read_bytes()).hexdigest(),sampleTimes=actual,subtitleText=sub.read_text(encoding='utf-8') if sub.is_file() else '')
  rows.append(row); print(key,x['id'],round(dur,2),flush=True)
(O/'audit/inventory.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
