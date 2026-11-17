"""Recoverable G4 submission: <=6 active jobs; >=120 seconds between queries."""
from pathlib import Path
import importlib.util,json,sys,time,subprocess,urllib.request,hashlib,re,os
from urllib.parse import urlsplit,urlunsplit
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[1]
spec=importlib.util.spec_from_file_location('shared_video_api',Path('C:/Users/zhousirui/Documents/ChatGPT/平行世界/tools/video_api.py'))
api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
transport_spec=importlib.util.spec_from_file_location('g4_cloudinary_shard',ROOT/'scripts/cloudinary_shard_transport.py')
transport=importlib.util.module_from_spec(transport_spec);transport_spec.loader.exec_module(transport)
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,v):api.atomic_json(p,v)
def emit(**d):print(json.dumps(d,ensure_ascii=False),flush=True)
def cached_shard_uploader(path):
    path=Path(path).resolve(strict=True);digest=hashlib.sha256(path.read_bytes()).hexdigest()
    for cached in api.CACHE.glob(f'*/{digest}.json'):
        record=read(cached);parts=urlsplit(record['url'])
        if parts.hostname not in {'res.cloudinary.com','res-1.cloudinary.com'}:continue
        target=urlunsplit(('https','res-1.cloudinary.com',parts.path,parts.query,''))
        try:verification=api.verify_image_url(target,digest)
        except api.PipelineError:continue
        return dict(record,path=str(path),url=target,cache_hit=True,verification=verification)
    return api.upload_reference(path)
def check_ready():
    p=ROOT/'references/manifest.json'
    if not p.exists():raise RuntimeError('Central reference manifest not published')
    m=read(p)
    b=read(OUT/'reference-binding.json')
    # Publishing the binding is permitted only after verifying the owning entries.
    guard=read(OUT/'reference-verification.json')
    if not guard.get('ready'):raise RuntimeError('G4 references are not ready')
    for k,path in b.items():
        if hashlib.sha256(Path(path).read_bytes()).hexdigest()!=guard['hashes'][k]:raise RuntimeError('Reference drift: '+k)
