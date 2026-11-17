from pathlib import Path
import importlib.util,json,sys,time,subprocess,urllib.request,hashlib,re,contextlib,concurrent.futures
OUT=Path(__file__).parent;BASE=OUT.parents[1]
spec=importlib.util.spec_from_file_location('g2_video_api','C:/Users/zhousirui/Documents/ChatGPT/平行世界/tools/video_api.py')
api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
_atomic=api.atomic_json
def resilient_atomic(path,value):
    for attempt in range(25):
        try:return _atomic(path,value)
        except PermissionError:
            if attempt==24:raise
            time.sleep(min(.05*(attempt+1),.4))
api.atomic_json=resilient_atomic
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,v):api.atomic_json(p,v)
def ready(c):
    p=BASE/'references/manifest.json'
    if not p.exists():return False
    m=read(p);rows=m if isinstance(m,list) else m.get('references',m.get('items',m.get('images',m.get('assets',[]))))
    if isinstance(rows,dict):rows=[dict(id=k,**v) for k,v in rows.items()]
    allready=isinstance(m,dict) and (m.get('ready') is True or m.get('status')=='ready')
    byid={r['id']:r for r in rows if 'id' in r}
    for ref in c['references']:
        row=byid.get(ref['id'])
        if not row or not (allready or row.get('ready') is True or row.get('status')=='ready'):return False
        p=Path(row['path'])
        if not p.is_file() or hashlib.sha256(p.read_bytes()).hexdigest()!=row['sha256']:raise RuntimeError('Central image hash mismatch '+ref['id'])
        if str(p.resolve())!=str(Path(ref['path']).resolve()):raise RuntimeError('Reauthor prompt for changed central image path '+ref['id'])
    return True
def ingest(c,s):
    dest=OUT/'generated'/f'{c["id"]}-raw.mp4';dest.parent.mkdir(exist_ok=True)
    if not dest.exists():
        tmp=dest.with_suffix('.download')
        with urllib.request.urlopen(s['result_url'],timeout=120) as r,tmp.open('wb') as f:
            while b:=r.read(1024*1024):f.write(b)
        tmp.replace(dest)
    report=OUT/'generated'/f'{c["id"]}-technical.json'
    if report.exists():return
    meta=subprocess.run([FF,'-hide_banner','-i',str(dest)],capture_output=True,text=True,encoding='utf-8',errors='replace').stderr
    match=re.search(r'Video:.*? (\d{3,5})x(\d{3,5})',meta)
    d=re.search(r'Duration: (\d+):(\d+):([\d.]+)',meta)
    if not match or not d or 'Audio:' not in meta:raise RuntimeError('Invalid media metadata '+c['id'])
    duration=int(d[1])*3600+int(d[2])*60+float(d[3])
    result=subprocess.run([FF,'-v','error','-i',str(dest),'-f','null','NUL'],capture_output=True)
    if result.returncode:raise RuntimeError('Decode failure '+c['id'])
    save(report,dict(id=c['id'],task_id=s['task_id'],path=str(dest.resolve()),duration=duration,size=list(map(int,match.groups())),audioTrack=True,decode='passed',sha256=hashlib.sha256(dest.read_bytes()).hexdigest(),visualReview='pending',audioReview='未听审'))
    # Sequential temporal contact sheets aid dynamic playback review, never presented as full listening review.
    review=OUT/'review'/c['id'];review.mkdir(parents=True,exist_ok=True)
    subprocess.run([FF,'-v','error','-y','-i',str(dest),'-vf','fps=2,scale=448:252','-q:v','3',str(review/'f-%03d.jpg')],check=True)
    from PIL import Image,ImageDraw,ImageFont
    frames=sorted(review.glob('f-*.jpg'));font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',18)
    for start in range(0,len(frames),12):
        sheet=Image.new('RGB',(1344,4*278),(20,23,25));draw=ImageDraw.Draw(sheet)
        for j,p in enumerate(frames[start:start+12]):
            x=j%3*448;y=j//3*278;sheet.paste(Image.open(p),(x,y));draw.text((x+7,y+253),f'{c["id"]} {(start+j)*0.5:.1f}s',font=font,fill='white')
        sheet.save(review/f'sequence-{start//12+1:02}.jpg')
    print(c['id'],'downloaded_decode_passed',flush=True)
