"""Check decoded video frames/PTS, not only container duration or decode exit."""
from pathlib import Path
import json,av,sys,uuid
OUT=Path(__file__).resolve().parent
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,d):
    t=p.with_name(p.name+'.'+uuid.uuid4().hex+'.tmp');t.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8');t.replace(p)
def inspect(path):
    path=Path(path);v_times=[];v_sizes=set();audio_end=0;audio_samples=0;audio_rate=None
    with av.open(str(path)) as c:
        duration=c.duration/av.time_base if c.duration is not None else None
        vs=c.streams.video[0];rate=float(vs.average_rate or 24);tb=str(vs.time_base)
        for fr in c.decode(video=0,audio=0):
            if isinstance(fr,av.VideoFrame):
                if fr.pts is None:raise RuntimeError('Missing decoded frame PTS')
                v_times.append(float(fr.pts*fr.time_base));v_sizes.add((fr.width,fr.height))
            elif isinstance(fr,av.AudioFrame):
                audio_rate=fr.sample_rate;audio_samples+=fr.samples
                if fr.pts is not None:audio_end=max(audio_end,float(fr.pts*fr.time_base)+fr.samples/fr.sample_rate)
    if not v_times:raise RuntimeError('No decoded video frames')
    deltas=[b-a for a,b in zip(v_times,v_times[1:])]
    end=v_times[-1]+1/rate
    ok=(duration is not None and duration-end<.13 and abs(len(v_times)-end*24)<4 and not any(d<=0 for d in deltas) and max(deltas or [0])<.085 and v_sizes=={(1280,720)})
    return dict(path=str(path),containerDuration=duration,videoFrames=len(v_times),firstPTS=v_times[0],lastPTS=v_times[-1],videoEnd=end,videoTimeBase=tb,averageRate=rate,maxFrameGap=max(deltas or [0]),ptsRegressions=sum(d<=0 for d in deltas),frameSizes=[list(x) for x in v_sizes],audioEnd=audio_end,audioDecodedSamples=audio_samples,audioSampleRate=audio_rate,fullVideoTrack=ok)
if __name__=='__main__':
    source=OUT/'review/pre-pts-fix-delivery.json' if '--before' in sys.argv else OUT/'delivery.json'
    results=[]
    for film in read(source)['films']:
        r=inspect(film['path']);r['id']=film['id'];results.append(r);print(json.dumps(r,ensure_ascii=False),flush=True)
    save(OUT/'review'/('tracks-before.json' if '--before' in sys.argv else 'tracks-final.json'),results)
