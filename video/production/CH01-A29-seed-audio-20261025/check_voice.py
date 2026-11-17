from pathlib import Path
import subprocess,json,numpy as np,wave
from faster_whisper import WhisperModel
O=Path('video/production/CH01-A29-seed-audio-20261025');F='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
p=O/'A-29-player-seed-audio-v1.wav';b=subprocess.check_output([F,'-v','error','-i',str(p),'-ac','1','-ar','16000','-f','f32le','pipe:1']);a=np.frombuffer(b,dtype=np.float32)
m=WhisperModel('small',device='cpu',compute_type='int8',local_files_only=True,cpu_threads=4)
s,info=m.transcribe(a,language='zh',beam_size=5,word_timestamps=True,vad_filter=True,condition_on_previous_text=False)
r=[{'start':v.start,'end':v.end,'text':v.text,'words':[{'start':w.start,'end':w.end,'word':w.word} for w in v.words or []]} for v in s]
(O/'new-voice-asr.json').write_text(json.dumps({'segments':r,'note':'ASR辅助核对，非实际听审或用户通过'},ensure_ascii=False,indent=2),encoding='utf8');print(json.dumps(r,ensure_ascii=False))
