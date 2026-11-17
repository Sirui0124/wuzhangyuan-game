from pathlib import Path
import json,subprocess,math,numpy as np,sys
from faster_whisper import WhisperModel
OUT=Path(__file__).parent
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
files=json.loads((OUT/'edited-manifest.json').read_text(encoding='utf-8'))
model=WhisperModel('small',device='cpu',compute_type='int8',cpu_threads=6,local_files_only=True)
for item in files:
    p=Path(item['path']);id=p.stem
    if sys.argv[1:] and id not in sys.argv[1:]:continue
    dest=OUT/'audit'/(id+'-final.jpg')
    subprocess.run([FF,'-v','error','-y','-i',str(p),'-vf',f'fps=1,scale=320:-1,tile=4x{math.ceil(item["duration"]/4)}:padding=3:margin=3','-frames:v','1',str(dest)],check=True)
    transcript=OUT/'audit'/(id+'-final-asr.json')
    pcm=subprocess.run([FF,'-v','error','-i',str(p),'-f','f32le','-ac','1','-ar','16000','pipe:1'],capture_output=True,check=True).stdout
    segs,info=model.transcribe(np.frombuffer(pcm,dtype=np.float32),language='zh',beam_size=5,word_timestamps=True)
    data=[dict(start=s.start,end=s.end,text=s.text,words=[dict(start=w.start,end=w.end,word=w.word) for w in (s.words or [])]) for s in segs]
    transcript.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(dict(id=id,segments=[{k:v for k,v in s.items() if k!='words'} for s in data]),ensure_ascii=False),flush=True)
