from pathlib import Path
import subprocess,json,hashlib
O=Path(__file__).resolve().parent;R=O/'review/picture-repair';R.mkdir(exist_ok=True)
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
specs=[('V25-06','hands',[400,436,576,324]),('V25-07','lamp',[0,320,576,324]),('V24-03-R2','hands',[420,440,576,324]),('V24-06','lamp',[0,320,576,324])]
for id,kind,crop in specs:
 src=O/'generated'/f'{id}-raw.mp4';dst=R/f'{id}-{kind}-draft.mp4';x,y,w,h=crop
 if not dst.exists():subprocess.run([FF,'-v','error','-y','-i',str(src),'-vf',f'crop={w}:{h}:{x}:{y},scale=1280:720,setsar=1','-r','24','-c:v','libx264','-crf','18','-preset','fast','-c:a','aac','-ar','48000','-movflags','+faststart',str(dst)],check=True)
 jpg=dst.with_suffix('.jpg')
 if not jpg.exists():subprocess.run([FF,'-v','error','-y','-i',str(dst),'-vf','fps=2,scale=320:-1,tile=5x6','-frames:v','1',str(jpg)],check=True)
 receipt=dict(id=id,kind=kind,source=str(src),sourceSha256=hashlib.sha256(src.read_bytes()).hexdigest(),crop=crop,file=str(dst),sha256=hashlib.sha256(dst.read_bytes()).hexdigest(),status='draft-awaiting-dynamic-review',purpose='足长同场景观察镜；不展示错误角色口型，不短循环凑长，不宣称闭口表演已生成')
 dst.with_suffix('.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2),encoding='utf-8')
 print(str(dst),flush=True)
