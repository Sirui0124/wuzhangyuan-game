from pathlib import Path
import json,subprocess,wave,sys
import numpy as np
from faster_whisper import WhisperModel
R=Path(__file__).resolve().parent
M=Path(r'D:/AI视频/VJ-1106/motion-runtime/audio-analysis-env/models/models--Systran--faster-whisper-base/snapshots/ebe41f70d5b6dfa9166e2c581c45c9c0cfc57b66')
m=WhisperModel(str(M),device='cpu',compute_type='int8',cpu_threads=6)
source=Path(sys.argv[1]) if len(sys.argv)>1 else R/'asr-input.wav'
raw=subprocess.check_output([r'D:/AI视频/VJ-1106/motion-runtime/node_modules/ffmpeg-static/ffmpeg.exe','-v','error','-i',str(source),'-f','f32le','-ac','1','-ar','16000','pipe:1'])
audio=np.frombuffer(raw,dtype='<f4').copy()
segments,info=m.transcribe(audio,language='zh',beam_size=5,vad_filter=True,condition_on_previous_text=False)
rows=[]
for s in segments:
 row={'in':s.start,'out':s.end,'text':s.text,'no_speech_probability':s.no_speech_prob,'log_probability':s.avg_logprob};rows.append(row);print(json.dumps(row,ensure_ascii=False),flush=True)
(source.with_suffix('.ASR-unverified.json')).write_text(json.dumps({'notice':'机器转写用于定位可能的人声，可能幻听；不是逐字听审，不作为字幕或批准依据。未向ASR喂入原剧本。','source':str(source),'segments':rows},ensure_ascii=False,indent=2),'utf-8')
