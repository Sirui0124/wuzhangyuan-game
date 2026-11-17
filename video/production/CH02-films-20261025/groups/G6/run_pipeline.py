"""G6 only: persistent dispatch, minimum 120s polling, no uncertain resubmission."""
from pathlib import Path
import importlib.util,json,sys,time,subprocess,urllib.request,hashlib,re,os
OUT=Path(__file__).resolve().parent; BASE=OUT.parents[1]
spec=importlib.util.spec_from_file_location('shared_video_api',Path('C:/Users/zhousirui/Documents/ChatGPT/平行世界/tools/video_api.py'))
api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
_verify=api.verify_image_url
def reliable_verify(*args,**kwargs):
    for attempt in range(3):
        try:return _verify(*args,**kwargs)
        except api.PipelineError:
            if attempt==2:raise
            time.sleep(4)
api.verify_image_url=reliable_verify
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,d):api.atomic_json(p,d)
def announce(d):print(json.dumps(d,ensure_ascii=False),flush=True)
plan=read(OUT/'plan.json'); clips=plan['requests']+plan.get('retries',[])
FINISHED=api.TERMINAL|{'not_required_reused'}
def voice_ready(c):
    # Latest user instruction: pictures never wait on missing voice. No new TTS.
    return True
def ready(c=None):
    manifest=read(BASE/'references/manifest.json')
    if not (manifest.get('ready') is True or manifest.get('status')=='ready'):raise RuntimeError('Central references not ready; per-image readiness may be bound after coordinator publication')
    return manifest
def prepare(c):
    ready(c); bindings=read(OUT/'reference-bindings.json')
    first=OUT/'requests'/f"{c['id']}.firstframe-override.json"
    if first.exists():
        body=read(OUT/'requests'/f"{c['id']}.json");api.validate_payload(body)
        return OUT/'requests'/f"{c['id']}.json"
    if not voice_ready(c):raise RuntimeError(c['id']+': waiting actual central voice duration')
    p=OUT/'prompts'/f"{c['id']}.md"; prompt=p.read_text(encoding='utf-8')
    paths=[bindings[k] for k in c['referenceKeys']]
    if any(not Path(x['path']).is_file() for x in paths):raise RuntimeError('Missing reference image')
    header='\n'.join(f"{i+1}. 图片{i+1}｜{x['name']}｜用途：{x['purpose']}\n   本地路径：`{Path(x['path']).resolve()}`" for i,x in enumerate(paths))
    prompt=re.sub(r'中央参考图待 ready；.*?\n.*?\n\n## 视频生成 Prompt',lambda m:header+'\n\n## 视频生成 Prompt',prompt,flags=re.S)
    for i,k in enumerate(c['referenceKeys']):prompt=prompt.replace(k+'负责其中央身份或空间，按manifest用途绑定',f"图片{i+1}用于{paths[i]['purpose']}")
    if '待 ready' in prompt or '按manifest用途绑定' in prompt:raise RuntimeError('Unbound prompt')
    p.write_text(prompt,encoding='utf-8')
    # API gets only filmable directions, never production metadata or source IDs.
    npc=[l['text'] for l in c['lines'] if l['spoken'] and (l['speaker']=='苟安' or '军吏' in l['speaker'])]
    relation='；'.join(f"图{i+1}仅用于{x['purpose']}" for i,x in enumerate(paths))
    frontal='摄像机就是交谈者双眼。严格光学第一人称POV，单一连续镜头，无任何反打。禁止越肩镜头、前景后脑、前景肩背、旁观者机位、镜中倒影。对话画面里只出现面向镜头的那一个受话人，摄影机所在的人完全不可见。'
    if c['id'].startswith('V43-01'):frontal+='只允许苟安离开的背影，前景没有另一个人的身体。'
    if c['id'].startswith('V43-02'):frontal+='本镜只允许指定远处士卒，摄影机眼前无任何身体遮挡。'
    sound=('唯一对白由画面的'+('苟安' if any(l['speaker']=='苟安' for l in c['lines']) else '军吏')+'自然说出：'+''.join(npc)) if npc else '全程无人声、无对白、无旁白、无心声；人物全程闭口，只保留环境动作声。'
    text=f"{c['duration']}秒，16:9。写实三国历史电影，自然肤色，低饱和土褐、麻白与墨灰，可读暗部，无绘画质感。{relation}。{frontal}场景：{c['scene']}。动作：{c['action']}。{sound}禁止画面文字、字幕、标记、水印、分屏和黑边。没有背景音乐、BGM、配乐、吟唱和音乐鼓点，只有同步帐布风声、衣料和本镜实际出现的脚步/器物动作声。"
    body=dict(model='MiniMax-H3',duration=c['duration'],resolution='768P',ratio='16:9',content=[dict(type='text',text=text)]+[dict(type='image_url',role='reference_image',image_url=dict(local_path=x['path'])) for x in paths])
    local=OUT/'requests'/f"{c['id']}.local.json"; prepared=OUT/'requests'/f"{c['id']}.json"
    save(local,body)
    if not prepared.exists():
        b,refs=api.prepare_request(body,OUT);save(prepared,b);save(prepared.with_suffix('.references.json'),refs)
    return prepared
