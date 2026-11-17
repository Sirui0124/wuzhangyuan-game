"""User-authorized repair jobs, exclusive POST states and >=120-second per-ID queries."""
from pathlib import Path
import json,sys,importlib.util,time,hashlib,uuid,urllib.request
O=Path(__file__).parent;R=O/'user-review-20261025';J=R/'jobs';J.mkdir(exist_ok=True)
spec=importlib.util.spec_from_file_location('g2api','C:/Users/zhousirui/Documents/ChatGPT/平行世界/tools/video_api.py');api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
spec=importlib.util.spec_from_file_location('cdn',O.parents[1]/'scripts/cloudinary_shard_transport.py');cdn=importlib.util.module_from_spec(spec);spec.loader.exec_module(cdn)
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def prepare(id,base,prompt,duration):
    q=J/(id+'.request.json')
    if q.exists():return
    body=read(O/'requests'/(base+'.json'));refs=read(O/'requests'/(base+'.references.json'))
    body['duration']=duration;body['content'][0]['text']=prompt;body,refs=cdn.promote(api,body,refs)
    api.atomic_json(q,body);api.atomic_json(J/(id+'.references.json'),refs)
def prepare_first(id,path,prompt,duration):
    q=J/(id+'.request.json')
    if q.exists():return
    api.CACHE=R/'transport-cache'
    record=api.upload_reference(path)
    body=dict(model='MiniMax-H3',duration=duration,resolution='768P',ratio='16:9',content=[dict(type='text',text=prompt),dict(type='image_url',role='first_frame',image_url=dict(url=record['url']))])
    body,refs=cdn.promote(api,body,[dict(role='first_frame',**record)]);api.atomic_json(q,body);api.atomic_json(J/(id+'.references.json'),refs)
def submit(id):
    p=J/(id+'.json');q=J/(id+'.request.json')
    if p.exists():return read(p)
    body=read(q);api.validate_payload(body)
    for item in body['content']:
        if item.get('type')=='image_url':api.verify_image_url(item['image_url']['url'])
    raw=json.dumps(body,ensure_ascii=False,separators=(',',':')).encode();now=time.time()
    s=dict(status='dispatching',task_id=None,request_sha256=hashlib.sha256(raw).hexdigest(),idempotency_key='g2-user-repair-'+uuid.uuid4().hex,request_path=str(q.resolve()),dispatchEpoch=now,lastPollEpoch=now)
    with p.open('x',encoding='utf-8') as f:json.dump(s,f,ensure_ascii=False,indent=2)
    try:
        response=api.minimax_api('POST','/hailuo/v2/video_generation',raw,s['idempotency_key']);task=response.get('task_id') or response.get('data',{}).get('task_id');s.update(task_id=task,status='accepted' if task else 'unknown_outcome')
    except Exception as exc:s.update(status='unknown_outcome',errorType=type(exc).__name__)
    api.atomic_json(p,s);print(id,s['status'],s.get('task_id'),flush=True);return s
def poll_all():
    for p in J.glob('*.json'):
        if p.name.endswith(('.request.json','.references.json','.latest.json')):continue
        s=read(p)
        if not s.get('task_id'):continue
        if s['status'] not in api.TERMINAL:
            if time.time()-s['lastPollEpoch']<120:continue
            s['lastPollEpoch']=time.time();api.atomic_json(p,s);s=api.poll_task(p,interval=120,max_polls=1)
        if s['status']=='succeeded':
            target=R/'generated'/(p.stem+'.mp4');target.parent.mkdir(exist_ok=True)
            if not target.exists():
                with urllib.request.urlopen(s['result_url'],timeout=120) as source,target.with_suffix('.download').open('wb') as f:
                    while b:=source.read(1024*1024):f.write(b)
                target.with_suffix('.download').replace(target)
            print('DOWNLOADED',p.stem,hashlib.sha256(target.read_bytes()).hexdigest(),flush=True)
if __name__=='__main__':
    if sys.argv[1]=='poll':poll_all()
    elif sys.argv[1]=='submit':submit(sys.argv[2])
