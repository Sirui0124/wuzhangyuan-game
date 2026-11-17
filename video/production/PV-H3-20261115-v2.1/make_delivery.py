from pathlib import Path
import json,html,subprocess
R=Path(__file__).resolve().parent;FF=r'D:/AI视频/VJ-1106/motion-runtime/node_modules/ffmpeg-static/ffmpeg.exe'
timeline=json.loads((R/'edit-timeline.json').read_text('utf-8'));shots=timeline['shots'];film='逆转五丈原-PV-v2.1-完整成片.mp4'
def tc(t):return f'{int(t)//60:02d}:{int(t)%60:02d}'
thumbs=R/'review-thumbs';thumbs.mkdir(exist_ok=True)
cards=[]
for s in shots:
 p=thumbs/(s['id']+'.jpg')
 subprocess.run([FF,'-v','error','-y','-ss',str(s['timeline_in']+s['duration']*.5),'-i',str(R/film),'-frames:v','1','-vf','scale=384:216',str(p)],check=True)
 cards.append(f'<button class="shot" data-time="{s["timeline_in"]}"><img loading="lazy" src="review-thumbs/{s["id"]}.jpg" alt="{html.escape(s["title_name"])}"><span>{tc(s["timeline_in"])} · {html.escape(s["title_name"])}</span></button>')
page='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>逆转五丈原 · PV v2.1</title><style>*{box-sizing:border-box}body{margin:0;background:#f7f7f4;color:#242824;font:16px/1.65 "Microsoft YaHei",sans-serif}main{max-width:1120px;padding:30px 24px 70px;margin:auto}h1{font-size:29px;margin:0 0 6px}p{margin:8px 0 18px}.meta{color:#626a62;font-size:14px}video{display:block;width:100%;background:#101010;border-radius:8px;max-height:72vh}.links{display:flex;gap:18px;flex-wrap:wrap;margin:15px 0 26px}a{color:#345c49}h2{font-size:19px;margin-top:30px}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.shot{padding:0;background:white;border:1px solid #dbe0d8;border-radius:7px;overflow:hidden;text-align:left;cursor:pointer;color:inherit;font:inherit}.shot img{width:100%;display:block;aspect-ratio:16/9}.shot span{display:block;padding:8px;font-size:13px}.shot:hover{border-color:#567d64}.note{padding:15px 19px;background:white;border:1px solid #dbe0d8;border-radius:8px}details{margin:22px 0}summary{cursor:pointer}li{margin:5px 0}@media(max-width:650px){main{padding:20px 14px}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}h1{font-size:24px}} </style><main><h1>逆转五丈原</h1><p class="meta">开篇 PV · v2.1 · 1 分 43 秒 · 1280 × 720 / 24 fps · 待观看审核</p><video id="film" controls preload="metadata" playsinline poster="review-thumbs/V01.jpg" src="'''+film+'''"></video><div class="links"><a href="'''+film+'''" download>打开 / 保存完整成片</a><a href="交付说明-v2.1.md">制作与检查记录</a><a href="全片画面索引.jpg">全片画面索引</a></div><p class="note">无 BGM。保留庞统托付、告急、傅肜拒降和“拉住我”等人物声音，以及呼吸、马蹄、火、雨与衣料声。点击下方画面可以定位到对应段落。</p><div class="grid">'''+''.join(cards)+'''</div><details><summary>本版主要修改</summary><ul><li>江岸火线开场，以近岸人物、芦苇与远岸火线建立纵深。</li><li>中箭采用画外单次箭声与空鞍结果，去掉怪箭、血雾与拼接坠马。</li><li>马谡、诸葛亮保持同场与同侧视线，完整呈现垂眼和举扇。</li><li>救人以第一视角前臂、双手握紧和起身连续完成，呼气延续至片名。</li><li>已发现的原生配乐和无关念白单独处理；原始素材与请求记录均保留。</li></ul><p class="meta">本页提供成片审核。抽帧、解码、自动转写与音乐筛查均不能代替人工逐句听审或用户通过。</p></details></main><script>const video=document.querySelector('video');document.querySelectorAll('.shot').forEach(b=>b.addEventListener('click',()=>{video.currentTime=Number(b.dataset.time);video.scrollIntoView({behavior:'smooth',block:'center'});}));</script></html>'''
(R/'成片审阅-v2.1.html').write_text(page,'utf-8')
rows=['| 时间 | 内容 | 采用素材 / 声音处理 |','| --- | --- | --- |']
for s in shots:
 audio=Path(s['audio_source']).name if s.get('audio_source') else '原生声音'
 rows.append(f'| {tc(s["timeline_in"])}—{tc(s["timeline_out"])} | {s["title_name"]} | {s.get("unit","后期片名/暗场")}；{audio}；{s.get("note","")} |')
