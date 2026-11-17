from pathlib import Path
import json,subprocess,html
R=Path(__file__).resolve().parent;P=R.parent/'PV-H3-20261115-v2.4';T=json.loads((R/'edit-timeline.json').read_text('utf-8'))
FF=r'D:/AI视频/VJ-1106/motion-runtime/node_modules/ffmpeg-static/ffmpeg.exe';film='逆转五丈原-PV-v2.5-完整成片.mp4';thumb=R/'review-thumbs';thumb.mkdir(exist_ok=True)
cards=[]
for s in T['shots']:
 p=thumb/(s['id']+'.jpg');stamp=s['timeline_in']+min(.5,s['duration']/2)
 if s['id']=='V02':stamp=18.5
 subprocess.run([FF,'-v','error','-y','-ss',str(stamp),'-i',str(R/film),'-frames:v','1','-vf','scale=384:216',str(p)],check=True)
 tc=f'{int(s["timeline_in"])//60:02d}:{int(s["timeline_in"])%60:02d}'
 cards.append(f'<button class="shot" data-time="{s["timeline_in"]}"><img loading="lazy" src="review-thumbs/{p.name}" alt="{html.escape(s["title_name"])}"><span>{tc} · {html.escape(s["title_name"])}</span></button>')
old=(P/'成片审阅-v2.4.html').read_text('utf-8');style=old.split('<style>')[1].split('</style>')[0];script=old.split('<script>')[1].split('</script>')[0]
page=f'''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>逆转五丈原 · PV v2.5</title><style>{style}</style><main><h1>逆转五丈原 · PV v2.5</h1><p class="meta">完整成片 · {T['duration']:.3f}秒 · 无BGM，保留人物与环境声音 · 待观看审核</p><video controls preload="metadata" playsinline src="{film}"></video><div class="links"><a href="{film}">打开完整MP4</a><a href="交付说明-v2.5.md">制作与检查记录</a><a href="修订记录-v2.5.md">本轮修订记录</a></div><p>庞统最后一句落在燃烧的大营；移出原版30—44秒附近的整组镜头；重新生成雨中诸葛亮与马谡，重接雨声、呼吸和衣料声。删减后时间码已前移。</p><h2>点击镜头定位</h2><div class="grid">{''.join(cards)}</div><details><summary>检查范围</summary><p>技术解码、抽帧、对白自动定位、音乐筛查与浏览器播放检查分别记录。本版仍待观看审核；机器筛查与抽帧不等同于人工逐句听审，也不代表用户已通过。</p></details></main><script>{script}</script></html>'''
(R/'成片审阅-v2.5.html').write_text(page,'utf-8')
doc=f'''# PV v2.5 交付说明

2026-11-15。完整成片 {T['duration']:.3f} 秒，1280×720、24fps、AAC 48kHz 立体声。保留对白、呼吸和现场环境音，不添加BGM。本版待用户 review。

- “持此，速救主公”期间完成交印，之后保留马上镜头。“也当尽力保全我军儿郎”改为燃烧的大营，并继续同一镜头至告急段。
- 原 v2.4 的30.25—45.50秒（倒梁、劝降、傅肜拒降、孤骑与空鞍）从当前剪辑移出，原片及素材保留。
- 按用户明确指认，重新制作雨中持扇诸葛亮，连到湿炭、泥地与雨声；帐内图与灯段保留。
- 马谡改用新的连续跪地表演：抬眼、闭眼、垂首；撤掉旧全景与特写的跳接，保留新镜头呼吸、衣料和营地环境声，不加对白。

来源及选段见 [修订记录](修订记录-v2.5.md)。完整解码和帧数见 final-technical.json，播放检查见 browser-verification.json，复用片段核验见 final-review.json。ASR、音乐事件筛查和抽帧是辅助自查，不代替人工逐句听审或用户通过。
'''
(R/'交付说明-v2.5.md').write_text(doc,'utf-8');print('Review page ready')
