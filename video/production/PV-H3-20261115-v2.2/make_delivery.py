from pathlib import Path
import json,html,subprocess
R=Path(__file__).resolve().parent
FF=r'D:/AI视频/VJ-1106/motion-runtime/node_modules/ffmpeg-static/ffmpeg.exe'
T=json.loads((R/'edit-timeline.json').read_text('utf-8'));shots=T['shots'];film='逆转五丈原-PV-v2.2-完整成片.mp4'
def tc(t):return f'{int(t)//60:02d}:{int(t)%60:02d}'
thumbs=R/'review-thumbs';thumbs.mkdir(exist_ok=True);cards=[]
for s in shots:
 p=thumbs/(s['id']+'.jpg')
 subprocess.run([FF,'-v','error','-y','-ss',str(s['timeline_in']+s['duration']*.5),'-i',str(R/film),'-frames:v','1','-vf','scale=384:216',str(p)],check=True)
 cards.append(f'<button class="shot" data-time="{s["timeline_in"]}"><img loading="lazy" src="review-thumbs/{s["id"]}.jpg" alt="{html.escape(s["title_name"])}"><span>{tc(s["timeline_in"])} · {html.escape(s["title_name"])}</span></button>')
page='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>逆转五丈原 · PV v2.2</title><style>*{box-sizing:border-box}body{margin:0;background:#f7f7f4;color:#242824;font:16px/1.65 "Microsoft YaHei",sans-serif}main{max-width:1120px;padding:30px 24px 70px;margin:auto}h1{font-size:29px;margin:0 0 6px}p{margin:8px 0 18px}.meta{color:#626a62;font-size:14px}video{display:block;width:100%;background:#101010;border-radius:8px;max-height:72vh}.links{display:flex;gap:18px;flex-wrap:wrap;margin:15px 0 26px}a{color:#345c49}h2{font-size:19px;margin-top:30px}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.shot{padding:0;background:white;border:1px solid #dbe0d8;border-radius:7px;overflow:hidden;text-align:left;cursor:pointer;color:inherit;font:inherit}.shot img{width:100%;display:block;aspect-ratio:16/9}.shot span{display:block;padding:8px;font-size:13px}.shot:hover{border-color:#567d64}details{margin:22px 0}summary{cursor:pointer}@media(max-width:600px){main{padding:20px 14px}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}h1{font-size:24px}}</style><main><h1>逆转五丈原 · PV v2.2</h1><p class="meta">完整成片 · DURATION秒 · 无BGM，人物与环境声音 · 待观看审核</p><video controls preload="metadata" playsinline src="FILM"></video><div class="links"><a href="FILM">打开完整MP4</a><a href="交付说明-v2.2.md">制作与检查记录</a><a href="修订导演稿-v2.2.md">修订导演稿</a></div><p>庞统整段提速；败营从火烧连营开始；谷火在雨中熄灭；马谡与诸葛亮恢复短镜头衔接；结尾重新拍摄伸手、抓牢和受力。</p><h2>点击镜头定位</h2><div class="grid">CARDS</div><details><summary>检查范围</summary><p>已完成技术解码、抽帧检查、对白自动定位及音乐筛查。上述检查不等同于人工逐句听审，也不代表用户已通过本版。</p></details></main><script>const video=document.querySelector('video');document.querySelectorAll('.shot').forEach(b=>b.addEventListener('click',()=>{video.currentTime=Number(b.dataset.time);video.scrollIntoView({behavior:'smooth',block:'center'});}));</script></html>'''.replace('DURATION',str(T['duration'])).replace('FILM',film).replace('CARDS',''.join(cards))
(R/'成片审阅-v2.2.html').write_text(page,'utf-8')
rows=['| 时间 | 内容 | 视频来源 |','| --- | --- | --- |']
for s in shots:
 src=Path(s['source']).parent.name if s.get('source') else '后期暗场/片名'
 rows.append(f'| {tc(s["timeline_in"])}—{tc(s["timeline_out"])} | {s["title_name"]} | {src} |')
