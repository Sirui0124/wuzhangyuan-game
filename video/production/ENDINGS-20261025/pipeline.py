"""Small resumable adapter for five authorized ending films; no secret output."""
import argparse
import hashlib
import json
from pathlib import Path
import sys
import time
import urllib.request

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parents[2]
sys.path.insert(0, str(PROJECT.parent/'平行世界'/'tools'))
import video_api as api

def read(p):
    return json.loads(Path(p).read_text(encoding='utf-8-sig'))

def prepare():
    out=[]
    for spec in read(ROOT/'plan.json'):
        result=read(ROOT/'references'/spec['key']/'result.json')
        ref=Path(result['local_path'])
        digest=hashlib.sha256(ref.read_bytes()).hexdigest()
        if digest != result['sha256']:
            raise ValueError('Reference changed after image collection')
        url=result['cloudinary']['url'].replace('https://res.cloudinary.com/','https://res-1.cloudinary.com/',1)
        check=api.verify_image_url(url,digest)
        body={'model':'MiniMax-H3','duration':12,'resolution':'768P','ratio':'16:9',
              'content':[{'type':'text','text':Path(spec['apiPrompt']).read_text(encoding='utf-8')},
                         {'type':'image_url','image_url':{'url':url},'role':'first_frame'}]}
        api.validate_payload(body)
        api.atomic_json(ROOT/'requests'/f"{spec['id']}.json",body)
        api.atomic_json(ROOT/'requests'/f"{spec['id']}.references.json",{'role':'first_frame','path':str(ref),'sha256':digest,'url':url,'check':check})
        out.append({'id':spec['id'],'reference':str(ref),'status':'prepared-not-submitted'})
    api.atomic_json(ROOT/'prepared.json',out)
    print('Prepared and verified',len(out),'requests; no video POST.')

def recovery_ready():
    probe=PROJECT/'video/production/CH02-films-20261025/groups/G6/tasks/V41L-02-R2.json'
    own=ROOT/'recovery-observation.json'
    observed=read(own) if own.exists() else {}
    observed_task=observed.get('task') or observed.get('data',{}).get('task',{})
    if (not probe.exists() or read(probe).get('status')!='succeeded') and observed_task.get('status')!='succeeded':
        raise RuntimeError('Existing res-1 recovery task has not succeeded; no new video POST.')

def submit():
    recovery_ready()
    original_poll=api.poll_task
    api.poll_task=lambda p,**kw: original_poll(p,interval=120,max_polls=1)
    for spec in read(ROOT/'plan.json'):
        state=ROOT/'tasks'/f"{spec['id']}.json"
        if state.exists():
            print(spec['id'],'already has a submission record; skipped')
            continue
        result=api.submit_request(ROOT/'requests'/f"{spec['id']}.json",state)
        result['last_poll_epoch']=time.time()
        api.atomic_json(state,result)
        print(spec['id'],result.get('task_id'),result.get('status'),flush=True)
        if result.get('status')=='failed':
            break

def poll():
    for state in (ROOT/'tasks').glob('C1END-*.json'):
        if '.latest.' in state.name or '.request.' in state.name: continue
        data=read(state)
        if data.get('status') in api.TERMINAL:
            print(state.stem,data['status'])
            continue
        if not data.get('task_id') or time.time()-data.get('last_poll_epoch',0)<120:
            continue
        data=api.poll_task(state,max_polls=1)
        data['last_poll_epoch']=time.time()
        api.atomic_json(state,data)

def download():
    folder=ROOT/'generated'
    folder.mkdir(exist_ok=True)
    for state in (ROOT/'tasks').glob('C1END-*.json'):
        if '.latest.' in state.name or '.request.' in state.name: continue
        data=read(state)
        if data.get('status')!='succeeded': continue
        target=folder/f"{state.stem}.mp4"
        if target.exists(): continue
        url=api.public_https(data['result_url'])
        req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'})
        with urllib.request.urlopen(req,timeout=120) as response:
            api.public_https(response.url)
            payload=response.read(200*1024*1024+1)
        if len(payload)>200*1024*1024 or b'ftyp' not in payload[:64]:
            raise ValueError('Unexpected video payload')
        temp=target.with_suffix('.part')
        temp.write_bytes(payload)
        temp.replace(target)
        print(state.stem,len(payload),'bytes downloaded')

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('action',choices=['prepare','submit','poll','download'])
    action=parser.parse_args().action
    globals()[action]()
