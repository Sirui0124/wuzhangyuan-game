from pathlib import Path
import subprocess,json,io
from PIL import Image,ImageDraw
OUT=Path(__file__).resolve().parent;FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
delivery=OUT/'delivery.json'
files=[Path(c['file']) for c in json.loads(delivery.read_text(encoding='utf-8'))['clips']] if delivery.exists() else sorted((OUT/'assembled').glob('*.mp4'))
folder=OUT/'review/first-decoded-frames';folder.mkdir(parents=True,exist_ok=True)
sheet=Image.new('RGB',(1280,((len(files)+3)//4)*202),'#111');draw=ImageDraw.Draw(sheet);rows=[]
for i,p in enumerate(files):
    target=folder/(p.stem+'.png')
    # Intentionally no -ss and no fps filter: inspect the real first decoded frame.
    subprocess.run([FF,'-v','error','-y','-i',str(p),'-frames:v','1',str(target)],check=True,capture_output=True)
    im=Image.open(target).convert('RGB');im.thumbnail((320,180));x=(i%4)*320;y=(i//4)*202;sheet.paste(im,(x,y));draw.text((x+4,y+183),p.stem.split('-')[0],fill='white')
    rows.append(dict(file=str(p),firstDecodedFrame=str(target),method='ffmpeg -i FILE -frames:v 1; no seek, no fps filter',size=list(Image.open(target).size)))
sheet.save(folder/'all-first-frames.jpg',quality=90)
(folder/'verification.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
print(len(rows))
