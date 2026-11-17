"""ASR is a locator only, never actual listening/user approval."""
from user_repair import *
import numpy as np
from faster_whisper import WhisperModel
model=WhisperModel('small',device='cpu',compute_type='int8',local_files_only=True,cpu_threads=2)
sources={sid:snapshot[sid]['file'] for sid in ['V04','V08B','V10','V11N','V12']}
sources['LI02A']=str(B.parents[1]/'current/LI02A-granary-20261018.mp4') if False else str(O.parents[3]/'current/LI02A-granary-20261018.mp4')
sources['LI02A']=str(Path('C:/Users/zhousirui/Documents/ChatGPT/逆转五丈原/video/current/LI02A-granary-20261018.mp4'))
for sid,p in sources.items():
 dest=D/'inspection'/f'{sid}-asr.json';dest.parent.mkdir(exist_ok=True)
 if dest.exists():continue
 raw=run(['-i',p,'-f','f32le','-ac','1','-ar','16000','pipe:1']).stdout
 segs,info=model.transcribe(np.frombuffer(raw,dtype=np.float32),language='zh',beam_size=5,word_timestamps=True,condition_on_previous_text=False)
 rows=[dict(start=s.start,end=s.end,text=s.text,words=[dict(start=w.start,end=w.end,word=w.word) for w in (s.words or [])]) for s in segs];save(dest,dict(file=p,sha256=sha(p),method='ASR locator only; not listening review',segments=rows));print(json.dumps(dict(id=sid,segments=[dict(start=s['start'],end=s['end'],text=s['text']) for s in rows]),ensure_ascii=False),flush=True)
