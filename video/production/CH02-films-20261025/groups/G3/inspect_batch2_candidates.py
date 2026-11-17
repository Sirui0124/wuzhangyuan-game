from pathlib import Path
import json,hashlib,subprocess,sys,re
import numpy as np
from faster_whisper import WhisperModel
O=Path(__file__).resolve().parent;R=O/'user-review-batch2';FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe';read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'));model=None
for id in sys.argv[1:] or ['V21','V22','V23','V24']:
 rec=read(R/(id+'-candidate.json'));p=Path(rec['file']);h=hashlib.sha256(p.read_bytes()).hexdigest();assert rec['sha256']==h;dest=R/(id+'-candidate-asr.json')
 if dest.exists() and read(dest)['sha256']==h:data=read(dest)
 else:
  if model is None:model=WhisperModel('small',device='cpu',compute_type='int8',local_files_only=True,cpu_threads=2)
  pcm=subprocess.run([FF,'-v','error','-i',str(p),'-f','f32le','-ac','1','-ar','16000','pipe:1'],capture_output=True,check=True).stdout
  segs,info=model.transcribe(np.frombuffer(pcm,dtype=np.float32),language='zh',beam_size=5,word_timestamps=True,vad_filter=True,condition_on_previous_text=False)
  rows=[dict(start=s.start,end=s.end,text=s.text,words=[dict(start=w.start,end=w.end,word=w.word) for w in s.words or []]) for s in segs];text=''.join(s['text'] for s in rows)
  data=dict(id=id,file=str(p),sha256=h,expected=[x['text'] for x in rec['spokenWhitelist']],segments=rows,possibleMetaMatches=re.findall('本请求|唯一原句|导演|画外|旁白|不拍执行|尚未实施的计划|字幕|口型|景别|镜头|画面|苟安自己',text),scope='ASR辅助核对白名单/定位；不是逐字听审、音色/声口/无BGM通过',userApproved=False);dest.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
 print(json.dumps(dict(id=id,segments=[{k:s[k] for k in ['start','end','text']} for s in data['segments']],possibleMetaMatches=data['possibleMetaMatches']),ensure_ascii=False),flush=True)
