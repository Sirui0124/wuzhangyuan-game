"""Fail closed at the next request boundary; never kill an in-flight POST."""
from pathlib import Path
import json,time,sys
OUT=Path(__file__).resolve().parent
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,v):
    p.parent.mkdir(parents=True,exist_ok=True);q=p.with_suffix(p.suffix+'.pause-tmp');q.write_text(json.dumps(v,ensure_ascii=False,indent=2),encoding='utf-8');q.replace(p)
restore=len(sys.argv)>1 and sys.argv[1]=='restore'
if restore:
    for p in (OUT/'requests/paused-originals').glob('*.json'):
        cid=p.name.replace('.local.json','').replace('.json','')
        if (OUT/'tasks'/f'{cid}.json').exists() and not p.name.endswith('.local.json'):continue
        save(OUT/'requests'/p.name,read(p))
    (OUT/'pause-submissions.json').unlink(missing_ok=True)
    print('Restored original unsubmitted request bodies; no POST performed')
else:
    save(OUT/'pause-submissions.json',dict(paused=True,reason='总控统一暂停：上游下载参考图出现IPv6/TLS故障；等待恢复方案',epoch=time.time()))
    changed=[]
    for p in (OUT/'requests').glob('*.json'):
        if p.name.endswith('.references.json'):continue
        cid=p.name.replace('.local.json','').replace('.json','')
        if (OUT/'tasks'/f'{cid}.json').exists():continue
        body=read(p)
        if 'model' not in body:continue
        backup=OUT/'requests/paused-originals'/p.name
        if not backup.exists():save(backup,body)
        body['model']='PAUSED_BY_TOTAL_CONTROL'
        save(p,body);changed.append(p.name)
    print(json.dumps(dict(gated=changed,inFlightPostsKilled=False),ensure_ascii=False))
