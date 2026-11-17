"""Free video compositing. Exact lettering is postproduction, never model handwriting."""
from pathlib import Path
import sys,subprocess,math
import numpy as np
from PIL import Image,ImageFilter,ImageDraw,ImageFont
OUT=Path(__file__).parent;sys.path.insert(0,str(OUT))
from run_pipeline import FF,save,metadata,read

def interp(t,keys):
    if t<=keys[0][0]:return keys[0][1]
    for (a,x),(b,y) in zip(keys,keys[1:]):
        if t<=b:return [u+(v-u)*(t-a)/(b-a) for u,v in zip(x,y)]
    return keys[-1][1]

def process(id,source,start,end,fn,description):
    dest=OUT/'edited/sources'/f'{id}.mp4';pending=dest.with_name(dest.stem+'.silent.mp4')
    src=OUT/'generated'/f'{source}-16x9.mp4'
    dec=subprocess.Popen([str(FF),'-v','error','-ss',str(start),'-t',str(end-start),'-i',str(src),'-vf','scale=1280:720,fps=24','-f','rawvideo','-pix_fmt','rgb24','pipe:1'],stdout=subprocess.PIPE)
    enc=subprocess.Popen([str(FF),'-v','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s','1280x720','-r','24','-i','pipe:0','-an','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p',str(pending)],stdin=subprocess.PIPE)
    i=0
    try:
        while True:
            data=dec.stdout.read(1280*720*3)
            if len(data)!=1280*720*3:break
            im=Image.frombytes('RGB',(1280,720),data);out=fn(im,start+i/24);enc.stdin.write(out.tobytes());i+=1
    finally:
        enc.stdin.close();dec.stdout.close()
    if dec.wait() or enc.wait():raise RuntimeError('Video composite failed')
    subprocess.run([str(FF),'-v','error','-y','-i',str(pending),'-ss',str(start),'-i',str(src),'-map','0:v','-map','1:a','-c:v','copy','-c:a','aac','-ar','48000','-ac','2','-t',str(i/24),'-movflags','+faststart',str(dest)],check=True)
    check=subprocess.run([str(FF),'-v','error','-i',str(dest),'-f','null','NUL'],capture_output=True)
    if check.returncode:raise RuntimeError('Decode failed')
    save(dest.with_suffix('.json'),dict(id=id,sourceId=source,sourceRange=[start,end],newPaidRequest=False,description=description,decode='passed',metadata=metadata(dest),visualReview='pending actual inspection',audioListening='未逐字听审'))
    print(id,'rendered',flush=True)

def receipt(im,t):
    keys=[(0,[1210,0,1279,80]),(.7,[1180,0,1279,100]),(1,[900,110,1200,270]),(1.5,[715,220,1000,390]),(2,[600,285,945,480]),(2.5,[480,315,900,560]),(3,[450,330,950,650]),(4.8,[435,330,965,660])]
    box=tuple(int(x) for x in interp(t,keys));mask=Image.new('L',im.size,0);ImageDraw.Draw(mask).rounded_rectangle(box,radius=12,fill=255);mask=mask.filter(ImageFilter.GaussianBlur(12))
    return Image.composite(im.filter(ImageFilter.GaussianBlur(12)),im,mask)

font=ImageFont.truetype('C:/Windows/Fonts/simkai.ttf',32)
def crossout(im,t,text_shift=0):
    original=im.copy();arr=np.asarray(original)
    # Put the exact withdrawn clause on the actual line drawn by the actor.
    keys=[(3.8,[570,330,730,366]),(4.3,[572,342,735,380]),(5,[574,350,740,386]),(6,[585,330,751,368]),(7,[601,317,768,357]),(8,[618,305,784,344]),(9.42,[630,294,795,332])]
    x,y,x2,y2=interp(t,keys);w=x2-x;h=36
    # Estimate unmarked paper at lower resolution, then replace thin dark old glyphs only.
    # Large fingers/brush cores survive the median; the actual cross stroke is below the ROI.
    box=(600,105,975,int(y-20));region=im.crop(box)
    estimate=region.resize((125, max(20,region.height//3)),Image.Resampling.BILINEAR).filter(ImageFilter.MedianFilter(15)).resize(region.size,Image.Resampling.BICUBIC)
    a=np.asarray(region).astype('int16');b=np.asarray(estimate).astype('int16')
    thin=(b.mean(axis=2)-a.mean(axis=2)>24)
    removal=Image.fromarray((thin*255).astype('uint8')).filter(ImageFilter.GaussianBlur(.6))
    region=Image.composite(estimate,region,removal);im.paste(region,box[:2])
    stamp=Image.new('RGBA',(300,65),(0,0,0,0));dd=ImageDraw.Draw(stamp);dd.text((2,4),'若仍不听便赴魏',font=font,fill=(45,35,25,235))
    bbox=stamp.getbbox();stamp=stamp.crop(bbox).resize((int(w),int(h)),Image.Resampling.LANCZOS)
    # Affine shear follows the paper's receding ink baseline.
    layer=Image.new('RGBA',im.size,(0,0,0,0));stamp=stamp.rotate(-math.degrees(math.atan2(y2-y,x2-x)),expand=True,resample=Image.Resampling.BICUBIC)
    layer.alpha_composite(stamp,(int(x),int(y-h/2+text_shift)))
    base=im.convert('RGBA');base.alpha_composite(layer);im=base.convert('RGB')
    # Original brush and actual physical stroke remain above the added glyphs.
    yy,xx=np.indices(arr.shape[:2]);foreground=((arr.max(axis=2)<85)&(xx>x-12)&(xx<x2+22)&(yy>y-20)&(yy<y2+24))
    out=np.array(im);out[foreground]=arr[foreground]
    return Image.fromarray(out)

if __name__=='__main__':
    if sys.argv[1]=='receipt':process('V36-01-C3-paper-focus','V36-01',0,4.8,receipt,'手持与首叠材料完整放置、松手阶段对模型错误字作局部柔焦；准确材料名称另作后期插入；未伪称纸面真实可读')
    else:process('V32A-07-C7-clean-paper','V32A-07-R2',3.8,9.42,crossout,'删除上方原生大伪字，在实际横划轨迹上配准撤回条款；大笔杆/手指和实际横线保留，下方署名字形仍以准确后期文书确认，不能冒充模型准确手写')
