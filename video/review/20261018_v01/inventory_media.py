from pathlib import Path
import json,subprocess,math,datetime,hashlib
from PIL import Image,ImageDraw
B=Path(__file__).resolve().parents[3];O=Path(__file__).parent;E=O/'evidence';F=E/'frames';F.mkdir(exist_ok=True)
FILES={'PR01':'video-new/01-若能早一步-20261018-012916.mp4','LI01':'video/video-new/LI01 - 蜀道运粮苟安救人 - 20261018_012647.mp4','LI02A':'video-new/01-粮仓探听-苟安受罚-20261018012502.mp4','LI02B':'video-new/LI02B-入帐探望-20261018-012518.mp4','SC01B':'video/video-new/SC01B - 军情奔马与魏延闯帐 - 20261018012738.mp4','EN04':'video/video-new/EN04 - 姜维叹战机那我有办法 - 20261018012727.mp4'}
rows=[]
for key,rel in FILES.items():
 p=B/rel;d=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(p)]));v=next(x for x in d['streams'] if x['codec_type']=='video');a=next(x for x in d['streams'] if x['codec_type']=='audio');r={'id':key,'path':rel,'modifiedUTC':datetime.datetime.fromtimestamp(p.stat().st_mtime,datetime.timezone.utc).isoformat(),'bytes':p.stat().st_size,'duration':float(d['format']['duration']),'videoCodec':v['codec_name'],'audioCodec':a['codec_name'],'fps':v['r_frame_rate'],'size':[v['width'],v['height']],'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'streams':d['streams']};rows.append(r);print(key,r['duration'],r['fps'],r['size'],rel,flush=True)
 folder=F/key;folder.mkdir(exist_ok=True);fps=round(float(v['r_frame_rate'].split('/')[0])/float(v['r_frame_rate'].split('/')[1]));subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(p),'-vf',f'select=not(mod(n\\,{fps})),scale=320:180','-fps_mode','vfr','-q:v','3',str(folder/'%03d.jpg')],check=True);imgs=sorted(folder.glob('*.jpg'));sheet=Image.new('RGB',(1920,math.ceil(len(imgs)/6)*202),(20,20,20));draw=ImageDraw.Draw(sheet)
 for i,f in enumerate(imgs):
  x=i%6*320;y=i//6*202;sheet.paste(Image.open(f),(x,y));draw.text((x+4,y+183),f'{key} source 00:{i:02d}.000',fill='white')
 sheet.save(E/f'{key}-source-contact.jpg',quality=92)
 subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(p),'-vn','-ac','1','-ar','16000',str(E/f'{key}-source.wav')],check=True)
(E/'new-sources.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2));(E/'sources-map.json').write_text(json.dumps(FILES,ensure_ascii=False,indent=2))
active={}
for p in list((B/'video/current').glob('*'))+[B/'GameStarter/web-demo/public/cinematics.json',B/'GameStarter/web-demo/public/ending-video.json',B/'GameStarter/web-demo/public/video/media-manifest.json',B/'content/chapters/wuzhang/chapter.json']:
 if p.is_file():active[str(p.relative_to(B))]=hashlib.sha256(p.read_bytes()).hexdigest()
(E/'protected-before.json').write_text(json.dumps(active,ensure_ascii=False,indent=2))
