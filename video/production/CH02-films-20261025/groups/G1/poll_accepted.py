"""Read only existing remote task IDs; never creates a POST."""
from pathlib import Path
import importlib.util,json,time
OUT=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('g1pipe',OUT/'run_pipeline.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
clips=m.read(OUT/'plan.json')['clips']+m.read(OUT/'repair-plan.json')['clips']
def snapshot():
    m.status(clips);p=OUT/'status.json';d=m.read(p);d['phase']='new-posts-paused-upstream-media-fetch';d['pauseReason']='input_download_failed: IPv6 unreachable/TLS timeout from upstream reading Cloudinary';m.save(p,d)
while True:
    snapshot();pending=0
    for c in clips:
        p=OUT/'tasks'/f"{c['id']}.json"
        if not p.exists():continue
        s=m.poll(c)
        if s.get('task_id') and s.get('status') not in m.api.TERMINAL:pending+=1
        snapshot()
    if not pending:break
    time.sleep(10)
