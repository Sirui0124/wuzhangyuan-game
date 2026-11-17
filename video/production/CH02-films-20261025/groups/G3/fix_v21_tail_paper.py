from pathlib import Path
import cv2,numpy as np,json,subprocess,hashlib
O=Path(__file__).resolve().parent;R=O/'review/picture-repair';E=O/'edited/picture-usability-v5';FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
D=read(O/'delivery.json');ov=read(R/'candidate-overrides.json');src=next(x['file'] for x in D['subclips'] if x['id']=='V21-10');cap=cv2.VideoCapture(src);fps=cap.get(5);w=int(cap.get(3));h=int(cap.get(4));vid=E/'V21-10-paper-picture.mp4';out=E/'V21-10-paper-interior-repaired.mp4'
proc=subprocess.Popen([FF,'-v','error','-y','-f','rawvideo','-pix_fmt','bgr24','-s',f'{w}x{h}','-r',str(fps),'-i','-','-an','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p',str(vid)],stdin=subprocess.PIPE);n=0;maxarea=0
while True:
 ok,f=cap.read()
 if not ok:break
 if n/fps>=1:
  b,g,r=cv2.split(f);paper=((r.astype(float)-g>7)&(r.astype(float)-g<44)&(g.astype(float)-b>12)&(g.astype(float)-b<53)&(g>110)&(b>75)).astype(np.uint8)*255
  roi=np.zeros((h,w),np.uint8);roi[420:h,780:w]=255;paper=cv2.bitwise_and(paper,roi);paper=cv2.morphologyEx(paper,cv2.MORPH_CLOSE,np.ones((31,31),np.uint8));cs,_=cv2.findContours(paper,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE);mask=np.zeros_like(paper)
  for c in cs:
   if cv2.contourArea(c)>350:cv2.drawContours(mask,[c],-1,255,-1)
  mask=cv2.erode(mask,np.ones((5,5),np.uint8));mask=cv2.GaussianBlur(mask,(9,9),2).astype(float)/255;maxarea=max(maxarea,float((mask>.5).mean()));blur=cv2.GaussianBlur(f,(0,0),6);f=np.clip(f*(1-mask[:,:,None])+blur*mask[:,:,None],0,255).astype(np.uint8)
 proc.stdin.write(f.tobytes());n+=1
proc.stdin.close();assert proc.wait()==0;cap.release();subprocess.run([FF,'-v','error','-y','-i',str(vid),'-i',src,'-map','0:v','-map','1:a','-c:v','copy','-c:a','copy',str(out)],check=True)
rec=dict(id='V21-10',file=str(out),sha256=hashlib.sha256(out.read_bytes()).hexdigest(),estimatedDuration=n/fps,sourceSegments=[dict(file=src,sha256=hashlib.sha256(Path(src).read_bytes()).hexdigest(),sourceTime=[0,n/fps],playbackRate=1)],reviewState='pending-final-dynamic-review',noLoop=True,noFrozenMouth=True,fullSourceLinesPreserved=True,paperInteriorRepair=dict(method='仅随纸色局部失焦，保留纸边、手部和整张脸，未作强裁脸',maxFrameAreaFraction=maxarea,gaussianSigma=6),repairReason='尾段案上模型纸面不作为可读假证据，未恢复后段拿信靠灯动作。')
ov['V21-10']=rec;(R/'candidate-overrides.json').write_text(json.dumps(ov,ensure_ascii=False,indent=2),encoding='utf-8');out.with_suffix('.json').write_text(json.dumps(rec,ensure_ascii=False,indent=2),encoding='utf-8');subprocess.run([FF,'-v','error','-y','-ss','4','-i',str(out),'-frames:v','1',str(R/'V21-10-paper-repaired-detail.png')],check=True);print('tail paper repair max area',maxarea)
