"""Generate each authorized H3 unit once; recover IDs and download idempotently."""
from pathlib import Path
import concurrent.futures,contextlib,datetime,hashlib,importlib.util,json,math,os,re,shutil,subprocess,sys,threading,time,urllib.request
from PIL import Image

OUT=Path(__file__).resolve().parent
PLAN=json.loads((OUT/'production-plan.json').read_text('utf-8'))
ENTRY=Path(r'D:/AI视频/VJ-1106/api-tools/Invoke-HailuoVideo.ps1')
FF=Path(r'D:/AI视频/VJ-1106/motion-runtime/node_modules/ffmpeg-static/ffmpeg.exe')
FP=Path(r'D:/AI视频/VJ-1106/motion-runtime/node_modules/ffprobe-static/bin/win32/x64/ffprobe.exe')
PS=shutil.which('pwsh') or 'powershell'
spec=importlib.util.spec_from_file_location('reference_uploader',Path(r'C:/Users/zhousirui/Documents/ChatGPT/平行世界/tools/video_api.py'))
helper=importlib.util.module_from_spec(spec);spec.loader.exec_module(helper)
PRINT_LOCK=threading.Lock(); UPLOAD_LOCK=threading.Lock()

def now():return datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).isoformat()
def save(p,v):helper.atomic_json(p,v)
def read(p,default=None):
    if not p.exists():return default
    return json.loads(p.read_text('utf-8-sig'))
def report(message):
    with PRINT_LOCK:print(f'{now()[11:19]} {message}',flush=True)
def setstate(d,**kw):
    s=read(d/'state.json',{'id':d.name,'version':'v2.6'});s.update(kw);s['updated_at']=now();save(d/'state.json',s);return s
def run(args,**kw):
    if str(args[0])==str(FF):args=[args[0],'-y',*args[1:]]
    return subprocess.run(list(map(str,args)),check=True,capture_output=True,**kw)
def findtask(d):
    records=sorted(d.glob('api/**/task.json'))
    ids={read(p).get('task_id') for p in records if read(p).get('task_id')}
    if len(ids)>1:raise RuntimeError('Multiple different task IDs; manual reconciliation required')
    return next(iter(ids),None)
def findresult(d):
    values=sorted(d.glob('api/**/result.json'))
    return values[-1] if values else None
def statusofresult(value):
    task=value.get('task') or value.get('data',{}).get('task') or value.get('data') or value
    return str(task.get('status') or task.get('state') or '').lower(),task
def upload_reference(path):
    path=Path(path);original_sha=hashlib.sha256(path.read_bytes()).hexdigest()
    cache=OUT/'references'/original_sha;cache.mkdir(parents=True,exist_ok=True)
    jpg=cache/'upload.jpg'
    if not jpg.exists():
        with Image.open(path) as im:im.convert('RGB').save(jpg,quality=95,subsampling=0)
    jpg_sha=hashlib.sha256(jpg.read_bytes()).hexdigest()
    record=read(cache/'reference-record.json')
    if not record:
        with UPLOAD_LOCK:
            record=read(cache/'reference-record.json')
            if not record:
                record=helper.upload_reference(jpg)
                record.update(original_path=str(path),original_sha256=original_sha,local_file=str(jpg),sha256=jpg_sha)
                save(cache/'reference-record.json',record)
    url=re.sub(r'/upload/v\d+/','/upload/',record['url'])
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=45) as response:
        data=response.read(20*1024*1024+1)
    if hashlib.sha256(data).hexdigest()!=jpg_sha:raise RuntimeError('Remote JPEG SHA256 mismatch')
    (cache/'download-check.jpg').write_bytes(data)
    return {**record,'url':url,'verified_sha256':jpg_sha,'verified_at':now()}
def preview(d,u,records):
    args=[PS,'-NoProfile','-NonInteractive','-File',ENTRY,'-PromptFile',d/'prompt.txt','-ReferenceImageUrls']
    # Passing an array to -File is not portable across pwsh versions; use a JSON-bound wrapper.
    cfg={'entry':str(ENTRY),'directory':str(d),'duration':u['duration'],'urls':[r['url'] for r in records]}
    save(d/'invocation.json',cfg)
    p=run([PS,'-NoProfile','-NonInteractive','-File',OUT/'invoke_unit.ps1','-UnitDirectory',d],timeout=90)
    (d/'preview-output.txt').write_bytes(p.stdout)
    output=p.stdout.decode('utf-8-sig');pos=output.find('{')
    body=json.loads(output[pos:])
    assert body['model']=='MiniMax-H3' and body['resolution']=='768P' and body['ratio']=='16:9'
    assert body['duration']==u['duration']
    assert [c['image_url']['url'] for c in body['content'] if c['type']=='image_url']==cfg['urls']
    assert body['content'][0]['text'].replace('\r\n','\n')==(d/'prompt.txt').read_text('utf-8').strip().replace('\r\n','\n')
    save(d/'request-preview.json',body)
    save(d/'preflight.json',{'status':'pass','checked_at':now(),'references':len(records),'prompt_sha256':hashlib.sha256((d/'prompt.txt').read_bytes()).hexdigest(),'duration':u['duration'],'model':body['model'],'resolution':body['resolution'],'ratio':body['ratio']})
