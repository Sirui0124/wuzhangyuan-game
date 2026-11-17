"""Independent audio localization; never uses the desired script as an ASR prompt."""
from pathlib import Path
import json,subprocess,hashlib,sys
import numpy as np
from faster_whisper import WhisperModel
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'outputs/ch2-video-update-20261027'
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
model=WhisperModel('small',device='cpu',compute_type='int8',local_files_only=True,cpu_threads=3)
for key in sys.argv[1:]:
    row=json.loads((OUT/(key+'-review.json')).read_text(encoding='utf-8'))
    target=OUT/(key+'-second-pass.json')
    if target.exists():continue
    ranges={'03':[(0,4.8),(0,7),(6,13.04)],'C05C':[(0,6)],'C05R':[(0,9),(23,24.04)],'C06':[(0,8),(21,26.04)],'C09':[(0,10)]}.get(key,[(0,row['duration'])])
    result=[]
    for a,b in ranges:
        raw=subprocess.run([FF,'-v','error','-ss',str(a),'-i',row['source'],'-t',str(b-a),'-vn','-ac','1','-ar','16000','-f','f32le','pipe:1'],capture_output=True,check=True).stdout
        ss,_=model.transcribe(np.frombuffer(raw,dtype=np.float32),language='zh',beam_size=5,word_timestamps=True,vad_filter=False,condition_on_previous_text=False,no_speech_threshold=None)
        segs=[dict(start=a+s.start,end=a+s.end,text=s.text,words=[dict(start=a+w.start,end=a+w.end,word=w.word) for w in s.words or []]) for s in ss]
        result+=segs
        print(json.dumps(dict(id=key,range=[a,b],segments=segs),ensure_ascii=False),flush=True)
    target.write_text(json.dumps(dict(id=key,sha256=row['sha256'],segments=result,method='local whisper-small, independent cropped audio, no script prompt',humanListeningReview=False),ensure_ascii=False,indent=2),encoding='utf-8')
