from pathlib import Path
import json, subprocess, io
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parents[3]
OUT=Path(__file__).parent/'audit'
FF=Path('C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe')
def load(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def frame(p,t):
    r=subprocess.run([str(FF),'-v','error','-ss',str(t),'-i',str(p),'-frames:v','1','-vf','scale=384:-1','-f','image2pipe','-vcodec','png','pipe:1'],capture_output=True)
    return Image.open(io.BytesIO(r.stdout)).convert('RGB')
films=load(ROOT/'GameStarter/web-demo/public/cinematics.json')
report=[]
for group,clips in films.items():
    if not isinstance(clips,list):continue
    for c in clips:
        if not isinstance(c,dict) or not c.get('src'):continue
        p=ROOT/c['src'].lstrip('/')
        if not p.exists():continue
        r=subprocess.run([str(FF),'-hide_banner','-i',str(p)],capture_output=True,text=True,encoding='utf-8',errors='replace')
        import re
        d=re.search(r'Duration: (\d+):(\d+):([\d.]+)',r.stderr)
        duration=int(d[1])*3600+int(d[2])*60+float(d[3]) if d else 0
        dims=re.search(r'Video:.*? (\d{3,5})x(\d{3,5})',r.stderr)
        row=dict(group=group,**c,duration=duration,width=int(dims[1]) if dims else None,height=int(dims[2]) if dims else None)
        report.append(row)
        if group in ['opening','chapterDialogue','sacrifice','safe']:
            ts=[min(duration-.1,max(.05,duration*f)) for f in [.04,.33,.66,.94]]
            sheet=Image.new('RGB',(768,478),'#111111');draw=ImageDraw.Draw(sheet)
            for i,t in enumerate(ts):
                im=frame(p,t);im.thumbnail((384,216));x=(i%2)*384;y=(i//2)*239
                sheet.paste(im,(x,y));draw.text((x+4,y+216),f'{t:.2f}s',fill='white')
            sheet.save(OUT/(c['id']+'.jpg'))
OUT.mkdir(exist_ok=True)
(OUT/'actual-films.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps([dict(id=r['id'],group=r['group'],duration=r['duration'],size=[r['width'],r['height']],rows=r.get('rows',[])) for r in report],ensure_ascii=False,indent=2))
