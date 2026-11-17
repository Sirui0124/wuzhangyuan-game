from pathlib import Path
import json,wave,numpy as np
from faster_whisper import WhisperModel
OUT=Path(__file__).parent
model=WhisperModel('small',device='cpu',compute_type='int8',cpu_threads=6,local_files_only=True)
for item in json.loads((OUT/'inventory.json').read_text(encoding='utf-8')):
 p=OUT/'audit'/f'{item["index"]:02d}-{item["id"]}-asr.json'
 if p.exists():continue
 with wave.open(str(OUT/item['audio']),'rb') as wav:audio=np.frombuffer(wav.readframes(wav.getnframes()),dtype=np.int16).astype(np.float32)/32768
 segments,info=model.transcribe(audio,language='zh',beam_size=4,word_timestamps=True,vad_filter=True,condition_on_previous_text=False)
 data=[{'start':s.start,'end':s.end,'text':s.text,'words':[{'start':w.start,'end':w.end,'word':w.word} for w in s.words or []]} for s in segments]
 p.write_text(json.dumps({'segments':data,'note':'自动识别仅辅助定位，不作为逐字听审或角色口型通过结论'},ensure_ascii=False,indent=2),encoding='utf-8')
 print(item['index'],item['id'],' | '.join(x['text'] for x in data),flush=True)
