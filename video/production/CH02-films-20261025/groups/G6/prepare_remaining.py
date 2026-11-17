"""Prepare the four remaining deliverable shots using verified HTTPS res-1.
No video POST. Running/uncertain remote records are never replaced.
"""
from pathlib import Path
import json,copy,importlib.util,hashlib,time
OUT=Path(__file__).resolve().parent;BASE=OUT.parents[1]
spec=importlib.util.spec_from_file_location('shared_video_api',Path('C:/Users/zhousirui/Documents/ChatGPT/平行世界/tools/video_api.py'))
api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,d):api.atomic_json(p,d)
plan=read(OUT/'plan.json')
central=read(BASE/'groups/G5/references/composition-manifest.json')['byId']['clerk-receiving-desk']
jobs=[]
for oldid in ['V41L-03','V41L-04']:
    original=read(OUT/'tasks'/f'{oldid}.json');assert original['status']=='failed' and original['error']['code']=='input_download_failed'
    assert read(OUT/'tasks'/f'{oldid}.latest.json')['task']['usage']['output_seconds']==0
    id=oldid+'-R2'
    if (OUT/'tasks'/f'{id}.json').exists():print(id,'remote state exists: untouched');continue
    body=read(OUT/'tasks'/f'{oldid}.request.json')
    c=copy.deepcopy(next(c for c in plan['requests'] if c['id']==oldid));c.update(id=id,replaces=oldid,retryReason='原任务明确input_download_failed，CDN恢复同图同内容')
    if not any(x['id']==id for x in plan['retries']):plan['retries'].append(c)
    jobs.append((id,body,central['path'],original['task_id']))
    (OUT/'prompts'/f'{id}.md').write_text((OUT/'prompts'/f'{oldid}.md').read_text(encoding='utf-8').replace(oldid,id),encoding='utf-8')
save(OUT/'plan.json',plan)
for id in ['V40-06-R2','V43-02']:
    if (OUT/'tasks'/f'{id}.json').exists():print(id,'remote state exists: untouched');continue
    local=OUT/'requests'/f'{id}.firstframe.local.json';body=read(local)
    ref=next(i['image_url']['local_path'] for i in body['content'] if i['type']=='image_url')
    if id=='V43-02':
        body['content'][0]['text']='11秒三国写实电影。从首帧开始，同一军营粮棚，另一天阴天。客观中远景。两名普通士卒从柱旁慢慢走入，停步交换不安目光，随后分别慢走散开。镜头缓缓拉远，展现营帐与远处营道。只有同步风声和脚步声，全程无人声、无音乐。'
    prepared,refs=api.prepare_request(body,OUT)
    jobs.append((id,prepared,ref,None))
for id,body,ref,original_task in jobs:
    expected=hashlib.sha256(Path(ref).read_bytes()).hexdigest()
    images=[i for i in body['content'] if i['type']=='image_url'];assert len(images)==1 and images[0]['role']=='first_frame'
    old=images[0]['image_url']['url'];assert old.startswith('https://res.cloudinary.com/') or old.startswith('https://res-1.cloudinary.com/')
    images[0]['image_url']['url']=old.replace('https://res.cloudinary.com/','https://res-1.cloudinary.com/',1)
    for attempt in range(3):
        try:verified=api.verify_image_url(images[0]['image_url']['url'],expected);break
        except api.PipelineError:
            if attempt==2:raise
            time.sleep(4)
    api.validate_payload(body);save(OUT/'requests'/f'{id}.json',body)
    save(OUT/'requests'/f'{id}.cdn-recovery.json',dict(id=id,originalTaskId=original_task,reference=ref,imageSha256=expected,verification=verified,newHost='res-1.cloudinary.com',remoteSubmitted=False,requiresCoordinatorOpening=True))
    save(OUT/'requests'/f'{id}.firstframe-override.json',dict(id=id,reference=ref,role='first_frame',imageSha256=expected,prepared=True,remoteSubmitted=False))
    print(json.dumps(dict(id=id,prepared=True,sha256=expected,host='res-1.cloudinary.com',submitted=False),ensure_ascii=False),flush=True)
