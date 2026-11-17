from pathlib import Path
import json,hashlib,subprocess
import numpy as np
from faster_whisper import WhisperModel
O=Path(__file__).resolve().parent;R=O/'user-review-batch2';FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe';p=O/'generated/V25-02-raw.mp4'
model=WhisperModel('small',device='cpu',compute_type='int8',local_files_only=True,cpu_threads=2);rows=[]
for i in [0,1]:
 dest=R/(f'P02-channel-{i}-asr.json')
 if dest.exists():d=json.loads(dest.read_text(encoding='utf-8-sig'))
 else:
  pcm=subprocess.run([FF,'-v','error','-i',str(p),'-af',f'pan=mono|c0=c{i}','-f','f32le','-ar','16000','pipe:1'],capture_output=True,check=True).stdout
  segs,info=model.transcribe(np.frombuffer(pcm,dtype=np.float32),language='zh',beam_size=5,word_timestamps=True,vad_filter=True,condition_on_previous_text=False)
  d=dict(file=str(p),sha256=hashlib.sha256(p.read_bytes()).hexdigest(),channel=i,scope='免费查找原片单声道是否有完整正确P02；ASR非听审',segments=[dict(start=s.start,end=s.end,text=s.text) for s in segs]);dest.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8')
 rows.append(d);print(json.dumps(d,ensure_ascii=False),flush=True)
