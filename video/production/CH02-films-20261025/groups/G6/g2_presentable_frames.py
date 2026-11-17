from pathlib import Path
import json,av,hashlib
from PIL import Image,ImageDraw
OUT=Path(__file__).resolve().parent
rows=json.loads((OUT/'review/G2-presentable-before.json').read_text(encoding='utf-8'))
result=[]
for row in rows:
    p=Path(row['file']);sha=hashlib.sha256(p.read_bytes()).hexdigest();assert sha==row['sha256'] and row['metadataMatches']
    frames=[];nextt=0
    with av.open(str(p)) as c:
        for fr in c.decode(video=0):
            t=float(fr.pts*fr.time_base)
            if t+.001>=nextt:
                im=fr.to_image();im.thumbnail((400,225));frames.append((t,im));nextt+=.125 if t<2.25 else .5
    sheets=[]
    for page in range((len(frames)+19)//20):
        subset=frames[page*20:page*20+20];sheet=Image.new('RGB',(1600,((len(subset)+3)//4)*250),'#161616');d=ImageDraw.Draw(sheet)
        for i,(t,im) in enumerate(subset):
            x=i%4*400;y=i//4*250;sheet.paste(im,(x,y));d.text((x+5,y+228),row['id']+f' PRESENTABLE {t:.3f}s',fill='white')
        out=OUT/'review'/f'G2-{row["id"]}-presentable-sequence-{page+1}.jpg';sheet.save(out);sheets.append(str(out))
    after=hashlib.sha256(p.read_bytes()).hexdigest()
    result.append(dict(**row,sha256AfterSampling=after,stable=after==sha,sheets=sheets,times=[t for t,_ in frames],sampling='8fps first2.25s plus cut boundary, then2fps; ordered auxiliary frames, not continuous human frame-by-frame review'))
(OUT/'review/G2-presentable-frame-evidence.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps([dict(id=x['id'],stable=x['stable'],frames=len(x['times'])) for x in result]))
