"""Refresh old worker only within its proven post-tick sleep; never during POST."""
from pathlib import Path
from datetime import datetime,timezone
import json,time,os,signal,subprocess
OUT=Path(__file__).resolve().parent
end=time.time()+50
pid=int((OUT/'pipeline.lock').read_text())
cmd=subprocess.run(['powershell','-NoProfile','-Command',f'(Get-CimInstance Win32_Process -Filter "ProcessId={pid}").CommandLine'],capture_output=True,text=True).stdout
assert 'run_pipeline.py watch' in cmd and 'groups/G3' in cmd,cmd
while time.time()<end:
 s=json.loads((OUT/'status.json').read_text(encoding='utf-8'))
 age=time.time()-datetime.fromisoformat(s['updated_utc'].replace('Z','+00:00')).timestamp()
 states=[json.loads(p.read_text(encoding='utf-8')) for p in (OUT/'tasks').glob('*.json') if '.latest.' not in p.name and '.request.' not in p.name]
 if 1<age<8 and not any(x.get('status')=='dispatching' for x in states):
  # The watch loop sleeps for thirty seconds immediately after this timestamp.
  os.kill(pid,signal.SIGTERM);time.sleep(.5);(OUT/'pipeline.lock').unlink(missing_ok=True)
  print('Stopped old scheduler during verified post-tick sleep; all saved task IDs preserved',flush=True);break
 time.sleep(.5)
else:print('No proven idle window observed; worker left running',flush=True)
