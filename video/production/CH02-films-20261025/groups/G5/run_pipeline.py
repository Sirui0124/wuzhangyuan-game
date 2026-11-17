"""G5 only. Durable state, no unknown-outcome resubmission, >=120 sec polling."""
from pathlib import Path
import importlib.util,json,sys,time,subprocess,urllib.request,hashlib,re,os
OUT=Path(__file__).parent
spec=importlib.util.spec_from_file_location('shared_video_api',Path('C:/Users/zhousirui/Documents/ChatGPT/平行世界/tools/video_api.py'))
api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
_secret_cache={}
_dpapi_load=api.load_secret
def cached_secret(name):
    if name not in _secret_cache:_secret_cache[name]=_dpapi_load(name)
    return _secret_cache[name]
api.load_secret=cached_secret
transport_spec=importlib.util.spec_from_file_location('g5_shard_transport',OUT.parents[1]/'scripts/cloudinary_shard_transport.py')
transport=importlib.util.module_from_spec(transport_spec);transport_spec.loader.exec_module(transport)
FF=Path('C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe')
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,x):api.atomic_json(p,x)
def log(**x):print(json.dumps(x,ensure_ascii=False),flush=True)
def metadata(p):
    r=subprocess.run([str(FF),'-hide_banner','-i',str(p)],capture_output=True,text=True,encoding='utf-8',errors='replace')
    dims=re.search(r'Video:.*? (\d{3,5})x(\d{3,5})',r.stderr)
    duration=re.search(r'Duration: (\d+):(\d+):([\d.]+)',r.stderr)
    return dict(size=list(map(int,dims.groups())) if dims else None,duration=int(duration[1])*3600+int(duration[2])*60+float(duration[3]) if duration else None,audio='Audio:' in r.stderr,probe=r.stderr)
