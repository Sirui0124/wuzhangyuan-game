from pathlib import Path
import av,json
from PIL import Image,ImageDraw
OUT=Path(__file__).resolve().parent
for key in ['V41E-04-silent-reaction-R2','V41L-04-silent-reaction-R4']:
    p=OUT/'edited'/f'{key}.mp4';frames=[];nextt=0
    with av.open(str(p)) as c:
        for f in c.decode(video=0):
            t=float(f.pts*f.time_base)
            if t+.001>=nextt:
                im=f.to_image();im.thumbnail((320,180));frames.append((t,im));nextt+=.5
    out=Image.new('RGB',(1280,((len(frames)+3)//4)*204),'#151515');d=ImageDraw.Draw(out)
    for i,(t,im) in enumerate(frames):
        x=i%4*320;y=i//4*204;out.paste(im,(x,y));d.text((x+4,y+182),f'{key} {t:.2f}s',fill='white')
    out.save(OUT/'review'/f'{key}-2fps.jpg')
print('New narration reaction checks rendered at 2fps')