def ingest(c,state):
    id=c['id']; raw=OUT/'generated'/f'{id}-raw.mp4'; dest=OUT/'generated'/f'{id}-16x9.mp4'; report=OUT/'generated'/f'{id}-delivery.json'
    if report.exists():return
    if not raw.exists():
        partial=raw.with_suffix('.part')
        with urllib.request.urlopen(state['result_url'],timeout=120) as response,partial.open('wb') as f:
            while b:=response.read(1024*1024):f.write(b)
        partial.replace(raw)
    meta=subprocess.run([FF,'-hide_banner','-i',str(raw)],capture_output=True,text=True,encoding='utf-8',errors='replace').stderr
    m=re.search(r'Video:.*? (\d{3,5})x(\d{3,5})',meta);w,h=map(int,m.groups()); unit=min(w//16,h//9)//2*2;cw,ch=unit*16,unit*9
    if not dest.exists():
        subprocess.run([FF,'-v','error','-y','-i',str(raw),'-vf',f'crop={cw}:{ch}:(iw-{cw})/2:(ih-{ch})/2,setsar=1','-r','24','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-movflags','+faststart',str(dest)],check=True)
    decoded=subprocess.run([FF,'-v','error','-i',str(dest),'-f','null','NUL'],capture_output=True)
    if decoded.returncode:raise RuntimeError(id+': decode failed')
    d=re.search(r'Duration: (\d+):(\d+):([\d.]+)',meta);duration=int(d[1])*3600+int(d[2])*60+float(d[3])
    save(report,dict(id=id,task_id=state['task_id'],raw=str(raw),file=str(dest),inputSize=[w,h],outputSize=[cw,ch],crop=[(w-cw)//2,(h-ch)//2,cw,ch],duration=duration,audio='Audio:' in meta,sha256=hashlib.sha256(dest.read_bytes()).hexdigest(),decode='passed',visualReview='待动态审片',audioReview='未逐字听审',userReview='待review'))
    announce(dict(id=id,status='downloaded',size=[cw,ch],duration=duration))
def tick(submit=False):
    global clips
    current_plan=read(OUT/'plan.json');clips=current_plan['requests']+current_plan.get('retries',[])
    gate=read(OUT/'dispatch-gate.json') if (OUT/'dispatch-gate.json').exists() else {'allowedRetries':[]}
    submit=submit and gate.get('newPostEnabled',True)
    ready(); active=[]; failed=[];pending=[]
    for c in clips:
        path=OUT/'tasks'/f"{c['id']}.json"
        if c['id'] in gate.get('skipRequests',[]) and not path.exists():continue
        if not path.exists():pending.append(c);continue
        s=read(path)
        if not s.get('task_id'):raise RuntimeError(c['id']+': uncertain dispatch; no automatic resubmission')
        if s.get('status') not in api.TERMINAL:
            last=s.get('last_poll_epoch',s.get('submitted_epoch',path.stat().st_mtime))
            if time.time()-last>=120:
                s=api.poll_task(path,max_polls=1);s['last_poll_epoch']=time.time();save(path,s)
        if s.get('status')=='succeeded':
            try:ingest(c,s)
            except Exception as e:announce(dict(id=c['id'],downloadError=str(e)))
        elif s.get('status') in api.TERMINAL:failed.append(c['id'])
        else:active.append(c['id'])
    unacknowledged=[id for id in failed if id not in gate.get('acknowledgedFailures',[])]
    if submit and len(unacknowledged)>=3:raise RuntimeError('Three explicit failures: inspect cause before more paid requests')
    eligible=[c for c in pending if c['id'] not in gate.get('skipRequests',[]) and c['id'] not in gate.get('heldRequests',[]) and voice_ready(c) and (not c.get('replaces') or gate.get('allRetriesApproved') or c['id'] in gate.get('allowedRetries',[]))] if submit else []
    eligible.sort(key=lambda c:0 if c['id'] in gate.get('allowedRetries',[]) else 1)
    # Dispatch distinct sequential batches of six (final remainder allowed), not
    # an endless stream of one-task refills as individual jobs finish.
    count=min(6,len(eligible)) if submit and not active else 0
    if count:
        for c in eligible[:count]:
            req=prepare(c);path=OUT/'tasks'/f"{c['id']}.json"
            original=api.poll_task
            api.poll_task=lambda p:read(Path(p))
            try:s=api.submit_request(req,path)
            finally:api.poll_task=original
            s['submitted_epoch']=time.time();s['last_poll_epoch']=s['submitted_epoch'];save(path,s);active.append(c['id'])
            announce(dict(id=c['id'],task_id=s['task_id'],status=s['status']))
    allstates={c['id']:read(OUT/'tasks'/f"{c['id']}.json").get('status') if (OUT/'tasks'/f"{c['id']}.json").exists() else 'not_required_reused' if c['id'] in gate.get('skipRequests',[]) else 'not_submitted' for c in clips}
    phase='held-input-download-outage' if not gate.get('newPostEnabled',True) else 'generating' if any(v not in FINISHED for v in allstates.values()) else 'generation-complete-awaiting-review'
    save(OUT/'status.json',dict(group='G6',phase=phase,states=allstates,failed=failed,updated_epoch=time.time(),userReview='待review'))
    summary=dict(active=len(active),pending=sum(v=='not_submitted' for v in allstates.values()),failed=failed,downloaded=len(list((OUT/'generated').glob('*-delivery.json'))))
    if globals().get('_last_summary')!=summary:announce(summary);globals()['_last_summary']=summary
mode=sys.argv[1]
if mode in ['tick','submit']:tick(submit=mode=='submit')
elif mode=='watch':
    lock=OUT/'pipeline.lock'
    try:
        with lock.open('x') as f:f.write(str(os.getpid()))
    except FileExistsError:raise RuntimeError('Pipeline already has a lock; inspect process before continuing')
    try:
        while True:
            tick(submit=True)
            if (OUT/'stop-after-tick').exists():
                announce({'status':'stopped between paid requests'});break
            states=read(OUT/'status.json')['states']
            if all(s in FINISHED for s in states.values()):break
            time.sleep(15)
    finally:lock.unlink(missing_ok=True)
elif mode=='prepare':
    for c in clips:prepare(c)
    announce(dict(prepared=len(clips),submitted=False))
else:raise RuntimeError('mode: prepare | submit | tick | watch')
