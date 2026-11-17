from pathlib import Path
import json,hashlib,subprocess,re,wave
import numpy as np
from faster_whisper import WhisperModel
O=Path(__file__).resolve().parent;R=O/'user-review-batch2/audio';read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'));FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe';model=None
for state in R.glob('*-state.json'):
 x=read(state)
 if x['status']!='succeeded':continue
 dest=R/(x['id']+'-asr.json')
 if dest.exists() and read(dest)['sha256']==x['sha256']:data=read(dest)
 else:
  if model is None:model=WhisperModel('small',device='cpu',compute_type='int8',local_files_only=True,cpu_threads=2)
  assert hashlib.sha256(Path(x['file']).read_bytes()).hexdigest()==x['sha256'];pcm=subprocess.run([FF,'-v','error','-i',x['file'],'-f','f32le','-ac','1','-ar','16000','pipe:1'],capture_output=True,check=True).stdout
  segs,info=model.transcribe(np.frombuffer(pcm,dtype=np.float32),language='zh',beam_size=5,word_timestamps=True,vad_filter=True,condition_on_previous_text=False)
  data=dict(id=x['id'],file=x['file'],sha256=x['sha256'],expected=x['text'],providerSubtitle=x.get('subtitle'),model=x['model'],referenceUploaded=x.get('referenceUploaded'),segments=[dict(start=s.start,end=s.end,text=s.text,words=[dict(start=w.start,end=w.end,word=w.word) for w in s.words or []]) for s in segs],listeningReview='pending; provider subtitles and independent ASR do not establish timbre, no-BGM or user approval')
  dest.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
 print(json.dumps(dict(id=x['id'],expected=x['text'],asr=[dict(start=s['start'],end=s['end'],text=s['text']) for s in data['segments']]),ensure_ascii=False),flush=True)
