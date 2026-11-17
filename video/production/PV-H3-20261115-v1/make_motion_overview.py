from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,math

OUT=Path(__file__).resolve().parent
units=json.loads((OUT/'production-plan.json').read_text('utf-8'))['units']
ready=[u for u in units if (OUT/u['id']/'contact.jpg').exists()]
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',18)
pages=[]
for offset in range(0,len(ready),8):
    batch=ready[offset:offset+8]
    board=Image.new('RGB',(1600,len(batch)*218),'#f6f5f1');draw=ImageDraw.Draw(board)
    for row,u in enumerate(batch):
        y=row*218;draw.text((8,y+4),u['id']+' '+u['title']+f'｜采用0—{u["edit_duration"]}秒',font=font,fill='#26332b')
        with Image.open(OUT/u['id']/'contact.jpg') as contact:
            for col,frac in enumerate([0,.25,.5,.75,.98]):
                index=max(0,int((u['edit_duration']-.1)*2*frac));x0=index%4*320;y0=index//4*180
                if y0+180>contact.height:y0=contact.height-180
                frame=contact.crop((x0,y0,x0+320,y0+180))
                board.paste(frame,(col*320,y+35))
    filename=OUT/f'motion-overview-{offset//8+1}.jpg';board.save(filename,quality=93);pages.append(str(filename))
print(json.dumps({'ready':len(ready),'pages':pages},ensure_ascii=False))
