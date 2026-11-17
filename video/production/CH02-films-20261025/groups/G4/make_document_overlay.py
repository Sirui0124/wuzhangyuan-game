"""Typeset the frozen document accurately; perspective coordinates come from review."""
from pathlib import Path
import json,numpy as np,hashlib
from PIL import Image,ImageDraw,ImageFont
OUT=Path(__file__).resolve().parent
placement=json.loads((OUT/'review/document-overlay-placement.json').read_text(encoding='utf-8'))
quad=placement['quad']
src=[(0,0),(699,0),(699,399),(0,399)]
A=[];B=[]
for (x,y),(u,v) in zip(quad,src):
    A.extend([[x,y,1,0,0,0,-u*x,-u*y],[0,0,0,x,y,1,-v*x,-v*y]])
    B.extend([u,v])
coeff=np.linalg.solve(np.array(A),np.array(B))
layer=Image.new('RGBA',(700,400),(0,0,0,0));draw=ImageDraw.Draw(layer)
font_path='C:/Windows/Fonts/simsun.ttc'
header=ImageFont.truetype(font_path,34);font=ImageFont.truetype(font_path,42)
draw.text((350,38),'转运简报',font=header,fill=(52,43,30,245),anchor='mt')
draw.text((45,128),'敌方正在修整粮道、',font=font,fill=(44,37,27,245))
draw.text((45,205),'筹集军资，并恢复屯田。',font=font,fill=(44,37,27,245))
result=layer.transform((1280,720),Image.Transform.PERSPECTIVE,coeff,Image.Resampling.BICUBIC)
target=OUT/'edited/overlays/V26-04-转运简报.png';target.parent.mkdir(parents=True,exist_ok=True);result.save(target)
(target.with_suffix('.json')).write_text(json.dumps(dict(sourceNode='CH2-LY09-009',text='敌方正在修整粮道、筹集军资，并恢复屯田。',file=str(target),quad=quad,sha256=hashlib.sha256(target.read_bytes()).hexdigest(),method='PIL原文排版与透视文字层，不由视频模型拼写，纸面空白纹理由实际视频保留'),ensure_ascii=False,indent=2),encoding='utf-8')
print(str(target))
