from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,subprocess
import pipeline

OUT=Path(__file__).resolve().parent;final=OUT/'开篇PV-H3-v1-108秒-无声动态审阅.mp4'
timeline=pipeline.read(OUT/'edit-timeline.json');font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',18)
board=Image.new('RGB',(1536,7*252),'#f6f5f1');draw=ImageDraw.Draw(board);frames=OUT/'final-contact-frames';frames.mkdir(exist_ok=True)
for index,s in enumerate(timeline):
    t=(s['timeline_in']+s['timeline_out'])/2
    if s['unit']=='G11':t=s['timeline_in']+5.5
    f=frames/(s['unit']+'.jpg')
    pipeline.run([pipeline.FF,'-v','error','-ss',t,'-i',final,'-vf','scale=384:216','-frames:v','1','-update','1',f],timeout=40)
    x=index%4*384;y=index//4*252
    with Image.open(f) as im:board.paste(im,(x,y))
    draw.text((x+6,y+220),f'{s["unit"]}　{s["timeline_in"]}—{s["timeline_out"]}秒',font=font,fill='#2c3931')
board.save(OUT/'成片关键画面总览.jpg',quality=94)
print('Final timeline contact sheet exported')
