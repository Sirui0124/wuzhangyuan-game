"""Coordinator-authorized single global recovery probe. No other paid dispatch."""
from pathlib import Path
import json,copy,importlib.util,time,urllib.parse
OUT=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('shared_video_api',Path('C:/Users/zhousirui/Documents/ChatGPT/平行世界/tools/video_api.py'))
api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,d):api.atomic_json(p,d)
original=read(OUT/'tasks/V41L-02.json')
assert original['status']=='failed' and original['error']['code']=='input_download_failed'
latest=read(OUT/'tasks/V41L-02.latest.json')['task'];assert latest['usage']['output_seconds']==0
id='V41L-02-R2';state_path=OUT/'tasks'/f'{id}.json'
if state_path.exists():
    s=read(state_path);print(json.dumps(dict(id=id,status=s.get('status'),task_id=s.get('task_id'),note='saved state exists; no POST'),ensure_ascii=False));raise SystemExit()
body=read(OUT/'tasks/V41L-02.request.json');assert body['duration']==9 and body['model']=='MiniMax-H3'
images=[i for i in body['content'] if i['type']=='image_url'];assert len(images)==1 and images[0]['role']=='first_frame'
old=images[0]['image_url']['url'];assert urllib.parse.urlparse(old).hostname=='res.cloudinary.com'
new=old.replace('https://res.cloudinary.com/','https://res-1.cloudinary.com/',1)
sha='6ac9fb4a605d8fd040fba7e23a4272494f37c15e1f6afa169e641a4859811e1a'
verification=api.verify_image_url(new,sha)
images[0]['image_url']['url']=new;api.validate_payload(body)
request=OUT/'requests'/f'{id}.json';save(request,body)
save(OUT/'requests'/f'{id}.local.json',body)
save(OUT/'requests'/f'{id}.cdn-recovery.json',dict(id=id,originalTaskId=original['task_id'],originalStatus='failed',originalError=original['error'],newHost='res-1.cloudinary.com',imageSha256=sha,verification=verification,authorization='总控只授权此一条全球恢复probe，其他newPostEnabled=false',paidPostsAllowed=1,bodyChanges=['image_url.url hostname only']))
plan=read(OUT/'plan.json');c=copy.deepcopy(next(c for c in plan['requests'] if c['id']=='V41L-02'));c.update(id=id,replaces='V41L-02',retryReason='明确input_download_failed，原image同字节CDN HTTPS域名恢复probe')
if not any(x['id']==id for x in plan['retries']):plan['retries'].append(c);save(OUT/'plan.json',plan)
doc=(OUT/'prompts/V41L-02.md').read_text(encoding='utf-8');(OUT/'prompts'/f'{id}.md').write_text(doc.replace('V41L-02',id),encoding='utf-8')
api.poll_task=lambda p:read(Path(p))
s=api.submit_request(request,state_path)
s['submitted_epoch']=time.time();s['last_poll_epoch']=s['submitted_epoch'];save(state_path,s)
print(json.dumps(dict(id=id,status=s.get('status'),task_id=s.get('task_id'),imageSha256=sha,httpsVerification=verification,otherPostsEnabled=False),ensure_ascii=False),flush=True)
