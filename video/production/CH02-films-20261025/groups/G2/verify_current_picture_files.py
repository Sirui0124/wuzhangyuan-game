"""Full actual video-track, source identity and no-seek first-frame verification; G2 only."""
from pathlib import Path
import json,subprocess,re,concurrent.futures,datetime
import repair_picture as r
O=Path(__file__).parent
def inspect(c):
    p=Path(c['file']);before=r.digest(p)
    x=subprocess.run([r.FF,'-v','error','-nostdin','-i',str(p),'-map','0:v:0','-an','-fps_mode','passthrough','-progress','pipe:1','-nostats','-f','null','-'],capture_output=True,text=True,encoding='utf-8',errors='replace')
    progress=dict(l.split('=',1) for l in x.stdout.splitlines() if '=' in l);count=int(progress['frame']);end=int(progress['out_time_us'])/1000000
    assert x.returncode==0 and not x.stderr
    assert abs(count/24-c['duration'])<.09 and abs(end-c['duration'])<.09,(c['id'],count,end,c['duration'])
    f=O/'review/current-first-frames'/f'{c["id"]}.jpg';f.parent.mkdir(exist_ok=True)
    subprocess.run([r.FF,'-v','error','-y','-i',str(p),'-map','0:v:0','-frames:v','1',str(f)],check=True)
    assert before==r.digest(p)==c['sha256']
    return dict(id=c['id'],file=str(p),sha256=before,containerSeconds=c['duration'],decodedFrames=count,videoSeconds=count/24,videoEndSeconds=end,noSeekFirstFrame=str(f),decodeExitCode=x.returncode,decodeWarnings=x.stderr)
def main():
    d=r.read(O/'review/picture-repair-candidates.json');rows=list(concurrent.futures.ThreadPoolExecutor(max_workers=3).map(inspect,d['clips']))
    plans={c['id']:c for c in r.PLAN['clips']}
    assert len(d['subclips'])==len(plans)==35
    for c in d['subclips']:
        assert c['sourceLines']==plans[c['id']]['sourceLines'] and c['sha256']==r.digest(c['file'])
    nodes={l['node'] for c in d['subclips'] for l in c['sourceLines']};assert len(nodes)==33
    r.save(O/'review/current-picture-integrity.json',dict(updatedUtc=datetime.datetime.now(datetime.timezone.utc).isoformat(),clips=rows,sourceRequests=35,uniqueSourceNodes=33,sourceLineExactMatch=True,newPaidRepairJobs=0,newTTS=0,userApproved=False))
    print('VERIFIED',len(rows),'full video tracks; exact 35 requests / 33 nodes',flush=True)
if __name__=='__main__':main()
