from pathlib import Path
import json,html
R=Path(__file__).resolve().parent
plan=json.loads((R/'production-plan.json').read_text('utf-8'))
selection=json.loads((R/'edit-selection.json').read_text('utf-8')) if (R/'edit-selection.json').exists() else None
if selection:
    original={u['id']:u for u in plan['units']}
    plan['units']=[dict(original[s['id']],**s) for s in selection['shots']]
cards=[]
for u in plan['units']:
    sid=u['id'];name=html.escape(u['name'])
    if u.get('source_path'):name='雨中诸葛亮 · 实际选用旧H3 R06'
    cards.append(f'''<article><h2>{sid} · {name}</h2><video controls preload="metadata" src="edit/{sid}.mp4"></video><p>实际选片 {u['edit_duration']} 秒 · 原速 · 本卡只播放画面，声音请看合并版</p><p>{html.escape(u.get('selection_reason',''))}</p><p><a href="{sid}/生成文档.md">生成文档</a> · <a href="{sid}/visual-review.json">画面抽查记录</a> · <a href="{sid}/source.mp4">本轮请求原片（可能未选用）</a></p></article>''')
page='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>三国遗憾 PV · v2 审阅</title><style>body{font:16px/1.7 system-ui,"Microsoft YaHei",sans-serif;color:#222;background:#f5f5f3;margin:0}main{max-width:1120px;margin:auto;padding:28px}h1{font-size:28px}h2{font-size:19px}a{color:#215f96}video{width:100%;background:#151515;border-radius:5px}article,.intro{background:white;border:1px solid #ddd;border-radius:9px;padding:20px;margin-bottom:20px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}p{margin:8px 0}.tag{display:inline-block;background:#fff0cb;color:#754c00;padding:3px 10px;border-radius:5px}@media(max-width:760px){.grid{grid-template-columns:1fr}main{padding:16px}}</style><main><h1>三国遗憾 · 电影转场版 v2</h1><p class="tag">待review</p><section class="intro"><p>本页只用于审阅此次遗憾PV。夷陵独立成片保持不变。无对白、无BGM；原片保留，生成、自动检查、抽帧和用户通过分别记录。</p><video id="final" controls preload="metadata" src="三国遗憾-PV-v2-电影转场版.mp4"></video><p id="status">读取视频状态…</p><p><a href="导演与转场执行.md">导演与转场执行</a> · <a href="edit-timeline.json">实际剪辑表</a> · <a href="audio-provenance.json">声音来源</a> · <a href="交付与验证.md">交付与验证</a></p></section><div class="grid">'''+''.join(cards)+'''</div><script>const v=document.getElementById('final'),s=document.getElementById('status');v.addEventListener('loadedmetadata',()=>s.textContent=`合并版：${v.duration.toFixed(2)}秒 · ${v.videoWidth}×${v.videoHeight} · 待用户视听审核`);v.addEventListener('error',()=>s.textContent='合并版仍在制作，或浏览器不能直接读取本地文件。请使用目录内MP4。');</script></main></html>'''
page=page.replace('<p id="status">读取视频状态…</p>','<p><button id="play-final" type="button">从头播放合并版</button></p><p id="status">读取视频状态…</p>')
page=page.replace("v.addEventListener('loadedmetadata'","document.getElementById('play-final').addEventListener('click',()=>{v.currentTime=0;v.play();});v.addEventListener('loadedmetadata'")
(R/'审阅.html').write_text(page,'utf-8')
print('light review page written')
