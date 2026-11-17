from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,hashlib,shutil,subprocess,datetime
OUT=Path(__file__).parent;G1=OUT.parent/'G1';D=OUT/'review/G1-assist-source';D.mkdir(exist_ok=True)
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
ids=['V06-01','V07-01','V08A-01','V08A-02','V08B-01'];plan=json.loads((G1/'plan.json').read_text(encoding='utf-8-sig'));rows=[]
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',18)
for id in ids:
    src=G1/'generated'/f'{id}-raw.mp4';copy=D/f'{id}.mp4';shutil.copyfile(src,copy)
    digest=hashlib.sha256(src.read_bytes()).hexdigest();assert digest==hashlib.sha256(copy.read_bytes()).hexdigest()
    c=next(c for c in plan['clips'] if c['id']==id)
    rows.append(dict(id=id,sourcePath=str(src.resolve()),sourceMtimeUtc=datetime.datetime.fromtimestamp(src.stat().st_mtime,datetime.timezone.utc).isoformat(),sha256=digest,sourceLines=c['sourceLines'],plannedDuration=c['duration'],localReviewCopy=str(copy.resolve())))
    dest=D/id;dest.mkdir(exist_ok=True)
    subprocess.run([FF,'-v','error','-y','-i',str(copy),'-vf','fps=2,scale=448:252','-q:v','3',str(dest/'f-%03d.jpg')],check=True)
    frames=sorted(dest.glob('f-*.jpg'))
    for start in range(0,len(frames),12):
        sheet=Image.new('RGB',(1344,4*280),(20,24,24));draw=ImageDraw.Draw(sheet)
        for j,p in enumerate(frames[start:start+12]):
            x=j%3*448;y=j//3*280;sheet.paste(Image.open(p),(x,y));draw.text((x+6,y+255),f'{id} {(start+j)/2}s',font=font,fill='white')
        sheet.save(dest/f'sequence-{start//12+1:02}.jpg')
(OUT/'review/G1-assist-source-index.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
page='''<!doctype html><meta charset="utf-8"><title>G1 协助审片</title><style>body{margin:0;background:#171c1a;color:#eee}video{width:100%;height:85vh}pre{white-space:pre-wrap}</style><h2 id="title"></h2><button onclick="v.play()">播放</button><video id="v" controls muted></video><pre id="audit"></pre><script>const ids='''+json.dumps(ids)+''';let index=0;function play(){title.textContent=ids[index];v.src='review/G1-assist-source/'+ids[index]+'.mp4';v.play()}v.onended=()=>{audit.textContent+=JSON.stringify({id:ids[index],event:'ended',duration:v.duration,time:new Date().toISOString()})+'\\n';if(++index<ids.length)play()};play()</script>'''
(OUT/'G1协助审片.html').write_text(page,encoding='utf-8');print('G1 read-only review sources prepared',len(rows))