def invoke(d,taskid=None):
    args=[PS,'-NoProfile','-NonInteractive','-File',OUT/'invoke_unit.ps1','-UnitDirectory',str(d)]
    args+=['-ResumeTaskId',taskid] if taskid else ['-Submit']
    with (d/'api-run.log').open('ab') as log:
        proc=subprocess.Popen(args,stdout=log,stderr=subprocess.STDOUT)
        try:return proc.wait(timeout=2850)
        except subprocess.TimeoutExpired:
            proc.terminate();proc.wait(timeout=15);return -1
def collect(d,u):
    resultpath=findresult(d)
    if not resultpath:raise RuntimeError('No successful result available')
    result=read(resultpath);status,task=statusofresult(result)
    if status not in ('succeeded','success','completed','done'):raise RuntimeError('Result is not succeeded')
    url=task.get('content',{}).get('url')
    if not url:raise RuntimeError('Result has no video URL')
    src=d/'source.mp4'
    if not src.exists():
        part=d/'source.part.mp4';last=None
        for attempt in range(3):
            try:
                deadline=time.monotonic()+150
                with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=45) as response,part.open('wb') as f:
                    expected=response.headers.get('Content-Length');total=0
                    while True:
                        chunk=response.read(1024*1024)
                        if not chunk:break
                        f.write(chunk);total+=len(chunk)
                        if time.monotonic()>deadline:raise TimeoutError('Video download overall timeout')
                if expected and total!=int(expected):raise RuntimeError('Incomplete result download')
                if total<10000:raise RuntimeError('Unexpected tiny video file')
                part.replace(src);last=None;break
            except Exception as exc:last=type(exc).__name__;time.sleep(2)
        if last:raise RuntimeError('Same-result download failed: '+last)
    run([FF,'-v','error','-i',src,'-f','null','-'],timeout=180)
    meta=json.loads(run([FP,'-v','error','-show_streams','-show_format','-of','json',src],timeout=40).stdout)
    stream=next(s for s in meta['streams'] if s['codec_type']=='video')
    duration=float(stream.get('duration') or meta['format']['duration']);fps=float(__import__('fractions').Fraction(stream['avg_frame_rate']))
    if duration+1/fps<u['edit_duration']:raise RuntimeError('Native duration shorter than planned edit')
    meta['checks']={'full_decode':'pass','requested_seconds':u['duration'],'selected_seconds':u['edit_duration'],'actual_seconds':duration,'native_width':stream['width'],'native_height':stream['height'],'native_fps':fps,'audio_streams':sum(s['codec_type']=='audio' for s in meta['streams']),'source_sha256':hashlib.sha256(src.read_bytes()).hexdigest()}
    save(d/'technical.json',meta)
    selected=d/'selected.mp4'
    w,h=stream['width'],stream['height'];crop_h=min(h,(w*9//16)//2*2);crop_w=min(w,(crop_h*16//9)//2*2)
    filt=f'crop={crop_w}:{crop_h}:(iw-{crop_w})/2:(ih-{crop_h})/2,scale=1280:720:flags=lanczos,setsar=1,fps=24'
    if not selected.exists():run([FF,'-v','error','-i',src,'-t',u['edit_duration'],'-map','0:v:0','-map','0:a:0?','-vf',filt,'-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags','+faststart',selected],timeout=240)
    run([FF,'-v','error','-sseof','-0.06','-i',src,'-frames:v','1','-update','1',d/'end-native.png'],timeout=30)
    endtime=max(0,u['edit_duration']-1/24)
    run([FF,'-v','error','-ss',endtime,'-i',src,'-frames:v','1','-update','1',d/'end-selected.png'],timeout=30)
    rows=math.ceil(duration*2/4)
    run([FF,'-v','error','-i',src,'-vf',f'fps=2,scale=320:180:force_original_aspect_ratio=decrease,pad=320:180:(ow-iw)/2:(oh-ih)/2,tile=4x{rows}','-frames:v','1','-update','1',d/'contact.jpg'],timeout=90)
    for index in range(math.ceil(u['edit_duration']/2)):
        run([FF,'-v','error','-ss',index*2,'-i',src,'-vf','fps=8,scale=256:144:force_original_aspect_ratio=decrease,pad=256:144:(ow-iw)/2:(oh-ih)/2,tile=4x4','-frames:v','1','-update','1',d/f'dense-{index}.jpg'],timeout=60)
    save(d/'edit-record.json',{'source':'source.mp4','start':0,'end':u['edit_duration'],'speed':1,'crop':[crop_w,crop_h],'output':[1280,720,24],'audio_removed_in_selected':False,'native_source_preserved':True,'continuation_frame':'end-selected.png','continuation_source_time':endtime,'note':'从原生画面中心裁为16:9并缩至720p，不称为原生1080p。'})
    save(d/'review.json',{'technical':'pass','method':'完整解码，已生成2fps总览及8fps动作联系表，尚待实际观看。','motion_review':'pending','user_review':'待review','selected_for_work_edit':'candidate','notes':[]})
    setstate(d,status='downloaded',local_file=str(src),selected_file=str(selected),technical='pass',downloaded_at=now(),user_review='待review')
    report(u['id']+' downloaded and decoded')
def work(u):
    d=OUT/u['id'];state=read(d/'state.json',{})
    if state.get('status')=='downloaded':return
    tid=findtask(d) or state.get('task_id')
    if state.get('submission_started') and not tid:
        setstate(d,status='unknown_outcome',note='Submission marker exists without task ID; no automatic POST retry');return
    try:
        if not tid:
            refs=list(u['reference_paths'])
            if u['depends_on']:
                endpoint=OUT/u['depends_on']/'end-selected.png'
                if not endpoint.exists():raise RuntimeError('Selected continuation frame not available')
                refs.insert(0,str(endpoint))
            setstate(d,status='preparing',started_at=now())
            records=[upload_reference(p) for p in refs]
            save(d/'reference-records.json',records);save(d/'verified-urls.json',[{'url':r['url'],'sha256':r['verified_sha256']} for r in records])
            preview(d,u,records)
            setstate(d,status='submitting',submission_started=now(),preflight='pass')
            report(u['id']+' submitting once')
            code=invoke(d)
            tid=findtask(d)
            if not tid:
                setstate(d,status='unknown_outcome',exit_code=code,note='No task ID returned; no automatic resubmission');report(u['id']+' unresolved POST; preserved records');return
            setstate(d,task_id=tid,status='accepted')
            report(u['id']+' task ID saved')
        else:
            setstate(d,task_id=tid,status='resuming')
            report(u['id']+' resuming existing task')
            invoke(d,tid)
        # A query error is resumable. Only GET is retried via the existing ID.
        for attempt in range(3):
            if findresult(d):break
            queries=sorted(d.glob('api/**/latest-query.json'))
            remote=statusofresult(read(queries[-1]))[0] if queries else ''
            if remote in ('failed','failure','error','cancelled','canceled'):
                setstate(d,status='failed',remote_status=remote,task_id=tid);report(u['id']+' remote '+remote);return
            report(u['id']+' continuing query for same ID')
            invoke(d,tid)
        if not findresult(d):
            setstate(d,status='query_pending',task_id=tid);return
        collect(d,u)
    except Exception as exc:
        tid=findtask(d) or tid
        status='download_error' if findresult(d) else 'query_pending' if tid else 'unknown_outcome' if read(d/'state.json',{}).get('submission_started') else 'preparation_error'
        setstate(d,status=status,error=type(exc).__name__+': '+str(exc),task_id=tid)
        report(u['id']+' '+status+': '+type(exc).__name__+': '+str(exc))
def snapshot():
    units=[]
    for u in PLAN['units']:
        s=read(OUT/u['id']/'state.json',{'id':u['id'],'status':'prepared'})
        active_directory=Path(s.get('active_directory') or OUT/u['id'])
        tid=s.get('task_id') or findtask(active_directory)
        if tid:s['task_id']=tid
        queries=sorted(active_directory.glob('api/**/latest-query.json'))
        if queries:s['api_status']=statusofresult(read(queries[-1]))[0]
        units.append(s)
    value={'updated_at':now(),'units':units,'counts':{k:sum(s.get('status')==k for s in units) for k in sorted({s.get('status') for s in units})},'user_review':'待review'}
    save(OUT/'batch-status.json',value);return value

if __name__=='__main__':
    if '--status' in sys.argv:
        snap=snapshot();print(json.dumps({'counts':snap['counts'],'tasks':sum(bool(u.get('task_id')) for u in snap['units']),'issues':[{'id':u['id'],'status':u['status'],'error':u.get('error')} for u in snap['units'] if u['status'] in ('failed','preparation_error','unknown_outcome','download_error','query_pending')]},ensure_ascii=False));sys.exit()
    selection=next((a.split('=',1)[1].split(',') for a in sys.argv if a.startswith('--only=')),None)
    concurrency=int(next((a.split('=',1)[1] for a in sys.argv if a.startswith('--concurrency=')),'3'))
    pending=[u for u in PLAN['units'] if not selection or u['id'] in selection]
    active={}
    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as pool:
        while pending or active:
            for u in list(pending):
                if len(active)>=concurrency:break
                state=read(OUT/u['id']/'state.json',{})
                if state.get('status') in ('downloaded','failed','unknown_outcome'):
                    pending.remove(u);continue
                dep=u['depends_on']
                if dep and read(OUT/dep/'state.json',{}).get('status')!='downloaded':continue
                active[pool.submit(work,u)]=u;pending.remove(u)
            if not active:
                for u in pending:setstate(OUT/u['id'],status='dependency_blocked',depends_on=u['depends_on'])
                break
            done,_=concurrent.futures.wait(active,timeout=15,return_when=concurrent.futures.FIRST_COMPLETED)
            for future in done:
                u=active.pop(future)
                try:future.result()
                except Exception as exc:report(u['id']+' unexpected '+type(exc).__name__)
            snapshot()
    snap=snapshot();report('Batch finished '+json.dumps(snap['counts'],ensure_ascii=False))


