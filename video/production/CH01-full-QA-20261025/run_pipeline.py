"""Use the user's shared uploader/API without copying credentials into this project."""
from pathlib import Path
import importlib.util,json,sys,time,subprocess,urllib.request,hashlib,re
OUT=Path(__file__).parent;ROOT=OUT.parents[2]
spec=importlib.util.spec_from_file_location('shared_video_api',Path('C:/Users/zhousirui/Documents/ChatGPT/平行世界/tools/video_api.py'))
api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,d):api.atomic_json(p,d)
plan=read(OUT/'production.json')['clips'];selected=set(sys.argv[2:]);plan=[c for c in plan if not selected or c['id'] in selected]
def ingest(c,state):
    id=c['id'];raw=OUT/'generated'/f'{id}-raw.mp4';raw.parent.mkdir(exist_ok=True)
    if not raw.exists():
        with urllib.request.urlopen(state['result_url'],timeout=120) as response,raw.open('wb') as f:
            while b:=response.read(1024*1024):f.write(b)
    dest=OUT/'generated'/f'{id}-16x9.mp4'
    meta=subprocess.run([FF,'-hide_banner','-i',str(raw)],capture_output=True,text=True,encoding='utf-8',errors='replace').stderr
    m=re.search(r'Video:.*? (\d{3,5})x(\d{3,5})',meta);w,h=map(int,m.groups());unit=min(w//16,h//9)//2*2;cw,ch=unit*16,unit*9
    if not dest.exists():
        subprocess.run([FF,'-v','error','-y','-i',str(raw),'-vf',f'crop={cw}:{ch}:(iw-{cw})/2:(ih-{ch})/2,setsar=1','-r','24','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-movflags','+faststart',str(dest)],check=True)
    decoded=subprocess.run([FF,'-v','error','-i',str(dest),'-f','null','NUL'],capture_output=True)
    if decoded.returncode:raise RuntimeError(f'{id}: decode failed')
    save(OUT/'generated'/f'{id}-delivery.json',dict(id=id,task_id=state['task_id'],result_url=state['result_url'],raw=str(raw.resolve()),file=str(dest.resolve()),inputSize=[w,h],outputSize=[cw,ch],crop=[(w-cw)//2,(h-ch)//2,cw,ch],sha256=hashlib.sha256(dest.read_bytes()).hexdigest(),decode='passed',humanReview='待review',audioReview='未完成逐字听审'))
    print(json.dumps(dict(id=id,status='downloaded',size=[cw,ch]),ensure_ascii=False),flush=True)
mode=sys.argv[1]
if mode=='submit':
    original_poll=api.poll_task
    api.poll_task=lambda path:original_poll(path,max_polls=1)
    for c in plan:
        id=c['id'];state_path=OUT/'tasks'/f'{id}.json'
        if state_path.exists():print(id,'state exists; use poll',flush=True);continue
        local=OUT/'requests'/f'{id}.local.json';request=OUT/'requests'/f'{id}.json'
        if not request.exists():
            body,refs=api.prepare_request(read(local),local.parent)
            save(request,body);save(request.with_suffix('.references.json'),refs)
        try:
            state=api.submit_request(request,state_path)
            print(json.dumps(dict(id=id,task_id=state.get('task_id'),status=state.get('status')),ensure_ascii=False),flush=True)
            if state.get('status')=='succeeded':ingest(c,state)
        except Exception as e:
            print(json.dumps(dict(id=id,error=str(e)),ensure_ascii=False),flush=True)
            # Never submit another paid request after an uncertain outcome.
            if state_path.exists() and not read(state_path).get('task_id'):break
elif mode=='poll':
    for c in plan:
        path=OUT/'tasks'/f'{c["id"]}.json'
        if not path.exists():continue
        state=api.poll_task(path,max_polls=1) if read(path).get('status') not in api.TERMINAL else read(path)
        if state.get('status')=='succeeded':ingest(c,state)
        else:print(json.dumps(dict(id=c['id'],status=state.get('status'),error=state.get('error')),ensure_ascii=False),flush=True)
elif mode=='watch':
    while True:
        pending=0
        for c in plan:
            path=OUT/'tasks'/f'{c["id"]}.json'
            if not path.exists():continue
            state=read(path)
            if state.get('status') not in api.TERMINAL:state=api.poll_task(path,max_polls=1)
            if state.get('status')=='succeeded':
                if not (OUT/'generated'/f'{c["id"]}-delivery.json').exists():
                    try:ingest(c,state)
                    except Exception as e:print(c['id'],'download retry pending',type(e).__name__,flush=True);pending+=1
            elif state.get('status') not in api.TERMINAL:pending+=1
            else:print(c['id'],state.get('status'),state.get('error'),flush=True)
        if not pending:break
        time.sleep(45)
