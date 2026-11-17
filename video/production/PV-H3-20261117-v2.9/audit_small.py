from pathlib import Path
import json,subprocess,sys,hashlib
import numpy as np
from faster_whisper import WhisperModel
R=Path(__file__).resolve().parent
cache=R.parents[2]/'tmp/pv-audio-models'
M=next(cache.glob('models--Systran--faster-whisper-small/snapshots/*'))
m=WhisperModel(str(M),device='cpu',compute_type='int8',cpu_threads=6)
FF=r'D:/AI视频/VJ-1106/motion-runtime/node_modules/ffmpeg-static/ffmpeg.exe'
for id in sys.argv[1:]:
 d=R/id;src=d if d.is_file() else d/'source.mp4';out=d.with_suffix('.asr.json') if d.is_file() else d/'audio-small-unverified.json'
 sha=hashlib.sha256(src.read_bytes()).hexdigest()
 if out.exists() and json.loads(out.read_text('utf-8')).get('source_sha256')==sha:continue
 raw=subprocess.check_output([FF,'-v','error','-i',str(src),'-vn','-f','f32le','-ar','16000','-ac','1','pipe:1'])
 seg,info=m.transcribe(np.frombuffer(raw,'<f4').copy(),language='zh',beam_size=5,vad_filter=True,condition_on_previous_text=False,word_timestamps=True)
 rows=[{'in':s.start,'out':s.end,'text':s.text,'words':[{'word':w.word,'in':w.start,'out':w.end,'p':w.probability} for w in s.words]} for s in seg]
 out.write_text(json.dumps({'source_sha256':sha,'method':'faster-whisper-small, zh, no script prompt, word timestamps; locator only','segments':rows},ensure_ascii=False,indent=2),'utf-8')
 print(json.dumps({'id':id,'segments':rows},ensure_ascii=False),flush=True)


