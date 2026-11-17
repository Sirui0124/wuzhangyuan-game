"""Local video-only moving paper defocus; original video/audio are preserved."""
from pathlib import Path
import subprocess,json,hashlib,sys
from PIL import Image,ImageDraw,ImageFilter
OUT=Path(__file__).resolve().parent
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
# Coordinates are on a 640x360 reference view, interpolated with the paper.
MASKS={
 'V12-02':[(1.3,[(210,360)]*4),(2,[(125,280),(375,225),(460,375),(150,375)]),(2.5,[(125,255),(400,205),(500,375),(120,375)]),(2.85,[(90,0),(440,-20),(600,375),(110,390)]),(8,[(90,0),(440,-20),(600,375),(110,390)]),(9,[(45,85),(350,15),(510,350),(100,390)]),(10,[(0,175),(200,135),(350,390),(0,390)]),(11,[(0,245),(120,200),(240,390),(0,390)]),(14.5,[(0,295),(95,245),(210,390),(0,390)])],
 'V12-01':[(1.8,[(280,175)]*4),(2.2,[(255,125),(310,100),(355,200),(255,225)]),(2.55,[(260,230),(430,210),(455,280),(275,315)]),(3.3,[(270,245),(425,230),(435,295),(290,315)]),(4.3,[(200,190),(540,230),(540,300),(220,250)]),(5,[(85,145),(320,145),(520,245),(310,345)]),(6.3,[(45,45),(285,35),(545,205),(350,330)]),(7,[(20,75),(310,65),(550,250),(315,360)]),(8,[(50,20),(395,-10),(640,320),(190,375)]),(9.5,[(50,-10),(400,-10),(640,330),(180,375)])],
 'V12-03':[(0,[(260,360)]*4),(.7,[(200,230),(400,170),(550,390),(180,390)]),(1.3,[(120,-30),(490,-30),(530,390),(100,390)]),(4.7,[(120,-30),(490,-30),(530,390),(100,390)]),(5.3,[(350,310),(530,300),(585,360),(330,360)]),(6.5,[(200,240),(320,215),(360,320),(220,345)]),(12.2,[(160,235),(290,220),(345,320),(210,345)])],
 'V06-01':[(0,[(250,145),(490,140),(570,330),(240,340)]),(2,[(175,95),(615,80),(640,360),(115,360)]),(3,[(130,50),(640,50),(640,360),(90,360)]),(8,[(100,30),(640,30),(640,360),(70,360)])],
 'V08A-01':[(1.1,[(500,360)]*4),(1.65,[(0,190),(490,20),(640,350),(170,360)]),(2.3,[(0,70),(490,0),(640,330),(110,360)]),(3,[(0,45),(490,0),(640,330),(100,360)]),(15.2,[(0,45),(490,0),(640,330),(100,360)])],
 'V10-01':[(.65,[(640,0)]*4),(1,[(475,0),(640,0),(640,175),(535,160)]),(2,[(300,155),(625,70),(640,360),(390,360)]),(3,[(205,150),(510,90),(640,360),(315,360)]),(4.5,[(75,88),(390,20),(615,350),(180,360)]),(8,[(65,85),(375,15),(610,350),(210,360)]),(10.3,[(65,85),(375,15),(610,350),(210,360)])]
}
def points(t,keys):
 if t<keys[0][0]:return None
 for (a,p),(b,q) in zip(keys,keys[1:]):
  if a<=t<b:
   k=(t-a)/(b-a);return [(x+(u-x)*k,y+(v-y)*k) for (x,y),(u,v) in zip(p,q)]
 return keys[-1][1]
selected=sys.argv[1:] or list(MASKS)
for cid in selected:
 src=OUT/'edited'/f'{cid}-normalized.mp4';tmp=OUT/'edited'/f'{cid}-document-video.mp4';dest=OUT/'edited'/f'{cid}-document-softened.mp4'
 assert src.is_file();keys=MASKS[cid];w,h,fps=1280,720,24
 dec=subprocess.Popen([FF,'-v','error','-i',str(src),'-f','rawvideo','-pix_fmt','rgb24','pipe:1'],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
 enc=subprocess.Popen([FF,'-v','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{w}x{h}','-r',str(fps),'-i','pipe:0','-an','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p',str(tmp)],stdin=subprocess.PIPE,stderr=subprocess.PIPE)
 i=masked=0
 while True:
  raw=dec.stdout.read(w*h*3)
  if not raw:break
  assert len(raw)==w*h*3
  poly=points(i/fps,keys)
  if poly:
   # Generous text-only safety margin; no fabricated letters or dates are added.
   cx=sum(x for x,y in poly)/4;cy=sum(y for x,y in poly)/4;poly=[(round((cx+(x-cx)*1.12)*2),round((cy+(y-cy)*1.12)*2)) for x,y in poly]
   mask=Image.new('L',(w,h));ImageDraw.Draw(mask).polygon(poly,fill=255);mask=mask.filter(ImageFilter.GaussianBlur(3));im=Image.frombytes('RGB',(w,h),raw);im=Image.composite(im.filter(ImageFilter.GaussianBlur(16 if cid.startswith('V12') else 9)),im,mask);raw=im.tobytes();masked+=1
  enc.stdin.write(raw);i+=1
 enc.stdin.close();enc.wait();dec.wait();assert enc.returncode==0 and dec.returncode==0
 subprocess.run([FF,'-v','error','-y','-i',str(tmp),'-i',str(src),'-map','0:v:0','-map','1:a:0','-c','copy','-movflags','+faststart',str(dest)],check=True)
 subprocess.run([FF,'-v','error','-i',str(dest),'-f','null','NUL'],check=True,capture_output=True)
 report=dict(id=cid,sourcePath=str(src),sourceSha256=hashlib.sha256(src.read_bytes()).hexdigest(),path=str(dest),frames=i,maskedFrames=masked,maskReferenceSize=[640,360],keyframes=keys,treatment='Moving paper region Gaussian defocus only; no substituted document facts; source audio retained',decode='passed')
 (OUT/'review'/f'{cid}-document-edit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
 subprocess.run([FF,'-v','error','-y','-i',str(dest),'-vf','fps=1,scale=320:-1,tile=4x4:padding=2:margin=2','-frames:v','1',str(OUT/'review'/f'{cid}-soft-check.jpg')],check=True)
 print(json.dumps(dict(id=cid,frames=i,maskedFrames=masked,path=str(dest)),ensure_ascii=False),flush=True)
