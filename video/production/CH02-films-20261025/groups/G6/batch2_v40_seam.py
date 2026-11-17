from pathlib import Path
import json,av,hashlib
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parent;OUT=ROOT/'user-review-batch2'
r=json.loads((OUT/'V40-candidate.json').read_text(encoding='utf-8'));p=Path(r['path']);assert p.stem.endswith('R2')
frames=[]
with av.open(str(p)) as c:
    for f in c.decode(video=0):
        t=float(f.pts*f.time_base)
        if not 12.65<=t<=13.20:continue
        im=f.to_image();im.thumbnail((400,225));frames.append((t,im))
im=Image.new('RGB',(1600,((len(frames)+3)//4)*250),'#181818');d=ImageDraw.Draw(im)
for i,(t,fr) in enumerate(frames):x=i%4*400;y=i//4*250;im.paste(fr,(x,y));d.text((x+5,y+228),f'V40 R2 each-frame {t:.6f}',fill='white')
dest=OUT/'V40-R2-seam-every-frame.jpg';im.save(dest)
sameAudio=hashlib.sha256((OUT/'V40-speech-only-R1.wav').read_bytes()).hexdigest()==hashlib.sha256((OUT/'V40-speech-only-R2.wav').read_bytes()).hexdigest();assert sameAudio
(OUT/'V40-R2-seam-evidence.json').write_text(json.dumps(dict(path=str(p),sha256=r['sha256'],frames=[t for t,_ in frames],sheet=str(dest),audioPCMFileIdenticalToR1=sameAudio,operation='replace 3-frame isolated entry with continuous preceding shot tail; then directly seated reporting angle; all 7 whitelist speech timelines unchanged'),ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(dict(frames=len(frames),audioIdentical=sameAudio),ensure_ascii=False))
