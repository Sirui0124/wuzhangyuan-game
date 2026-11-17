from pathlib import Path
import av,json,hashlib
from PIL import Image,ImageDraw
OUT=Path(__file__).resolve().parent
src=OUT.parent/'G5/assembled/V32A-4dc62cf1df-cfr24.mp4'
copy=OUT/'review/G5-V32A-readonly-copy.mp4'
sha=hashlib.sha256(src.read_bytes()).hexdigest();assert sha==hashlib.sha256(copy.read_bytes()).hexdigest()
frames=[];nextt=49.75
with av.open(str(copy)) as c:
    c.seek(int(49*av.time_base))
    for f in c.decode(video=0):
        t=float(f.pts*f.time_base)
        if t+.001>=nextt:
            im=f.to_image();im.thumbnail((400,225));frames.append((t,im));nextt+=.25
        if t>55.8:break
out=Image.new('RGB',(1600,((len(frames)+3)//4)*252),'#171717');draw=ImageDraw.Draw(out)
for i,(t,im) in enumerate(frames):
    x=i%4*400;y=i//4*252;out.paste(im,(x,y));draw.text((x+4,y+228),f'G5 actual parent {t:.3f}s',fill='white')
out.save(OUT/'review/G5-signature-parent-sequence.jpg')
(OUT/'review/G5-signature-parent-frame-times.json').write_text(json.dumps(dict(file=str(src),sha256=sha,sampleTimes=[x[0] for x in frames],sampling='4fps auxiliary; dynamic UI playback recorded separately'),ensure_ascii=False,indent=2),encoding='utf-8')
print('Same-SHA parent 4fps evidence saved')
