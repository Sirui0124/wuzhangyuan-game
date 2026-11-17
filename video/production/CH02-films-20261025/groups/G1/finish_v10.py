from pathlib import Path
import json,subprocess,io,math
from PIL import Image,ImageDraw
O=Path(__file__).resolve().parent
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
for cid,vf in [('V10-02','crop=1066:600:106:0,scale=1280:720,setsar=1'),('V10-03','crop=800:450:200:0,scale=1280:720,setsar=1')]:
    subprocess.run([FF,'-v','error','-y','-i',str(O/'edited'/f'{cid}-normalized.mp4'),'-vf',vf,'-c:v','libx264','-crf','18','-preset','fast','-c:a','copy','-movflags','+faststart',str(O/'edited'/f'{cid}-reframed.mp4')],check=True)
for cid in ['V10-01','V10-02','V10-03','V10-04','V10-05']:
    suffix={'V10-01':'document-softened','V10-02':'reframed','V10-03':'reframed'}.get(cid,'normalized')
    p=O/'edited'/f'{cid}-{suffix}.mp4';t=json.loads((O/'generated'/f'{cid}-technical.json').read_text(encoding='utf-8'))['output']['duration']
    ts=[min(t-.05,.05+i*.5) for i in range(math.ceil(t*2))];canvas=Image.new('RGB',(1280,198*math.ceil(len(ts)/4)),'#121212');draw=ImageDraw.Draw(canvas)
    for i,x in enumerate(ts):
        a=subprocess.run([FF,'-v','error','-ss',str(x),'-i',str(p),'-frames:v','1','-vf','scale=320:-1','-f','image2pipe','-vcodec','png','pipe:1'],check=True,capture_output=True)
        im=Image.open(io.BytesIO(a.stdout));xx=i%4*320;yy=i//4*198;canvas.paste(im,(xx,yy));draw.text((xx+3,yy+181),f'{cid} {x:.2f}s',fill='white')
    canvas.save(O/'review'/f'{cid}-final-check.jpg',quality=83)
    print(cid,flush=True)
