"""G3 only: persisted, bounded dispatch and >=120-second task polling."""
from pathlib import Path
import importlib.util,json,sys,time,subprocess,urllib.request,hashlib,re,os
OUT=Path(__file__).resolve().parent; BASE=OUT.parents[1]
sp=importlib.util.spec_from_file_location('shared_video_api','C:/Users/zhousirui/Documents/ChatGPT/平行世界/tools/video_api.py')
api=importlib.util.module_from_spec(sp);sp.loader.exec_module(api)
transport_spec=importlib.util.spec_from_file_location('g3_shard_transport',BASE/'scripts/cloudinary_shard_transport.py')
transport=importlib.util.module_from_spec(transport_spec);transport_spec.loader.exec_module(transport)
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,d):api.atomic_json(p,d)
def stamp():return time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())
def ready(c):
 p=BASE/'references/manifest.json'
 if not p.exists():return False
 m=read(p)
 if not (m.get('ready') is True or m.get('status')=='ready'):
  # subset readiness must be explicitly recorded by bind_references.py
  b=OUT/'reference-bindings.json'
  if not b.exists():return False
  binds=read(b)
  if not all(binds.get(k,{}).get('ready') is True for k in c['referenceKeys']):return False
 return (OUT/'requests'/f"{c['id']}.local.json").exists()
