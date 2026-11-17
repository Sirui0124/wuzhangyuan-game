from pathlib import Path
import json,hashlib
R=Path(__file__).resolve().parent;d=R/'L04R';d.mkdir(exist_ok=True)
p='''15-second live-action historical film scene, same exact Liu Bei as reference. Medium close shot, natural face and old dark armor, fixed camera, warm oil lamp camera-right and cool predawn outside left. He is exhausted and quietly grieving, but composed. No smile, no sobbing, no big gestures. Start with a short exhale, turn head toward guard on camera-right for the first sentence, then face the viewer for second sentence, a short pause, then say the last sentence softly. His hand then moves toward the map on the table. Only Liu Bei speaks. Low slightly hoarse elderly male Mandarin voice, calm natural conversational delivery and precise synchronized lips. Guard remains silent. No narrator. No additional speech. NO SUBTITLES, NO CAPTIONS, NO ON-SCREEN WORDS. Do not put any dialogue or production instructions visibly on the video. NO MUSIC, NO BGM, NO score, NO singing. Only voice, light breathing, cloth rustle and very low distant wind.
Spoken Mandarin dialogue, verbatim, in this order, no other words:
“传令，拨一队人马，听他调遣。”
“你去收拢残部，接应尚未撤出的将士。”
“把他们带回来。”'''
refs=[str(R/'references/L02-刘备倾听.png')]
(d/'prompt.txt').write_text(p,'utf-8');(d/'references.json').write_text(json.dumps(refs,ensure_ascii=False),'utf-8');(d/'视频生成Prompt.md').write_text('# L04R｜传令修订\n\n原L04出现额外说明朗读及烧录字幕，停止选用。本镜仅中文对白，其余控制改英文；15秒，H3 768P，16:9。\n参考图：'+refs[0]+'\n\n'+p,'utf-8')
plan=json.loads((R/'production-plan.json').read_text('utf-8'))
for u in plan['units']:
 if u['id']=='L04':u.update(selected_for_edit=False,video_status='待更新',rejection='额外说明朗读及烧录字幕')
if not any(u['id']=='L04R' for u in plan['units']):plan['units'].append(dict(id='L04R',title='传令修订',duration=15,edit_duration=15,depends_on=None,reference_paths=refs,prompt_status='待review',video_status='待生成',prompt_path=str(d/'视频生成Prompt.md'),request_prompt_sha256=hashlib.sha256(p.encode()).hexdigest()))
(R/'production-plan.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2),'utf-8')
(R/'L04/review.json').write_text(json.dumps(dict(technical='pass',method='联系表目视及ASR辅助定位',motion_review='reject',user_review='待review',selected_for_work_edit=False,notes=['烧录字幕','说明性额外台词','尾句超过选用13秒，不能截断']),ensure_ascii=False,indent=2),'utf-8')
