"""Replace proven preset dialogue, keeping video packets and other audio intact."""
from pathlib import Path
from importlib.machinery import SourceFileLoader
import hashlib,json,subprocess,wave,sys
import numpy as np
import av
a=SourceFileLoader('voice_audit',str(Path(__file__).with_name('player-voice-audit-20261027.py'))).load_module()
RATE=48000
def pcm(p):
    b=subprocess.check_output([str(a.FF),'-v','error','-nostdin','-i',str(p),'-vn','-ac','2','-ar',str(RATE),'-f','f32le','pipe:1'])
    return np.frombuffer(b,dtype='<f4').reshape(-1,2).copy()
def packets(p):
    with av.open(str(p)) as c:return [hashlib.sha256(bytes(p)).hexdigest() for p in c.demux(video=0) if p.size]
def meta(p):
    with av.open(str(p)) as c:
        v=c.streams.video[0];return dict(duration=float(v.duration*v.time_base),containerDuration=c.duration/1e6,width=v.width,height=v.height,fps=str(v.average_rate),frames=v.frames,videoCodec=v.codec_context.name)
def stamp(t):
    ms=round(t*1000);return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02}.{ms%1000:03}'
def word_times(state):
    ans=[]
    for s in state['subtitle']['sentences']:
        for w in s.get('words',[]):
            for c in a.norm(w['text']):ans.append(dict(char=c,start=w['start_time']/1000,end=w['end_time']/1000))
    return ans

