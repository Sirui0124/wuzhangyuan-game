from pathlib import Path
import cv2,numpy as np,json,subprocess,hashlib
O=Path(__file__).resolve().parent;R=O/'review/picture-repair';E=O/'edited/picture-usability-v4';E.mkdir(exist_ok=True)
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
D=read(O/'delivery.json');old={c['id']:c['file'] for c in D['subclips']};over=read(R/'candidate-overrides.json')
# Remove the unnecessary first paper-holding second, retain the entire slot audio.
segs=[(old['V21-02'],1,7.4),(old['V21-06'],3,8.85)];parts=[]
for i,(src,a,b) in enumerate(segs):
 out=E/f'V21-02-part{i}.mp4';parts.append(out)
 subprocess.run([FF,'-v','error','-y','-ss',str(a),'-i',src,'-t',str(b-a),'-vf','fps=24,setsar=1','-an','-c:v','libx264','-crf','18','-preset','fast',str(out)],check=True)
lst=E/'V21-02.concat.txt';lst.write_text('\n'.join("file '"+p.as_posix()+"'" for p in parts),encoding='utf-8');vid=E/'V21-02-picture.mp4'
subprocess.run([FF,'-v','error','-y','-f','concat','-safe','0','-i',str(lst),'-c','copy',str(vid)],check=True)
out=E/'V21-02-no-paper-intro.mp4'
subprocess.run([FF,'-v','error','-y','-i',str(vid),'-i',old['V21-02'],'-map','0:v','-map','1:a','-c:v','copy','-c:a','aac','-ar','48000','-t','12.25',str(out)],check=True)
rec=dict(over['V21-02']);rec.update(file=str(out),sha256=sha(out),sourceSegments=[dict(file=src,sha256=sha(src),sourceTime=[a,b],playbackRate=1) for src,a,b in segs],reviewState='pending-final-dynamic-review',repairReason='去掉模型乱字持信起镜和末段重复递纸，保持原槽完整音轨12.25秒。');over['V21-02']=rec
# The essential one-time handoff remains. Defocus only the moving paper interior,
# leaving its edges, fingers, release and subsequent accurate summary unchanged.
src=Path(over['V21-03']['file']);cap=cv2.VideoCapture(str(src));fps=cap.get(cv2.CAP_PROP_FPS);w=int(cap.get(3));h=int(cap.get(4));video=E/'V21-03-paper-interior-picture.mp4'
# Region guide in 640x360 coordinates; paper colour segmentation excludes skin.
knots=[(0,[(480,35),(640,110),(640,170),(475,95)]),(.25,[(463,60),(635,120),(635,167),(466,106)]),(.5,[(355,102),(530,108),(546,155),(375,164)]),(.75,[(285,115),(430,105),(467,165),(320,191)]),(1,[(193,173),(374,134),(440,185),(238,235)]),(1.25,[(180,187),(369,146),(419,191),(215,239)]),(1.5,[(164,205),(355,160),(412,204),(194,243)]),(1.75,[(153,209),(349,166),(404,214),(180,250)]),(2,[(147,213),(344,174),(401,224),(167,254)]),(2.25,[(147,212),(341,165),(401,225),(163,255)]),(2.5,[(158,212),(339,152),(398,218),(174,247)]),(2.79,[(155,212),(331,199),(374,237),(174,246)])]
proc=subprocess.Popen([FF,'-v','error','-y','-f','rawvideo','-pix_fmt','bgr24','-s',f'{w}x{h}','-r',str(fps),'-i','-','-an','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p',str(video)],stdin=subprocess.PIPE)
n=0;maxarea=0
while True:
 ok,f=cap.read()
 if not ok:break
 t=n/fps
 if .5<=t<2.8:
  j=max(i for i,(s,_) in enumerate(knots) if s<=t);j=min(j,len(knots)-2);a,qa=knots[j];b,qb=knots[j+1];q=(np.array(qa)*(1-(t-a)/(b-a))+np.array(qb)*(t-a)/(b-a))*2
  roi=np.zeros((h,w),np.uint8);cv2.fillConvexPoly(roi,q.astype(np.int32),255)
  bb,gg,rr=cv2.split(f);paper=((rr.astype(float)-gg<39)&(gg.astype(float)-bb<48)&(gg>150)&(bb>115)&(roi>0)).astype(np.uint8)*255
  paper=cv2.morphologyEx(paper,cv2.MORPH_CLOSE,np.ones((13,13),np.uint8))
  contours,_=cv2.findContours(paper,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE);mask=np.zeros_like(roi)
  if contours:cv2.drawContours(mask,[max(contours,key=cv2.contourArea)],-1,255,-1)
  mask=cv2.erode(mask,np.ones((7,7),np.uint8));mask=cv2.GaussianBlur(mask,(9,9),2).astype(float)/255
  # Avoid feathering across fingers at the paper edge.
  maxarea=max(maxarea,float((mask>.5).mean()));blur=cv2.GaussianBlur(f,(0,0),5)
  f=np.clip(f*(1-mask[:,:,None])+blur*mask[:,:,None],0,255).astype(np.uint8)
 proc.stdin.write(f.tobytes());n+=1
proc.stdin.close();assert proc.wait()==0;cap.release()
out=E/'V21-03-paper-interior-repaired.mp4'
subprocess.run([FF,'-v','error','-y','-i',str(video),'-i',str(src),'-map','0:v','-map','1:a','-c:v','copy','-c:a','copy',str(out)],check=True)
rec=dict(over['V21-03']);rec.update(file=str(out),sha256=sha(out),reviewState='pending-final-dynamic-review',sourceSegments=[dict(file=str(src),sha256=sha(src),sourceTime=[0,n/fps],playbackRate=1)],paperInteriorRepair=dict(time=[.5,2.8],method='跟随纸张颜色和区域的局部光学失焦，纸边及手指保持；不修改正文摘要、不伪造信全文',gaussianSigma=5,maxFrameAreaFraction=maxarea),repairReason='完整接住及松手动作保留，纸面模型乱字不作为可读证据；2.8秒后准确摘要不变。');over['V21-03']=rec
for id in ['V21-02','V21-03']:
 subprocess.run([FF,'-v','error','-i',over[id]['file'],'-f','null','NUL'],capture_output=True,check=True)
 Path(over[id]['file']).with_suffix('.json').write_text(json.dumps(over[id],ensure_ascii=False,indent=2),encoding='utf-8')
 subprocess.run([FF,'-v','error','-y','-i',over[id]['file'],'-vf','fps=4,scale=256:144,tile=5x10','-frames:v','1',str(R/(id+'-paper-repaired-sequence.jpg'))],check=True)
(R/'candidate-overrides.json').write_text(json.dumps(over,ensure_ascii=False,indent=2),encoding='utf-8');print('Local paper repairs staged; max frame area',maxarea)
