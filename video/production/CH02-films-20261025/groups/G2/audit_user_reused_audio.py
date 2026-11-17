from pathlib import Path
import json,hashlib,re,difflib,subprocess,numpy as np
from faster_whisper import WhisperModel
O=Path(__file__).parent;R=O/'user-review-20261025';plan=json.loads((O/'plan.json').read_text(encoding='utf-8'));model=WhisperModel('small',device='cpu',compute_type='int8',cpu_threads=2,local_files_only=True)
rows=[]
for id in ['V13-02','V15-01','V16A-01','V16C-01']:
    c=next(c for c in plan['clips'] if c['id']==id);p=Path(c['voice']['path']);FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe';pcm=subprocess.run([FF,'-v','error','-i',str(p),'-f','f32le','-ar','16000','-ac','1','pipe:1'],capture_output=True,check=True).stdout;segs,info=model.transcribe(np.frombuffer(pcm,dtype=np.float32),language='zh',beam_size=5,vad_filter=True,condition_on_previous_text=False);parts=[dict(start=s.start,end=s.end,text=s.text) for s in segs];text=''.join(s['text'] for s in parts);norm=lambda t:re.sub(r'[^\u4e00-\u9fff]','',t);expected=c['sourceLines'][0]['text']
    rows.append(dict(id=id,node=c['sourceLines'][0]['node'],expected=expected,file=str(p),sha256=hashlib.sha256(p.read_bytes()).hexdigest(),recognized=text,similarity=difflib.SequenceMatcher(None,norm(expected),norm(text)).ratio(),segments=parts,source='existing fixed player TTS; no new synthesis',subjectiveListening=False,note='ASR辅助核对，不代表逐字听审或用户通过'))
    print(id,rows[-1]['similarity'],flush=True)
(R/'reused-audio-asr.json').write_text(json.dumps(dict(rows=rows,newTTSCalls=0),ensure_ascii=False,indent=2),encoding='utf-8')
