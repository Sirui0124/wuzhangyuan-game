from pathlib import Path
import json,hashlib,numpy as np,subprocess
R=Path(__file__).resolve().parent;P=R/'夷陵撤离-PV-v2.11-完整成片.mp4'
def read(p):return json.loads(p.read_text('utf-8'))
t=read(R/'final-technical.json');a=read(P.with_suffix('.asr.json'));e=read(P.with_suffix('.events.json'));b=read(R/'browser-verification.json')
sha=hashlib.sha256(P.read_bytes()).hexdigest()
assert sha==t['sha256']==a['source_sha256']==e['source_sha256']
assert not [x for x in a['segments'] if x['in']>20.5]
assert max(x['music'] for x in e['windows'])<.1
assert b['status']=='pass' and b['playback']['ended'] and t['frames']==946
ff=str(R.parents[2]/'.local-tools/pv-h3/ffmpeg.exe')
raw=subprocess.check_output([ff,'-v','error','-i',str(P),'-vn','-f','f32le','-ar','48000','-ac','2','pipe:1'])
w=np.frombuffer(raw,'<f4').reshape(-1,2)
levels=[dict(start=i/48000,rms_db=float(20*np.log10(max(1e-9,np.sqrt(np.mean(w[i:i+24000]**2)))))) for i in range(0,len(w),24000)]
(R/'sound-levels.json').write_text(json.dumps(dict(sha256=sha,peak=float(np.max(np.abs(w))),half_second_windows=levels),indent=2),'utf-8')
result=dict(version='v2.11',sha256=sha,duration=t['duration'],frames=t['frames'],full_decode='pass',browser='pass',music_screen_max=max(x['music'] for x in e['windows']),speech_last_time=max(x['out'] for x in a['segments']),actual_generation_requests=4,selected=['F31','F32','F34'],rejected=['F33'],user_review='待review',human_full_listening=False,visual_check='contact sheets and dense action sheets',minimum_interior_half_second_rms=min(x['rms_db'] for x in levels[1:-2]))
(R/'final-review.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),'utf-8')
print(json.dumps(result,ensure_ascii=False))
