from pathlib import Path
import subprocess,sys,json,math
OUT=Path(__file__).parent
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
clips={c['id']:c for c in json.loads((OUT/'production.json').read_text(encoding='utf-8'))['clips']}
for id in sys.argv[1:]:
    p=OUT/'generated'/(id+'-16x9.mp4')
    if not p.exists():continue
    rows=math.ceil(clips[id]['duration']*2/4)
    dest=OUT/'audit'/(id+'-quick.jpg')
    subprocess.run([FF,'-v','error','-y','-i',str(p),'-vf',f'fps=2,scale=320:-1,tile=4x{rows}:padding=3:margin=3','-frames:v','1',str(dest)],check=True)
    print(id,str(dest.resolve()),flush=True)
