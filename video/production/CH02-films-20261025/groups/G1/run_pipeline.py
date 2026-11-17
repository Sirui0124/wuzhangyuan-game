"""G1 only: sequential batches, <=6 in flight, 120s per-task polling, no replay."""
from pathlib import Path
import importlib.util,json,sys,time,subprocess,urllib.request,hashlib,re,os,math
OUT=Path(__file__).resolve().parent; CENTRAL=OUT.parents[1]/'references'/'manifest.json'
spec=importlib.util.spec_from_file_location('shared_video_api',Path('C:/Users/zhousirui/Documents/ChatGPT/平行世界/tools/video_api.py'))
api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
_load_secret=api.load_secret;_secret_cache={}
def cached_secret(name):
    if name not in _secret_cache:_secret_cache[name]=_load_secret(name)
    return _secret_cache[name]
api.load_secret=cached_secret
FF=Path('C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe')
_transport_spec=importlib.util.spec_from_file_location('central_shard_transport',OUT.parents[1]/'scripts/cloudinary_shard_transport.py');shard=importlib.util.module_from_spec(_transport_spec);_transport_spec.loader.exec_module(shard)
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,d):api.atomic_json(p,d)
def event(**d):
    d['utc']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())
    with (OUT/'events.ndjson').open('a',encoding='utf-8') as f:f.write(json.dumps(d,ensure_ascii=False)+'\n')
    print(json.dumps(d,ensure_ascii=False),flush=True)
def central_ready(c):
    if not CENTRAL.exists():return False
    m=read(CENTRAL)
    # Only published/approved refs from the bindings are eligible.
    bindings=read(OUT/'reference-bindings.json')
    for k in c['referenceKeys']:
        b=bindings[k]
        if not b.get('ready'):return False
        p=Path(b['path'])
        if not p.is_file() or hashlib.sha256(p.read_bytes()).hexdigest()!=b['sha256']:raise RuntimeError('Reference bytes changed: '+k)
    return True
def metadata(p):
    r=subprocess.run([str(FF),'-hide_banner','-i',str(p)],capture_output=True,text=True,encoding='utf-8',errors='replace')
    dims=re.search(r'Video:.*? (\d{3,5})x(\d{3,5})',r.stderr);d=re.search(r'Duration: (\d+):(\d+):([\d.]+)',r.stderr)
    return dict(width=int(dims[1]),height=int(dims[2]),duration=int(d[1])*3600+int(d[2])*60+float(d[3]),hasAudio='Audio:' in r.stderr)
def ingest(c,state):
    cid=c['id'];raw=OUT/'generated'/f'{cid}-raw.mp4';raw.parent.mkdir(exist_ok=True)
    if not raw.exists():
        partial=raw.with_suffix('.partial');url=api.public_https(state['result_url'])
        with urllib.request.urlopen(url,timeout=120) as response,partial.open('wb') as f:
            while b:=response.read(1024*1024):f.write(b)
        partial.replace(raw)
    meta=metadata(raw);dest=OUT/'edited'/f'{cid}-normalized.mp4';dest.parent.mkdir(exist_ok=True)
    if not dest.exists():
        subprocess.run([str(FF),'-v','error','-y','-i',str(raw),'-vf','scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,setsar=1','-r','24','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-movflags','+faststart',str(dest)],check=True)
    r=subprocess.run([str(FF),'-v','error','-i',str(dest),'-f','null','NUL'],capture_output=True)
    if r.returncode:raise RuntimeError('decode failure '+cid)
    save(OUT/'generated'/f'{cid}-technical.json',dict(id=cid,task_id=state['task_id'],raw=str(raw),normalized=str(dest),input=meta,output=metadata(dest),sha256=hashlib.sha256(dest.read_bytes()).hexdigest(),decode='passed',treatment='Uniform 1280x720/24fps/48k; aspect-fill centered crop only, no temporal cuts',visualReview='pending',audioReview='未完成逐字听审',userReview='待review'))
    event(id=cid,status='downloaded-and-decoded')
def poll(c):
    p=OUT/'tasks'/f"{c['id']}.json";s=read(p)
    if not s.get('task_id'):return s
    if s.get('status') not in api.TERMINAL and time.time()-s.get('last_poll_epoch',s.get('submitted_epoch',0))>=120:
        s['last_poll_epoch']=time.time();save(p,s)
        try:s=api.poll_task(p,max_polls=1)
        except Exception as exc:
            s['query_error']='Local/query transient: '+type(exc).__name__
            event(id=c['id'],status='query-retry-pending',error=type(exc).__name__)
        s['last_poll_epoch']=time.time();save(p,s)
        event(id=c['id'],status=s['status'],progress=s.get('progress'))
    if s.get('status')=='succeeded' and not (OUT/'generated'/f"{c['id']}-technical.json").exists():
        try:ingest(c,s)
        except Exception as e:event(id=c['id'],status='download-retry-pending',error=type(e).__name__)
    return s
