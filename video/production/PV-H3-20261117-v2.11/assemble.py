from pathlib import Path
import subprocess,json,hashlib
import numpy as np
R=Path(__file__).resolve().parent;P=R.parent;T=P.parent.parent/'.local-tools/pv-h3'
FF=str(T/'ffmpeg.exe');FP=str(T/'ffprobe.exe');E=R/'edit';E.mkdir(exist_ok=True)
SR=48000;D=946/24;START=418/24
OLD=P/'PV-H3-20261117-v2.10/夷陵大火-PV-v2.10-火营与归途.mp4'
def run(args):
 p=subprocess.run(list(map(str,args)),capture_output=True)
 if p.returncode:raise RuntimeError(p.stderr.decode('utf-8','replace')[-2000:])
 return p.stdout
def load(path,start=0,duration=None):
 args=[FF,'-v','error','-ss',start,'-i',path]
 if duration is not None:args+=['-t',duration]
 return np.frombuffer(run(args+['-vn','-f','f32le','-ar',SR,'-ac',2,'pipe:1']),'<f4').reshape(-1,2).copy()
parts=[];timeline=[]
for ident,src,seconds,offset in [('PREFIX',OLD,START,0),('F31',R/'F31/source.mp4',6,START),('F32',R/'F32/source.mp4',8,START+6),('F34',R/'F34/source.mp4',8,START+14)]:
 out=E/(ident+'.mp4');vf='scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,setsar=1,fps=24'
 if ident=='F34':vf+=',fade=t=out:st=7.5:d=0.5'
 if not out.exists():run([FF,'-v','error','-y','-i',src,'-an','-vf',vf,'-frames:v',round(seconds*24),'-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p',out])
 parts.append(out);timeline.append(dict(id=ident,source=str(src),source_in=0,duration=seconds,timeline_in=offset,timeline_out=offset+seconds,source_sha256=hashlib.sha256(src.read_bytes()).hexdigest()))
cf=E/'concat.txt';cf.write_text('\n'.join("file '"+p.as_posix()+"'" for p in parts),'utf-8')
run([FF,'-v','error','-y','-f','concat','-safe','0','-i',cf,'-c','copy',E/'picture.mp4'])
mix=np.zeros((round(D*SR),2),np.float32);records=[]
def add(a,start,fi=.03,fo=.04):
 a=a.copy();n=len(a);time=np.arange(n)/SR
 if fi:a*=np.clip(time/fi,0,1)[:,None]
 if fo:a*=np.clip((n/SR-time)/fo,0,1)[:,None]
 ix=round(start*SR);n=min(n,len(mix)-ix);mix[ix:ix+n]+=a[:n]