doc=f'''# 《逆转五丈原》PV v2.2 交付记录

2026-11-15。完整成片 {T['duration']} 秒，1280×720，24fps，{round(T['duration']*24)}帧，AAC 48kHz立体声。状态：待用户review。旧版保留；本次制作检查不代表用户已通过。

## 本版修改

- 庞统从马背到托付结尾整体约1.301倍，声音同步提速并保持音高；完整保留三段对白。
- 败营段撤掉旧版整齐部队、并排站桩和伤兵排列，改成火烧连营→两将穿行告急→横梁塌落断路→傅肜拒降。先交代烧营，再跟随人物。
- 大雨段以短大全景交代谷地雨势，随即切到最后火苗被雨浇灭的近景，湿木与水汽之后才接诸葛亮反应。R01未采用；R03未实现全谷火灭，仅采用开头1.5秒建立雨景，未把其后持续燃烧的画面剪回灭火之后。R02从0.5秒最大火苗处正放到熄灭，未倒放雨或火。
- 马谡段恢复旧版跪地中景、望向诸葛亮的近景、新拍诸葛亮单人近景、旧版举扇动作。视线为右上对左下，撤掉12秒双人静止长镜与遮挡军官。
- 救人段撤掉旧H18/H18B的全部画面。新拍伸手、抓牢，再接受力近景；K02后半人物外观漂移，不采用这部分。结尾落在握紧与拉起的动作，不声称已展示完整站立。

## 制作与声音

新增画面按用户指定 `D:/AI视频/VJ-1106/api-tools/docs/MiniMax-H3-API视频生成SOP-20261114-v1.md` 使用MiniMax-H3 / 768P生成，逐镜预览、单次POST、保存ID并查询同一任务。源片通常1344×768，成片裁为16:9的1280×720。使用screenwriting-master检查动作与镜头关系；没有用静态分镜充当动态剧情。

没有添加BGM。保留庞统、冯习、傅肜、镜外敌人和“拉住我”的人物声音；火、木梁落地、马蹄、雨、衣料与呼吸按场景匹配。M02原声含疑似音乐，保留人声残差并重建轻风；B03隔离瞬态木裂声后接火场声。马谡旧素材不使用其不可靠原声，采用非旋律营地风与衣料声。自动声音标签仅用于筛查，不作为听审结论。

雨声复用上一版已保存的公有领域素材：[Rain.ogg](https://commons.wikimedia.org/wiki/File:Rain.ogg)，作者ジダネ，PD-self。雨段按连续时间取声。其他声音来自H3原片与本地无旋律风声拟音。

## 请求记录与状态

K01（HTTP502）与K01R（HTTP520）都未拿到任务ID，保留原始未知记录。用户分别授权重提一次；第二次重提K01RR已成功下载，后续没有再次提交这两笔未知请求。M01未取得ID且未重提，最终恢复旧版马谡素材。K03是针对K02外观漂移的独立构图修正。完整列表见task-registry.json；未知请求是否产生费用无法从现有接口核实。

## 检查边界

- final-technical.json：最终帧数、音画时长、编码与全片解码。
- sound-levels.json：逐段RMS/峰值；人物对白和环境声分段调整，保留动态。
- 原片contact/dense及成片full-contact：检查场面、动作阶段、轴线与衔接，不能替代连续人工视听审阅。
- 整片.asr.json与.events.json：自动对白定位、音乐风险筛查；不冒充逐字听审或精确口型认证。
- browser-verification.json：网页定位、完整1倍速静音技术播放、移动布局与链接核验，以实际文件结果为准。
- 本版仍待用户实际观看；未给出“用户已通过”结论。

## 最终剪辑表

'''+ '\n'.join(rows)+'\n'
(R/'交付说明-v2.2.md').write_text(doc,'utf-8')
print('Review page and delivery record prepared.')
