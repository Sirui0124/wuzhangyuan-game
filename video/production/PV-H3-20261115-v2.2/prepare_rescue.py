from pathlib import Path
import json,hashlib
R=Path(__file__).resolve().parent
rows=[('K01','伤兵伸手抓牢',5,[str(R/'references/K01-坡边接手.png')],None,
'''Five-second literal FIRST PERSON live-action shot, starting from this exact reference arrangement. Camera is the rescuer's eyes; rescuer is represented only by the already visible right forearm and open hand at the bottom. A young adult male voice from CAMERA position says ONCE in Mandarin “拉住我。” during0.3—1.2seconds. The injured man keeps his lips CLOSED; he only breathes. His reaching RIGHT hand moves forward and securely clasps the rescuer's open RIGHT hand, fingers wrapping naturally into one firm handshake. His LEFT hand remains on the earth supporting him. Hold the completed grip for one second with tension in the forearms. No lifting yet, no second grip change, no extra hand, no third person. Camera makes a very small forward lean with the offered arm. Keep the same actor, dirt slope, burnt log and local fire, tactile skin and cloth. Only the quoted sentence, quiet breath, cloth and distant fire. NO music, no other words. No cut,16:9.'''),
('K02','抓牢后支腿起身',5,[],'K01',
'''Five-second literal FIRST PERSON continuation from the reference's exact completed hand grip. Start already connected; NEVER release or re-grip. The injured man pushes with his free LEFT palm and planted boot, then lifts his chest and hips slowly from the slope as camera and rescuer's forearm move gently back and up together. Show the physical support and strain, not levitation. He reaches a stable half-standing crouch facing the camera and exhales once. Only ONE right forearm of the rescuer is visible, no rescuer torso or legs. Injured man does not speak; his mouth may part only for exertion breathing. Natural uneven movement, body weight, shaking cloth, boots scuffing dry earth and gravel. No new people, no camera orbit, no extreme close-up crop or jump cut. Keep actor, gear, slope and smoke. Natural exertion and scene ambience only, NO music or spoken words.16:9.''')]
plan=json.loads((R/'production-plan.json').read_text('utf-8'))
for id,title,dur,refs,dep,prompt in rows:
 d=R/id;d.mkdir(exist_ok=True)
 if (d/'state.json').exists():continue
 (d/'prompt.txt').write_text(prompt+'\n','utf-8');(d/'references.json').write_text(json.dumps(refs,ensure_ascii=False,indent=2),'utf-8')
 u=dict(id=id,title=title,duration=dur,edit_duration=dur,reference_paths=refs,depends_on=dep,version='v2.2',prompt_sha256=hashlib.sha256((d/'prompt.txt').read_bytes()).hexdigest())
 if id not in [x['id'] for x in plan['units']]:plan['units'].append(u)
(R/'production-plan.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2),'utf-8')
