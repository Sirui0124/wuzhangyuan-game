from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,subprocess,time
OUT=Path(__file__).parent;FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',18);last=''
while True:
    rows=[]
    for p in sorted((OUT/'edited/picture-review-final').glob('*.json')):
        r=json.loads(p.read_text(encoding='utf-8-sig'));rows.append(dict(id='SAMPLE-'+r['id'],file=Path(r['file']).relative_to(OUT).as_posix(),sha256=r['sha256']))
        dest=OUT/'review/picture-review-final'/r['id'];dest.mkdir(parents=True,exist_ok=True)
        if not (dest/'sequence-01.jpg').exists():
            subprocess.run([FF,'-v','error','-y','-i',r['file'],'-vf','fps=2,scale=448:252','-q:v','3',str(dest/'f-%03d.jpg')],check=True)
            ps=sorted(dest.glob('f-*.jpg'))
            for start in range(0,len(ps),12):
                sheet=Image.new('RGB',(1344,4*280),(20,24,24));draw=ImageDraw.Draw(sheet)
                for j,pic in enumerate(ps[start:start+12]):
                    x=j%3*448;y=j//3*280;sheet.paste(Image.open(pic),(x,y));draw.text((x+6,y+255),f'{r["id"]} {(start+j)/2}s',font=font,fill='white')
                sheet.save(dest/f'sequence-{start//12+1:02}.jpg')
            print('Picture sequence ready',r['id'],flush=True)
    final=OUT/'review/picture-repair-candidates.json'
    for folder,prefix in [('picture-review-corrected','CORRECT-'),('picture-review-presentable','PRESENT-')]:
        for p in sorted((OUT/'edited'/folder).glob('*.json')):
            r=json.loads(p.read_text(encoding='utf-8-sig'));rows.append(dict(id=prefix+r['id'],file=Path(r['file']).relative_to(OUT).as_posix(),sha256=r['sha256']))
    if final.exists():
        d=json.loads(final.read_text(encoding='utf-8-sig'))
        if d['version']=='picture-review-final':rows += [dict(id='NEW-'+c['id'],file=Path(c['file']).relative_to(OUT).as_posix(),sha256=c['sha256']) for c in d['clips']]
    text=json.dumps(rows,ensure_ascii=False)
    if text!=last:
        p=OUT/'review/picture-live-index.json';tmp=p.with_suffix('.tmp');tmp.write_text(text,encoding='utf-8');tmp.replace(p);last=text
    if final.exists() and len(rows)>=75:break
    time.sleep(5)
