from pathlib import Path
import json,subprocess
from PIL import Image,ImageDraw,ImageFont
R=Path(__file__).resolve().parent;T=json.loads((R/'edit-timeline.json').read_text('utf-8'));F=R/'逆转五丈原-PV-v2.5-完整成片.mp4';D=R/'review-seams';D.mkdir(exist_ok=True)
FF=r'D:/AI视频/VJ-1106/motion-runtime/node_modules/ffmpeg-static/ffmpeg.exe'
for key,ids in [('camp',['V03','V04','V09']),('rain',['V10','V11','V12','V11B','V13']),('masu',['V14','V17'])]:
 stamps=[]
 for s in T['shots']:
  if s['id'] not in ids:continue
  t=s['timeline_in'];stamps.extend([max(0,t-.25),t+.125,t+min(.75,s['duration']-.125)])
 out=Image.new('RGB',(960,204*((len(stamps)+2)//3)),(245,245,242));draw=ImageDraw.Draw(out)
 for i,t in enumerate(stamps):
  p=D/f'{key}-{i}.jpg';subprocess.run([FF,'-v','error','-y','-ss',str(t),'-i',str(F),'-frames:v','1','-vf','scale=320:180',str(p)],check=True);x=i%3*320;y=i//3*204;out.paste(Image.open(p),(x,y));draw.text((x+5,y+182),f'{t:.3f}s',fill=(0,0,0))
 out.save(D/f'{key}-contact.jpg')
print('Seams ready')
