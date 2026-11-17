"""ASR is evidence for locating speech, never a claim of listening approval."""
from pathlib import Path
import json,subprocess,sys,difflib,re
import numpy as np
from faster_whisper import WhisperModel
OUT=Path(__file__).resolve().parent
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
P=json.loads((OUT/'plan.json').read_text(encoding='utf-8'));model=None
ids=set(sys.argv[1:])
for c in P['clips']:
 if ids and c['id'] not in ids:continue
 p=OUT/'generated'/f"{c['id']}-raw.mp4";dest=OUT/'review'/f"{c['id']}-asr.json"
 if not p.exists():continue
 if not dest.exists():
  if model is None:model=WhisperModel('small',device='cpu',compute_type='int8',local_files_only=True,cpu_threads=2)
  pcm=subprocess.run([FF,'-v','error','-i',str(p),'-f','f32le','-ac','1','-ar','16000','pipe:1'],capture_output=True,check=True).stdout
  segs,info=model.transcribe(np.frombuffer(pcm,dtype=np.float32),language='zh',beam_size=5,word_timestamps=True,vad_filter=True)
  data=[dict(start=s.start,end=s.end,text=s.text,words=[dict(start=w.start,end=w.end,word=w.word) for w in s.words or []]) for s in segs]
  original=''.join(l['text'] for l in c['sourceLines'] if l['spoken'] and not c.get('postVoiceOnly'))
  got=''.join(s['text'] for s in data)
  norm=lambda t:re.sub(r'[^\u4e00-\u9fff0-9]','',t)
  value=dict(id=c['id'],original=original,recognized=got,segments=data,ratio=difflib.SequenceMatcher(None,norm(original),norm(got)).ratio(),unexpectedSpeech=bool(not original and len(norm(got))>2),scope='ASR定位；非逐字听审、非说话人或BGM通过结论')
  dest.write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf-8')
 else:value=json.loads(dest.read_text(encoding='utf-8'))
 print(json.dumps({k:value[k] for k in ['id','original','recognized','ratio','unexpectedSpeech']},ensure_ascii=False),flush=True)
