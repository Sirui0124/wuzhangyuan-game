"""Apply coordinator's confirmed same-byte CDN recovery, never replay a state."""
from pathlib import Path
import json,copy,time
OUT=Path(__file__).resolve().parent
def read(p):return json.loads(p.read_text(encoding='utf8'))
def save(p,x):p.write_text(json.dumps(x,ensure_ascii=False,indent=2),encoding='utf8')
observation=read(OUT.parents[2]/'ENDINGS-20261025/recovery-observation.json')
# OUT.parents[2]=.../production, verified explicit shared source.
assert observation['task']['status']=='succeeded' and observation['task']['usage']['output_seconds']==9
plan=read(OUT/'plan.json');rp=read(OUT/'repair-plan.json');created=[]
for orig,cid in [('V04-01','V04-01-R3'),('V04-02','V04-02-R2'),('V04-03','V04-03-R2'),('V04-04','V04-04-R2')]:
    state=read(OUT/'tasks'/f'{orig}.json');latest=read(OUT/'tasks'/f'{orig}.latest.json')['task']
    assert state['status']=='failed' and state['error']['code']=='input_download_failed' and latest['usage']['output_seconds']==0
    if (OUT/'tasks'/f'{cid}.json').exists():continue
    body=read(OUT/'requests'/f'{orig}.json');refs=read(OUT/'requests'/f'{orig}.references.json')
    save(OUT/'requests'/f'{cid}.json',body);save(OUT/'requests'/f'{cid}.references.json',refs)
    c=copy.deepcopy(next(c for c in plan['clips'] if c['id']==orig));c.update(id=cid,repairOf=orig,reason='Explicit input_download_failed; coordinator confirmed same-byte res-1 recovery',transport='same-byte-cloudinary-res-1')
    if not any(x['id']==cid for x in rp['clips']):rp['clips'].insert(0,c)
    original=(OUT/'prompts'/f'{orig}.md').read_text(encoding='utf8');(OUT/'prompts'/f'{cid}.md').write_text(original,encoding='utf8');created.append(cid)
save(OUT/'repair-plan.json',rp)
failed=[]
for p in (OUT/'tasks').glob('*.json'):
    if '.request.' in p.name or '.latest.' in p.name:continue
    s=read(p)
    if s['status']=='failed':failed.append(p.stem)
save(OUT/'transport.json',dict(mode='res-1-cloudinary',authorization='Coordinator formally resumed after confirmed 9s succeeded global probe',globalProbeId=observation['task']['id'],acknowledgedFailures=failed,activatedEpoch=time.time()))
hold=OUT/'POST-PAUSED.json'
if hold.exists():hold.replace(OUT/'archive/POST-PAUSED-before-res1.json')
states={p.stem for p in (OUT/'tasks').glob('*.json') if '.request.' not in p.name and '.latest.' not in p.name}
pending=[c['id'] for c in rp['clips']+plan['clips'] if c['id'] not in states]
print(json.dumps(dict(transport='res-1',newRecoveryIds=created,pending=len(pending),acknowledgedHistoricalFailures=failed,newPostsEnabled=True),ensure_ascii=False))
