"""Check speech tails against leaf trim and final parent audio cap, not nominal video sums."""
from user_review_render import *
import wave
native_ends={'V16C-02-raw.mp4':9.6,'V19A-02-raw.mp4':9.97,'V19C-02-raw.mp4':9.21,'V20-02-raw.mp4':9.18,'V20-05-raw.mp4':7.08,'V20-07-raw.mp4':7.02,'V20-08-raw.mp4':7.22}
states={str(Path(j['file']).resolve()).lower():j for p in (R/'audio').glob('*seed-audio-state.json') if (j:=read(p)).get('status')=='succeeded'}
rows=[]
def walk(m,parent,base=0,cap=None):
    if cap is None:cap=m['videoSeconds']
    if m.get('recipe',{}).get('audioMode')=='parts':
        t=0
        for part in m['recipe']['parts']:
            sub=read(Path(part['file']).with_suffix('.json'));walk(sub,parent,base+t,min(sub['videoSeconds'],cap-t));t+=sub['videoSeconds']
        return
    a=m.get('recipe',{}).get('audio')
    if not a:return
    f=Path(a['file']);key=str(f.resolve()).lower();offset=a.get('offset',0);start=a.get('start',0)
    if key in states:
        j=states[key];end=max(x['end_time'] for x in j['subtitle']['sentences'])/1000;evidence='Seed-Audio1.0 service word/sentence timing; not actual hearing'
    elif f.name in native_ends:end=native_ends[f.name];evidence='Original native ASR last-word locator; actual listening pending'
    else:
        with wave.open(str(f)) as v:end=v.getnframes()/v.getframerate()
        evidence='Complete existing player WAV duration, including its tail'
    speech_end=offset+end-start;available=min(m['videoSeconds'],cap);margin=available-speech_end
    row=dict(parent=parent,child=m['id'],file=m['file'],sha256=m['sha256'],audioSource=str(f.resolve()),audioSourceSha256=sha(f),sourceLastSpeechEnd=end,evidence=evidence,sourceTrimStart=start,sourceTrimEnd=a.get('end'),offset=offset,lastSpeechEndInChild=speech_end,parentAudioStart=base,lastSpeechEndInParent=base+speech_end,availableChildAudioSeconds=available,tailMarginSeconds=margin,technicalTailCheck=margin>=.08,subjectiveListening=False)
    rows.append(row);assert margin>=.08,row
for id in ['V13','V15','V16A','V16C','V17','V18','V19A','V19B','V19C','V20']:
    ps=[p for p in (R/'candidates').glob(id+'-*.json') if read(p)['id']==id];m=read(max(ps,key=lambda p:p.stat().st_mtime));walk(m,id)
save(R/'audio/batch2-boundary-audit.json',dict(rows=rows,status='all listed canonical spoken endings fit leaf and final parent trim with at least0.08s margin',v16b='Exact user-approved file preserved, no new concat in this round; no change to its audio',limitations='Native source endpoints are ASR locators. Service timing and ASR do not replace actual listening or user voice approval. Parent audio concat uses full child durations, so final cap is checked separately from actual video node spans.'))
print('BOUNDARIES',len(rows),'PASS; minimum margin',min(x['tailMarginSeconds'] for x in rows),flush=True)
