from pathlib import Path
import json,urllib.request,hashlib
OUT=Path(__file__).parent
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def save(p,x):p.write_text(json.dumps(x,ensure_ascii=False,indent=2),encoding='utf-8')
plan=read(OUT/'production.json');clips=[];checks=[]
for c in plan['clips']:
 if c['id'].endswith('-R2'):continue
 old=c['id'];state=read(OUT/'tasks'/(old+'.json'))
 assert state['status']=='failed' and state['error']['code']=='input_download_failed',(old,state['status'])
 new=old+'-R2';request=read(OUT/'requests'/(old+'.json'));refs=read(OUT/'requests'/(old+'.references.json'))
 for item in request['content']:
  if item['type']!='image_url':continue
  url=item['image_url']['url'];newurl=url.replace('res.cloudinary.com/','res-1.cloudinary.com/')
  with urllib.request.urlopen(url,timeout=30) as r:before=r.read()
  with urllib.request.urlopen(newurl,timeout=30) as r:
   after=r.read();assert r.status==200 and r.headers.get('Content-Type','').startswith('image/')
  assert hashlib.sha256(before).digest()==hashlib.sha256(after).digest()
  checks.append(dict(url=newurl,sha256=hashlib.sha256(after).hexdigest(),originalTask=state['task_id'],status='identical-public-image-verified'))
  item['image_url']['url']=newurl
 save(OUT/'requests'/(new+'.json'),request);save(OUT/'requests'/(new+'.references.json'),refs)
 save(OUT/'requests'/(new+'.local.json'),read(OUT/'requests'/(old+'.local.json')))
 doc=(OUT/'prompts'/(old+'.md')).read_text(encoding='utf-8')
 (OUT/'prompts'/(new+'.md')).write_text(doc,encoding='utf-8')
 clips.append(dict(c,id=new,retries=old,reason='明确终态input_download_failed；使用同一Cloudinary的已验证字节相同的HTTPS交付别名。'))
save(OUT/'audit/cloudinary-alias-checks.json',checks)
plan['clips']+=clips;save(OUT/'production.json',plan)
print('All 4 original tasks explicitly failed input download. Alias images byte verified. Prepared unique R2 records.')
