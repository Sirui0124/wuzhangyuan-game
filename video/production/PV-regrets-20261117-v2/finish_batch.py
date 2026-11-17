"""Only local screening and assembly. Never submits API jobs."""
from pathlib import Path
import json,subprocess,time,sys
R=Path(__file__).resolve().parent
AUDIO=r'D:/AI视频/VJ-1106/motion-runtime/audio-analysis-env/Scripts/python.exe'
plan=json.loads((R/'production-plan.json').read_text('utf-8'))
deadline=time.monotonic()+10800
done=set()
while time.monotonic()<deadline:
    for u in plan['units']:
        sid=u['id'];d=R/sid
        if sid in done or not (d/'technical.json').exists():continue
        try:
            for script,output in [('audit_music.py','audio-events-unverified.json'),('audit_small.py','audio-small-unverified.json')]:
                if not (d/output).exists():
                    with (d/(script+'.log')).open('wb') as f:
                        p=subprocess.run([AUDIO,str(R/script),sid],stdout=f,stderr=subprocess.STDOUT,timeout=240)
                    if p.returncode:raise RuntimeError(script+' failed; see per-shot log')
            done.add(sid);print(sid+' audio screened (machine only)',flush=True)
        except Exception as exc:
            (d/'screening-error.txt').write_text(type(exc).__name__+': '+str(exc),'utf-8')
            print(sid+' screening issue '+str(exc),flush=True);done.add(sid)
    if len(done)==len(plan['units']):
        print('All native sources available. Ready for visual selection before render.',flush=True);break
    states=[json.loads((R/u['id']/'state.json').read_text('utf-8')).get('status') if (R/u['id']/'state.json').exists() else '' for u in plan['units']]
    if any(s in ('failed','unknown_outcome','preparation_error') for s in states):
        print('One or more jobs need reconciliation; available shots remain screened.',flush=True)
        break
    time.sleep(10)
