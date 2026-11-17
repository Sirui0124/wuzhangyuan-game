from pathlib import Path
import json,subprocess,html,shutil
R=Path(__file__).resolve().parent;P=R.parent/'PV-H3-20261115-v2.5';T=json.loads((R/'edit-timeline.json').read_text('utf-8'))
FF=r'D:/AI视频/VJ-1106/motion-runtime/node_modules/ffmpeg-static/ffmpeg.exe';film='逆转五丈原-PV-v2.6-完整成片.mp4';thumb=R/'review-thumbs';thumb.mkdir(exist_ok=True)
cards=[]
for s in T['shots']:
 p=thumb/(s['id']+'.jpg')
 if s['id']!='V14':shutil.copy2(P/'review-thumbs'/p.name,p)
 else:subprocess.run([FF,'-v','error','-y','-ss',str(s['timeline_in']+.5),'-i',str(R/film),'-frames:v','1','-vf','scale=384:216',str(p)],check=True)
 tc=f'{int(s["timeline_in"])//60:02d}:{int(s["timeline_in"])%60:02d}'
 cards.append(f'<button class="shot" data-time="{s["timeline_in"]}"><img loading="lazy" src="review-thumbs/{p.name}" alt="{html.escape(s["title_name"])}"><span>{tc} · {html.escape(s["title_name"])}</span></button>')
old=(P/'成片审阅-v2.5.html').read_text('utf-8');style=old.split('<style>')[1].split('</style>')[0];script=old.split('<script>')[1].split('</script>')[0]
page=f'''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>逆转五丈原 · PV v2.6</title><style>{style}</style><main><h1>逆转五丈原 · PV v2.6</h1><p class="meta">完整成片 · {T['duration']:.3f}秒 · 无BGM，保留人物与环境声音 · 待观看审核</p><video controls preload="metadata" playsinline src="{film}"></video><div class="links"><a href="{film}">打开完整MP4</a><a href="马谡与诸葛亮-站位修订片.mp4">只看马谡与诸葛亮</a><a href="交付说明-v2.6.md">制作与检查记录</a><a href="修订记录-v2.6.md">本轮修订记录</a></div><p>恢复原图中左侧刀斧手与中央马谡的构图。马谡看向右上方，接诸葛亮左下看的反打；本次修改位于45—48秒；只取自然上望，后续镜头前移1.5秒。</p><h2>点击镜头定位</h2><div class="grid">{''.join(cards)}</div><details><summary>检查范围</summary><p>技术解码、接点抽帧、对白自动定位、音乐筛查与浏览器播放分别记录。本版仍待观看审核；机器筛查与抽帧不等同于人工逐句听审，也不代表用户已通过。</p></details></main><script>{script}</script></html>'''
(R/'成片审阅-v2.6.html').write_text(page,'utf-8')
(R/'交付说明-v2.6.md').write_text('''# PV v2.6 交付说明

2026-11-15。完整成片70.292秒，1280×720、24fps、AAC48kHz立体声。本轮仅重做马谡段，直接以原有含刀斧手的E07图经指定H3流程生成，没有另画替代图。M04图及视频停用。

马谡看向画面右上方的诸葛亮；诸葛亮在前方偏右的稍高监斩台案后，反打看向画面左下。刀斧手始终在马谡左侧、画面左前方，保持低位刑刀。声音继续无对白、无BGM，保留呼吸、衣料与营地环境音。成片中其他已保留片段的原对白保持。

[修订记录](修订记录-v2.6.md)记载素材、空间关系及检查边界。完整解码和声画时长见final-technical.json；播放检查见browser-verification.json；复用片段hash见final-review.json。以上不等同用户通过。本版待review。
''','utf-8')
print('Review page ready')