def submit(c):
    cid=c['id'];sp=OUT/'tasks'/f'{cid}.json'
    if sp.exists():return read(sp)
    if (OUT/'POST-PAUSED.json').exists():return None
    if not central_ready(c):return None
    local=OUT/'requests'/f'{cid}.local.json';request=OUT/'requests'/f'{cid}.json'
    if not request.exists():
        body,refs=api.prepare_request(read(local),local.parent);save(request,body);save(request.with_suffix('.references.json'),refs)
    config=read(OUT/'transport.json') if (OUT/'transport.json').exists() else {}
    if config.get('mode')=='res-1-cloudinary':
        body,refs=shard.promote(api,read(request),read(request.with_suffix('.references.json')))
        save(request,body);save(request.with_suffix('.references.json'),refs)
    # Decrypt before dispatching state exists. Never print or persist the value.
    cached_secret('openai-next-key.dpapi')
    original=api.poll_task
    # submit_request saves the task id before invoking poll. Suppress that immediate
    # invocation; first query is at least 120 seconds after acceptance.
    api.poll_task=lambda p:read(Path(p))
    try:s=api.submit_request(request,sp)
    finally:api.poll_task=original
    s['submitted_epoch']=time.time();s['last_poll_epoch']=s['submitted_epoch'];save(sp,s)
    event(id=cid,status=s['status'],task_id=s.get('task_id'));return s
def status(clips):
    states={c['id']:read(OUT/'tasks'/f"{c['id']}.json") for c in clips if (OUT/'tasks'/f"{c['id']}.json").exists()}
    save(OUT/'status.json',dict(group='G1',phase='generation',totalRequests=len(clips),submitted=len(states),succeeded=sum(s.get('status')=='succeeded' for s in states.values()),failed=sum(s.get('status')=='failed' for s in states.values()),inFlight=sum(s.get('status') not in api.TERMINAL and bool(s.get('task_id')) for s in states.values()),unknown=[k for k,s in states.items() if not s.get('task_id')],downloaded=len(list((OUT/'generated').glob('*-technical.json'))) if (OUT/'generated').exists() else 0,updatedEpoch=time.time()))
def main():
    plan=read(OUT/'plan.json');clips=plan['clips']
    if (OUT/'repair-plan.json').exists():clips=read(OUT/'repair-plan.json')['clips']+clips
    sel=set(sys.argv[2:]);clips=[c for c in clips if not sel or c['id'] in sel]
    mode=sys.argv[1]
    if mode=='poll':
        for c in clips:
            if (OUT/'tasks'/f"{c['id']}.json").exists():poll(c)
        status(clips);return
    if mode not in {'watch','submit'}:raise ValueError(mode)
    # A live owner prevents two controllers sharing the same group.
    lock=OUT/'pipeline.lock'
    if lock.exists():
        prior=read(lock);pid=prior['pid']
        ps=subprocess.run(['powershell','-NoProfile','-Command',f'Get-Process -Id {int(pid)} -ErrorAction SilentlyContinue'],capture_output=True)
        if ps.returncode==0:raise RuntimeError('G1 controller already live')
        lock.unlink()
    save(lock,dict(pid=os.getpid(),epoch=time.time()))
    try:
        while True:
            states={c['id']:poll(c) for c in clips if (OUT/'tasks'/f"{c['id']}.json").exists()}
            unknown=[k for k,s in states.items() if not s.get('task_id')]
            active=[s for s in states.values() if s.get('status') not in api.TERMINAL and s.get('task_id')]
            config=read(OUT/'transport.json') if (OUT/'transport.json').exists() else {}
            acknowledged=set(config.get('acknowledgedFailures',[]))
            failed=[s for cid,s in states.items() if s.get('status')=='failed' and cid not in acknowledged]
            missing=[c for c in clips if c['id'] not in states]
            if len(active)<=1 and missing and not unknown and len(failed)<3:
                size=5 if active else 6
                # Leave a minimum five for subsequent batches whenever possible.
                if not active and len(missing)>6 and len(missing)-6<5*(math.ceil(len(missing)/6)-1):size=5
                batch=missing[:size];event(status='batch-start',ids=[c['id'] for c in batch])
                for c in batch:
                    try:
                        if submit(c) is None:break
                    except Exception as e:
                        event(id=c['id'],status='submit-stopped',error=type(e).__name__);break
            status(clips)
            if mode=='submit':break
            if unknown:raise RuntimeError('Unknown submission outcome; no automatic resubmission')
            if len(failed)>=3:raise RuntimeError('Service failure threshold; inspect before further spend')
            current=[read(OUT/'tasks'/f"{c['id']}.json") for c in clips if (OUT/'tasks'/f"{c['id']}.json").exists()]
            if len(current)==len(clips) and all(s.get('status') in api.TERMINAL for s in current) and all(s.get('status')!='succeeded' or (OUT/'generated'/f"{c['id']}-technical.json").exists() for c,s in zip(clips,current)):break
            time.sleep(10)
    finally:lock.unlink(missing_ok=True)
if __name__=='__main__':main()
