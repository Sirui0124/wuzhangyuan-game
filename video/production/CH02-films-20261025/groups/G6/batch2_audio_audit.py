"""Freeze current G6 versions and locate speech; ASR is not listening approval."""
from pathlib import Path
import hashlib,json,subprocess,sys,datetime
import numpy as np
from faster_whisper import WhisperModel
ROOT=Path(__file__).resolve().parent
OUT=ROOT/'user-review-batch2'
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
OUT.mkdir(exist_ok=True)
def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def save(p,v): p.write_text(json.dumps(v,ensure_ascii=False,indent=2),encoding='utf-8')
baseline=OUT/'baseline-delivery.json'
if not baseline.exists(): baseline.write_bytes((ROOT/'delivery.json').read_bytes())
delivery=json.loads(baseline.read_text(encoding='utf-8'))
assignment=json.loads((ROOT/'assignment.json').read_text(encoding='utf-8'))
actions={'CH2-LY12A-004','CH2-LY12A-007','CH2-LY12A-010','CH2-E5-001'}
whitelist=[]
for c in assignment['clips']:
    for l in c['lines']:
        role='action' if l['node'] in actions else 'gouan' if l['speaker']=='苟安' else 'clerk' if '军吏' in l['speaker'] else 'player'
        whitelist.append(dict(clip=c['id'],node=l['node'],role=role,text=l['text'],spoken=role!='action',voiceAndLipOwner=l['voiceAndLipOwner']))
save(OUT/'speech-whitelist.json',whitelist)
report=ROOT/'user-review-batch2.json'
if not report.exists():
    save(report,dict(group='G6',policy='20261025-batch2-clean-speech-and-duration',status='audit-in-progress',audioListening='pending; ASR only locates words',userApproved=False,films=[dict(id=f['id'],oldPath=f['path'],oldSHA=f['sha256'],oldDuration=f['duration'],whitelist=[x for x in whitelist if x['clip']==f['id']],status='pending-audit') for f in delivery['films']]))
selected=set(sys.argv[1:]); model=None
for f in delivery['films']:
    if selected and f['id'] not in selected: continue
    p=Path(f['path']); actual=sha(p)
    if actual!=f['sha256']: raise ValueError(f"baseline SHA changed: {f['id']}")
    dest=OUT/(f['id']+'-baseline-asr.json')
    if dest.exists():
        data=json.loads(dest.read_text(encoding='utf-8'))
        if data['sha256']!=actual: raise ValueError('stale ASR')
    else:
        if model is None: model=WhisperModel('small',device='cpu',compute_type='int8',local_files_only=True,cpu_threads=4)
        pcm=subprocess.run([FF,'-v','error','-i',str(p),'-f','f32le','-ac','1','-ar','16000','pipe:1'],capture_output=True,check=True).stdout
        segs,info=model.transcribe(np.frombuffer(pcm,dtype=np.float32),language='zh',beam_size=5,word_timestamps=True,vad_filter=True)
        data=dict(id=f['id'],path=str(p),sha256=actual,review='ASR locator only; no hearing/timbre/music approval',segments=[dict(start=s.start,end=s.end,text=s.text,words=[dict(start=w.start,end=w.end,word=w.word) for w in s.words or []]) for s in segs])
        save(dest,data)
    print(json.dumps(dict(id=f['id'],sha256=actual,segments=[{k:s[k] for k in ['start','end','text']} for s in data['segments']]),ensure_ascii=False),flush=True)
