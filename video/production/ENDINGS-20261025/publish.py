import html
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parent
plan=json.loads((ROOT/'plan.json').read_text(encoding='utf-8'))
tech=json.loads((ROOT/'technical-review.json').read_text(encoding='utf-8')) if (ROOT/'technical-review.json').exists() else []
byid={r['id']:r for r in tech}
adoption=json.loads((ROOT/'adoption.json').read_text(encoding='utf-8')) if (ROOT/'adoption.json').exists() else {}
cards=[]
delivery=[]
for s in plan:
    t=byid.get(s['id'])
    if t and t.get('take') != adoption.get(s['id'],s['id']):
        t=None
    statepath=ROOT/'tasks'/f"{adoption.get(s['id'],s['id'])}.json"
    state=json.loads(statepath.read_text(encoding='utf-8')) if statepath.exists() else {}
    if t and t.get('localRevision'):
        origin=ROOT/'tasks'/f"{t['originTake']}.json"
        state=json.loads(origin.read_text(encoding='utf-8')) if origin.exists() else {}
    status='候选片 · 待审阅' if t else '视频生成中' if state.get('task_id') else '首帧与分镜已准备'
    image=Path(s['reference']).relative_to(ROOT).as_posix()
    media=f'<video controls preload="metadata" poster="{image}" src="{Path(t["path"]).relative_to(ROOT).as_posix()}"></video>' if t else f'<img src="{image}" alt="{html.escape(s["name"])}首帧">'
    prompt=Path(s['prompt']).relative_to(ROOT).as_posix()
    cards.append(f'<article>{media}<div><h2>{html.escape(s["name"])}</h2><p>{html.escape(s["core"])}</p><footer><span>{status}</span><a href="{prompt}">查看分镜</a></footer></div></article>')
    delivery.append({**s,'remoteStatus':state.get('status'),'task_id':state.get('task_id'),'film':t,'userApproved':False})
page='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>第一章结局候选</title><style>
*{box-sizing:border-box}body{margin:0;background:#171b1b;color:#ece9df;font:16px/1.7 system-ui,"Microsoft YaHei",sans-serif}main{max-width:1360px;margin:auto;padding:38px}h1{font-weight:500;letter-spacing:.08em;font-size:30px;margin:0 0 8px}.intro{color:#bcbfb5;margin:0 0 32px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}article{background:#252b2b;border:1px solid #414841;border-radius:10px;overflow:hidden}video,img{display:block;width:100%;aspect-ratio:16/9;background:#080b0b;object-fit:contain}article>div{padding:20px}h2{font-weight:500;font-size:23px;margin:0 0 8px}p{margin:0;color:#c8cdc2}footer{margin-top:18px;display:flex;justify-content:space-between;font-size:14px;color:#aab2a3}a{color:#dac18c;text-decoration:none}a:hover{text-decoration:underline}@media(max-width:800px){main{padding:20px}.grid{grid-template-columns:1fr}}</style><main><h1>第一章 · 结局候选</h1><p class="intro">五种结局，五段完整收束。人物沿用现有形象，允许客观镜头；新片待审阅，尚未接入游戏。</p><section class="grid">'''+''.join(cards)+'''</section></main></html>'''
page=page.replace('<h1>第一章', '<nav><a href="chapter-two/审片.html">第二章结局</a></nav><h1>第一章')
(ROOT/'审片.html').write_text(page,encoding='utf-8')
available=sum(bool(row['film']) for row in delivery)
(ROOT/'delivery.json').write_text(json.dumps({'status':'review-candidates' if available==len(plan) else 'production','userApproved':False,'gameIntegrated':False,'chapterTwoOwner':'01a16f08-4fed-7eb0-ac75-041e1f010683','films':delivery},ensure_ascii=False,indent=2),encoding='utf-8')
print('Published',len(cards),'review cards;',available,'videos available.')