def ingest(c,state):
    cid=c['id'];raw=OUT/'generated'/f'{cid}-raw.mp4';raw.parent.mkdir(exist_ok=True)
    if not raw.exists():
        tmp=raw.with_suffix('.downloading')
        with urllib.request.urlopen(state['result_url'],timeout=90) as response,tmp.open('wb') as f:
            while b:=response.read(1024*1024):f.write(b)
        tmp.replace(raw)
    dest=OUT/'generated'/f'{cid}-16x9.mp4';report=OUT/'generated'/f'{cid}-delivery.json'
    if report.exists() and dest.exists():return
    meta=subprocess.run([FF,'-hide_banner','-i',str(raw)],capture_output=True,text=True,encoding='utf-8',errors='replace').stderr
    m=re.search(r'Video:.*? (\d{3,5})x(\d{3,5})',meta);w,h=map(int,m.groups())
    dm=re.search(r'Duration: (\d+):(\d+):([\d.]+)',meta);duration=int(dm[1])*3600+int(dm[2])*60+float(dm[3])
    unit=min(w//16,h//9)//2*2;cw,ch=unit*16,unit*9
    has_audio=bool(re.search(r'Audio:',meta))
    if not dest.exists():
        cmd=[FF,'-v','error','-y','-i',str(raw)]
        if not has_audio:cmd+=['-f','lavfi','-i','anullsrc=r=48000:cl=stereo','-shortest']
        cmd+=['-vf',f'crop={cw}:{ch}:(iw-{cw})/2:(ih-{ch})/2,scale=1280:720,setsar=1','-r','24','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-movflags','+faststart',str(dest)]
        subprocess.run(cmd,check=True,capture_output=True)
    decoded=subprocess.run([FF,'-v','error','-i',str(dest),'-f','null','NUL'],capture_output=True)
    if decoded.returncode:raise RuntimeError(cid+': decode failed')
    save(report,dict(id=cid,slot=c['slot'],task_id=state['task_id'],raw=str(raw),file=str(dest),duration=duration,inputSize=[w,h],outputSize=[1280,720],crop=[(w-cw)//2,(h-ch)//2,cw,ch],fps=24,sampleRate=48000,originalAudioTrack=has_audio,sha256=hashlib.sha256(dest.read_bytes()).hexdigest(),decode='passed',humanReview='待review',audioReview='未完成逐字听审'))
    emit(id=cid,status='downloaded',duration=duration)
def one_poll(path):
    state=read(path)
    if state.get('status') in api.TERMINAL:return state
    if not state.get('task_id'):return state
    if time.time()-state.get('last_poll_epoch',state.get('submitted_epoch',path.stat().st_mtime))<120:return state
    state['last_poll_epoch']=time.time();save(path,state)
    # shared poll function only called once; orchestration owns scheduling.
    state=original_poll(path,max_polls=1)
    return state
original_poll=api.poll_task
# submit_request normally queries immediately. Disable that and schedule >=120s later.
api.poll_task=lambda path:read(Path(path))
def validate_new_request_dialogue(body,clip):
    """2026-10-25 user policy: validate only future submissions; never rewrite history."""
    if (OUT/'pause-submissions.json').exists():
        raise RuntimeError('Video API submissions are paused; current handoff uses independent local Seedance Markdown documents, at most 30 seconds each. Preserve existing task records; do not repost.')
    prompt='\n'.join(x.get('text','') for x in body.get('content',[]) if x.get('type')=='text')
    if 'SPOKEN DIALOGUE WHITELIST' not in prompt or 'No BGM' not in prompt:
        raise RuntimeError('New requests must use user-review-20261025/new-request-templates and an independent new task ID; historical prompts cannot be submitted as new work')
    if 'CH2-' in prompt or '### 分镜' in prompt:
        raise RuntimeError('Planning IDs/full production prose must stay outside the actual model prompt')
    if clip.get('silent') or clip.get('audioOverlay'):
        if 'WHITELIST IS EMPTY' not in prompt:raise RuntimeError('Silent/existing-player-voice shot must not generate a fixed voice')
    else:
        for line in clip.get('lines',[]):
            if json.dumps(line['text'],ensure_ascii=False) not in prompt:
                raise RuntimeError('Missing exact quoted source utterance in dialogue whitelist')
def run_once(clips,submit=True):
    check_ready();terminal_failures=0
    for c in clips:
        sp=OUT/'tasks'/f"{c['id']}.json"
        if not sp.exists():continue
        state=read(sp)
        if state.get('status') not in api.TERMINAL:state=one_poll(sp)
        if state.get('status')=='succeeded':
            try:ingest(c,state)
            except Exception as e:emit(id=c['id'],stage='ingest',error=type(e).__name__)
        elif state.get('status')=='failed':terminal_failures+=1
        elif not state.get('task_id'):raise RuntimeError(c['id']+': uncertain submission, manual recovery required; do not resubmit')
    # The retake worker may run after the last original has been submitted.
    # Count every real task in this group, not just this worker's selection.
    task_paths=[p for p in (OUT/'tasks').glob('*.json') if '.request' not in p.stem and '.latest' not in p.stem]
    active=sum(1 for p in task_paths if read(p).get('status') not in api.TERMINAL)
    if submit and terminal_failures>=3:raise RuntimeError('Three failed tasks: pause paid dispatch and diagnose')
    dispatched=0
    for c in clips:
        if (OUT/'pause-submissions.json').exists():break
        if not submit or active>=6 or dispatched>=6:break
        cid=c['id'];sp=OUT/'tasks'/f'{cid}.json'
        if sp.exists():continue
        request=OUT/'requests'/f'{cid}.json'
        if not request.exists():
            local=OUT/'requests'/f'{cid}.local.json'
            local_body=read(local);validate_new_request_dialogue(local_body,c)
            body,refs=api.prepare_request(local_body,local.parent,uploader=cached_shard_uploader)
            body,refs=transport.promote(api,body,refs)
            save(request,body);save(request.with_suffix('.references.json'),refs)
        else:
            prepared_body=read(request);validate_new_request_dialogue(prepared_body,c)
            body,refs=transport.promote(api,prepared_body,read(request.with_suffix('.references.json')))
            save(request,body);save(request.with_suffix('.references.json'),refs)
        if (OUT/'pause-submissions.json').exists():break
        state=api.submit_request(request,sp)
        state['submitted_epoch']=time.time();save(sp,state)
        active+=1;dispatched+=1
        emit(id=cid,status=state['status'],task_id=state.get('task_id'),active=active)
    states=[read(OUT/'tasks'/f"{c['id']}.json") for c in clips if (OUT/'tasks'/f"{c['id']}.json").exists()]
    summary=dict(group='G4',stage='生成与审片并行',total=len(clips),submitted=len(states),succeeded=sum(s.get('status')=='succeeded' for s in states),failed=sum(s.get('status')=='failed' for s in states),active=active,downloaded=sum((OUT/'generated'/f"{c['id']}-delivery.json").exists() for c in clips),updatedEpoch=time.time())
    save(OUT/'status.json',summary);emit(**summary)
    return len(states)==len(clips) and all(s.get('status') in api.TERMINAL for s in states) and all((OUT/'generated'/f"{c['id']}-delivery.json").exists() for c in clips if (OUT/'tasks'/f"{c['id']}.json").exists() and read(OUT/'tasks'/f"{c['id']}.json").get('status')=='succeeded')
if __name__=='__main__':
    mode=sys.argv[1] if len(sys.argv)>1 else 'once'
    retakes=mode.startswith('retake');recover=mode=='recover'
    if retakes or recover:mode='watch'
    choices=read(OUT/('retake-plan.json' if retakes else 'plan.json'))['clips']
    if recover:choices+=read(OUT/'retake-plan.json')['clips']
    selected=set(sys.argv[2:]);clips=[c for c in choices if not selected or c['id'] in selected]
    while True:
        done=run_once(clips,submit=mode!='poll')
        if done or mode!='watch':break
        time.sleep(15)
