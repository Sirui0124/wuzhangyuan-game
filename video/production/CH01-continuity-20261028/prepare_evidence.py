from pathlib import Path
import json, av, hashlib, shutil
from PIL import Image, ImageDraw
O=Path(__file__).resolve().parent; R=O.parents[2]
inv=json.loads((O/'audit/inventory.json').read_text(encoding='utf-8')); by={x['index']:x for x in inv}
refs={
 '帐前空间':('03','03-8.000.jpg'), '斥候首轮接镜':('06','06-0.125.jpg'),
 '斥候次轮接镜':('15','15-16.875.jpg'), '乙接镜':('14','14-0.500.jpg'),
 '亲兵身份':('22','22-0.500.jpg'), '甲身份':('09','09-0.500.jpg'),
 '接报结束目标':('19','19-0.125.jpg'), '魏延身份':('17','17-5.000.jpg'),
 '姜维亲兵原站位':('23','23-8.000.jpg'), '将军帐':(None,str(R/'source-art/core/将军帐.png')),
 '同行出发旧帧':('22','22-4.667.jpg')}
(O/'references').mkdir(exist_ok=True)
records=[]
for name,(idx,file) in refs.items():
 src=O/'audit/frames'/file if idx else Path(file)
 dst=O/'references'/(name+src.suffix);shutil.copy2(src,dst)
 records.append(dict(name=name,path=str(dst),source=str(src),sourceVideo=by[idx]['path'] if idx else None,sourceSha256=by[idx]['sha256'] if idx else hashlib.sha256(src.read_bytes()).hexdigest(),kind='unmodified-extracted-frame' if idx else 'existing-scene-reference'))
windows={'08':(3.5,10),'13':(10,14),'16':(3,6),'23':(7.5,10),'24':(10,12.49),'25':(0,1.5),'26':(8,12),'29':(23,28)}
for key,(start,end) in windows.items():
 x=by[key]; frames=[]; target=start
 with av.open(x['path']) as con:
  s=con.streams.video[0];con.seek(int(start/s.time_base),stream=s)
  for f in con.decode(s):
   if f.time is None or f.time<target:continue
   if f.time>end:break
   frames.append((float(f.time),f.to_image().resize((320,180))));target+=.25
 sheet=Image.new('RGB',(1280,202*((len(frames)+3)//4)),'#202020');d=ImageDraw.Draw(sheet)
 for j,(t,im) in enumerate(frames):
  xx=j%4*320;yy=j//4*202;sheet.paste(im,(xx,yy));d.text((xx+4,yy+181),f'{key} {t:.3f}s',fill='white')
 sheet.save(O/f'audit/{key}-detail.jpg',quality=92)
for x in inv:
 p=R/'GameStarter/web-demo/public'/x['subtitles'].lstrip('/'); x['subtitleText']=p.read_text(encoding='utf-8') if p.exists() else ''
(O/'audit/inventory.json').write_text(json.dumps(inv,ensure_ascii=False,indent=2),encoding='utf-8')
(O/'audit/reference-provenance.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
print('Prepared',len(records),'reference images and',len(windows),'dense evidence sheets')
