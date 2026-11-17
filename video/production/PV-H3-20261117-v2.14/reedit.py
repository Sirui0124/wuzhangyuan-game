from pathlib import Path
import subprocess,json,hashlib
import numpy as np
R=Path(__file__).resolve().parent;P=R.parent;E=R/'edit';T=R.parents[2]/'.local-tools/pv-h3';FF=str(T/'ffmpeg.exe');FP=str(T/'ffprobe.exe')
D=946/24;CUT=562/24;SR=48000
old=P/'PV-H3-20261117-v2.13/夷陵撤离-PV-v2.13-夜行赴火.mp4'
def run(args):
 p=subprocess.run(list(map(str,args)),capture_output=True)
 if p.returncode:raise RuntimeError(p.stderr.decode('utf-8','replace')[-2500:])
 return p.stdout
def load(path,start=0,duration=8,af=None):
 args=[FF,'-v','error','-ss',start,'-i',path,'-vn','-t',duration]
 if af:args+=['-af',af]
 return np.frombuffer(run(args+['-ar',SR,'-ac',2,'-f','f32le','pipe:1']),'<f4').reshape(-1,2).copy()
base='scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,setsar=1,fps=24'
wide=base+",scale=2560:1440,zoompan=z='1+0.035*on/191':x='(iw-iw/zoom)*0.45':y='(ih-ih/zoom)*0.58':d=1:s=1280x720:fps=24"
shots=[dict(id='PREFIX',source=str(old),duration=CUT,timeline_in=0,filter=base),dict(id='F43_WIDE',source=str(P/'PV-H3-20261117-v2.12/F43/source.mp4'),duration=8,timeline_in=CUT,filter=wide),dict(id='F42_CLOSE',source=str(P/'PV-H3-20261117-v2.12/F42/source.mp4'),duration=8,timeline_in=CUT+8,filter=base+',fade=t=out:st=7.5:d=0.5')]
parts=[]
for s in shots:
 out=E/(s['id']+'.mp4');run([FF,'-v','error','-y','-i',s['source'],'-an','-vf',s['filter'],'-frames:v',round(s['duration']*24),'-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p',out]);parts.append(out)
 s.update(source_in=0,timeline_out=s['timeline_in']+s['duration'],source_sha256=hashlib.sha256(Path(s['source']).read_bytes()).hexdigest())
cf=E/'concat.txt';cf.write_text('\n'.join("file '"+p.as_posix()+"'" for p in parts),'utf-8');run([FF,'-v','error','-y','-f','concat','-safe','0','-i',cf,'-c','copy',E/'picture.mp4'])
mix=np.zeros((round(D*SR),2),np.float32)
def norm(a,db):return a*10**(db/20)/max(1e-8,np.sqrt(np.mean(a*a)))
def add(a,start,fi=.08,fo=.1):
 a=a.copy();t=np.arange(len(a))/SR
 if fi:a*=np.clip(t/fi,0,1)[:,None]
 if fo:a*=np.clip((len(a)/SR-t)/fo,0,1)[:,None]
 i=round(start*SR);n=min(len(a),len(mix)-i);mix[i:i+n]+=a[:n]
add(load(P/'PV-H3-20261117-v2.12/edit/location-mix.wav',0,CUT),0,0,.12)
fire=P/'PV-H3-20261115-v2.2/B01/source.mp4';action=P/'PV-H3-20261117-v2.11/F32/source.mp4'
records=[]
for start,label,level,lowpass in [(CUT,'wide',-35,2400),(CUT+8,'close',-28,5500)]:
 a=norm(load(fire,0,4.5),-29 if label=='wide' else -28)
 add(a,start,.12,.5);add(a,start+4,.5,.15)
 raw=run([FF,'-v','error','-ss',1,'-i',action,'-vn','-af',f'atrim=duration=6,asetpts=PTS-STARTPTS,atempo=0.75,highpass=f=150,lowpass=f={lowpass}','-ar',SR,'-ac',2,'-f','f32le','pipe:1'])
 a=np.frombuffer(raw,'<f4').reshape(-1,2).copy()[:8*SR];add(norm(a,level),start,.12,.12)
 records.append(dict(shot=label,start=start,duration=8,fire_source=str(fire),action_source=str(action),action_atempo=.75,action_level_db=level,lowpass=lowpass))
t=np.arange(len(mix))/SR;mix*=np.clip((D-t)/.6,0,1)[:,None];peak=float(np.max(np.abs(mix)))
if peak>.79:mix*=.79/peak
snd=E/'location-mix.wav';p=subprocess.run([FF,'-v','error','-y','-f','f32le','-ar',str(SR),'-ac','2','-i','pipe:0','-c:a','pcm_s24le',str(snd)],input=mix.astype('<f4').tobytes(),capture_output=True);assert p.returncode==0
out=R/'夷陵撤离-PV-v2.14-远景至近景.mp4';run([FF,'-v','error','-y','-i',E/'picture.mp4','-i',snd,'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','192k','-t',D,'-movflags','+faststart',out]);run([FF,'-v','error','-i',out,'-f','null','-'])
meta=json.loads(run([FP,'-v','error','-show_streams','-show_format','-of','json',out]));v=next(x for x in meta['streams'] if x['codec_type']=='video');assert int(v['nb_frames'])==946
for name,value in [('edit-timeline.json',dict(duration=D,shots=shots)),('audio-provenance.json',dict(added_bgm=False,new_dialogue=False,original_mix_retained_to=CUT,records=records,note='Existing clean location audio, perspective matching not frame-exact Foley')),('final-technical.json',dict(file=str(out),duration=float(v['duration']),frames=int(v['nb_frames']),full_decode='pass',sha256=hashlib.sha256(out.read_bytes()).hexdigest(),metadata=meta,user_review='待review'))]:
 (R/name).write_text(json.dumps(value,ensure_ascii=False,indent=2),'utf-8')
run([FF,'-v','error','-y','-ss',CUT,'-i',out,'-vf','fps=1,scale=320:180,tile=4x4','-frames:v','1',R/'ending-contact.jpg'])
print(str(out))
