from pathlib import Path
import subprocess,time,json,sys
OUT=Path(__file__).resolve().parent
while True:
    ready=[p.name.removesuffix('-technical.json') for p in (OUT/'generated').glob('*-technical.json') if not (OUT/'review'/f"{p.name.removesuffix('-technical.json')}-sequence.jpg").exists()]
    if ready:
        subprocess.run([sys.executable,str(OUT/'review_media.py'),*ready],check=True)
    p=OUT/'status.json'
    if p.exists():
        d=json.loads(p.read_text(encoding='utf8'))
        if d.get('submitted',0)==d.get('totalRequests',-1) and d.get('inFlight')==0:break
    time.sleep(15)
