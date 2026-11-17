from pathlib import Path
import json,hashlib
R=Path(__file__).resolve().parent;A=R.parent/'PV-opening-20261114'
rows=[('H03B','告急对白定点修正',5,[str(A/'references/new/N01-冯习张南-救驾受阻-v1.png')],
'''Five seconds. Static live-action medium shot of these same two mounted commanders. Left man Feng Xi faces the right man and says once in Mandarin: “御营败了，速去救驾！” Start the sentence at0.5 seconds, finish by3.5 seconds. Right man Zhang Nan silently listens, mouth closed, then turns his head toward the camp road. Both horses stay mostly still. Only the LEFT man speaks. No repeating words, no additional voices, no chanting. Real horse breathing, leather and distant fire. Absolutely no music, no text, no letterbox. Keep the reference faces and normal realistic light. No camera travel, no charge, no combat in this short shot.''',
'H03对白重复且混入无关喊话；独立补一个简短告急镜，旧H03保留作后续无对白战况画面。'),
('H16B','五丈原无对白手部修正',5,[str(R/'H16/end-selected.png')],
'''Five seconds. Live-action close shot of the SAME resting hand, worn map, low feather fan, dark sleeve and oil lamp from this reference. Keep the face and mouth OUTSIDE the frame at all times. The tired hand presses fingertips slightly into the map then relaxes once; the sleeve softly shifts. The lamp stays lit, flame quivers lightly in a small tent draft. Camera very slowly tracks toward the lamp but keeps the hand visible at left. Only quiet cloth, faint breathing and tent fabric rustle. NO speech, NO narrator, NO words, NO music, NO chanting. No new hand, no floating map, no readable new text, no cut. Full frame16:9.''',
'H16擅加无关对白且嘴部持续动作；只拍既有末帧手部与灯，同一地图／衣袖不变，避免错口型。')]
plan=json.loads((R/'production-plan.json').read_text('utf-8'))
for id,title,dur,refs,prompt,reason in rows:
 d=R/id;d.mkdir(exist_ok=True)
 if (d/'state.json').exists():continue
 for p in refs:assert Path(p).exists()
 (d/'prompt.txt').write_text(prompt+'\n','utf-8');(d/'references.json').write_text(json.dumps(refs,ensure_ascii=False,indent=2),'utf-8')
 u={'id':id,'title':title,'duration':dur,'edit_duration':dur,'version':'v2.1-correction1','reference_paths':refs,'depends_on':None,'reason':reason,'prompt_sha256':hashlib.sha256((d/'prompt.txt').read_bytes()).hexdigest()}
 (d/'correction-record.json').write_text(json.dumps(u,ensure_ascii=False,indent=2),'utf-8')
 if id not in [x['id'] for x in plan['units']]:plan['units'].append(u)
(R/'production-plan.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2),'utf-8')
print('Two targeted corrections prepared; originals preserved; not retries of unknown requests.')
