from pathlib import Path
import av,json,hashlib
from PIL import Image,ImageDraw
OUT=Path(__file__).resolve().parent
before=json.loads((OUT/'review/G2-document-cleanup-assist-before.json').read_text(encoding='utf-8'))
results=[]
for row in before:
    p=Path(row['file']);sha=hashlib.sha256(p.read_bytes()).hexdigest()
    if sha!=row['sha256']:
        results.append(dict(id=row['id'],reviewState='pending-source-changed',beforeSha256=row['sha256'],currentSha256=sha));continue
    frames=[];nextt=0
    with av.open(str(p)) as c:
        for f in c.decode(video=0):
            t=float(f.pts*f.time_base)
            if t+.001>=nextt:
                im=f.to_image();im.thumbnail((400,225));frames.append((t,im));nextt+=.5
    sheet=Image.new('RGB',(1600,((len(frames)+3)//4)*250),'#171717');d=ImageDraw.Draw(sheet)
    for i,(t,im) in enumerate(frames):
        x=i%4*400;y=i//4*250;sheet.paste(im,(x,y));d.text((x+5,y+228),row['id']+f' {t:.3f}s',fill='white')
    dest=OUT/'review'/f'G2-{row["id"]}-2fps.jpg';sheet.save(dest)
    after=hashlib.sha256(p.read_bytes()).hexdigest()
    results.append(dict(**row,afterSamplingSha256=after,unchangedDuringSampling=after==sha,sheet=str(dest),times=[x[0] for x in frames]))
(OUT/'review/G2-assist-frame-evidence.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps([dict(id=x['id'],unchanged=x.get('unchangedDuringSampling',False)) for x in results]))
