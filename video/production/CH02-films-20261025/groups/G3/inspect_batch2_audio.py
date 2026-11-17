from pathlib import Path
import json,hashlib,subprocess,urllib.parse,sys
import numpy as np
from faster_whisper import WhisperModel
O=Path(__file__).resolve().parent;B=O.parents[1];R=O/'user-review-batch2';R.mkdir(exist_ok=True);FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,x):p.write_text(json.dumps(x,ensure_ascii=False,indent=2),encoding='utf-8')
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
source=B/'reviews/user-20261025-batch2/comments-and-versions.json';rows=[x for x in read(source)['rows'] if x['id'] in ['V21','V22','V23','V24','V25']];D=read(O/'delivery.json');P=read(O/'plan.json')
if not (R/'delivery-before-batch2.json').exists():save(R/'delivery-before-batch2.json',D)
snapshot=[]
for x in rows:
 relative=urllib.parse.unquote(x['video'].split('?')[0].lstrip('/'));p=B/relative;v=next(v for v in D['logicalClips'] if v['id']==x['id']);assert p.resolve()==Path(v['path']).resolve()
 expected=int(urllib.parse.parse_qs(urllib.parse.urlsplit(x['video']).query)['v'][0]);assert p.stat().st_mtime_ns==expected,(x['id'],'reviewed version changed')
 snapshot.append(dict(x,file=str(p),sha256=sha(p),duration=v['duration'],mtimeNs=p.stat().st_mtime_ns,whitelist=[dict(node=l['node'],speaker=l['speaker'],text=l['text'],voiceMode=l['voiceMode']) for c in P['clips'] if c['logicalId']==x['id'] for l in c['sourceLines'] if l['spoken']]))
save(R/'reviewed-version-snapshot.json',dict(source=str(source),sourceSha256=sha(source),clips=snapshot))
model=None;chosen=set(sys.argv[1:])
for x in snapshot:
 id=x['id']
 if chosen and id not in chosen:continue
 dest=R/(id+'-old-asr.json')
 if dest.exists() and read(dest)['sha256']==x['sha256']:data=read(dest)
 else:
  if model is None:model=WhisperModel('small',device='cpu',compute_type='int8',local_files_only=True,cpu_threads=2)
  pcm=subprocess.run([FF,'-v','error','-i',x['file'],'-f','f32le','-ac','1','-ar','16000','pipe:1'],capture_output=True,check=True).stdout
  segs,info=model.transcribe(np.frombuffer(pcm,dtype=np.float32),language='zh',beam_size=5,word_timestamps=True,vad_filter=True,condition_on_previous_text=False)
  data=dict(id=id,file=x['file'],sha256=x['sha256'],scope='ASR辅助定位，不是实际听审、说话人/音色/无BGM通过',segments=[dict(start=s.start,end=s.end,text=s.text,words=[dict(start=w.start,end=w.end,word=w.word) for w in s.words or []]) for s in segs]);save(dest,data)
 print(json.dumps(dict(id=id,segments=[{k:s[k] for k in ['start','end','text']} for s in data['segments']]),ensure_ascii=False),flush=True)
