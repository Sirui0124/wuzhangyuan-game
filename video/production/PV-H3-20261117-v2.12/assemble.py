from pathlib import Path
import json,hashlib,subprocess
import numpy as np
R=Path(__file__).resolve().parent;P=R.parent;T=R.parents[2]/'.local-tools/pv-h3';FF=str(T/'ffmpeg.exe');FP=str(T/'ffprobe.exe')
E=R/'edit';E.mkdir(exist_ok=True);SR=48000;D=946/24;START=418/24
OLD=P/'PV-H3-20261117-v2.11/夷陵撤离-PV-v2.11-完整成片.mp4'
def run(args):
 p=subprocess.run(list(map(str,args)),capture_output=True)
 if p.returncode:raise RuntimeError(p.stderr.decode('utf-8','replace')[-2500:])
 return p.stdout
def load(path,start=0,duration=None,filters=None):
 args=[FF,'-v','error','-ss',start,'-i',path,'-vn']
 if duration is not None:args+=['-t',duration]
 if filters:args+=['-af',filters]
 return np.frombuffer(run(args+['-f','f32le','-ar',SR,'-ac',2,'pipe:1']),'<f4').reshape(-1,2).copy()
parts=[];timeline=[]
for ident,source,seconds,offset in [('PREFIX',OLD,START,0),('F41',R/'F41/source.mp4',6,START),('F42',R/'F42/source.mp4',8,START+6),('F43',R/'F43/source.mp4',8,START+14)]:
 out=E/(ident+'.mp4');vf='scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,setsar=1,fps=24'
 if ident=='PREFIX':vf+=",eq=brightness=-0.025:gamma=0.90:saturation=1.0:enable='lt(t,4.75)'"
 if ident=='F43':vf+=',fade=t=out:st=7.5:d=0.5'
 if not out.exists():run([FF,'-v','error','-y','-i',source,'-an','-vf',vf,'-frames:v',round(seconds*24),'-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p',out])
 parts.append(out);timeline.append(dict(id=ident,source=str(source),source_in=0,duration=seconds,timeline_in=offset,timeline_out=offset+seconds,source_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),filter=vf))
cf=E/'concat.txt';cf.write_text('\n'.join("file '"+p.as_posix()+"'" for p in parts),'utf-8');run([FF,'-v','error','-y','-f','concat','-safe','0','-i',cf,'-c','copy',E/'picture.mp4'])
mix=np.zeros((round(D*SR),2),np.float32);records=[]
def add(a,start,fi=.08,fo=.1):
 a=a.copy();tt=np.arange(len(a))/SR
 if fi:a*=np.clip(tt/fi,0,1)[:,None]
 if fo:a*=np.clip((len(a)/SR-tt)/fo,0,1)[:,None]
 i=round(start*SR);n=min(len(a),len(mix)-i);mix[i:i+n]+=a[:n]
def norm(a,db):return a*10**(db/20)/max(1e-8,np.sqrt(np.mean(a*a)))
cut=514/24
add(load(P/'PV-H3-20261117-v2.11/edit/location-mix.wav',0,cut),0,0,.18)
def screening(ident):
 d=R/ident;a=json.loads((d/'audio-small-unverified.json').read_text('utf-8'));e=json.loads((d/'audio-events-unverified.json').read_text('utf-8'))
 music=max(w['music'] for w in e['windows']);motor=max([0]+[x['p'] for w in e['windows'] for x in w['top'] if x['label'] in ['Engine','Idling','Helicopter','Aircraft','Heavy engine (low frequency)']])
 return not a['segments'] and music<.1 and motor<.15,dict(asr=a['segments'],music_max=music,motor_max=motor)
for ident,offset,seconds in [('F41',START,6),('F42',START+6,8),('F43',START+14,8)]:
 clean,screen=screening(ident);skip=max(0,cut-.18-offset)
 if clean:
  a=load(R/ident/'source.mp4',skip,seconds-skip)
  add(norm(a,-27 if ident!='F42' else -25),offset+skip,.18,.1)
  records.append(dict(id=ident,native_audio=True,source=str(R/ident/'source.mp4'),source_in=skip,duration=seconds-skip,screen=screen))
 else:
  fire=P/'PV-H3-20261115-v2.2/B01/source.mp4';a=norm(load(fire,0,min(4.5,seconds-skip)),-28)
  add(a,offset+skip,.18,.45)
  if seconds-skip>4.5:add(a,offset+skip+4,.45,.3)
  action=None
  if ident!='F41':
   action=R/'F42/source.mp4' if screening('F42')[0] else P/'PV-H3-20261117-v2.11/F32/source.mp4'
   raw=run([FF,'-v','error','-ss',1,'-i',action,'-vn','-af','atrim=duration=6,asetpts=PTS-STARTPTS,atempo=0.75,highpass=f=150,lowpass=f=2800','-f','f32le','-ar',SR,'-ac',2,'pipe:1'])
   a=np.frombuffer(raw,'<f4').reshape(-1,2).copy()[:8*SR];add(norm(a,-33),offset,.18,.3)
  records.append(dict(id=ident,native_audio=False,excluded_reason='speech/music/motor screening',screen=screen,fire_source=str(fire),action_source=str(action) if action else None,note='environmental sound matching, not frame-exact Foley'))
tt=np.arange(len(mix))/SR;mix*=np.clip((D-tt)/.6,0,1)[:,None];peak=float(np.max(np.abs(mix)))
if peak>.79:mix*=.79/peak
sound=E/'location-mix.wav';proc=subprocess.run([FF,'-v','error','-y','-f','f32le','-ar',str(SR),'-ac','2','-i','pipe:0','-c:a','pcm_s24le',str(sound)],input=mix.astype('<f4').tobytes(),capture_output=True);assert proc.returncode==0
final=R/'夷陵撤离-PV-v2.12-暮夜至凌晨.mp4'
run([FF,'-v','error','-y','-i',E/'picture.mp4','-i',sound,'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','192k','-t',D,'-movflags','+faststart',final]);run([FF,'-v','error','-i',final,'-f','null','-'])
meta=json.loads(run([FP,'-v','error','-show_streams','-show_format','-of','json',final]));v=next(x for x in meta['streams'] if x['codec_type']=='video');a=next(x for x in meta['streams'] if x['codec_type']=='audio');assert int(v['nb_frames'])==946;assert abs(float(a['duration'])-D)<.04
for name,value in [('edit-timeline.json',dict(duration=D,shots=timeline)),('audio-provenance.json',dict(original_mix=str(P/'PV-H3-20261117-v2.11/edit/location-mix.wav'),original_retained_to=cut,added_bgm=False,new_dialogue=False,records=records,human_listening='not claimed')),('final-technical.json',dict(file=str(final),duration=D,frames=946,sha256=hashlib.sha256(final.read_bytes()).hexdigest(),full_decode='pass',metadata=meta,user_review='待review'))]:
 (R/name).write_text(json.dumps(value,ensure_ascii=False,indent=2),'utf-8')
run([FF,'-v','error','-y','-i',final,'-vf','fps=1/2,scale=320:180,tile=5x4','-frames:v','1',R/'final-contact.jpg'])
print('Complete: '+str(final))
