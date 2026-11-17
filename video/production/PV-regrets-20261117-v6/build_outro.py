from pathlib import Path
import subprocess,json,hashlib,re
import numpy as np
import imageio_ffmpeg as io
R=Path(__file__).resolve().parent;P=R.parent;W=P.parent.parent
FF=io.get_ffmpeg_exe();FPS=24;DUR=7;WIDTH=1280;HEIGHT=720
LOGO=W/'source-art/logo/20261106-v15/04-平面金墨.png'
SRC=P/'PV-regrets-20261117-v5/三国遗憾-PV-v5-写实谷地与马谡叩首.mp4'
OUT=R/'三国遗憾-PV-v6-金墨书法片尾.mp4'
def run(args):
 p=subprocess.run([FF,'-y','-hide_banner','-v','error',*map(str,args)],capture_output=True,timeout=600)
 if p.returncode:raise RuntimeError(p.stderr.decode('utf-8','replace')[-3000:])
 return p
def smooth(x):x=np.clip(x,0,1);return x*x*(3-2*x)
x,y=np.meshgrid(np.arange(WIDTH,dtype=np.float32),np.arange(HEIGHT,dtype=np.float32))
oval=np.exp(-(((x-640)/490)**4+((y-348)/350)**4)*1.4)
cloud=(np.sin(x*.009+y*.006)+np.sin(x*.019-y*.012)*.4)*3
rng=np.random.default_rng(171117)
particles=[(rng.uniform(0,2*np.pi),rng.uniform(120,510),rng.uniform(.55,1.7),rng.uniform(.4,1.0)) for _ in range(115)]
cmd=[FF,'-y','-v','error','-f','rawvideo','-pix_fmt','rgb24','-s','1280x720','-r','24','-i','pipe:0','-an','-c:v','libx264','-crf','16','-preset','fast','-threads','3',str(R/'background.mp4')]
proc=subprocess.Popen(cmd,stdin=subprocess.PIPE,stderr=subprocess.PIPE)
for n in range(FPS*DUR):
 t=n/FPS;reveal=smooth((t-.35)/1.05);ending=1-smooth((t-6.15)/.85)
 light=oval*(125+cloud)*reveal
 frame=np.zeros((HEIGHT,WIDTH,3),np.float32);frame[:]=[5,8,10]
 frame+=light[:,:,None]*np.array([1.04,1.02,.94],np.float32)
 # One motivated horizontal light sweep precedes the logo settling.
 sweep=np.exp(-((x-(t-.45)*1750)/190)**2-((y-360)/3.2)**2)*max(0,1-abs(t-.9)/.65)
 frame+=sweep[:,:,None]*np.array([185,133,56])
 # Radial gold flecks scatter once on the arrival, then lose energy.
 for angle,speed,life,bright in particles:
  age=t-1.0
  if not 0<age<life:continue
  px=int(640+np.cos(angle)*(180+speed*age));py=int(348+np.sin(angle)*(.65)*(100+speed*age)+14*age*age)
  if 3<px<WIDTH-3 and 3<py<HEIGHT-3:
   a=(1-age/life)**2*bright
   frame[py-1:py+2,px-2:px+3]+=np.array([220,155,62])*a
 # A dim edge glow recedes; no perpetual pulsing or looping animation.
 frame=np.clip(frame*ending,0,255).astype(np.uint8)
 proc.stdin.write(frame.tobytes())
proc.stdin.close();err=proc.stderr.read();proc.wait()
if proc.returncode:raise RuntimeError(err.decode())
# Animate the original PNG as an intact image. No regenerated glyphs or recoloring.
boost="(1+0.7*exp(-pow((X/W-(T-2.0)/1.1)/0.085,2)))"
graph="[1:v]scale=840:-2,format=rgba,geq=r='r(X,Y)*"+boost+"':g='g(X,Y)*"+boost+"':b='b(X,Y)*"+boost+"':a='alpha(X,Y)',scale=w='trunc((660+110*pow(max(0,1-t/1.3),3)+40*(1-clip((t-1.3)/4.5,0,1)))/2)*2':h=-2:eval=frame,fade=t=in:st=0.45:d=0.55:alpha=1,fade=t=out:st=6.15:d=0.85:alpha=1[logo];[0:v][logo]overlay=x='(W-w)/2':y='(H-h)/2':shortest=1,format=yuv420p[v]"
run(['-i',R/'background.mp4','-loop','1','-framerate',24,'-i',LOGO,'-filter_complex_threads','1','-filter_complex',graph,'-map','[v]','-t',7,'-r',24,'-c:v','libx264','-preset','fast','-crf',16,'-threads',3,'-an',R/'片尾-金墨书法-7秒.mp4'])
g="[0:v]trim=end=51,settb=AVTB,setpts=PTS-STARTPTS[a];[1:v]trim=duration=7,settb=AVTB,setpts=PTS-STARTPTS,fade=t=out:st=6.75:d=0.25[b];[2:v]settb=AVTB,setpts=PTS-STARTPTS[c];[a][b][c]concat=n=3:v=1:a=0[v];[0:a]atrim=end=58,asetpts=PTS-STARTPTS,apad=pad_dur=7,atrim=end=65,afade=t=out:st=57.7:d=0.3[base];[3:a]highpass=f=400,lowpass=f=3800,volume=0.13,afade=t=in:d=0.35,afade=t=out:st=0.35:d=0.55,adelay=58450:all=1[sfx];[base][sfx]amix=inputs=2:duration=first:normalize=0[audio]"
run(['-i',SRC,'-i',P/'PV-regrets-20261117-v2/edit/D02.mp4','-i',R/'片尾-金墨书法-7秒.mp4','-f','lavfi','-i','anoisesrc=color=pink:duration=0.9:sample_rate=48000:seed=61117','-filter_complex_threads',1,'-filter_complex',g,'-map','[v]','-map','[audio]','-t',65,'-frames:v',1560,'-r',24,'-c:v','libx264','-preset','fast','-crf',18,'-threads',4,'-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags','+faststart',OUT])
p=run(['-i',OUT,'-progress','pipe:1','-f','null','-']);assert int(re.findall(r'frame=(\d+)',p.stdout.decode())[-1])==1560
reader=io.read_frames(str(OUT));meta=next(reader);reader.close();assert abs(meta['duration']-65)<.05
run(['-i',R/'片尾-金墨书法-7秒.mp4','-vf','fps=2,scale=400:225,tile=4x4','-frames:v',1,'-update',1,R/'outro-contact.jpg'])
run(['-ss',3,'-i',R/'片尾-金墨书法-7秒.mp4','-frames:v',1,'-update',1,R/'outro-hero.png'])
(R/'检查与来源.json').write_text(json.dumps(dict(file=str(OUT),metadata=meta,frames=1560,full_decode='pass',sha256=hashlib.sha256(OUT.read_bytes()).hexdigest(),logo=str(LOGO),logo_sha256=hashlib.sha256(LOGO.read_bytes()).hexdigest(),source=str(SRC),new_generation_calls=0,changes='51秒前剧情沿用v5；51—58秒恢复完整灯灭并淡黑；58—65秒原v15金墨logo动画。',audio='保留原片环境声；片尾单次非音调风切音，无对白与BGM。',user_review='待review',visual_review='待抽帧检查'),ensure_ascii=False,indent=2),'utf-8')
print(str(OUT))
