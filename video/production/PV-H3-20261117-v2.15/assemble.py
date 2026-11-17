from pathlib import Path
import subprocess,json,hashlib
import numpy as np
R=Path(__file__).resolve().parent;P=R.parent;E=R/'edit';E.mkdir(exist_ok=True)
ROOT=R.parents[2];FF=str(ROOT/'.local-tools/pv-h3/ffmpeg.exe');FP=str(ROOT/'.local-tools/pv-h3/ffprobe.exe');SR=48000
def run(args):
 p=subprocess.run(list(map(str,args)),capture_output=True)
 if p.returncode:raise RuntimeError(p.stderr.decode('utf-8','replace')[-2500:])
 return p.stdout
base='scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,setsar=1,fps=24'
shots=[dict(id='PV',source=str(P/'PV-H3-20261117-v2.14/夷陵撤离-PV-v2.14-远景至近景.mp4'),start=0,frames=946,filter=base),dict(id='L01',source=str(R/'L01/source.mp4'),start=0,frames=192,filter=base+',fade=t=in:st=0:d=0.25'),dict(id='L02S',source=str(R/'L02S/source.mp4'),start=0,frames=144,filter=base),dict(id='L03',source=str(R/'L03/source.mp4'),start=0,frames=174,filter=base),dict(id='L04R',source=str(R/'L04R/source.mp4'),start=0,frames=264,filter=base),dict(id='L05',source=str(R/'L05/source.mp4'),start=60/24,frames=64,filter=base)]
previous=json.loads((R/'edit-timeline.json').read_text('utf-8')) if (R/'edit-timeline.json').exists() else {'shots':[]}
cache={s['id']:s for s in previous['shots']}
parts=[];position=0
for s in shots:
 s.update(timeline_in=position,duration=s['frames']/24);position+=s['duration'];s['timeline_out']=position
 out=E/(s['id']+'.mp4')
 s['source_sha256']=hashlib.sha256(Path(s['source']).read_bytes()).hexdigest()
 prior=cache.get(s['id'],{})
 if not out.exists() or any(prior.get(k)!=s[k] for k in ['source','start','frames','filter','source_sha256']):
  run([FF,'-v','error','-y','-ss',s['start'],'-i',s['source'],'-an','-vf',s['filter'],'-frames:v',s['frames'],'-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p',out])
 parts.append(out)
mapfile=ROOT/'demos/yiling-rescue/public/art/yiling-retreat-map-v1.png'
run([FF,'-v','error','-y','-loop','1','-i',mapfile,'-vf',base,'-t',2,'-an','-c:v','libx264','-preset','fast','-crf',18,'-pix_fmt','yuv420p',E/'map.mp4'])
run([FF,'-v','error','-y','-i',E/'L05.mp4','-i',E/'map.mp4','-filter_complex','[0:v]settb=AVTB,format=yuv420p[a];[1:v]settb=AVTB,format=yuv420p[b];[a][b]xfade=transition=fade:duration=0.5:offset=2.166666667,format=yuv420p[v]','-map','[v]','-an','-frames:v',100,'-r',24,'-c:v','libx264','-preset','fast','-crf',18,E/'map-handoff.mp4'])
parts[-1]=E/'map-handoff.mp4';D=position+1.5
cf=E/'concat.txt';cf.write_text('\n'.join("file '"+p.as_posix()+"'" for p in parts),'utf-8')
run([FF,'-v','error','-y','-f','concat','-safe','0','-i',cf,'-c','copy',E/'picture.mp4'])
mix=np.zeros((round(D*SR),2),np.float32);audio=[]
def load(path,start,duration,af=None):
 args=[FF,'-v','error','-ss',start,'-i',path,'-vn','-t',duration]
 if af:args+=['-af',af]
 return np.frombuffer(run(args+['-ar',SR,'-ac',2,'-f','f32le','pipe:1']),'<f4').reshape(-1,2).copy()
def norm(a,db):return a*10**(db/20)/max(1e-8,np.sqrt(np.mean(a*a)))
def add(a,start,fi=.04,fo=.08):
 a=a.copy();t=np.arange(len(a))/SR
 if fi:a*=np.clip(t/fi,0,1)[:,None]
 if fo:a*=np.clip((len(a)/SR-t)/fo,0,1)[:,None]
 i=round(start*SR);n=min(len(a),len(mix)-i);mix[i:i+n]+=a[:n]
