from pathlib import Path
from PIL import Image
p=Path(__file__).with_name('build_outro.py');s=p.read_text('utf-8')
exec(compile(s.split('x,y=np.meshgrid')[0],str(p),'exec'))
logo=Image.open(LOGO).convert('RGBA')
reader=io.read_frames(str(R/'background.mp4'),pix_fmt='rgb24');next(reader)
cmd=[FF,'-y','-v','error','-f','rawvideo','-pix_fmt','rgb24','-s','1280x720','-r','24','-i','pipe:0','-an','-c:v','libx264','-crf','16','-preset','fast','-threads','3',str(R/'片尾-金墨书法-7秒.mp4')]
proc=subprocess.Popen(cmd,stdin=subprocess.PIPE,stderr=subprocess.PIPE)
for n,raw in enumerate(reader):
 if n>=168:break
 t=n/24;frame=np.frombuffer(raw,np.uint8).reshape(720,1280,3).copy()
 w=round(660+110*max(0,1-t/1.3)**3+40*(1-np.clip((t-1.3)/4.5,0,1)));h=round(w*logo.height/logo.width)
 a=np.array(logo.resize((w,h),Image.Resampling.LANCZOS),dtype=np.float32)
 opacity=smooth((t-.45)/.55)*(1-smooth((t-6.15)/.85))
 sweep=1+.7*np.exp(-((np.arange(w)/w-(t-2)/1.1)/.085)**2)
 rgb=np.clip(a[:,:,:3]*sweep[None,:,None],0,255);alpha=a[:,:,3:4]/255*opacity
 left=(1280-w)//2;top=(720-h)//2
 target=frame[top:top+h,left:left+w]
 target[:]=(rgb*alpha+target*(1-alpha)).astype(np.uint8)
 proc.stdin.write(frame.tobytes())
reader.close();proc.stdin.close();err=proc.stderr.read();proc.wait()
if proc.returncode:raise RuntimeError(err.decode())
print('Logo animation rendered.',flush=True)
exec(compile(s[s.index('g="[0:v]trim=end=51'):],str(p),'exec'))
