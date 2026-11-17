from pathlib import Path
import importlib.util,json,hashlib
OUT=Path(__file__).resolve().parent;BASE=OUT.parents[1]
def module(name,path):
    s=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
api=module('video_api','C:/Users/zhousirui/Documents/ChatGPT/平行世界/tools/video_api.py')
shard=module('cloudinary_shard',BASE/'scripts/cloudinary_shard_transport.py')
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
for id in ['V41L-03-R2','V41L-04-R2','V40-06-R2','V43-02']:
    if (OUT/'tasks'/f'{id}.json').exists():raise RuntimeError(id+': existing remote state, do not rewrite')
    path=OUT/'requests'/f'{id}.json';body=read(path);ref=read(OUT/'requests'/f'{id}.firstframe-override.json')['reference']
    record=dict(path=ref,role='first_frame',sha256=hashlib.sha256(Path(ref).read_bytes()).hexdigest())
    body,records=shard.promote(api,body,[record]);api.atomic_json(path,body);api.atomic_json(path.with_suffix('.references.json'),records)
    print(json.dumps(dict(id=id,transport=records[0]['transport'],sha256=records[0]['sha256'],submitted=False),ensure_ascii=False),flush=True)
