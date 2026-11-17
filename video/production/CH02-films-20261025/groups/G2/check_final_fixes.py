from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import subprocess
OUT=Path(__file__).parent
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
D=OUT/'review/final-fix-check';D.mkdir(exist_ok=True)
checks=[('V20-05',1),('V20-05',3.8),('V20-05',4.1),('V20-07',0),('V20-07',4.3),('V20-07',7.5),('V20-08',0),('V20-08',3.5),('V20-08',6.95),('V20-08',7.1),('V20-08',8.8)]
sheet=Image.new('RGB',(1344,4*280),(20,24,24));draw=ImageDraw.Draw(sheet);font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',18)
for j,(id,t) in enumerate(checks):
    p=D/f'{id}-{t}.png'
    subprocess.run([FF,'-v','error','-y','-ss',str(t),'-i',str(OUT/'edited'/f'{id}-R3.mp4'),'-frames:v','1',str(p)],check=True)
    im=Image.open(p).convert('RGB');im.thumbnail((448,252));x=j%3*448;y=j//3*280;sheet.paste(im,(x,y));draw.text((x+6,y+255),f'{id} {t}s',font=font,fill='white')
sheet.save(D/'sheet.jpg')
print('Local fixes checks',len(checks))
