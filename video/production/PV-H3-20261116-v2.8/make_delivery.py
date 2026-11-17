from pathlib import Path
import json,subprocess
from PIL import Image,ImageDraw
R=Path(__file__).resolve().parent;P=R.parent/'PV-H3-20261116-v2.7';T=json.loads((R/'edit-timeline.json').read_text('utf-8'));F='夷陵大火-PV-v2.8-回忆与火场.mp4'
FF=r'D:/AI视频/VJ-1106/motion-runtime/node_modules/ffmpeg-static/ffmpeg.exe';D=R/'review-thumbs';D.mkdir(exist_ok=True)
def frame(t,p,w=384,h=216):subprocess.run([FF,'-v','error','-y','-ss',str(t),'-i',str(R/F),'-frames:v','1','-vf',f'scale={w}:{h}',str(p)],check=True)
cards=[]
for s in T['shots']:
 p=D/(s['id']+'.jpg');frame(s['timeline_in']+.5,p);cards.append(f'<button class="shot" data-time="{s["timeline_in"]}"><img src="review-thumbs/{p.name}" alt="{s["title_name"]}"><span>{s["timeline_in"]:.2f}秒 · {s["title_name"]}</span></button>')
old=(P/'成片审阅-v2.7.html').read_text('utf-8');css=old.split('<style>')[1].split('</style>')[0];js=old.split('<script>')[1].split('</script>')[0]
page=f'''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>夷陵大火 · PV v2.8</title><style>{css}</style><main><h1>夷陵大火 · PV v2.8</h1><p class="meta">{T['duration']:.2f}秒 · 回忆与火场 · 无BGM，保留人物与环境声音 · 待观看审核</p><video controls preload="metadata" playsinline src="{F}"></video><div class="links"><a href="{F}">打开完整MP4</a><a href="修订记录-v2.8.md">修订与声音记录</a></div><p>庞统托付处理为回忆，交印后回到马背；17.4秒大火进入，随后展开燃烧连营、雨中废墟与同一营道的灾后空景。</p><h2>点击镜头定位</h2><div class="grid">{''.join(cards)}</div><details><summary>检查范围</summary><p>已分别记录解码、接缝抽帧、声音自动筛查及浏览器静音播放；不等同人工逐句听审或用户通过。</p></details></main><script>{js}</script></html>'''
(R/'成片审阅-v2.8.html').write_text(page,'utf-8')
for name,stamps in [('memory',[9.7,10.2,11.5,12.5,14.3,15.2,15.7,16.7]),('fire',[17.5,19,20.6,23.8,25.7,29.4,32,37.5])]:
 out=Image.new('RGB',(1280,408),(245,245,242));draw=ImageDraw.Draw(out)
 for i,t in enumerate(stamps):
  p=D/f'{name}-{i}.jpg';frame(t,p,320,180);x=i%4*320;y=i//4*204;out.paste(Image.open(p),(x,y));draw.text((x+5,y+183),f'{t:.2f}s',fill='black')
 out.save(R/f'{name}-contact.jpg')
print('Review page and contact sheets ready')