def ingest(c,state):
    id=c['id'];raw=OUT/'generated'/f'{id}-raw.mp4';raw.parent.mkdir(exist_ok=True)
    if not raw.exists():
        partial=raw.with_suffix('.partial')
        with urllib.request.urlopen(state['result_url'],timeout=90) as response,partial.open('wb') as f:
            while b:=response.read(1024*1024):f.write(b)
        partial.replace(raw)
    m=metadata(raw)
    if not m['size'] or not m['duration']:raise RuntimeError('No valid video stream')
    w,h=m['size'];unit=min(w//16,h//9)//2*2;cw,ch=unit*16,unit*9
    dest=OUT/'generated'/f'{id}-16x9.mp4'
    if not dest.exists():
        subprocess.run([str(FF),'-v','error','-y','-i',str(raw),'-vf',f'crop={cw}:{ch}:(iw-{cw})/2:(ih-{ch})/2,setsar=1','-r','24','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-movflags','+faststart',str(dest)],check=True)
    decoded=subprocess.run([str(FF),'-v','error','-i',str(dest),'-f','null','NUL'],capture_output=True)
    if decoded.returncode:raise RuntimeError('Decode failed')
    record=dict(id=id,slot=c['slot'],task_id=state['task_id'],raw=str(raw.resolve()),file=str(dest.resolve()),input=m,output=metadata(dest),sha256=hashlib.sha256(dest.read_bytes()).hexdigest(),crop=[(w-cw)//2,(h-ch)//2,cw,ch],decode='passed',visualReview='pending',audioReview='未逐字听审',userReview='待review')
    save(OUT/'generated'/f'{id}-delivery.json',record)
    log(id=id,event='downloaded',size=[cw,ch],duration=m['duration'],audio=m['audio'])
def snapshot(plan):
    rows=[]
    for c in plan:
        p=OUT/'tasks'/f'{c["id"]}.json';state=read(p) if p.exists() else {}
        rows.append(dict(id=c['id'],status=state.get('status','unsubmitted'),task_id=state.get('task_id'),downloaded=(OUT/'generated'/f'{c["id"]}-delivery.json').exists()))
    unknown=[x['id'] for x in rows if x['status'] in ['dispatching','unknown_outcome'] and not x['task_id']]
    d=dict(group='G5',phase='generation',updated_utc=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),submitted=sum(bool(x['task_id']) for x in rows),downloaded=sum(x['downloaded'] for x in rows),total=len(rows),unknown=unknown,clips=rows,pollInterval=120,concurrencyLimit=6,reviewStatus='制作自查不等于用户通过')
    save(OUT/'status.json',d);return d
def tick(plan,submit=True):
    # Resume only known task IDs. Persist the query time BEFORE each network call.
    for c in plan:
        path=OUT/'tasks'/f'{c["id"]}.json'
        if not path.exists():continue
        s=read(path)
        if s.get('task_id') and s.get('status') not in api.TERMINAL and time.time()-s.get('last_query_epoch',s.get('submitted_epoch',time.time()))>=120:
            s['last_query_epoch']=time.time();save(path,s)
            try:api.poll_task(path,interval=120,max_polls=1)
            except Exception as e:
                s=read(path);s['query_error']='query exception: '+type(e).__name__;save(path,s)
                log(id=c['id'],event='query-retry-later',error=type(e).__name__)
            s=read(path)
        if s.get('status')=='succeeded' and not (OUT/'generated'/f'{c["id"]}-delivery.json').exists():
            try:ingest(c,s)
            except Exception as e:log(id=c['id'],event='ingest-error',error=str(e))
    status=snapshot(plan)
    if status['unknown']:
        log(event='unknown-outcome-held',ids=status['unknown'])
    failures=[x for x in status['clips'] if x['status'] in ('failed','cancelled','canceled')]
    if len(failures)>=2:
        log(event='service-failure-stop',ids=[x['id'] for x in failures]);return status
    active=0
    for taskfile in (OUT/'tasks').glob('*.json'):
        if any(x in taskfile.name for x in ('.request.','.latest.')):continue
        taskstate=read(taskfile)
        if taskstate.get('status') not in api.TERMINAL:active+=1
    if submit:
        gate=OUT/'post-gate.json'
        if gate.exists() and not read(gate).get('enabled',False):return status
        for c in plan:
            if active>=6:break
            state_path=OUT/'tasks'/f'{c["id"]}.json'
            if state_path.exists():continue
            if c.get('holdPendingOriginalReview'):continue
            if c.get('postVoiceLines'):
                voice_path=OUT.parents[1]/'voice'/'manifest.json'
                voices=read(voice_path).get('rows',{}) if voice_path.exists() else {}
                needed=[voices.get(x['node'],{}) for x in c['postVoiceLines']]
                if not all(x.get('ready') and Path(x.get('path','')).is_file() for x in needed):continue
                if 1+sum(x['duration'] for x in needed)+.4*max(0,len(needed)-1) > c['duration']:
                    log(id=c['id'],event='voice-duration-must-replan');continue
            local=OUT/'requests'/f'{c["id"]}.local.json'
            if not local.exists():continue
            request=OUT/'requests'/f'{c["id"]}.json'
            try:
                # Resolve DPAPI before entering the paid POST dispatch guard.
                api.load_secret('openai-next-key.dpapi')
                if not request.exists():
                    body,refs=api.prepare_request(read(local),local.parent)
                else:
                    body=read(request);refs=read(request.with_suffix('.references.json'))
                body,refs=transport.promote(api,body,refs)
                save(request,body);save(request.with_suffix('.references.json'),refs)
                original=api.poll_task
                api.poll_task=lambda path:read(Path(path))
                try:s=api.submit_request(request,state_path)
                finally:api.poll_task=original
                s['submitted_epoch']=time.time();s['last_query_epoch']=s['submitted_epoch'];save(state_path,s)
                log(id=c['id'],event='accepted',task_id=s['task_id']);active+=1
            except Exception as e:
                log(id=c['id'],event='submit-error',error=str(e));break
    return snapshot(plan)
if __name__=='__main__':
    mode=sys.argv[1] if len(sys.argv)>1 else 'tick'
    selected=set(sys.argv[2:]);plan=[c for c in read(OUT/('queue-plan.json' if mode=='watch-combined' else 'plan.json'))['clips'] if not selected or c['id'] in selected]
    if mode=='ingest':
        for c in plan:
            p=OUT/'tasks'/f'{c["id"]}.json'
            if p.exists() and read(p).get('status')=='succeeded':ingest(c,read(p))
    elif mode in ('tick','poll'):log(**tick(plan,submit=mode=='tick'))
    elif mode in ('watch','watch-combined'):
        while True:
            if mode=='watch-combined':plan=read(OUT/'queue-plan.json')['clips']
            status=tick(plan)
            log(event='cycle',submitted=status['submitted'],downloaded=status['downloaded'],total=len(plan))
            if all((x['status'] in api.TERMINAL and (x['downloaded'] or x['status']!='succeeded')) or x['id'] in status['unknown'] for x in status['clips']):break
            if sum(x['status'] in ('failed','cancelled','canceled') for x in status['clips'])>=2:break
            # Safe to leave this child process sleeping; host agent stays active for review.
            time.sleep(20)