doc='''# 《逆转五丈原》开篇 PV v2.1 交付记录

制作日期：2026-11-15。用户已明确授权按 v2.1 整体重做并用指定 H3 流程生成。成片尚待用户观看审核；旧版与旧审核状态均保留，不沿用为本版通过。

成片：`逆转五丈原-PV-v2.1-完整成片.mp4`，103.166667 秒，1280×720，24fps，2476 帧，AAC 48kHz 立体声。实拍剧情画面均为本轮 H3 动态视频，片名与半秒暗场为后期制作，无静态分镜占位。

## 制作依据与版本

- 指定流程：`D:/AI视频/VJ-1106/api-tools/docs/MiniMax-H3-API视频生成SOP-20261114-v1.md`。实际调用 MiniMax-H3 / 768P；原片多为1344×768，成片按16:9统一裁切为1280×720，并非2K或8K。
- 依据用户已批准的 v2.1 和此前导演稿，使用 screenwriting-master 的动作、场景关系与节奏检查。用户本轮“直接生成完整成片”覆盖筹备稿中旧的待审暂停状态。
- 共22条已取得ID的独立请求，其中4条为具体问题补拍。没有重投旧版无ID状态不明的G09。实际请求、ID、原片、参考图校验和原版均保留。
- H03B替代重复告急对白；H16B替代五丈原错误念白的脸部表演；H18B替代露出施救者身体的错误视角。H05B仅取干净回望，后续异常箭和血雾均未采用。

## 声音

没有添加任何BGM。音乐筛查对H07、H08、H09和弃用的H18原声报出较高音乐分数，因此这些音乐声床没有直接用于成片。H07/H08使用同一段连续雨声；H09保留无对白时段的人声残差并重建轻风和衣料声。H18B采用其原生对白与呼吸。

保留的唯一对白原句与人物：

- 庞统画外叮嘱：“你若见天际赤红，便须星夜速往救援。”
- 庞统：“此乃我的私印，请你持此，速救主公。”
- 庞统交印：“若已无力挽回败局，也当尽力保全我军儿郎。”
- 冯习告急：“御营败了，速去救驾！”
- 敌方劝降：“降了，免死！”
- 傅肜：“吴狗！何有汉将军降者！”
- 我：“拉住我。”

上述为批准的原句映射，不是冒充人工逐字转录。自动识别存在“持/迟”“儿郎/而朗”等同音误识；未将机器文字烧入字幕。无关念白、重复警告单独去除；按场景调整声音增益，保留呼吸、动作与环境的动态。最终听感和字词发音仍需用户实际观看确认。

雨声来源：[Rain.ogg — Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Rain.ogg)，作者ジダネ，公有领域（PD-self）。进行了重采样、增益与片段选取。详细来源见`sound/provenance.json`。其他声音来自本轮H3原片与非旋律轻风拟音。

## 已做检查与边界

- 全部下载原片完成完整解码检查；逐镜2fps抽帧与问题处更密集抽帧检查，另核对最终全片画面索引。
- 最终2476帧、画音时长、编码及完整解码核验，见`final-technical.json`。
- 使用本地faster-whisper-small逐镜和整片转写定位；使用AST AudioSet模型筛查音乐并对修复声轨复查。机器检查不等同于完整人工视听审阅，也不能证明所有发音、口型和微小动作都无误。
- 网页播放、定位、完整1倍速技术播放与移动布局结果见`browser-verification.json`（以实际文件记录为准）。
- 本版状态：完整成片，待用户review。未标为用户已通过。

## 最终剪辑表

'''+ '\n'.join(rows)+'\n'
(R/'交付说明-v2.1.md').write_text(doc,'utf-8')
print('Delivery page, thumbnails and documented edit created.')
