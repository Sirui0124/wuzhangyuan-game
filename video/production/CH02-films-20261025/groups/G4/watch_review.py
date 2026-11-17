from pathlib import Path
import subprocess,time,json,sys
OUT=Path(__file__).resolve().parent
for attempt in range(160):
    plan=json.loads((OUT/'plan.json').read_text(encoding='utf-8'))
    pending=[c['id'] for c in plan['clips'] if (OUT/'generated'/f"{c['id']}-delivery.json").exists() and not (OUT/'review'/c['id']/'asr.json').exists()]
    if pending:
        subprocess.run([sys.executable,str(OUT/'review_extract.py'),*pending],check=True)
        subprocess.run([sys.executable,str(OUT/'make_review_page.py')],check=True)
    done=sum((OUT/'review'/c['id']/'asr.json').exists() for c in plan['clips'])
    if done==len(plan['clips']):break
    time.sleep(30)
