from pathlib import Path
import json,hashlib,wave
ROOT=Path(__file__).resolve().parent
OUT=ROOT/'user-review-batch2'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
whitelist=read(OUT/'speech-whitelist.json')
voice=read(ROOT.parents[1]/'voice/manifest.json')
rows=voice['rows']; records=[]
for w in whitelist:
    if w['role']!='player':continue
    r=rows[w['node']];p=Path(r['path']); h=hashlib.sha256(p.read_bytes()).hexdigest()
    assert h==r['sha256'] and r['text']==w['text']
    with wave.open(str(p)) as a:dur=a.getnframes()/a.getframerate()
    records.append(dict(**w,path=str(p),sha256=h,duration=dur,provider=voice['provider'],reuseAuthorization='20261025 batch2 coordinator clarification: central existing correct player WAV explicitly reusable; no new generation',listening='pending actual listening'))
(OUT/'player-voice-reuse.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(records,ensure_ascii=False,indent=2))
old=[]
for p in (ROOT/'review').glob('*asr.json'):
    r=read(p)
    if isinstance(r,list):old.append(dict(report=p.name,segments=[{k:s[k] for k in ['start','end','text'] if k in s} for s in r]))
(OUT/'historical-asr-locators.json').write_text(json.dumps(old,ensure_ascii=False,indent=2),encoding='utf-8')
for row in old:print(json.dumps(row,ensure_ascii=False))
