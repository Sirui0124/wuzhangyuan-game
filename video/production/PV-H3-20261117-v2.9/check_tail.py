from pathlib import Path
import subprocess,json,cv2,numpy as np
from PIL import Image,ImageDraw
R=Path(__file__).resolve().parent;FF=r'D:/AI视频/VJ-1106/motion-runtime/node_modules/ffmpeg-static/ffmpeg.exe'
src=R/'A21/source.mp4';D=R/'A21/tail-review';D.mkdir(exist_ok=True)
stamps=[6,6.25,6.5,6.75,7,7.5,8,8.5,9,9.25]
canvas=Image.new('RGB',(1280,612),'#eee');draw=ImageDraw.Draw(canvas)
for i,t in enumerate(stamps):
 p=D/f'{t}.png';subprocess.run([FF,'-v','error','-y','-ss',str(t),'-i',str(src),'-frames:v','1',str(p)],check=True)
 im=Image.open(p);im=im.resize((320,180));x=i%4*320;y=i//4*204;canvas.paste(im,(x,y));draw.text((x+6,y+183),str(t),fill='black')
canvas.save(D/'tail-contact.jpg')
a=np.asarray(Image.open(D/'6.25.png'));b=np.asarray(Image.open(D/'9.25.png'));delta=np.abs(a.astype(float)-b.astype(float));(D/'pixel-change.json').write_text(json.dumps(dict(mean_absolute_difference=float(delta.mean()),fraction_pixels_changed_over10=float((delta.max(axis=2)>10).mean()),note='Pixel differences alone do not prove natural motion; compare smoke, trees and static geometry.')),'utf-8')
print('Tail frames ready')
