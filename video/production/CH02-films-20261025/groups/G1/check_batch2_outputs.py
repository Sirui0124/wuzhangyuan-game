from user_repair import *
from faster_whisper import WhisperModel
import numpy as np
model=WhisperModel('small',device='cpu',compute_type='int8',local_files_only=True,cpu_threads=2)
for sid in sys.argv[1:]:
 a=rd(D/f'{sid}-batch2-timeline.json');p=Path(a['file']);dest=D/'inspection'/f'{sid}-batch2-final-asr.json'
 if dest.exists() and rd(dest).get('sha256')==sha(p):continue
 wave=np.frombuffer(run(['-i',p,'-f','f32le','-ac','1','-ar','16000','pipe:1']).stdout,dtype=np.float32)
 segs,info=model.transcribe(wave,language='zh',beam_size=5,word_timestamps=True,condition_on_previous_text=False)
 rows=[dict(start=z.start,end=z.end,text=z.text,words=[dict(start=w.start,end=w.end,word=w.word) for w in (z.words or [])]) for z in segs]
 save(dest,dict(id=sid,file=str(p),sha256=sha(p),segments=rows,verification='ASR locator only; actual listening/noBGM/naturalness/lips not approved'))
 print(json.dumps(dict(id=sid,segments=[{k:v for k,v in x.items() if k!='words'} for x in rows]),ensure_ascii=False),flush=True)
