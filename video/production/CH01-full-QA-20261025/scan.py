from pathlib import Path
import json,subprocess,math,hashlib
from concurrent.futures import ThreadPoolExecutor
from PIL import Image,ImageDraw,ImageFont
import av
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).parent
FF=Path('C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe')
FONT=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',15)
for name in ['sheets','audio','audit']:(OUT/name).mkdir(parents=True,exist_ok=True)
def save(p,x):p.write_text(json.dumps(x,ensure_ascii=False,indent=2),encoding='utf-8')
config=json.loads((ROOT/'GameStarter/web-demo/public/cinematics.json').read_text(encoding='utf-8-sig'))
script=json.loads((ROOT/'content/chapters/wuzhang/chapter-one.script.json').read_text(encoding='utf-8-sig'))
rows={x['id']:x for x in script['rows']}
items=[]
for group in ['opening','chapterDialogue','sacrifice','safe']:
 for c in config[group]:
  item=dict(group=group,**c)
  item['lines']=[{k:rows[r].get(k) for k in ['id','speaker','text']} for r in c.get('rows',[]) if r in rows]
  items.append(item)
save(OUT/'audit/cinematics-before.json',config)
def scan(pair):
 n,item=pair;path=ROOT/item['src'].lstrip('/');sid=f'{n:02d}-{item["id"]}';dest=OUT/'sheets'/sid
 dest.mkdir(exist_ok=True)
 con=av.open(str(path));vs=con.streams.video[0];duration=float(vs.duration*vs.time_base) if vs.duration else con.duration/1e6
 meta={'duration':duration,'width':vs.width,'height':vs.height,'fps':str(vs.average_rate),'audio':bool(con.streams.audio),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()};con.close()
 run=subprocess.run([str(FF),'-v','error','-threads','2','-i',str(path),'-vf','fps=2,scale=320:180','-vsync','0','-f','image2pipe','-vcodec','mjpeg','-'],capture_output=True)
 assert run.returncode==0,(sid,run.stderr.decode(errors='replace'))
 import io
 chunks=run.stdout.split(b'\xff\xd8')[1:];images=[Image.open(io.BytesIO(b'\xff\xd8'+x)).convert('RGB') for x in chunks]
 sheets=[]
 for offset in range(0,len(images),32):
  batch=images[offset:offset+32];sheet=Image.new('RGB',(1280,42+204*math.ceil(len(batch)/4)),(18,18,18));d=ImageDraw.Draw(sheet)
  d.text((8,8),f'{sid} | {item["title"]} | {duration:.2f}s',font=FONT,fill='white')
  for i,img in enumerate(batch):
   x=(i%4)*320;y=42+(i//4)*204;sheet.paste(img,(x,y));d.text((x+4,y+181),f'{(offset+i)/2:.2f}s',font=FONT,fill='white')
  p=dest/f'{offset//32+1:02d}.jpg';sheet.save(p,quality=88);sheets.append(str(p.relative_to(OUT)))
 audio=OUT/'audio'/(sid+'.wav')
 run=subprocess.run([str(FF),'-v','error','-threads','2','-i',str(path),'-vn','-ar','16000','-ac','1','-y',str(audio)],capture_output=True)
 assert run.returncode==0
 result=dict(index=n,**item,metadata=meta,sheets=sheets,audio=str(audio.relative_to(OUT)))
 save(OUT/'audit'/(sid+'.json'),result)
 print(f'{n:02d} {item["id"]} {duration:.2f}s {len(images)} frames {len(sheets)} sheets',flush=True)
 return result
with ThreadPoolExecutor(max_workers=3) as pool:results=list(pool.map(scan,enumerate(items,1)))
save(OUT/'inventory.json',results)
core=json.loads((ROOT/'source-art/core/assets.json').read_text(encoding='utf-8'))['assets']
chosen=core[:6];sheet=Image.new('RGB',(1500,600),(25,25,25));d=ImageDraw.Draw(sheet)
for i,a in enumerate(chosen):
 im=Image.open(a['path']).convert('RGB');im.thumbnail((490,250));x=(i%3)*500;y=(i//3)*300
 sheet.paste(im,(x+(500-im.width)//2,y+25));d.text((x+10,y+2),a['id'],font=FONT,fill='white')
sheet.save(OUT/'core-identities.jpg',quality=92)
print('TOTAL',len(results),round(sum(r['metadata']['duration'] for r in results),2),'seconds',flush=True)
