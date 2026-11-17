"""One coordinator-authorized data-URI recovery probe. No general relaxation."""
from pathlib import Path
import json,hashlib,base64,uuid,time,importlib.util,sys,io
from PIL import Image
OUT=Path(__file__).resolve().parent;CID='V04-01-R2'
spec=importlib.util.spec_from_file_location('shared_api',Path('C:/Users/zhousirui/Documents/ChatGPT/平行世界/tools/video_api.py'));api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,d):api.atomic_json(p,d)
state_path=OUT/'tasks'/f'{CID}.json';request_path=OUT/'requests'/f'{CID}.data.json'
def prepare():
    original=read(OUT/'requests/V04-01.json');refs=read(OUT/'requests/V04-01.references.json')
    assert len(refs)==1 and refs[0]['role']=='first_frame'
    p=Path(refs[0]['path']);data=p.read_bytes();sha=hashlib.sha256(data).hexdigest()
    assert sha==refs[0]['sha256']=='d24f553d3bdc91e9e8a74ee2e606e7b67c9e1873223e3275f94370f5467684b9'
    ext,mime=api.image_type(data);assert ext in {'png','jpg','webp'} and len(data)<=30*1024*1024
    with Image.open(io.BytesIO(data)) as im:
        dims=list(im.size);assert im.format in {'PNG','JPEG','WEBP'};im.verify()
    assert original['model']=='MiniMax-H3' and original['duration']==9 and original['resolution']=='768P' and original['ratio']=='16:9'
    assert len(original['content'])==2
    text=original['content'][0];media=original['content'][1]
    assert text['type']=='text' and text['text'].strip() and media['type']=='image_url' and media['role']=='first_frame'
    assert '永安那地方，五月不灌两口酒，江风能钻进骨头缝。' in text['text']
    uri='data:'+mime+';base64,'+base64.b64encode(data).decode('ascii')
    # Validate this one media shape, not arbitrary URI types or remote schemes.
    prefix,encoded=uri.split(',',1);assert prefix in {'data:image/png;base64','data:image/jpeg;base64','data:image/webp;base64'}
    decoded=base64.b64decode(encoded,validate=True);assert hashlib.sha256(decoded).hexdigest()==sha and api.image_type(decoded)[1]==mime
    media['image_url']={'url':uri}
    raw=json.dumps(original,ensure_ascii=False,separators=(',',':')).encode('utf8');assert len(raw)<=64*1024*1024
    meta=dict(id=CID,repairOf='V04-01',authorization='Coordinator explicitly permits the sole global inline-reference recovery probe',imageSha256=sha,imageBytes=len(data),imageMime=mime,imageSize=dims,payloadBytes=len(raw),requestSha256=hashlib.sha256(raw).hexdigest(),duration=9,referenceRole='first_frame',transport='strict-image-data-uri')
    save(request_path,original);save(OUT/'requests'/f'{CID}.data-metadata.json',meta)
    return raw,meta
def submit():
    if state_path.exists():
        s=read(state_path);print(json.dumps(dict(id=CID,status=s['status'],task_id=s.get('task_id'),resubmitted=False),ensure_ascii=False),flush=True);return
    raw,meta=prepare()
    # Secret exists only in process memory. Decrypt before creating POST guard.
    key=api.load_secret('openai-next-key.dpapi');api.load_secret=lambda name:key if name=='openai-next-key.dpapi' else (_ for _ in ()).throw(RuntimeError('Unexpected secret'))
    state=dict(status='dispatching',task_id=None,idempotency_key='g1-inline-probe-'+uuid.uuid4().hex,request_sha256=meta['requestSha256'],request_path=str(request_path),submitted_epoch=time.time(),last_poll_epoch=time.time(),probe_metadata=meta)
    state_path.parent.mkdir(exist_ok=True)
    with state_path.open('x',encoding='utf8') as f:json.dump(state,f,ensure_ascii=False,indent=2)
    try:
        result=api.minimax_api('POST','/hailuo/v2/video_generation',raw,state['idempotency_key'])
        task_id=result.get('task_id') or result.get('data',{}).get('task_id');state.update(task_id=task_id,status='accepted' if task_id else 'unknown_outcome')
    except Exception as exc:state.update(status='unknown_outcome',error=type(exc).__name__)
    state['submitted_epoch']=time.time();state['last_poll_epoch']=state['submitted_epoch'];save(state_path,state)
    save(OUT/'recovery-probe.json',{**meta,'status':state['status'],'task_id':state.get('task_id')})
    plan=read(OUT/'repair-plan.json');base=dict(next(c for c in read(OUT/'plan.json')['clips'] if c['id']=='V04-01'));base.update(id=CID,repairOf='V04-01',transport='strict-image-data-uri')
    if not any(c['id']==CID for c in plan['clips']):plan['clips'].append(base);save(OUT/'repair-plan.json',plan)
    print(json.dumps({**meta,'status':state['status'],'task_id':state.get('task_id')},ensure_ascii=False),flush=True)
    if not state.get('task_id'):raise RuntimeError('Unknown probe outcome; no automatic resubmission')
if __name__=='__main__':submit()
