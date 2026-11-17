from pathlib import Path
import json,hashlib
R=Path(__file__).resolve().parent;d=R/'F34';d.mkdir(exist_ok=True)
prompt='''8-second continuous live-action historical epic shot, landscape 16:9. Use reference image 1 as the exact composition and spatial layout: broad side view of an evacuation road, seven small soldiers and one wooden supply cart in the lower third, enormous burning encampment behind them.

LOCKED TRIPOD CAMERA. The mountain notch, left dead tree, right watchtower and road remain at exactly the same screen positions and exactly the same scale for all eight seconds. Absolutely no pan, no tracking, no dolly, no zoom, no rotation, no reframing, no approach toward people. A stationary camera observes the scene; it does not follow the people.

From 0 to 8 seconds, the existing soldiers and the one cart continuously walk briskly from screen RIGHT to screen LEFT along the road. The front man holds the cart shafts and pulls left, the man behind pushes the rear of the cart left; wheels rotate with actual ground contact. Leading soldiers leave the left edge first; the cart follows, and trailing soldiers follow it. All people remain the SAME SMALL SCALE as the reference, full bodies readable. Nobody runs toward camera or turns back toward the flames. Do not add people or horses. Clothing and secured cargo remain consistent. Fire in background stays vigorous, natural flame and smoke movement, dry dust stirred lightly by feet. No rain, no wet ground, no extinction, no dawn. Deep focus, clear foreground and midground, natural dusk colors, no CGI or miniature appearance.

Audio: ONLY nonverbal environmental sound: distant roaring fire, dry footsteps, wooden cart wheel creaking, clothing friction. NO speech whatsoever, no narration, no shouted words, no singing, NO music or musical instruments, NO soundtrack. No text or subtitles in the picture. Do not read these instructions aloud.'''
(d/'prompt.txt').write_text(prompt,'utf-8')
ref=R/'references/F33-撤出火营侧面远景.png'
plan=json.loads((R/'production-plan.json').read_text('utf-8'))
u=dict(id='F34',title='固定大远景撤离修订',duration=8,edit_duration=8,depends_on=None,reference_paths=[str(ref)],timeline_in=754/24,prompt_status='待review',video_status='待生成',authorization='本轮用户明确生成与整合授权内，已知成功但机位失控镜头的定向修订；不是未知任务重投',request_prompt_sha256=hashlib.sha256((d/'prompt.txt').read_bytes()).hexdigest(),reference_sha256=hashlib.sha256(ref.read_bytes()).hexdigest())
(d/'references.json').write_text(json.dumps([str(ref)],ensure_ascii=False),'utf-8')
(d/'视频生成Prompt.md').write_text('# F34 固定大远景撤离修订\n\nMiniMax-H3，768P，16:9，8秒。成片31.417—39.417秒。\n\n修订原因：F33成功生成但相机跟随并靠近人物，不符固定远景要求。F33不采用。\n\n参考图顺序1（空间、人物与构图）：'+ref.as_posix()+'\n\n唯一允许发声的原句：无。仅允许无词动作声，无BGM。\n\n## 实际提交Prompt\n\n'+prompt,'utf-8')
u['prompt_path']=str(d/'视频生成Prompt.md')
plan['units'].append(u);(R/'production-plan.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2),'utf-8')
(d/'state.json').write_text(json.dumps(dict(id='F34',status='prepared',version='v2.11',user_review='待review'),ensure_ascii=False),'utf-8')
review=json.loads((R/'F33/review.json').read_text('utf-8'));review.update(selected_for_work_edit=False,motion_review='2fps contact sheet: camera follows and approaches people; wide shot not maintained',user_review='待review');(R/'F33/review.json').write_text(json.dumps(review,ensure_ascii=False,indent=2),'utf-8')
print('F34 prepared, F33 excluded')
