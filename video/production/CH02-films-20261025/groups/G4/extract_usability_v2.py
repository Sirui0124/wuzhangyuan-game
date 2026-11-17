from pathlib import Path
import subprocess,json,io,math
from PIL import Image,ImageDraw
OUT=Path(__file__).resolve().parent
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
d=json.loads((OUT/'review/picture-v2-candidates.json').read_text(encoding='utf-8'))
root=OUT/'review/usability/picture-v2';root.mkdir(exist_ok=True)
manifest=[]
for c in d['clips']:
 f=Path(c['file']);dur=c['technical']['duration'];ts=list(range(math.ceil(dur)))+[max(0,dur-.1)]
 board=Image.new('RGB',(1280,166*((len(ts)+4)//5)),'#202020');draw=ImageDraw.Draw(board)
 for i,t in enumerate(ts):
  b=subprocess.run([FF,'-v','error','-ss',str(t),'-i',str(f),'-frames:v','1','-vf','scale=256:144','-f','image2pipe','-vcodec','png','-'],capture_output=True,check=True).stdout
  x=i%5*256;y=i//5*166;board.paste(Image.open(io.BytesIO(b)),(x,y));draw.text((x+4,y+146),f'{c["id"]} {t:.2f}s',fill='white')
 dst=root/(c['id']+'-timeline.jpg');board.save(dst)
 first=root/(c['id']+'-first.png')
 subprocess.run([FF,'-v','error','-i',str(f),'-frames:v','1','-y',str(first)],capture_output=True,check=True)
 manifest.append(dict(id=c['id'],file=str(f),sha256=c['technical']['sha256'],timeline=str(dst),sampleTimes=ts,firstDecodedFrame=str(first)))
 print(c['id'],flush=True)
(root/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
