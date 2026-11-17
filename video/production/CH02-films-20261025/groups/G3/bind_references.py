from pathlib import Path
import json,hashlib
OUT=Path(__file__).resolve().parent;BASE=OUT.parents[1]
m=json.loads((BASE/'references/manifest.json').read_text(encoding='utf-8-sig'))
assert m.get('ready')
assets={x['id']:x for x in m['assets']}
mapping={'gouan':'苟安','wound_tent':'伤帐','grain_manager':'粮队管事','camp_route':'粮仓','village':'访村','liyan':'李严','study':'书房'}
bindings={}
for key,id in mapping.items():
 r=assets[id];assert r['ready'];p=Path(r['path']);assert p.is_file()
 assert hashlib.sha256(p.read_bytes()).hexdigest()==r['sha256']
 bindings[key]=dict(id=id,path=str(p),purpose=r['use']+'；'+r.get('constraint',''),sha256=r['sha256'],ready=True)
(OUT/'reference-bindings.json').write_text(json.dumps(bindings,ensure_ascii=False,indent=2),encoding='utf-8')
from PIL import Image,ImageDraw,ImageFont
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',20)
sheet=Image.new('RGB',(1200,4*250),'#151515');d=ImageDraw.Draw(sheet)
for i,(k,r) in enumerate(bindings.items()):
 im=Image.open(r['path']).convert('RGB');im.thumbnail((590,220));x=i%2*600;y=i//2*250;sheet.paste(im,(x,y));d.text((x+5,y+220),r['id'],font=font,fill='white')
sheet.save(OUT/'review/reference-binding.jpg')
print('Bound and hash-verified',len(bindings),'central references')
