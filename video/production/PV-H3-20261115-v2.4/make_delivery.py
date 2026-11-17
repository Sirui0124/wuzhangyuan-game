from pathlib import Path
import json,subprocess,html,shutil
R=Path(__file__).resolve().parent;P=R.parent/'PV-H3-20261115-v2.3';T=json.loads((R/'edit-timeline.json').read_text('utf-8'))
FF=r'D:/AI视频/VJ-1106/motion-runtime/node_modules/ffmpeg-static/ffmpeg.exe';film='逆转五丈原-PV-v2.4-完整成片.mp4';thumb=R/'review-thumbs';thumb.mkdir(exist_ok=True)
cards=[]
for s in T['shots']:
 p=thumb/(s['id']+'.jpg')
 if s['id']!='V02':shutil.copy2(P/'review-thumbs'/p.name,p)
 else:subprocess.run([FF,'-v','error','-y','-ss','14.5','-i',str(R/film),'-frames:v','1','-vf','scale=384:216',str(p)],check=True)
 tc=f'{int(s["timeline_in"])//60:02d}:{int(s["timeline_in"])%60:02d}'
 cards.append(f'<button class="shot" data-time="{s["timeline_in"]}"><img loading="lazy" src="review-thumbs/{p.name}" alt="{html.escape(s["title_name"])}"><span>{tc} · {html.escape(s["title_name"])}</span></button>')
old=(P/'成片审阅-v2.3.html').read_text('utf-8');page=old.split('<div class="grid">')[0]+'<div class="grid">'+''.join(cards)+'</div><details>'+old.split('</div><details>',1)[1]
page=page.replace('v2.3','v2.4').replace('本轮修订：雨水浸过余炭；马谡补回呼吸与衣料声；诸葛亮采用连续举扇动作；救人收束后，呼吸延续至片名渐显。','本轮修订：在“持此，速救主公”期间完成交印；“若已无力挽回”切回马上奔赴，随后接救援实景。庞统声音连续，无BGM。')
page=page.replace('<div class="links">','<div class="links"><a href="庞统交印与救援-修订检查片.mp4">单看本次修订段</a>')
(R/'成片审阅-v2.4.html').write_text(page,'utf-8')
doc='# PV v2.4 交付说明\n\n2026-11-15。完整成片88.875秒，1280×720、24fps、AAC48kHz立体声。无BGM。本轮采用已有H3素材重新剪辑，无新增API生成请求。\n\n交印前移至12.25秒开始，交印完成落在“持此，速救主公”期间；15.458秒回到马上，17.417秒接伸手救援，以庞统后半句为连续画外叮嘱。后续段落时间点保持一致。\n\n具体来源、速度、声音处理与检查边界见[修订记录](修订记录-v2.4.md)。新成片与旧版分别保存，本版待用户review。最终解码与帧数见final-technical.json，播放核验见browser-verification.json，未改动素材的hash核验见final-review.json。ASR、音乐筛查与抽帧不代替人工逐句听审或用户通过。\n'
(R/'交付说明-v2.4.md').write_text(doc,'utf-8')
print('Review page ready')
