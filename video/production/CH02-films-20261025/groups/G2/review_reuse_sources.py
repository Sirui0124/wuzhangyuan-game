from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,hashlib,shutil,subprocess,datetime
OUT=Path(__file__).parent;D=OUT/'review/reuse-candidates';D.mkdir(exist_ok=True)
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
rows=[]
for group,id in [('G1','L01'),('G1','V11N'),('G4','L02')]:
    d=json.loads((OUT.parent/group/'delivery.json').read_text(encoding='utf-8-sig'));c=next(c for c in d['clips'] if c['id']==id)
    src=Path(c['file']);tag=group+'-'+id;dst=D/(tag+'.mp4');shutil.copyfile(src,dst)
    sha=hashlib.sha256(src.read_bytes()).hexdigest();assert sha==hashlib.sha256(dst.read_bytes()).hexdigest()
    rows.append(dict(group=group,id=id,path=str(src.resolve()),reviewCopy=str(dst.resolve()),sha256=sha,mtimeUtc=datetime.datetime.fromtimestamp(src.stat().st_mtime,datetime.timezone.utc).isoformat()))
    frames=D/tag;frames.mkdir(exist_ok=True)
    subprocess.run([FF,'-v','error','-y','-i',str(dst),'-vf','fps=2,scale=448:252','-q:v','3',str(frames/'f-%03d.jpg')],check=True)
    ps=sorted(frames.glob('f-*.jpg'));font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',18)
    for start in range(0,len(ps),12):
        sheet=Image.new('RGB',(1344,4*280),(20,24,24));draw=ImageDraw.Draw(sheet)
        for j,p in enumerate(ps[start:start+12]):
            x=j%3*448;y=j//3*280;sheet.paste(Image.open(p),(x,y));draw.text((x+6,y+255),f'{tag} {(start+j)/2}s',font=font,fill='white')
        sheet.save(frames/f'sequence-{start//12+1:02}.jpg')
(D/'sources.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
print('Three reuse candidates copied and hash verified; no generation request')