plan=a.read(a.OUT/'plan.json');changes=[];pending=[]
for f in plan['films']:
    hs=[h for h in plan['occurrences'] if h['filmId']==f['id']];states={}
    for h in hs:
        p=a.OUT/'generated'/(h['id']+'-state.json')
        if p.exists() and a.read(p)['status']=='succeeded':states[h['id']]=a.read(p)
    if len(states)!=len({h['id'] for h in hs}):pending.append(f['id']);continue
    ledger=a.OUT/'renders'/(f['id']+'.json')
    if ledger.exists():changes.append(a.read(ledger));continue
    src=Path(f['file']);assert a.sha(src)==f['sha256'];info=meta(src)
    original=pcm(src);mix=original.copy();cues=[dict(c) for c in f['cues']];replacements=[];windows=[];valid=True
    for h in sorted(hs,key=lambda x:x['window'][0]):
        state=states[h['id']];assert a.sha(state['file'])==state['sha256']
        actualText=''.join(s['text'] for s in state.get('subtitle',{}).get('sentences',[]))
        if a.norm(actualText)!=a.norm(h['text']):
            pending.append(dict(film=f['id'],line=h['id'],reason='provider-text-mismatch',expected=h['text'],actual=actualText));valid=False;break
        voice=pcm(state['file']);start,end=h['window'];end=min(end,info['duration']);maxn=round((end-start)*RATE)
        trim=0
        if len(voice)>maxn:
            lo,hi=a.active(voice.mean(axis=1),RATE);cutstart=max(0,lo-round(.035*RATE));cutend=min(len(voice),hi+round(.05*RATE))
            if cutend-cutstart>maxn:
                pending.append(dict(film=f['id'],line=h['id'],reason='voice-too-long',voiceSeconds=len(voice)/RATE,availableSeconds=maxn/RATE));valid=False;break
            trim=cutstart/RATE;voice=voice[cutstart:cutend]
        offset=round(start*RATE);stop=round(end*RATE)
        reference=original[round(h['speechStart']*RATE):round(min(h['speechEnd'],end)*RATE)]
        old=reference[np.max(np.abs(reference),axis=1)>.01];new=voice[np.max(np.abs(voice),axis=1)>.01]
        gain=min(float(np.sqrt(np.mean(old**2))/max(np.sqrt(np.mean(new**2)),1e-6)),.95/max(float(np.abs(voice).max()),1e-6))
        assert .1<gain<8,(h['id'],gain)
        voice*=gain;fade=min(round(.008*RATE),len(voice)//2)
        voice[:fade]*=np.linspace(0,1,fade)[:,None];voice[-fade:]*=np.linspace(1,0,fade)[:,None]
        ramp=round(.008*RATE);mix[offset:offset+ramp]*=np.linspace(1,0,ramp)[:,None];mix[offset+ramp:stop-ramp]=0;mix[stop-ramp:stop]*=np.linspace(0,1,ramp)[:,None]
        mix[offset:offset+len(voice)]+=voice;windows.append((offset,stop))
        words=word_times(state);normalized=''.join(w['char'] for w in words)
        for i in h['cueIndices']:
            needle=a.norm(cues[i]['text']);at=normalized.find(needle)
            assert at>=0,(h['id'],needle,normalized)
            cues[i]['start']=max(start,start+words[at]['start']-trim-.04)
            cues[i]['end']=min(end,start+words[at+len(needle)-1]['end']-trim+.07)
            assert cues[i]['end']>cues[i]['start']
        replacements.append(dict(id=h['id'],node=h['node'],text=h['text'],kind=h['kind'],oldVoice=h['file'],oldCorrelation=h['correlation'],newVoice=state['file'],newVoiceSha256=state['sha256'],references=state['references'],window=[start,end],insertAt=start,voiceSeconds=len(voice)/RATE,trimmedLeadingSilence=trim,gain=gain,speed=1,pitchUnchanged=True,model=state['model'],newUserApproved=False))
    if not valid:continue
    keep=np.ones(len(mix),dtype=bool)
    for lo,hi in windows:keep[lo:hi]=False
    assert np.array_equal(original[keep],mix[keep]);assert float(np.abs(mix).max())<=1.00001
    for i in range(len(cues)-1):
        if cues[i]['end']>cues[i+1]['start']:
            middle=(cues[i]['end']+cues[i+1]['start'])/2;cues[i]['end']=middle;cues[i+1]['start']=middle
    renderdir=a.OUT/'renders';renderdir.mkdir(exist_ok=True)
    master=renderdir/(f['id']+'-master.wav')
    with wave.open(str(master),'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(RATE);w.writeframes((np.clip(mix,-1,1)*32767).astype('<i2').tobytes())
    name='PV27-'+f['id']+'-'+a.sha(master)[:8]+'.mp4';dest=a.ROOT/'video/current'/name
    if not dest.exists():subprocess.run([str(a.FF),'-v','error','-nostdin','-i',str(src),'-i',str(master),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','256k','-ar',str(RATE),'-t',str(info['duration']),'-movflags','+faststart',str(dest)],check=True)
    assert packets(src)==packets(dest),'Video packets changed'
    subprocess.run([str(a.FF),'-v','error','-nostdin','-i',str(dest),'-f','null','NUL'],check=True)
    sub=a.ROOT/'GameStarter/web-demo/public/video/subtitles'/(dest.stem+'.vtt')
    sub.write_text('WEBVTT\n\n'+''.join(f'{i+1}\n{stamp(c["start"])} --> {stamp(c["end"])}\n{c["text"]}\n\n' for i,c in enumerate(cues)),encoding='utf-8')
    current={k:v for k,v in f.items() if k not in ['group','file','sha256','duration','cues','method','humanListeningReview']};current.update(src='/video/current/'+name,subtitles='/video/subtitles/'+sub.name)
    row=dict(id=f['id'],group=f['group'],oldSrc=f['src'],oldSha256=f['sha256'],oldSubtitles=f['subtitles'],file=str(dest),sha256=a.sha(dest),bytes=dest.stat().st_size,**meta(dest),current=current,replacements=replacements,cues=cues,videoPacketsIdentical=True,masterOutsideReplacementWindowsUnchanged=True,fullDecodePassed=True,humanListeningReview=False,userApproved=False)
    a.save(ledger,row);changes.append(row);print('RENDERED',f['id'],len(replacements),flush=True)
a.save(a.OUT/'render-status.json',dict(ready=len(changes),total=len(plan['films']),pending=pending,changes=changes))
print(json.dumps(dict(ready=len(changes),pending=pending),ensure_ascii=False))
