from pathlib import Path
import json,subprocess,html
from PIL import Image,ImageDraw
R=Path(__file__).resolve().parent;P=R.parent/'PV-H3-20261115-v2.6';T=json.loads((R/'edit-timeline.json').read_text('utf-8'))
FF=r'D:/AI视频/VJ-1106/motion-runtime/node_modules/ffmpeg-static/ffmpeg.exe';film='夷陵大火-PV-v2.7-精简版.mp4';thumb=R/'review-thumbs';thumb.mkdir(exist_ok=True)
def frame(t,p,w=384,h=216):subprocess.run([FF,'-v','error','-y','-ss',str(t),'-i',str(R/film),'-frames:v','1','-vf',f'scale={w}:{h}',str(p)],check=True)
cards=[]
for s in T['shots']:
 p=thumb/(s['id']+'.jpg');frame(s['timeline_in']+.5,p)
 cards.append(f'<button class="shot" data-time="{s["timeline_in"]}"><img src="review-thumbs/{p.name}" alt="{html.escape(s["title_name"])}"><span>{s["timeline_in"]:.2f}秒 · {html.escape(s["title_name"])}</span></button>')
old=(P/'成片审阅-v2.6.html').read_text('utf-8');style=old.split('<style>')[1].split('</style>')[0];script=old.split('<script>')[1].split('</script>')[0]
page=f'''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>夷陵大火 · PV v2.7</title><style>{style}</style><main><h1>夷陵大火 · PV v2.7</h1><p class="meta">精简版 · {T['duration']:.2f}秒 · 无BGM，保留人物与环境声音 · 待观看审核</p><video controls preload="metadata" playsinline src="{film}"></video><div class="links"><a href="{film}">打开完整MP4</a><a href="修订记录-v2.7.md">本轮修订记录</a></div><p>前段托印与连营保留；20.25秒接原版31秒附近的火场，21.75秒转灾后湿灰、黑炭与余烟，淡出结束。告急奔跑、残旗和后半段先移出。</p><h2>点击镜头定位</h2><div class="grid">{''.join(cards)}</div><details><summary>检查范围</summary><p>完整解码、接点抽帧、声音自动筛查和浏览器静音播放分别记录；不代替人工逐句听审或用户审核。</p></details></main><script>{script}</script></html>'''
(R/'成片审阅-v2.7.html').write_text(page,'utf-8')
stamps=[19.9,20.3,20.75,21.5,21.8,22.25,22.75,23.25];out=Image.new('RGB',(1280,408),(245,245,242));draw=ImageDraw.Draw(out)
for i,t in enumerate(stamps):
 p=thumb/f'seam-{i}.jpg';frame(t,p,320,180);x=i%4*320;y=i//4*204;out.paste(Image.open(p),(x,y));draw.text((x+6,y+184),f'{t:.2f}s',fill='black')
out.save(R/'fire-to-aftermath-contact.jpg')
print('Review page and seam contact ready')
