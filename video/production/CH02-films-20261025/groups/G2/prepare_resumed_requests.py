from pathlib import Path
import sys,json,importlib.util,time
OUT=Path(__file__).parent;BASE=OUT.parents[1]
sys.path.insert(0,str(BASE/'scripts'));import cloudinary_shard_transport as shard
spec=importlib.util.spec_from_file_location('g2_shared_video_api','C:/Users/zhousirui/Documents/ChatGPT/平行世界/tools/video_api.py');api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,d):
    for attempt in range(20):
        try:return api.atomic_json(p,d)
        except PermissionError:
            if attempt==19:raise
            time.sleep(.3)
assert (OUT/'PAUSE_NEW_DISPATCH').exists(),'Prepare while the new POST gate remains closed'
count=0
for c in read(OUT/'plan.json')['clips']:
    if (OUT/'tasks'/f'{c["id"]}.json').exists():continue
    source=OUT/'requests'/f'{c["id"]}.local.json'
    body,refs=api.prepare_request(read(source),source.parent)
    body,refs=shard.promote(api,body,refs)
    target=OUT/'requests'/f'{c["id"]}.json';save(target,body);save(target.with_suffix('.references.json'),refs)
    count+=1;print(c['id'],'res-1 references verified, no paid request submitted',flush=True)
save(OUT/'requests/resumed-transport.json',dict(prepared=count,host='res-1.cloudinary.com',imageBytes='SHA256 identical to central approved reference bytes',authorization='Coordinator explicit recovery release after successful single global probe',newVideoSubmissions=0))
