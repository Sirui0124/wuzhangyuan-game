from pathlib import Path
import time,subprocess,sys,json
OUT=Path(__file__).parent
previous=-1
while True:
    count=len(list((OUT/'generated').glob('*-technical.json')))
    if count!=previous:
        subprocess.run([sys.executable,str(OUT/'postprocess.py')],check=True);previous=count
    total=len(json.loads((OUT/'plan.json').read_text(encoding='utf-8'))['clips'])
    if count==total:break
    time.sleep(25)
