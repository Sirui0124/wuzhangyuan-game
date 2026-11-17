"""Extract actual first decoded frames (no seek/fps filter); review remains human."""
from pathlib import Path
import importlib.util,json,subprocess,urllib.parse,time,hashlib
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1]
FF=Path('C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe')
spec=importlib.util.spec_from_file_location('review_server',ROOT/'scripts/review_server.py')
server=importlib.util.module_from_spec(spec);spec.loader.exec_module(server)
dest=ROOT/'audit/heads';dest.mkdir(exist_ok=True)
rows=[]
for group in server.data()['groups']:
 for c in group['clips']:
  if not c['file']:continue
  p=ROOT/urllib.parse.unquote(c['file'].split('?')[0]);stamp=str(p.stat().st_mtime_ns)
  name=c['id']+'-'+stamp;frame=dest/(name+'.jpg')
  if not frame.exists():
   result=subprocess.run([str(FF),'-v','error','-y','-i',str(p),'-frames:v','1','-q:v','3',str(frame)],capture_output=True)
   if result.returncode:continue
  rows.append({'id':c['id'],'name':c['name'],'group':group['group'],'file':str(p),'mtime_ns':stamp,'firstFrame':str(frame),'status':'extracted_only_not_reviewed'})
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',17)
for offset in range(0,len(rows),12):
 batch=rows[offset:offset+12];sheet=Image.new('RGB',(1200,264*((len(batch)+2)//3)),(24,28,25));draw=ImageDraw.Draw(sheet)
 for i,r in enumerate(batch):
  x=(i%3)*400;y=(i//3)*264
  with Image.open(r['firstFrame']) as im:sheet.paste(im.resize((400,225)),(x,y))
  draw.text((x+8,y+229),r['id']+' '+r['name'][:17],font=font,fill=(235,238,227))
 sheet.save(dest/f'contact-{offset//12+1:02d}.jpg',quality=90)
(dest/'manifest.json').write_text(json.dumps({'updated':time.strftime('%Y-%m-%d %H:%M:%S'),'frames':rows},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'candidateCount':len(rows),'sheets':(len(rows)+11)//12,'status':'first frames extracted; no automated visual approval'},ensure_ascii=False))
