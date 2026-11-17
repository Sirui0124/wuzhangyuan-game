"""Locate the old preset player recordings in the current films, using PCM evidence."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import json, re, subprocess, hashlib, sys
import numpy as np

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'video/production/player-voice-repair-20261027'
FF=Path('C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe')
RATE=4000
def read(p):return json.loads(Path(p).read_text(encoding='utf-8-sig'))
def save(p,x):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def pcm(p,rate=RATE,tempo=1):
    args=[str(FF),'-v','error','-nostdin','-i',str(p),'-vn','-ac','1','-ar',str(rate)]
    if tempo!=1:args+=['-af',f'atempo={tempo}']
    q=subprocess.run(args+['-f','f32le','pipe:1'],capture_output=True)
    if q.returncode:
        if b'does not contain any stream' in q.stderr:return np.zeros(1,dtype=np.float32)
        raise RuntimeError(q.stderr.decode(errors='replace'))
    return np.frombuffer(q.stdout,dtype='<f4').copy()
def active(a,rate=RATE):
    step=max(1,int(.02*rate));n=len(a)//step
    if not n:return (0,len(a))
    energy=np.sqrt(np.mean(a[:n*step].reshape(n,step)**2,axis=1));ix=np.flatnonzero(energy>max(.003,float(energy.max())*.045))
    return (max(0,(int(ix[0])-2)*step), min(len(a),(int(ix[-1])+3)*step)) if len(ix) else (0,len(a))
def correlate(x,y):
    if len(y)>len(x):return (0.,0)
    x=x.astype(np.float64);y=y.astype(np.float64)
    sums=np.r_[0,np.cumsum(x.astype(np.float64)**2)]
    energy=sums[len(y):]-sums[:-len(y)]
    den=np.sqrt(np.maximum(energy*float(np.sum(y**2)),1e-12))
    n=1<<(len(x)+len(y)-2).bit_length()
    conv=np.fft.irfft(np.fft.rfft(x,n)*np.fft.rfft(y[::-1],n),n)
    c=conv[len(y)-1:len(x)]/den
    c[energy<len(y)*.002**2]=0
    c[c>1.00001]=0
    i=int(np.argmax(c));return float(c[i]),i
def norm(t):return re.sub(r'[^\w\u4e00-\u9fff]','',t).lower()
def vtt(path):
    text=path.read_text(encoding='utf-8-sig').replace('\r\n','\n');ans=[]
    sec=lambda x:sum(float(v)*m for v,m in zip(x.split(':'),[3600,60,1]))
    for b in re.split(r'\n\s*\n',text):
        m=re.search(r'(\d\d:\d\d:\d\d\.\d{3}) --> (\d\d:\d\d:\d\d\.\d{3})\n(.*)',b,re.S)
        if m:ans.append(dict(start=sec(m[1]),end=sec(m[2]),text=m[3].strip()))
    return ans

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    refs=read(ROOT/'source-art/audio/player-reference-review-20261027/manifest.json')
    refs['userConfirmation']='2026-10-27 用户：都正确；3和4为常规，1和2为思考或沉重场景。'
    for r in refs['samples']:
        assert sha(r['file'])==r['sha256'];r['userApproved']=True
        r['usage']='regular-dialogue' if r['id'].startswith(('03','04')) else 'thought-or-heavy'
    save(OUT/'approved-references.json',refs)
    old=[]
    d=ROOT/'video/production/CH01-cinematic-20261025/voice';m=read(d/'manifest.json')
    for k,t in m['lines'].items():old.append(dict(id='C1-'+k,node=k,text=t,speaker='我（心声）' if k.startswith('M') or k in ['B-03','B-04'] else '我',file=str(d/(k+'.wav')),chapter=1,provider=m['provider']))
    m=read(ROOT/'video/production/CH02-films-20261025/voice/manifest.json')
    for k,r in m['rows'].items():old.append(dict(id=k,node=k,text=r['text'],speaker=r['speaker'],file=r['path'],chapter=2,provider=m['provider']))
    def template(r):
        a=pcm(r['file']);lo,hi=active(a);r={**r,'sha256':sha(r['file']),'duration':len(a)/RATE,'speechRange':[lo/RATE,hi/RATE]}
        return r,a[lo:hi]
    templates=list(ThreadPoolExecutor(4).map(template,old))
    config=read(ROOT/'GameStarter/web-demo/public/cinematics.json');media=read(ROOT/'GameStarter/web-demo/public/video/media-manifest.json')
    save(OUT/'before/cinematics.json',config);save(OUT/'before/media-manifest.json',media)
    clips=[dict(group=g,**c) for g,cs in config.items() if isinstance(cs,list) for c in cs if c.get('src')]
    def scan(c):
        p=ROOT/c['src'].lstrip('/');assert p.exists()
        a=pcm(p);cues=vtt(ROOT/'GameStarter/web-demo/public'/c['subtitles'].lstrip('/'))
        hits=[];near=[]
        for r,y in templates:
            score,idx=correlate(a,y)
            if score>=.64:
                start=idx/RATE-r['speechRange'][0]
                hits.append(dict(**r,correlation=score,insertAt=round(start,4),speechStart=idx/RATE,speechEnd=(idx+len(y))/RATE))
            elif any(norm(q['text']) in norm(r['text']) or norm(r['text']) in norm(q['text']) for q in cues if len(norm(q['text']))>=5):
                near.append(dict(id=r['id'],score=score,text=r['text']))
        result=dict(**c,file=str(p),sha256=sha(p),duration=len(a)/RATE,cues=cues,presetMatches=hits,unmatchedTextCandidates=near,method='Normalized waveform cross-correlation against original preset WAV; no claim of subjective listening',humanListeningReview=False)
        save(OUT/'audit'/f'{c["id"]}.json',result)
        print(c['id'],len(hits),'preset lines',flush=True)
        return result
    results=list(ThreadPoolExecutor(4).map(scan,clips))
    summary=dict(clips=len(results),presetOccurrences=sum(len(x['presetMatches']) for x in results),affectedFilms=sum(bool(x['presetMatches']) for x in results),results=results,templates=[r for r,a in templates],scope='Current Chapter 1 and 2 cinematics, including current previews and endings; replacement candidates require positive old-preset waveform evidence')
    save(OUT/'audit.json',summary)
    print(json.dumps({k:v for k,v in summary.items() if k not in ['results','templates']},ensure_ascii=False))
if __name__=='__main__':main()
