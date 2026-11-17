"""Clean recuts: only cuts, whole-frame crop, rescale and explicit audio. Never cards/masks/holds/loops."""
from pathlib import Path
import json,subprocess,hashlib,sys,cv2
from PIL import Image,ImageDraw
O=Path(__file__).parent;R=O/'user-review-20261025';FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
def read(p):return json.loads(Path(p).read_text(encoding='utf-8-sig'))
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def save(p,d):Path(p).parent.mkdir(parents=True,exist_ok=True);Path(p).write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8')
def raw(id):return str((O/'generated'/(id+'-raw.mp4')).resolve())
def render(c):
    identity=hashlib.sha256(('duration-aligned-v2'+json.dumps(c,ensure_ascii=False,sort_keys=True)).encode()).hexdigest()[:10];D=R/'candidates';D.mkdir(exist_ok=True);p=D/(c['id']+'-'+identity+'.mp4');meta=p.with_suffix('.json')
    if p.exists() and meta.exists():return read(meta)
    args=[];f=[];duration=0
    for i,part in enumerate(c['parts']):
        source=part.get('file') or raw(part['source']);args+=['-i',source];a,b=part['range'];duration+=b-a;crop=part.get('crop');extra=f',crop={crop[2]}:{crop[3]}:{crop[0]}:{crop[1]}' if crop else ''
        f.append(f'[{i}:v]trim=start={a}:end={b},setpts=PTS-STARTPTS{extra},scale=1280:720,setsar=1,fps=24[v{i}]')
    f.append(''.join(f'[v{i}]' for i in range(len(c['parts'])))+f'concat=n={len(c["parts"])}:v=1:a=0[v]')
    audio=c.get('audio');k=len(c['parts'])
    quarantine=R/'audio/QUARANTINED-SEED-AUDIO-PENDING-LISTENING.json'
    if audio and quarantine.exists():
        denied={x.get('sha256') for x in read(quarantine)['states'] if x.get('sha256')}
        release=R/'audio/batch2-adoption-release.json'
        allowed=set(read(release).get('candidateSha256',[])) if release.exists() else set()
        if sha(audio['file']) in denied and sha(audio['file']) not in allowed:raise RuntimeError('Audio output quarantined pending coordinator release')
    if c.get('audioMode')=='parts':
        for i,part in enumerate(c['parts']):
            a,b=part['range'];f.append(f'[{i}:a]atrim=start={a}:end={b},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo[a{i}]')
        f.append(''.join(f'[a{i}]' for i in range(len(c['parts'])))+f'concat=n={len(c["parts"])}:v=0:a=1[a]')
    elif audio:
        args+=['-i',audio['file']];a=audio.get('start',0);b=audio.get('end');end=f':end={b}' if b is not None else '';delay=round(audio.get('offset',0)*1000)
        f.append(f'[{k}:a]atrim=start={a}{end},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,adelay={delay}|{delay},apad,atrim=duration={duration}[a]')
    else:
        args+=['-f','lavfi','-i','anullsrc=r=48000:cl=stereo'];f.append(f'[{k}:a]atrim=duration={duration}[a]')
    subprocess.run([FF,'-v','error','-y',*args,'-filter_complex',';'.join(f),'-map','[v]','-map','[a]','-t',str(duration),'-r','24','-fps_mode','cfr','-c:v','libx264','-preset','fast','-crf','17','-threads','2','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-movflags','+faststart',str(p)],check=True)
    v=cv2.VideoCapture(str(p));fps=v.get(5);frames=int(v.get(7));actual=frames/fps;v.release();assert fps==24
    aligned=p.with_name(p.stem+'-aligned.mp4')
    subprocess.run([FF,'-v','error','-y','-i',str(p),'-map','0:v','-map','0:a','-c:v','copy','-af',f'atrim=duration={actual}','-t',str(actual),'-c:a','aac','-ar','48000','-movflags','+faststart',str(aligned)],check=True);aligned.replace(p)
    check=subprocess.run([FF,'-v','warning','-i',str(p),'-f','null','NUL'],capture_output=True,text=True,encoding='utf-8',errors='replace');assert check.returncode==0 and not check.stderr
    row=dict(id=c['id'],file=str(p.resolve()),sha256=sha(p),videoFrames=frames,videoSeconds=actual,resolution=[1280,720],fps=fps,audioHz=48000,recipe=c,sourceParts=[dict(**x,sourceFile=x.get('file') or raw(x['source']),sourceSha256=sha(x.get('file') or raw(x['source']))) for x in c['parts']],newPolicy='20261025-no-meta-no-cards-no-boxes',reviewState='pending-actual-review',audioListeningReview='not-heard',userApproved=False)
    save(meta,row);sheets(row);print('CANDIDATE',c['id'],actual,row['sha256'],flush=True);return row
def sheets(row):
    d=R/'review'/row['id'];d.mkdir(parents=True,exist_ok=True);cap=cv2.VideoCapture(row['file']);fps=cap.get(5);count=int(cap.get(7));tiles=[]
    for n in range(0,count,12):
        cap.set(cv2.CAP_PROP_POS_FRAMES,n);ok,frame=cap.read();assert ok;im=Image.fromarray(cv2.cvtColor(cv2.resize(frame,(448,252)),cv2.COLOR_BGR2RGB));ImageDraw.Draw(im).text((7,7),f'{row["id"]} {n/fps:.2f}',fill='yellow');tiles.append(im)
    cap.release()
    for start in range(0,len(tiles),24):
        out=Image.new('RGB',(448*4,252*6))
        for i,im in enumerate(tiles[start:start+24]):out.paste(im,((i%4)*448,(i//4)*252))
        out.save(d/f'sequence-{start//24+1:02}.jpg',quality=90)
    save(d/'identity.json',dict(file=row['file'],sha256=row['sha256'],method='all 0.5-second samples; pending direct visual review'))
if __name__=='__main__':
    for c in read(R/'clean-recipes.json')['clips']:
        if len(sys.argv)==1 or c['id'] in sys.argv[1:]:render(c)
