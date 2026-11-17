from pathlib import Path
import json,shutil,hashlib
R=Path(__file__).resolve().parent
G=Path('C:/Users/zhousirui/.codex/generated_images/01a1d983-5ada-7a93-b3bc-b154ad9ffdfe')
for f in ['pipeline.py','add_one_unit.py','render_film.py']:
 p=R/f;p.write_text(p.read_text('utf-8').replace('v2.8','v2.9').replace('回忆与火场','火营与归途'),'utf-8')
plan={'version':'v2.9','authorization':'User approved full remake through H3, approximately40sec, noBGM, horse shots remade, 2026-11-17','units':[]}
def add(id,title,img,dur,prompt):
 ref=R/'references'/f'{id}.png';shutil.copy2(G/img,ref)
 d=R/id;d.mkdir(exist_ok=True);(d/'prompt.txt').write_text(prompt+'\n','utf-8')
 u=dict(id=id,title=title,version='v2.9',duration=dur,edit_duration=dur,reference_paths=[str(ref)],depends_on=None,prompt_sha256=hashlib.sha256((d/'prompt.txt').read_bytes()).hexdigest())
 (d/'references.json').write_text(json.dumps(u['reference_paths'],ensure_ascii=False,indent=2),'utf-8');plan['units'].append(u)
sound=' Sound only natural synchronized hoof contacts, horse breathing, leather creak and cloth rustle. NO music, NO BGM, NO narration, NO speech or words, no subtitles. No slow motion, no cuts, no text. Real live-action natural texture, not CGI.'
add('H21','侧后跟骑','exec-28e882fd-0894-4745-8a11-aa6aabdc349e.png',5,'Five-second continuous real-time tracking shot. Keep this exact grey horse, rider and forest track, plain gray short hair and worn tack. Camera follows from rear-left at waist height as horse canters away toward the right bend, steady physical tracking with subtle natural vibration. Horse performs a believable repeating three-beat canter; hoof placement, leg joints, rider seated weight and rein tension physically coherent. Trees pass left with real parallax, small dust follows hoof contact. Rider leans slightly forward and stays turned away; do not reveal or invent a face. No rearing, flying, exaggerated bouncing, sliding legs or ornamental fur.'+sound)
add('H22','骑手视角奔赴火场','exec-dd83468f-b7ee-4e6b-8921-2b80989159a4.png',5,'Five-second continuous first-person rider view following the dirt road forward and slightly right. Maintain exact grey horse ears and gray sleeves at bottom, no body or face added. Visible path must travel toward camera, trees pass with correct parallax. Rhythmic small vertical motion of horse head and rider camera, not violent shake. Start cantering, ease to a slower controlled pace near the opening as burning camp grows slightly larger ahead. Reins gently take tension; horse never rears, no abrupt zoom, no new armies, no rain. Real physical forest and distant flames.'+sound)
add('H23','落蹄回到当下','exec-0ec1f8cb-52ce-4b91-9f5f-bd6c33746c1f.png',4,'Four-second ground-level close tracking insert of only the gray horse lower legs and dark hooves moving LEFT TO RIGHT on packed earth. Near hoof loads its weight onto dirt then lifts, other hoof advances and lands; small dry crumbs at actual contacts. Natural real-time canter rhythm and correct joint bending, four legs belong to one horse but frame mainly holds two front lower legs. No hoof morphs, no extra legs, no giant dust explosion. Camera stays close to ground moving alongside, no transition or camera orbit.'+sound)
(R/'production-plan.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2),'utf-8')