def ingest(c,s):
 id=c['id']; raw=OUT/'generated'/f'{id}-raw.mp4'; report=OUT/'generated'/f'{id}-technical.json'
 if report.exists():return
 if not raw.exists():
  part=raw.with_suffix('.mp4.part')
  with urllib.request.urlopen(s['result_url'],timeout=120) as r,part.open('wb') as f:
   while b:=r.read(1024*1024):f.write(b)
  part.replace(raw)
 meta=subprocess.run([FF,'-hide_banner','-i',str(raw)],capture_output=True,text=True,encoding='utf-8',errors='replace').stderr
 dim=re.search(r'Video:.*? (\d{3,5})x(\d{3,5})',meta)
 dur=re.search(r'Duration: (\d+):(\d+):([\d.]+)',meta)
 if not dim or not dur:raise RuntimeError('missing valid video metadata')
 w,h=map(int,dim.groups());duration=int(dur[1])*3600+int(dur[2])*60+float(dur[3])
 audio=bool(re.search(r'Audio:',meta))
 unit=min(w//16,h//9)//2*2;cw,ch=unit*16,unit*9
 if max((w-cw)/w,(h-ch)/h)>.025:raise RuntimeError(f'unexpected aspect {w}x{h}; crop exceeds reviewed 2.5% boundary')
 crop=[(w-cw)//2,(h-ch)//2,cw,ch]
 # use true 16:9 even dimensions for all delivered clips
 fixed=OUT/'edited'/f'{id}-16x9.mp4'
 if not fixed.exists():
  subprocess.run([FF,'-v','error','-y','-i',str(raw),'-vf',f'crop={cw}:{ch}:{crop[0]}:{crop[1]},scale=1280:720,setsar=1','-r','24','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-movflags','+faststart',str(fixed)],check=True)
 decoded=subprocess.run([FF,'-v','error','-i',str(fixed),'-f','null','NUL'],capture_output=True)
 if decoded.returncode:raise RuntimeError('decode failed')
 # Dense sequence for visual screening; does not constitute listening approval.
 n=max(1,round(duration*3));rows=(n+4)//5
 quick=OUT/'review'/f'{id}-3fps.jpg'
 subprocess.run([FF,'-v','error','-y','-i',str(fixed),'-vf',f'fps=3,scale=320:-1,tile=5x{rows}:padding=3:margin=3','-frames:v','1',str(quick)],check=True)
 save(report,dict(id=id,task_id=s['task_id'],raw=str(raw),file=str(fixed),duration=duration,size=[w,h],crop=crop,outputSize=[1280,720],audioTrack=audio,decode='passed',sha256=hashlib.sha256(fixed.read_bytes()).hexdigest(),visualReview='pending',audioReview='未逐字听审',quicklook=str(quick),normalizedOnly=True))
 print(json.dumps(dict(id=id,status='downloaded',duration=duration,size=[w,h],audioTrack=audio),ensure_ascii=False),flush=True)
def tick(allow_submit=True):
 if (OUT/'pause-dispatch.flag').exists():allow_submit=False
 plan=read(OUT/'plan.json');queue=plan.get('revisions',[])+plan['clips'];inflight=[];unknown=[];failed=[];all_failed=[]
 replacements={c['revisionOf']:c['id'] for c in plan.get('revisions',[])}
 for c in queue:
  p=OUT/'tasks'/f"{c['id']}.json"
  if not p.exists():continue
  s=read(p)
  if not s.get('task_id'):unknown.append(c['id']);continue
  if s.get('status') not in api.TERMINAL:
   if time.time()-s.get('last_query_epoch',s.get('submitted_epoch',p.stat().st_mtime))>=120:
    s=api.poll_task(p,max_polls=1);s['last_query_epoch']=time.time();save(p,s)
   if s.get('status') not in api.TERMINAL:inflight.append(c['id'])
  if s.get('status')=='succeeded':
   try:ingest(c,s)
   except Exception as e:print(json.dumps(dict(id=c['id'],ingestError=type(e).__name__+': '+str(e)),ensure_ascii=False),flush=True)
  elif s.get('status') in api.TERMINAL:
   all_failed.append(c['id'])
   if c['id'] not in replacements:failed.append(c['id'])
 submitted=[]
 # Stop paid dispatch on any uncertain result or systemic failures; retries are explicit revisions only.
 if allow_submit and not unknown and len(failed)<2:
  for c in queue:
   if (OUT/'pause-dispatch.flag').exists():break
   allow_file=OUT/'dispatch-allowlist.json'
   if allow_file.exists() and c['id'] not in read(allow_file):continue
   if len(inflight)>=6:break
   id=c['id'];p=OUT/'tasks'/f'{id}.json'
   if p.exists() or not ready(c):continue
   local=OUT/'requests'/f'{id}.local.json';request=OUT/'requests'/f'{id}.json'
   try:
    if not request.exists():
     body,refs=api.prepare_request(read(local),local.parent)
     body,refs=transport.promote(api,body,refs)
     save(request,body);save(request.with_suffix('.references.json'),refs)
    else:
     # Reuse only an unsubmitted prepared body; accepted/uncertain states were skipped above.
     body,refs=transport.promote(api,read(request),read(request.with_suffix('.references.json')))
     save(request,body);save(request.with_suffix('.references.json'),refs)
    # api.submit_request normally polls immediately at 30s. Override only that continuation.
    original=api.poll_task;api.poll_task=lambda path:read(Path(path))
    try:s=api.submit_request(request,p)
    finally:api.poll_task=original
    s.update(submitted_epoch=time.time(),last_query_epoch=time.time(),submitted_utc=stamp());save(p,s)
    inflight.append(id);submitted.append(id)
    print(json.dumps(dict(id=id,status=s.get('status'),task_id=s.get('task_id')),ensure_ascii=False),flush=True)
   except Exception as e:
    print(json.dumps(dict(id=id,error=type(e).__name__+': '+str(e)),ensure_ascii=False),flush=True)
    if p.exists() and not read(p).get('task_id'):unknown.append(id);break
 status=dict(group='G3',updated_utc=stamp(),status='generating' if inflight else 'awaiting-reference-or-review',newPostGate='closed-by-controller' if (OUT/'pause-dispatch.flag').exists() else 'open',planned=len(plan['clips']),revisions=len(plan.get('revisions',[])),inflight=inflight,submittedThisTick=submitted,unknownOutcome=unknown,failed=failed,historicalFailed=all_failed,downloaded=[p.stem.removesuffix('-technical') for p in (OUT/'generated').glob('*-technical.json')],notSubmitted=[c['id'] for c in queue if not (OUT/'tasks'/f"{c['id']}.json").exists()],pollIntervalSeconds=120)
 save(OUT/'status.json',status);print(json.dumps(status,ensure_ascii=False),flush=True)
 return status
if __name__=='__main__':
 mode=sys.argv[1] if len(sys.argv)>1 else 'tick'
 if mode=='watch':
  lock=OUT/'pipeline.lock'
  try:
   fd=os.open(lock,os.O_CREAT|os.O_EXCL|os.O_WRONLY);os.write(fd,str(os.getpid()).encode());os.close(fd)
  except FileExistsError:raise SystemExit('Pipeline lock exists; verify PID before restarting')
  try:
   while True:
    s=tick()
    if (OUT/'stop-after-tick.flag').exists():break
    if s['unknownOutcome'] or len(s['failed'])>=2:break
    if not s['notSubmitted'] and not s['inflight']:break
    time.sleep(30)
  finally:lock.unlink(missing_ok=True)
 else:tick(mode!='poll')