def norm(a,db):return a*10**(db/20)/max(1e-8,np.sqrt(np.mean(a*a)))
# Exact existing voice and location mix through 21.4167 seconds, including Pang's final phrase.
cut=514/24
add(load(P/'PV-H3-20261117-v2.10/sound/full-location-mix.wav',0,cut),0,0,.18)
# Subtle dry air under the original memory pause, never replacing or shifting voice.
add(norm(load(P/'PV-H3-20261115-v2.2/sound/camp-wind.wav',2,5.5),-43),239/24,.2,.2)
for ident,offset,seconds in [('F31',START,6),('F32',START+6,8),('F34',START+14,8)]:
 d=R/ident;asr=json.loads((d/'audio-small-unverified.json').read_text('utf-8'));ev=json.loads((d/'audio-events-unverified.json').read_text('utf-8'))
 music=max(x['music'] for x in ev['windows']);speech=asr['segments']
 skip=max(0,cut-.18-offset)
 if ident=='F31':
  clean=P/'PV-H3-20261115-v2.2/B01/source.mp4'
  a=load(clean,0,seconds-skip)
  records.append(dict(id=ident,excluded_native_audio=True,reason='unrequested speech detected by ASR and event model; entire native audio excluded',replacement=str(clean),native_music_screen=music))
 elif ident=='F34':
  # Native F34 has a prominent motor-like low rumble. Use clean, real action audio
  # from this batch, slowed without pitch shift and attenuated for the wide view.
  raw=run([FF,'-v','error','-ss',1,'-i',R/'F32/source.mp4','-vn','-af','atrim=duration=6,asetpts=PTS-STARTPTS,atempo=0.75,highpass=f=150,lowpass=f=2600','-f','f32le','-ar',SR,'-ac',2,'pipe:1'])
  a=np.frombuffer(raw,'<f4').reshape(-1,2).copy()[:8*SR]
  a=norm(a,-34)
  clean=load(P/'PV-H3-20261115-v2.2/B01/source.mp4',0,4.5)
  add(norm(clean,-29),offset,.18,.45)
  add(norm(clean,-29),offset+4,.45,.5)
  add(a,offset,.18,.4)
  records.append(dict(id=ident,excluded_native_audio=True,reason='motor-like rumble screening; replaced with clean fire and distant cart/footsteps',action_source=str(R/'F32/source.mp4'),action_source_in=1,action_source_duration=6,atempo=.75,fire_source=str(P/'PV-H3-20261115-v2.2/B01/source.mp4'),perspective='lowpass 2600Hz and lower level for wide shot; approximate action bed, not frame-exact Foley'))
  continue
 else:
  if speech or music>=.1:raise RuntimeError(f'{ident} needs audio remediation: music={music}, speech={speech}')
  a=load(d/'source.mp4',skip,seconds-skip)
 add(norm(a,-27 if ident=='F31' else -25),offset+skip,.18,.08)
 if ident!='F31':records.append(dict(id=ident,source=str(d/'source.mp4'),source_in=skip,duration=seconds-skip,native_audio=True,music_screen_max=music,asr=speech))
t=np.arange(len(mix))/SR;mix*=np.clip((D-t)/.6,0,1)[:,None]
peak=float(np.max(np.abs(mix)))
if peak>.79:mix*=.79/peak
sound=E/'location-mix.wav'
p=subprocess.run([FF,'-v','error','-y','-f','f32le','-ar',str(SR),'-ac','2','-i','pipe:0','-c:a','pcm_s24le',str(sound)],input=mix.astype('<f4').tobytes(),capture_output=True);assert p.returncode==0
final=R/'夷陵撤离-PV-v2.11-完整成片.mp4'
run([FF,'-v','error','-y','-i',E/'picture.mp4','-i',sound,'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','192k','-t',D,'-movflags','+faststart',final])
run([FF,'-v','error','-i',final,'-f','null','-'])
meta=json.loads(run([FP,'-v','error','-show_streams','-show_format','-of','json',final]));v=next(x for x in meta['streams'] if x['codec_type']=='video');a=next(x for x in meta['streams'] if x['codec_type']=='audio')
assert int(v['nb_frames'])==946;assert abs(float(a['duration'])-D)<.04
(R/'edit-timeline.json').write_text(json.dumps(dict(duration=D,shots=timeline),ensure_ascii=False,indent=2),'utf-8')
(R/'audio-provenance.json').write_text(json.dumps(dict(original_voice_source=str(P/'PV-H3-20261117-v2.10/sound/full-location-mix.wav'),original_audio_retained_to=cut,added_bgm=False,new_dialogue=False,records=records,human_listening='not claimed'),ensure_ascii=False,indent=2),'utf-8')
(R/'final-technical.json').write_text(json.dumps(dict(file=str(final),duration=D,frames=946,sha256=hashlib.sha256(final.read_bytes()).hexdigest(),full_decode='pass',metadata=meta,user_review='待review'),ensure_ascii=False,indent=2),'utf-8')
run([FF,'-v','error','-y','-i',final,'-vf','fps=1/2,scale=320:180,tile=5x4','-frames:v','1',R/'final-contact.jpg'])
print('Complete: '+str(final))
