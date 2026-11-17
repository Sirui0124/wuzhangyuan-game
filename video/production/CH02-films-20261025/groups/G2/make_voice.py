from pathlib import Path
import json,urllib.request,base64,wave,math,time
OUT=Path(__file__).parent
plan=json.loads((OUT/'plan.json').read_text(encoding='utf-8'))
D=OUT/'voice';D.mkdir(exist_ok=True)
for c in plan['clips']:
    if c['kind']!='dialogue' or not c['sourceLines'][0]['speaker'].startswith('我'):continue
    l=c['sourceLines'][0];p=D/(l['node']+'.wav')
    if not p.exists():
        req=urllib.request.Request('http://127.0.0.1:8787/api/game/tts',data=json.dumps({'role':'player','text':l['text']}).encode(),headers={'Content-Type':'application/json'})
        pcm=bytearray();done=False
        with urllib.request.urlopen(req,timeout=90) as r:
            for line in r:
                if not line.strip():continue
                event=json.loads(line)
                if event.get('error'):
                    msg=str(event['error']);code=__import__('re').findall(r'\b\d{3,10}\b',msg)
                    raise RuntimeError('TTS error codes '+','.join(code)+'; service details suppressed')
                if event.get('audio'):pcm.extend(base64.b64decode(event['audio']))
                if event.get('done'):done=True
        if not done or not pcm:raise RuntimeError('TTS incomplete')
        with wave.open(str(p),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(24000);w.writeframes(pcm)
    with wave.open(str(p),'rb') as w:seconds=w.getnframes()/w.getframerate()
    c['voice']={'path':str(p.resolve()),'duration':seconds,'offset':1.0,'provider':'existing player TTS','voice':'ICL_uranus_zh_male_xiaohouye_tob','listeningReview':'未听审'}
    c['duration']=max(c['duration'],math.ceil(seconds+1.8));c['shots'][0]['end']=c['duration']
    if c['duration']>15:raise RuntimeError(c['id']+' must split before generating')
    (OUT/'plan.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2),encoding='utf-8')
    print(c['id'],round(seconds,2),c['duration'],flush=True)
    time.sleep(1.2)
plan['totalCandidateSeconds']=sum(c['duration'] for c in plan['clips'])
(OUT/'plan.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2),encoding='utf-8')
