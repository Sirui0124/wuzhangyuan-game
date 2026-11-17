"""One minimal visual repair. Hold unsubmitted original queue during the pilot."""
from pathlib import Path
import sys,time,json
OUT=Path(__file__).parent
sys.path.insert(0,str(OUT))
from run_pipeline import api,read,save,ingest
def hold():
    folder=OUT/'requests'/'held-for-pilot';folder.mkdir(exist_ok=True)
    moved=[]
    for c in read(OUT/'plan.json')['clips']:
        if (OUT/'tasks'/f'{c["id"]}.json').exists():continue
        p=OUT/'requests'/f'{c["id"]}.local.json';dest=folder/p.name
        if p.exists() and not dest.exists():p.rename(dest);moved.append(c['id'])
    print('Original unsubmitted queue held:',moved,flush=True)
def restore():
    folder=OUT/'requests'/'held-for-pilot'
    for p in folder.glob('*.local.json'):
        dest=OUT/'requests'/p.name
        if not dest.exists():p.rename(dest)
    print('Original queue restored',flush=True)
if sys.argv[1]=='restore':restore();raise SystemExit()
hold()
c=next(x for x in read(OUT/'repair-plan.json')['clips'] if x['parentId']=='V32A-04')
id=c['id'];local=OUT/'requests'/f'{id}.local.json';prepared=OUT/'requests'/f'{id}.json';statepath=OUT/'tasks'/f'{id}.json'
body=read(local)
body['content'][0]['text']='历史电影实拍。苟安在夜间伤帐的低案后安静坐着，嘴唇合拢，耐心听对面的人说话。轻微自然呼吸，眼神偶尔轻移。摄影机正对苟安，固定中近景，保持首帧的人物、纸张、衣服和灯光，完整持续8秒。只有安静帐内环境声。'
if not statepath.exists():save(local,body)
while True:
    if statepath.exists():
        s=read(statepath)
        if not s.get('task_id'):print('Pilot uncertain; no repeat',flush=True);break
        if s.get('status') not in api.TERMINAL and time.time()-s.get('last_query_epoch',s.get('submitted_epoch',time.time()))>=120:
            s['last_query_epoch']=time.time();save(statepath,s);api.poll_task(statepath,interval=120,max_polls=1);s=read(statepath)
        if s.get('status')=='succeeded':ingest(c,s);break
        if s.get('status') in api.TERMINAL:print('Pilot terminal',s['status'],flush=True);break
    else:
        active=[]
        for p in (OUT/'tasks').glob('*.json'):
            if any(x in p.name for x in ['.request.','.latest.']):continue
            s=read(p)
            if s.get('task_id') and s.get('status') not in api.TERMINAL:active.append(p.stem)
        if len(active)<5: # conservatively leave one place for the unknown initial request
            if not prepared.exists():
                b,refs=api.prepare_request(read(local),local.parent);save(prepared,b);save(prepared.with_suffix('.references.json'),refs)
            original=api.poll_task;api.poll_task=lambda p:read(Path(p))
            try:s=api.submit_request(prepared,statepath)
            finally:api.poll_task=original
            s['submitted_epoch']=time.time();s['last_query_epoch']=s['submitted_epoch'];save(statepath,s)
            print(id,s['task_id'],'accepted',flush=True)
    time.sleep(20)
