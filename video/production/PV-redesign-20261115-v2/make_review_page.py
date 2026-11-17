from pathlib import Path
import json,html,subprocess,hashlib
from PIL import Image,ImageDraw,ImageFont
R=Path(__file__).resolve().parent
FF=r'D:/AI视频/VJ-1106/motion-runtime/node_modules/ffmpeg-static/ffmpeg.exe'
S=json.loads((R/'storyboard.json').read_text('utf-8'))['shots']
M=json.loads((R/'h3-remake-manifest.json').read_text('utf-8'))
e=html.escape;media='开篇PV-v2-92秒-分镜预演-背景声候选.mp4';raw='开篇PV-v2-92秒-分镜预演含18秒静态占位.mp4'
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',16)
board=Image.new('RGB',(1280,5*174),(248,247,243));draw=ImageDraw.Draw(board)
frames=R/'work/overview';frames.mkdir(exist_ok=True)
for j,s in enumerate(S):
 p=frames/(s['id']+'.jpg')
 subprocess.run([FF,'-v','error','-y','-ss',str((s['in']+s['out'])/2),'-i',str(R/media),'-frames:v','1','-vf','scale=256:144','-update','1',str(p)],capture_output=True,check=True)
 x=j%5*256;y=j//5*174;board.paste(Image.open(p),(x,y));draw.text((x+5,y+146),f"{s['id']} {s['in']:g}—{s['out']:g}秒"+(' · 静态' if s['kind']=='still' else ''),font=font,fill=(40,47,43))
board.save(R/'v2-全片分镜总览.jpg',quality=92)
timeline=''.join(f'<button class="shot {"still" if s["kind"]=="still" else ""}" data-time="{s["in"]}" data-out="{s["out"]}"><span class="stamp">{s["in"]:g}—{s["out"]:g}秒</span><strong>{e(s["title"])}</strong><small>{"新构图 · 静态占位" if s["kind"]=="still" else "现有动态参考" if s["kind"]=="video" else "后期"}</small></button>' for s in S)
requests=''.join(f'<a href="{e(str(Path(u["directory"]).relative_to(R)/(u["id"]+"-"+u["title"]+"-v2.md")).replace(chr(92),"/"))}">{u["id"]} {e(u["title"])}</a>' for u in M['units'])
cards=''
for name,title,body,t in [
 ('R01-山河火线-v2.png','开场：山河先于人','暗芦苇、江面、细长火线和远山分出四层。近岸人和船都小，先让观众看见人在什么处境里。',0),
 ('R02-人去马还行-v2.png','中箭：让空鞍交代结果','保留回望与一箭身亡。命中只用短促中断，不展示怪箭杆；落地后留空鞍、骨朵和空路。中箭动作仍待制作。',34),
 ('R03-马谡诸葛亮同场-v2.png','马谡与诸葛亮：先在同一个地方','马谡左下跪着看右上，诸葛亮在右上低台看左下。优先一条连续镜头完成相视、垂眼、举扇，避免独立反打失配。',59)]:
 cards+=f'<article class="key"><img src="references/{name}" alt="{e(title)}"><div><h3>{e(title)}</h3><p>{e(body)}</p><button class="jump" data-time="{t}">看这段预演</button></div></article>'
