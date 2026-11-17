from pathlib import Path
import sys,subprocess
from PIL import Image,ImageFilter,ImageDraw
OUT=Path(__file__).parent;sys.path.insert(0,str(OUT))
from run_pipeline import FF,read,save,metadata
from paper_composite import interp

def obscure(im,t):
    # Current V42 final film. Keep physical unrolling/turning, remove readable ink locally.
    if t<3.25:return im
    keys=[(3.25,[610,550,980,710]),(4,[570,490,980,719]),(5,[400,380,1000,719]),(7.25,[360,335,1050,719]),(7.4,[0,350,1280,719]),(8.25,[0,290,1280,719]),(16.92,[0,250,1280,719]),(17,[120,370,790,700]),(18,[110,350,800,700]),(19,[90,360,800,710]),(21.83,[90,365,815,710])]
    box=tuple(round(x) for x in interp(t,keys));mask=Image.new('L',im.size,0);ImageDraw.Draw(mask).rectangle(box,fill=255);mask=mask.filter(ImageFilter.GaussianBlur(18))
    estimate=im.resize((256,144),Image.Resampling.BILINEAR).filter(ImageFilter.MedianFilter(15)).resize(im.size,Image.Resampling.BICUBIC)
    return Image.composite(estimate,im,mask)

if __name__=='__main__':
    if sys.argv[1]=='preview':
        src=next(x['file'] for x in read(OUT/'delivery.json')['assembled'] if x['id']=='V42')
        target=OUT/'review/record-paper-preview';target.mkdir(exist_ok=True)
        for t in [6,10.5,19.5]:
            tmp=target/f'original-{t}.png'
            subprocess.run([str(FF),'-v','error','-y','-ss',str(t),'-i',src,'-frames:v','1',str(tmp)],check=True)
            obscure(Image.open(tmp).convert('RGB'),t).save(target/f'local-{t}.png')
        print('Three bounded local-paper previews created; no output selected')