def place(path,source_in,duration,timeline_in,db=None,af=None,reason=''):
 a=load(path,source_in,duration,af)
 if db is not None:a=norm(a,db)
 add(a,timeline_in);audio.append(dict(source=str(path),source_in=source_in,duration=duration,timeline_in=timeline_in,level_db_rms=db,filter=af,reason=reason))
prefix=946/24
add(load(shots[0]['source'],0,prefix),0,0,0)
audio.append(dict(source=shots[0]['source'],source_in=0,duration=prefix,timeline_in=0,reason='保留前片实际混音'))
wind=P/'PV-H3-20261115-v2.2/sound/camp-wind.wav'
for t in np.arange(prefix-.6,D,8):place(wind,0,min(8.4,D-t),float(t),-41,reason='帐棚远处风声，短交叠')
fire=P/'PV-H3-20261115-v2.2/B01/source.mp4'
for t in np.arange(prefix,D,4):place(fire,0,min(4.3,D-t),float(t),-43,'lowpass=f=1800',reason='远处火场与灯火环境，不采用生成旁白')
cloth=P/'PV-H3-20261115-v2.2/sound/fan-wind-cloth.wav'
place(cloth,.2,1.5,prefix+.2,-33,'highpass=f=200,lowpass=f=5000','展绢动作质感')
place(cloth,1.8,1.1,prefix+6,-36,'highpass=f=200,lowpass=f=5000','托印轻动')
starts={s['id']:s['timeline_in'] for s in shots}
place(R/'A01/source.mp4',.4,6,starts['L02S'],-22,None,'玩家原句单独补录，略去片头空白并保留尾音；ASR定位仅此原句，凤雏/持此为同音识别字')
place(R/'L02S/source.mp4',0,6,starts['L02S'],-35,None,'保留刘备倾听时自然呼吸，低于玩家对白')
place(R/'L03/source.mp4',5.65,1.60,starts['L03']+5.65,-24,None,'保留士元及相邻呼吸，与原画口型时间不变')
place(cloth,.5,1.2,starts['L03']+.8,-38,'highpass=f=250,lowpass=f=3500','持印袖口轻擦')
place(R/'L04R/source.mp4',0,13.5,starts['L04R'],-22,None,'采用修订版同期对白与呼吸；须核验无额外台词和BGM')
place(cloth,1.2,1.2,starts['L05']+.2,-36,'highpass=f=250,lowpass=f=4000','手离军图布面')
t=np.arange(len(mix))/SR;mix*=np.clip((D-t)/.3,0,1)[:,None];peak=float(np.max(np.abs(mix)))
if peak>.89:mix*=.89/peak
wav=E/'location-dialogue-mix.wav';p=subprocess.run([FF,'-v','error','-y','-f','f32le','-ar',str(SR),'-ac','2','-i','pipe:0','-c:a','pcm_s24le',str(wav)],input=mix.astype('<f4').tobytes(),capture_output=True);assert p.returncode==0
out=R/'夷陵撤离与认印托付-PV-v2.15.mp4'
run([FF,'-v','error','-y','-i',E/'picture.mp4','-i',wav,'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','192k','-t',D,'-movflags','+faststart',out]);run([FF,'-v','error','-i',out,'-f','null','-'])
meta=json.loads(run([FP,'-v','error','-show_streams','-show_format','-of','json',out]));v=next(x for x in meta['streams'] if x['codec_type']=='video');assert int(v['nb_frames'])==round(D*24)
for name,value in [('edit-timeline.json',dict(duration=D,shots=shots,map_handoff=dict(source=str(mapfile),duration=2,overlap=.5,note='现行游戏地图画面，不自动修改游戏逻辑'))),('audio-provenance.json',dict(bgm=False,records=audio,peak_before_limiter=peak,scope='保留对白与环境，剔除模型额外说明；音效按动作时间配置，不声称逐帧实录')) ,('final-technical.json',dict(file=str(out),duration=float(v['duration']),frames=int(v['nb_frames']),full_decode='pass',sha256=hashlib.sha256(out.read_bytes()).hexdigest(),metadata=meta,user_review='待review'))]:
 (R/name).write_text(json.dumps(value,ensure_ascii=False,indent=2),'utf-8')
run([FF,'-v','error','-y','-ss',prefix,'-i',out,'-vf','fps=0.5,scale=320:180,tile=4x6','-frames:v',1,R/'continuation-contact.jpg'])
print(str(out),D)
