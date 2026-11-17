from pathlib import Path
import json, shutil, hashlib, html
from PIL import Image, ImageDraw
DOC=Path(__file__).resolve().parent
ROOT=DOC.parents[2]
OUT=ROOT/'source-art/visuals/investigation-expansion-20261022'
OUT.mkdir(parents=True,exist_ok=True)
rows=json.loads((DOC/'investigation-generation.json').read_text(encoding='utf-8'))
cards=[]; checks=[]; thumbs=[]
for row in rows:
    p=OUT/(row['id']+'.png'); p.parent.mkdir(parents=True,exist_ok=True)
    if not p.exists(): shutil.copy2(row['source'],p)
    im=Image.open(p); im.load()
    c=dict(id=row['id'],title=row['title'],path=str(p),size=im.size,mode=im.mode,sha256=hashlib.sha256(p.read_bytes()).hexdigest(),status='待review')
    char=row['transparent']
    if char:
        assert im.mode=='RGBA',p
        a=im.getchannel('A'); hist=a.histogram()
        c.update(alphaRange=a.getextrema(),transparentRatio=hist[0]/(im.width*im.height))
        assert hist[0]>0 and a.getextrema()[1]>240,p
        proof=Image.new('RGB',(800,600))
        for k,color in enumerate(['#eee9df','#20252a']):
            bg=Image.new('RGBA',(400,600),color); t=im.copy(); t.thumbnail((380,570)); bg.alpha_composite(t,((400-t.width)//2,(600-t.height)//2)); proof.paste(bg.convert('RGB'),(400*k,0))
        proof.save(p.parent/'alpha-proof.jpg',quality=92)
    checks.append(c)
    t=im.convert('RGBA'); t.thumbnail((480,300)); canvas=Image.new('RGBA',(500,340),'#d9d4ca'); canvas.alpha_composite(t,((500-t.width)//2,0)); d=ImageDraw.Draw(canvas); d.text((10,310),row['id'],fill='black'); thumbs.append(canvas.convert('RGB'))
    rel=p.relative_to(OUT).as_posix()
    cards.append(f'<article><a href="{rel}"><img class="{"char" if char else "scene"}" src="{rel}"></a><h2>{html.escape(row["title"])}</h2><p>{html.escape(row["evidence"])} · 待review</p><small>{row["id"]}</small></article>')
sheet=Image.new('RGB',(1500,340*((len(thumbs)+2)//3)),'#d9d4ca')
for i,t in enumerate(thumbs):sheet.paste(t,((i%3)*500,(i//3)*340))
sheet.save(OUT/'contact-sheet.jpg',quality=90)
(DOC/'investigation-validation.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2),encoding='utf8')
(OUT/'index.html').write_text('<!doctype html><meta charset="utf-8"><title>查账补充资产审阅</title><style>body{margin:32px;background:#e6dece;color:#302d27;font:16px system-ui}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(400px,1fr));gap:20px}article{padding:16px;background:#f8f3e9}img{width:100%;object-fit:contain;height:300px}.char{height:480px;background:repeating-conic-gradient(#ddd 0% 25%,#f3efe6 0% 50%) 50%/24px 24px}h2{font-size:20px}</style><h1>主角查账 · 补充资产</h1><p>8张场景（5处环境、3个核账机位）与3位透明底NPC。均待review，未绑定正式游戏。地点为美术实施名称，不新增旅行、剧情事实或强制关卡。点击查看原图。</p><main>'+''.join(cards)+'</main>',encoding='utf8')
print(json.dumps(checks,ensure_ascii=False))
