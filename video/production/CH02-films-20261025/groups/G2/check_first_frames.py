from pathlib import Path
import json,subprocess,sys
from PIL import Image,ImageDraw,ImageFont
OUT=Path(__file__).parent;normalized='--normalized' in sys.argv
D=OUT/'review'/('normalized-first-frames' if normalized else 'assembled-first-frames');D.mkdir(exist_ok=True)
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
delivery=json.loads((OUT/('review/prepared-candidates.json' if normalized else 'delivery.json')).read_text(encoding='utf-8'))
rows=[]
for c in (delivery if normalized else delivery['clips']):
    if not c.get('file'):continue
    p=Path(c['file']);dest=D/(p.stem+'.png')
    subprocess.run([FF,'-v','error','-y','-i',str(p),'-frames:v','1',str(dest)],check=True)
    rows.append((c['id'],dest))
for start in range(0,len(rows),9):
    sheet=Image.new('RGB',(1344,3*280),(20,24,24));draw=ImageDraw.Draw(sheet);font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',18)
    for j,(id,p) in enumerate(rows[start:start+9]):
        im=Image.open(p).convert('RGB');im.thumbnail((448,252));x=j%3*448;y=j//3*280;sheet.paste(im,(x,y));draw.text((x+6,y+255),id+' first decoded frame',font=font,fill='white')
    sheet.save(D/f'sheet-{start//9+1}.jpg')
print('Direct first-decoded frames',len(rows),'without seek/fps sampling')
