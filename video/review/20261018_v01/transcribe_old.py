import os,json
from pathlib import Path
os.environ['HF_HUB_OFFLINE']='1'
import mlx_whisper
E=Path(__file__).parent/'evidence';M=Path(os.environ['WHISPER_MODEL_DIR'])
r=mlx_whisper.transcribe(str(E/'OLDEN03-source.wav'),path_or_hf_repo=str(M),language='zh',word_timestamps=True,verbose=False,condition_on_previous_text=False)
(E/'OLDEN03-transcript.json').write_text(json.dumps(r,ensure_ascii=False,indent=2));print([(s['start'],s['end'],s['text']) for s in r['segments']])
