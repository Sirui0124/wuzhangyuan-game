from pathlib import Path
import json,hashlib,subprocess,sys
import numpy as np
from faster_whisper import WhisperModel
ROOT=Path(__file__).resolve().parent;OUT=ROOT/'user-review-batch2'
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
manifest=OUT/(sys.argv[1] if len(sys.argv)>1 else 'original-voice-probes.json')
rows=[json.loads(p.read_text(encoding='utf-8')) for p in sorted(OUT.glob('V*-candidate.json'))] if len(sys.argv)>1 and sys.argv[1]=='--candidates' else json.loads(manifest.read_text(encoding='utf-8'))
model=None
for r in rows:
    p=Path(r['path']);h=hashlib.sha256(p.read_bytes()).hexdigest();assert h==r['sha256']
    dest=OUT/(p.stem+'-asr.json')
    if dest.exists():data=json.loads(dest.read_text(encoding='utf-8'));assert data['sha256']==h
    else:
        if model is None:model=WhisperModel('small',device='cpu',compute_type='int8',local_files_only=True,cpu_threads=2)
        pcm=subprocess.run([FF,'-v','error','-i',str(p),'-f','f32le','-ac','1','-ar','16000','pipe:1'],capture_output=True,check=True).stdout
        segs,info=model.transcribe(np.frombuffer(pcm,dtype=np.float32),language='zh',beam_size=5,word_timestamps=True,vad_filter=True)
        data=dict(path=str(p),sha256=h,segments=[dict(start=s.start,end=s.end,text=s.text,words=[dict(start=w.start,end=w.end,word=w.word) for w in s.words or []]) for s in segs],review='ASR only; actual listening/timbre/music review pending')
        dest.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(dict(id=r.get('node',r.get('id')),segments=[{k:s[k] for k in ['start','end','text']} for s in data['segments']]),ensure_ascii=False),flush=True)