page=f'''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>逆转五丈原 · PV v2分镜审阅</title><style>
*{{box-sizing:border-box}}body{{margin:0;background:#f5f5f1;color:#252c28;font:16px/1.7 "Microsoft YaHei",sans-serif}}main{{max-width:1450px;margin:auto;padding:32px 28px 70px}}h1{{font-size:30px;line-height:1.4;margin:8px 0 16px}}h2{{font-size:23px;margin-top:36px}}h3{{font-size:19px;margin:0 0 8px}}p{{max-width:1040px;color:#58625c}}a{{color:#2b6357;text-underline-offset:3px}}button{{font:inherit;cursor:pointer}}.meta{{font-size:13px;color:#748078}}.note{{padding:16px 20px;background:#fff8e8;border-left:3px solid #b48a4b;color:#63543d}}.layout{{display:grid;grid-template-columns:minmax(0,1fr) 285px;gap:22px;align-items:start}}.player{{background:white;border:1px solid #dce2da;border-radius:9px;overflow:hidden}}video{{display:block;width:100%;aspect-ratio:16/9;background:#111}}.bar{{display:flex;gap:8px;flex-wrap:wrap;padding:12px 15px}}.bar button,.jump{{border:1px solid #c9d4cc;background:white;color:#325c50;border-radius:5px;padding:7px 12px;font-size:14px}}.bar button[aria-pressed="true"]{{background:#e6eee9;border-color:#74917f}}#current{{padding:0 16px 14px;color:#687268;font-size:14px}}.timeline{{max-height:660px;overflow:auto;border:1px solid #dce2da;border-radius:8px;background:white}}.shot{{display:block;text-align:left;border:0;border-bottom:1px solid #eef0eb;background:white;width:100%;padding:10px 14px;color:#293b31}}.shot.active{{background:#e8f0ea;box-shadow:inset 3px 0 #628570}}.shot.still small{{color:#a07735}}.stamp,small{{display:block;font-size:12px;color:#788177}}.shot strong{{font-size:14px;font-weight:500}}.docs{{display:flex;gap:14px 24px;flex-wrap:wrap;margin:18px 0}}.key{{background:white;border:1px solid #dce2da;border-radius:9px;overflow:hidden;margin:20px 0;display:grid;grid-template-columns:55% 45%}}.key img{{width:100%;display:block}}.key div{{padding:24px}}.key p{{font-size:15px}}details{{background:white;border:1px solid #dce2da;border-radius:7px;padding:14px 18px;margin:18px 0}}summary{{cursor:pointer}}.requests{{display:grid;grid-template-columns:1fr 1fr;gap:8px 20px;padding-top:14px;font-size:14px}}.overview{{width:100%;border-radius:7px}}.foot{{font-size:13px;color:#798178;margin-top:26px}}@media(max-width:900px){{.layout{{grid-template-columns:1fr}}.timeline{{max-height:340px;display:grid;grid-template-columns:1fr 1fr}}.key{{grid-template-columns:1fr}}}}@media(max-width:520px){{main{{padding:23px 14px 50px}}h1{{font-size:25px}}.key div{{padding:18px}}.requests{{grid-template-columns:1fr}}.timeline{{grid-template-columns:1fr}}}}
</style><main><div class="meta">2026年11月15日 · v2 · 待review</div><h1>想留住，却一次次从手里失去</h1><p>《逆转五丈原》开篇PV整体重设计。山河火线开场；中箭后留给空鞍；马谡与诸葛亮先共享一个场景。最后，一双手终于抓住了活着的人。</p>
<p class="note"><strong>这是92秒分镜预演，含18秒静态新构图。</strong>0—4、36—40、59—69秒尚未重生成动态，不能当作完成成片。当前主音轨为原生背景声分离候选，正确台词和终混尚未制作，可能损失呼吸等细节。本轮没有提交新的H3收费视频任务。</p>
<p class="note"><strong>v2.1声音要求：全片不要BGM，允许人物声音。</strong>保留正确对白、呼吸、喘息和环境／动作声；原生混入的配乐同样要排除。下方仍为旧v2分离候选预演，尚未完成这项声音制作。<a href="整体重做与声音要求-v2.1.md">查看整体重做要求</a></p><div class="docs"><a href="开篇PV-整体优化导演稿-v2.md">完整导演分镜与发声原句</a><a href="声音匹配与待修清单.md">声音匹配与待修</a><a href="参考PV吸收记录.md">两支参考PV的吸收记录</a></div>
<div class="layout"><section class="player"><video id="film" controls preload="metadata" poster="references/R01-山河火线-v2.png" src="{media}"></video><div class="bar"><button id="clean" aria-pressed="true">背景声分离候选</button><button id="raw" aria-pressed="false">原生混音对照（含异常人声）</button></div><div id="current">可点右侧时间，直接看对应段落。</div></section><aside class="timeline">{timeline}</aside></div>
<h2>三处重新建立的画面</h2>{cards}
<details><summary>九条待审H3重拍请求 · 合计60秒请求时长 · 未提交</summary><p>每条含真实参考图路径、起止动作、发声限制、可提交Prompt候选与检查要求。新版通过后按指定MiniMax-H3 SOP生成；不自动重投旧G09。</p><div class="requests">{requests}</div></details>
<details><summary>来源与当前验证程度</summary><p>现有动态来自PV-H3-20261115-v1采用版本，旧片与原始音轨保留。预演声音按新剪点从实际原片取样，静态分镜的声音仅作方向参考。已做技术解码、时间与路径检查；没有把机器ASR、抽帧或浏览器播放当作人工逐字听审或用户通过。</p><p><a href="原版108秒-恢复原生声音对照.mp4">打开原108秒恢复原生声音的对照视频（画面未优化）</a> · <a href="storyboard.json">剪辑来源记录</a> · <a href="background-separation.json">背景声分离记录</a></p></details>
<h2>全片结构总览</h2><a href="v2-全片分镜总览.jpg"><img class="overview" src="v2-全片分镜总览.jpg" alt="25个剪辑单元总览，静态占位另标"></a><p class="foot">本版不继承旧版通过结论。重生成、正确对白、终混及用户审片仍待完成。源素材和文档均原文件交付。</p></main>
<script>
const film=document.getElementById('film'),buttons=[...document.querySelectorAll('[data-time]')],shots=[...document.querySelectorAll('.shot')];
buttons.forEach(b=>b.addEventListener('click',()=>{{film.currentTime=+b.dataset.time;film.scrollIntoView({{behavior:'smooth',block:'center'}});}}));
film.addEventListener('timeupdate',()=>{{for(const b of shots)b.classList.toggle('active',film.currentTime>=+b.dataset.time&&film.currentTime<+b.dataset.out);const a=shots.find(b=>b.classList.contains('active'));document.getElementById('current').textContent=a?a.textContent.trim().replace(/\s+/g,' '):'';}});
async function select(clean){{const t=film.currentTime,playing=!film.paused;film.src=clean?{json.dumps(media,ensure_ascii=False)}:{json.dumps(raw,ensure_ascii=False)};document.getElementById('clean').setAttribute('aria-pressed',clean);document.getElementById('raw').setAttribute('aria-pressed',!clean);film.addEventListener('loadedmetadata',()=>{{film.currentTime=t;if(playing)film.play();}},{{once:true}});}}
document.getElementById('clean').onclick=()=>select(true);document.getElementById('raw').onclick=()=>select(false);
</script></html>'''
(R/'整体优化审阅.html').write_text(page,'utf-8')
print(str(R/'整体优化审阅.html'))
