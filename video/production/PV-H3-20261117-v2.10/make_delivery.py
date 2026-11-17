from pathlib import Path
import json,subprocess
from PIL import Image,ImageDraw
R=Path(__file__).resolve().parent;T=json.loads((R/'edit-timeline.json').read_text('utf-8'));F='夷陵大火-PV-v2.10-火营与归途.mp4'
FF=r'D:/AI视频/VJ-1106/motion-runtime/node_modules/ffmpeg-static/ffmpeg.exe';D=R/'review-thumbs';D.mkdir(exist_ok=True)
def frame(t,p,w=384,h=216):subprocess.run([FF,'-v','error','-y','-ss',str(t),'-i',str(R/F),'-frames:v','1','-vf',f'scale={w}:{h}',str(p)],check=True)
cards=[]
for s in T['shots']:
 p=D/(s['id']+'.jpg');frame(s['timeline_in']+min(.3,s['duration']/2),p);cards.append(f'<button class="shot" data-time="{s["timeline_in"]}"><img src="review-thumbs/{p.name}" alt="{s["title_name"]}"><span>{s["timeline_in"]:.2f}秒 · {s["title_name"]}</span></button>')
page=f'''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>夷陵大火 · v2.10</title><style>
*{{box-sizing:border-box}}body{{margin:0;background:#f5f5f2;color:#242826;font:16px/1.65 system-ui,sans-serif}}main{{max-width:1100px;margin:36px auto;padding:0 24px 48px}}h1{{font-size:28px;margin-bottom:4px}}.meta{{color:#666}}video{{display:block;width:100%;background:#111;border-radius:8px}}.links{{display:flex;gap:20px;flex-wrap:wrap;margin:18px 0}}a{{color:#235b8c}}.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}}button{{padding:0;overflow:hidden;background:white;border:1px solid #ddd;border-radius:7px;text-align:left;cursor:pointer;color:inherit;font:inherit}}button img{{width:100%;display:block}}button span{{display:block;padding:10px;font-size:14px}}details{{margin-top:24px;color:#666}}@media(max-width:500px){{main{{padding:0 14px;margin:20px auto}}h1{{font-size:24px}}}}
</style><main><h1>夷陵大火 · v2.10</h1><p class="meta">39.42秒 · 无BGM · 人物与环境音 · 待观看审核</p><video controls playsinline preload="metadata" src="{F}"></video><div class="links"><a href="{F}">打开完整成片</a><a href="修订记录-v2.10.md">修订记录</a></div><p>奔马与蹄声同步加速；庞统恢复自然色彩。火营淡黑后进入雨后空营，删除湿炭插镜，以连续大全景收尾。</p><h2>点击镜头定位</h2><div class="grid">{''.join(cards)}</div><details><summary>检查范围</summary><p>完整解码、关键动作与转场抽帧、声音自动筛查、浏览器静音播放检查分别记录；不代替用户实看实听与审核。</p></details></main><script>const v=document.querySelector('video');document.querySelectorAll('.shot').forEach(b=>b.onclick=()=>{{v.pause();v.currentTime=Number(b.dataset.time);v.scrollIntoView({{behavior:'smooth',block:'center'}})}});</script></html>'''
(R/'成片审阅-v2.10.html').write_text(page,'utf-8')
for name,stamps in [('horse-memory',[5,6.5,8,9.5,10.5,13.5,15.75,16.75]),('camp-seams',[17.5,20.8,21.8,23.2,25.8,27.875,27.958,29,32,34.5,36.6,38.2])]:
 out=Image.new('RGB',(1280,204*((len(stamps)+3)//4)),(245,245,242));draw=ImageDraw.Draw(out)
 for i,t in enumerate(stamps):
  p=D/f'{name}-{i}.jpg';frame(t,p,320,180);x=i%4*320;y=i//4*204;out.paste(Image.open(p),(x,y));draw.text((x+5,y+183),f'{t:.3f}s',fill='black')
 out.save(R/f'{name}-contact.jpg')
print('Review page and contact sheets ready')
