from user_repair import *
from faster_whisper import WhisperModel
import numpy as np
model=WhisperModel('small',device='cpu',compute_type='int8',local_files_only=True,cpu_threads=2)
for node in ['CH2-LY02-007','CH2-LY03-021','CH2-LY03-012','CH2-LY03-013','CH2-LY03-015','CH2-LY03-017','CH2-LY02-022','CH2-LY02-027']:
 s=rd(D/f'{node}-seed-audio1-state.json');p=Path(s['file']);dest=D/'inspection'/f'{node}-seed-audio1-content.json'
 if dest.exists():continue
 raw=run(['-i',p,'-f','f32le','-ac','1','-ar','16000','pipe:1']).stdout;wave=np.frombuffer(raw,dtype=np.float32)
 segs,info=model.transcribe(wave,language='zh',beam_size=5,word_timestamps=True,condition_on_previous_text=False)
 rows=[dict(start=z.start,end=z.end,text=z.text) for z in segs]
 out=dict(node=node,file=str(p),sha256=sha(p),expectedText=s['text'],providerSubtitle=s.get('subtitle'),rms=float(np.sqrt(np.mean(wave*wave))),peak=float(np.max(np.abs(wave))),segments=rows,listeningReview='not completed; ASR/PCM are technical checks only')
 save(dest,out);print(json.dumps(out,ensure_ascii=False),flush=True)
