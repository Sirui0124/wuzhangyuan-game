from pathlib import Path
import os,json
os.environ['HF_HUB_OFFLINE']='1';os.environ['TRANSFORMERS_OFFLINE']='1'
import mlx_whisper
O=Path(__file__).parent;E=O/'evidence';M=Path(os.environ['WHISPER_MODEL_DIR'])
for key in ['PR01','LI01','LI02A','LI02B','SC01B','EN04']:
 p=E/f'{key}-source.wav'
 if not p.exists():continue
 r=mlx_whisper.transcribe(str(p),path_or_hf_repo=str(M),language='zh',word_timestamps=True,verbose=False,condition_on_previous_text=False)
 (E/f'{key}-transcript.json').write_text(json.dumps(r,ensure_ascii=False,indent=2));print(key,[(s['start'],s['end'],s['text']) for s in r['segments']],flush=True)
