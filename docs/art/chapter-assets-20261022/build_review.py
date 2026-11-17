from pathlib import Path
import json, shutil, hashlib, html
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[3]
DOC=Path(__file__).resolve().parent
OUT=ROOT/'source-art/visuals/chapter-expansion-20261022'
rows=json.loads((DOC/'generation.json').read_text(encoding='utf8'))
names={'infirmary-day':'伤帐·白昼','granary-day':'粮仓·白昼','granary-night':'粮仓·第三夜','village-day':'村口核粮处','records-tent-day':'军吏收件帐·设计稿','liyan-study-night':'李严书房·夜','liyan-study-day':'李严书房·日','gouan':'苟安','liyan':'李严·新身份设计','old-woman':'老妇','grain-officer':'粮队管事','warehouse-clerk':'仓吏','military-clerk':'收件军吏','old-transporter':'老运粮人','village-handler':'村中经手人','villager':'村户','granary-soldier':'仓边兵卒'}
proof=DOC/'proof';proof.mkdir(exist_ok=True)
checks=[]; cards=[]
for i,r in enumerate(rows):
 p=OUT/(r['id']+'.png');p.parent.mkdir(parents=True,exist_ok=True)
 if not p.exists():shutil.copy2(r['source'],p)
 im=Image.open(p);im.load();c=dict(id=r['id'],path=str(p),size=list(im.size),mode=im.mode,sha256=hashlib.sha256(p.read_bytes()).hexdigest(),status='待review')
 char=r['id'].startswith('characters/')
 if char:
  assert im.mode=='RGBA',p
  a=im.getchannel('A');h=a.histogram();c.update(alphaRange=list(a.getextrema()),fullyTransparentRatio=h[0]/(im.width*im.height),corners=[a.getpixel(pt) for pt in [(0,0),(im.width-1,0),(0,im.height-1),(im.width-1,im.height-1)]])
  assert h[0]>0 and a.getextrema()[1]>240,p
  panel=Image.new('RGB',(640,480),'white')
  for k,color in enumerate(['#ffffff','#202020']):
   thumb=im.copy();thumb.thumbnail((310,460));bg=Image.new('RGBA',(320,480),color);bg.alpha_composite(thumb,((320-thumb.width)//2,(480-thumb.height)//2));panel.paste(bg.convert('RGB'),(k*320,0))
  panel.save(proof/f'{i:02}.jpg',quality=90)
 title=names.get(r['id'].split('/')[1] if char else r['id'].split('/')[1].removesuffix('-v1'),r['id'])
 c['title']=title;checks.append(c)
 rel=p.relative_to(OUT).as_posix()
 extra=f'<a href="../../../docs/art/chapter-assets-20261022/proof/{i:02}.jpg">黑白底复核</a>' if char else ''
 cards.append(f'<article><a href="{rel}"><img loading="lazy" src="{rel}" class="{"char" if char else "scene"}"></a><h3>{title}</h3><p>{html.escape(r["id"])} · {im.width}×{im.height} · 待review</p>{extra}</article>')
(DOC/'validation.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2),encoding='utf8')
(OUT/'index.html').write_text('''<!doctype html><meta charset="utf-8"><title>第一、二章补缺资产审阅</title><style>body{background:#e6dece;color:#302d27;font:16px system-ui;margin:32px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(380px,1fr));gap:22px}article{background:#f8f3e9;padding:16px}img{width:100%;object-fit:contain}.char{height:460px;background:repeating-conic-gradient(#dedbd3 0% 25%,#f3efe6 0% 50%) 50%/24px 24px}.scene{height:300px}p{overflow-wrap:anywhere}a{color:#655634}</style><h1>章节补缺资产 · 21张 · 待review</h1><p>7张场景、10位角色共14张透明人物图。点击原图放大；人物可看黑白底。第一章现有资产沿用，本页仅列新增。</p><p>李严及书房、收件帐是新设计；苟安、老妇、仓边兵卒和村中经手人参考实际视频。尚未绑定游戏，不代表视觉审批通过。</p><a href="../../../docs/art/chapter-assets-20261022/REPORT.md">完整剧情需求与复用判断</a><main>'''+''.join(cards)+'</main>',encoding='utf8')
print(json.dumps({'files':len(checks),'characters':sum(c['mode']=='RGBA' for c in checks),'scenes':sum(c['mode']=='RGB' for c in checks),'allReadable':True,'allCharactersHaveAlpha':True},ensure_ascii=False))
