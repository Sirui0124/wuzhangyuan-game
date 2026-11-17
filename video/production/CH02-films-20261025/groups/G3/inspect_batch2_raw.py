from pathlib import Path
import json,hashlib,subprocess
import numpy as np
from faster_whisper import WhisperModel
O=Path(__file__).resolve().parent;R=O/'user-review-batch2';FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe';read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
P=read(O/'plan.json');model=None
for c in P['clips']+[dict(id='V21-03-UR1',sourceLines=[])]:
 if c['id']!='V21-03-UR1' and (c.get('postVoiceOnly') or not any(x['spoken'] for x in c['sourceLines'])):continue
 id=c['id'];p=O/'generated'/(id+'-raw.mp4');p=p if p.exists() else O/'generated'/(id+'-R2-raw.mp4');dest=R/(id+'-raw-asr.json');prior=O/'review'/(id+'-asr.json');h=hashlib.sha256(p.read_bytes()).hexdigest()
 if dest.exists() and read(dest)['sha256']==h:data=read(dest)
 elif prior.exists():
  old=read(prior);data=dict(id=id,file=str(p),sha256=h,scope='既有原片ASR辅助定位，非听审；未改原片，当前SHA绑定',segments=old['segments']);dest.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
 else:
  if model is None:model=WhisperModel('small',device='cpu',compute_type='int8',local_files_only=True,cpu_threads=2)
  pcm=subprocess.run([FF,'-v','error','-i',str(p),'-f','f32le','-ac','1','-ar','16000','pipe:1'],capture_output=True,check=True).stdout
  segs,info=model.transcribe(np.frombuffer(pcm,dtype=np.float32),language='zh',beam_size=5,word_timestamps=True,vad_filter=True,condition_on_previous_text=False)
  data=dict(id=id,file=str(p),sha256=h,scope='ASR辅助定位，非听审、音色/无BGM通过',segments=[dict(start=s.start,end=s.end,text=s.text,words=[dict(start=w.start,end=w.end,word=w.word) for w in s.words or []]) for s in segs]);dest.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
 print(json.dumps(dict(id=id,expected=[l['text'] for l in c['sourceLines'] if l['spoken']],segments=[{k:s[k] for k in ['start','end','text']} for s in data['segments']]),ensure_ascii=False),flush=True)
