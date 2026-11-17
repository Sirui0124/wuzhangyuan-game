from pathlib import Path
import json,hashlib
R=Path(__file__).resolve().parent
A=R.parent/'PV-opening-20261114'
rows=[('H05B','沙摩柯一次失力修正',5,A/'references/new/N03-沙摩柯-孤骑回望-v1.png',
'''Single five-second live action shot. Keep the reference horse, warrior, camp road and distant burning camp. Locked camera at the reference angle. The horse walks steadily to screen right. The warrior glances back once, then suddenly makes one small involuntary shoulder jerk, his breath stops and his weapon hand loosens. He starts folding forward over the saddle. End before he falls. His intact clothing stays intact throughout. No blood, no red spray, no dust bursts, no visible projectile, no arrow shaft, no wound. The attack is communicated ONLY by a single brief offscreen arrow whistle and a dull cloth impact exactly on the shoulder jerk at3seconds. Natural horse breathing, hooves, leather. No dialogue, no narration, no singing, no instrumental music. Do not speak any instructions. Full frame16:9, no cut.''',
'H05产生突兀血雾，改为一次短促受力，接空鞍结果；不展示箭体穿模。'),
('H18B','救人严格第一视角修正',9,R.parent/'PV-H3-20261115-v1/G24-25-v2/P01-伤兵无接触起始图-v2.png',
'''Nine-second live-action single shot, literal head-mounted FIRST PERSON POV. The viewer IS the rescuer. Only ONE full human, the injured soldier in the reference, is visible in the entire scene. No other person's torso, waist, belt, head, legs or shoulder may appear at any edge. Camera crouches facing the soldier directly. Only one forearm extends from the very bottom center toward him: viewer's RIGHT hand wearing pale blue-white sleeve and worn silver-gray bracer. At1.5seconds viewer says once in Mandarin “拉住我。” Injured man keeps lips closed and looks into camera; he does NOT speak this sentence. He grips this forearm firmly with both hands. Camera and extended forearm move backward/up together, pulling him away from the wheel; his shoulders lift and he starts to stand facing viewer. Keep anatomy and hand contact. No cut, no lateral camera orbit. Real breathing, effort grunts, cloth, boots, distant fire. No other spoken words, no narration, no chanting, NO music. Full frame16:9.''',
'H18画面右侧露出施救者腰部，违背第一视角；重做严格只有前臂进入画面。')]
plan=json.loads((R/'production-plan.json').read_text('utf-8'))
for id,title,dur,ref,prompt,reason in rows:
 d=R/id;d.mkdir(exist_ok=True)
 if (d/'state.json').exists():continue
 assert ref.exists()
 (d/'prompt.txt').write_text(prompt+'\n','utf-8')
 (d/'references.json').write_text(json.dumps([str(ref)],ensure_ascii=False,indent=2),'utf-8')
 u=dict(id=id,title=title,duration=dur,edit_duration=dur,version='v2.1-correction2',reference_paths=[str(ref)],depends_on=None,reason=reason,prompt_sha256=hashlib.sha256((d/'prompt.txt').read_bytes()).hexdigest())
 (d/'correction-record.json').write_text(json.dumps(u,ensure_ascii=False,indent=2),'utf-8')
 if id not in [x['id'] for x in plan['units']]:plan['units'].append(u)
(R/'production-plan.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2),'utf-8')
