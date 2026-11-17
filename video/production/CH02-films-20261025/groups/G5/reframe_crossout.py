from pathlib import Path
import sys
from PIL import Image
OUT=Path(__file__).parent;sys.path.insert(0,str(OUT))
from paper_composite import process,interp,crossout

def reframe(im,t):
    # Align the actual diagonal ink stroke with the frame. No ink removal or new action.
    im=im.rotate(18,resample=Image.Resampling.BICUBIC,expand=False)
    x,y,w,h=interp(t,[(3.8,[400,325,448,252]),(5.25,[400,325,448,252]),(5.75,[400,370,448,252]),(9.42,[400,370,448,252])])
    return im.crop((round(x),round(y),round(x+w),round(y+h))).resize((1280,720),Image.Resampling.LANCZOS)

if __name__=='__main__':
    if len(sys.argv)>1 and sys.argv[1]=='clause':
        process('V32A-07-C12-follow-clause-safe','V32A-07-R2',3.8,9.42,lambda im,t:reframe(crossout(im,t,text_shift=9),t),'在同一真实横划轨迹配准准确撤回句，并旋转校正/跟随笔尖裁幅排除上方伪字。字层下移9源像素使全句留在裁幅安全区，真实横划仍穿过字身。实际横划、提笔、下方署名、写字手离开顺序完整保留。字层是后期，不冒充模型准确手写；待动态复核。')
    else:
        process('V32A-07-C8-follow-brush','V32A-07-R2',3.8,9.42,reframe,'仅旋转校正与跟随笔尖裁幅：先实际横划、再下方署名、最后写字手离开。上方大伪字排除在画外，无擦字/准确文字卡替代动作；准确条款和姓名只在前后核阅层展示。待全片复核，不自动采用。')
