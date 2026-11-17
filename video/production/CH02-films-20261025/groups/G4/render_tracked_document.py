"""Accurate frozen text composited onto the blank moving paper; no API calls."""
from pathlib import Path
import json,subprocess,numpy as np
from PIL import Image,ImageDraw,ImageFont
OUT=Path(__file__).resolve().parent
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
source=OUT/'generated/V26-04-R2-16x9.mp4'
dest=OUT/'edited/derived/V26-04-准确转运简报.mp4';dest.parent.mkdir(parents=True,exist_ok=True)
silent=dest.with_name(dest.stem+'-visual.mp4')
keys=[(0,[[622,509],[901,515],[936,676],[508,658]]),(1.5,[[602,463],[912,472],[960,669],[462,644]]),(3,[[570,378],[929,386],[1001,659],[379,619]])]
layer=Image.new('RGBA',(700,400),(0,0,0,0));draw=ImageDraw.Draw(layer)
font='C:/Windows/Fonts/simsun.ttc'
draw.text((350,38),'转运简报',font=ImageFont.truetype(font,38),fill=(44,36,25,245),anchor='mt')
for y,line in [(135,'敌方正在修整粮道、'),(230,'筹集军资，并恢复屯田。')]:draw.text((45,y),line,font=ImageFont.truetype(font,48),fill=(44,36,25,245))
dec=subprocess.Popen([FF,'-v','error','-i',str(source),'-vf','trim=start=0:end=3,setpts=(PTS-STARTPTS)/0.5,fps=24','-an','-f','rawvideo','-pix_fmt','rgb24','pipe:1'],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
enc=subprocess.Popen([FF,'-v','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s','1280x720','-r','24','-i','pipe:0','-an','-c:v','libx264','-threads','2','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(silent)],stdin=subprocess.PIPE,stderr=subprocess.PIPE)
count=0
while True:
    data=dec.stdout.read(1280*720*3)
    if not data:break
    if len(data)!=1280*720*3:raise RuntimeError('Partial decoded frame')
    t=count/24*.5
    pair=next(((a,b) for a,b in zip(keys,keys[1:]) if a[0]<=t<=b[0]),(keys[-2],keys[-1]))
    a,b=pair;f=max(0,min(1,(t-a[0])/(b[0]-a[0])))
    quad=np.array(a[1])*(1-f)+np.array(b[1])*f
    A=[];B=[]
    for (x,y),(u,v) in zip(quad,[(0,0),(699,0),(699,399),(0,399)]):
        A.extend([[x,y,1,0,0,0,-u*x,-u*y],[0,0,0,x,y,1,-v*x,-v*y]]);B.extend([u,v])
    coeff=np.linalg.solve(np.array(A),np.array(B))
    overlay=layer.transform((1280,720),Image.Transform.PERSPECTIVE,coeff,Image.Resampling.BICUBIC)
    base=Image.frombytes('RGB',(1280,720),data).convert('RGBA')
    enc.stdin.write(Image.alpha_composite(base,overlay).convert('RGB').tobytes());count+=1
enc.stdin.close();er=enc.stderr.read();enc.wait();dr=dec.stderr.read();dec.wait()
if enc.returncode or dec.returncode:raise RuntimeError('Document compositing encode failed')
subprocess.run([FF,'-v','error','-y','-i',str(silent),'-i',str(source),'-map','0:v','-map','1:a:0','-af','atrim=start=0:end=3,asetpts=PTS-STARTPTS,atempo=0.5','-t',str(count/24),'-c:v','copy','-c:a','aac','-ar','48000','-ac','2','-b:a','192k','-movflags','+faststart',str(dest)],check=True)
(OUT/'review/document-overlay-placement.json').write_text(json.dumps(dict(source=str(source),sourceTask='task_K3cY2lbT6H1esMYpuYmmQACPCU5fPe11',sourceRange=[0,3],speed=.5,frames=count,output=str(dest),text='敌方正在修整粮道、筹集军资，并恢复屯田。',sourceNode='CH2-LY09-009',trackingKeys=keys,method='逐帧透视字层，不改原纸面纹理，不由模型写字；保留本段原环境音，声音未听审'),ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(dict(file=str(dest),frames=count,duration=count/24),ensure_ascii=False))
