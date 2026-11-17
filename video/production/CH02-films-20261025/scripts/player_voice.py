from pathlib import Path
import json,urllib.request,base64,wave,time,shutil,hashlib,sys
OUT=Path(__file__).resolve().parents[1];DEST=OUT/'voice';DEST.mkdir(exist_ok=True)
sys.path.insert(0,'C:/Users/zhousirui/Documents/ChatGPT/平行世界/tools')
from video_api import atomic_json
clips=json.loads((OUT/'sources/CHAPTER-TWO-VIDEO-SEGMENTS.json').read_text(encoding='utf-8'))['clips']
lines={l['node']:l for c in clips for l in c['lines'] if '我的' in l.get('voiceAndLipOwner','') or l['speaker']=='旁白'}
with urllib.request.urlopen('http://127.0.0.1:8787/api/game/tts/settings',timeout=10) as r: settings=json.load(r)
assert settings['configured'] and settings['player']=='ICL_uranus_zh_male_xiaohouye_tob',settings
rows={}
def manifest():atomic_json(DEST/'manifest.json',{'voice':settings['player'],'provider':'existing local seed-tts-2.0','status':'complete' if len(rows)==len(lines) and all(x.get('ready') for x in rows.values()) else 'in_progress','rows':rows,'expected':len(lines),'readyCount':sum(x.get('ready',False) for x in rows.values()),'listeningReview':'尚未逐字听审；由各组结合成片检查'})
for node,line in lines.items():
 dest=DEST/(node+'.wav');source='central_tts'
 if not dest.exists():
  reuse=OUT/'groups/G2/voice'/dest.name
  if reuse.exists():shutil.copy2(reuse,dest);source='reused_G2_same_voice'
 if not dest.exists():
  last=''
  for attempt in range(3):
   try:
    req=urllib.request.Request('http://127.0.0.1:8787/api/game/tts',data=json.dumps({'role':'player','text':line['text']}).encode(),headers={'Content-Type':'application/json'})
    pcm=bytearray();done=False
    with urllib.request.urlopen(req,timeout=65) as r:
     for raw in r:
      if not raw.strip():continue
      event=json.loads(raw)
      if event.get('error'):raise RuntimeError(event['error'])
      if event.get('audio'):pcm.extend(base64.b64decode(event['audio']))
      if event.get('done'):done=True
    assert done and pcm,'incomplete audio'
    with wave.open(str(dest),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(24000);w.writeframes(pcm)
    break
   except Exception as e:last=str(e);time.sleep(5*(attempt+1))
  else:rows[node]={'node':node,'text':line['text'],'ready':False,'error':last};manifest();print(node,'failed',flush=True);continue
 with wave.open(str(dest)) as w:duration=w.getnframes()/w.getframerate()
 rows[node]={'node':node,'text':line['text'],'speaker':line['speaker'],'path':dest.resolve().as_posix(),'duration':duration,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'ready':True,'source':source}
 manifest();print(node,round(duration,2),flush=True);time.sleep(.8)
manifest()