def snapshot(plan):
    states=[]
    for c in plan['clips']:
        p=OUT/'tasks'/f'{c["id"]}.json';s=read(p) if p.exists() else dict(status='unsubmitted')
        states.append(dict(id=c['id'],parent=c['parent'],status=s['status'],task_id=s.get('task_id'),error=s.get('error'),downloaded=(OUT/'generated'/f'{c["id"]}-technical.json').exists()))
    counts={k:sum(x['status']==k for x in states) for k in sorted({x['status'] for x in states})}
    save(OUT/'status.json',dict(group='G2',phase='generating',updatedUtc=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),counts=counts,downloaded=sum(x['downloaded'] for x in states),requestCount=len(states),clips=states))
    return states
def step(plan):
    queries=[]
    for c in plan['clips']:
        p=OUT/'tasks'/f'{c["id"]}.json'
        if not p.exists():continue
        s=read(p)
        if s.get('task_id') and s['status'] not in api.TERMINAL and time.time()-s.get('g2_last_poll_epoch',s.get('g2_dispatch_epoch',time.time()))>=120:
            # Save the attempt time before querying; crash/restart cannot create a rapid poll loop.
            s['g2_last_poll_epoch']=time.time();save(p,s)
            queries.append((c,p))
        if s['status']=='succeeded':
            try:ingest(c,s)
            except Exception as e:print(c['id'],'ingest pending',type(e).__name__,flush=True)
    # Independent read-only status requests can overlap; paid POSTs below remain strictly sequential.
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        futures={pool.submit(api.poll_task,p,interval=120,max_polls=1):c for c,p in queries}
        for future in concurrent.futures.as_completed(futures):
            c=futures[future]
            try:
                s=future.result()
                if s['status']=='succeeded':ingest(c,s)
            except Exception as e:print(c['id'],'query/ingest retry pending',type(e).__name__,flush=True)
    states=snapshot(plan)
    if (OUT/'PAUSE_NEW_DISPATCH').exists():return
    if any(x['status'] in ['unknown_outcome','dispatching'] and not x['task_id'] for x in states):
        print('Uncertain paid submission; stopped new dispatch; saved IDs continue polling',flush=True);return
    completed=[x for x in states if x['status'] in api.TERMINAL]
    failures=[x for x in completed if x['status']!='succeeded']
    if len(failures)>=2 and len(failures)/max(1,len(completed))>=.5:
        print('High service failure rate; suspend new dispatch pending diagnosis',flush=True);return
    active=sum(x['task_id'] is not None and x['status'] not in api.TERMINAL for x in states)
    # Initial/refill batch maximum six, sequential API submits; uncertain outcome halts immediately.
    remaining=[c for c in plan['clips'] if not (OUT/'tasks'/f'{c["id"]}.json').exists()]
    for c in remaining:
        if (OUT/'PAUSE_NEW_DISPATCH').exists():break
        if active>=6:break
        if not ready(c):continue
        p=OUT/'tasks'/f'{c["id"]}.json';q=OUT/'requests'/f'{c["id"]}.json'
        if not q.exists():
            try:
                body,refs=api.prepare_request(read(OUT/'requests'/f'{c["id"]}.local.json'),OUT/'requests')
                save(q,body);save(q.with_suffix('.references.json'),refs)
            except Exception as e:
                print(c['id'],'prepare retry pending; no paid dispatch',type(e).__name__,flush=True);break
        original=api.poll_task
        api.poll_task=lambda path:read(Path(path))
        try:
            s=api.submit_request(q,p);s['g2_dispatch_epoch']=time.time();s['g2_last_poll_epoch']=time.time();save(p,s)
            print(c['id'],'accepted',s['task_id'],flush=True);active+=1
        except Exception as e:
            print(c['id'],'dispatch stopped',type(e).__name__,flush=True)
            if p.exists():
                s=read(p);s['g2_dispatch_epoch']=time.time();s['g2_last_poll_epoch']=time.time();save(p,s)
            break
        finally:api.poll_task=original
    snapshot(plan)
if __name__=='__main__':
    plan=read(OUT/'plan.json')
    mode=sys.argv[1] if len(sys.argv)>1 else 'once'
    if mode=='ingest':
        for c in plan['clips']:
            p=OUT/'tasks'/f'{c["id"]}.json'
            if p.exists() and read(p)['status']=='succeeded':ingest(c,read(p))
    else:
        while True:
            step(plan)
            states=snapshot(plan)
            if all(x['status'] in api.TERMINAL for x in states):break
            if mode!='watch':break
            time.sleep(20)
