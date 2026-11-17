"""Enable the other six original slots only after inspecting the single paid pilot."""
from pathlib import Path
import json,hashlib
OUT=Path(__file__).resolve().parent
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
proof=read(OUT/'review/V25-02-pilot-validation.json')
assert proof.get('passed') is True and proof.get('noOnscreenText') and proof.get('noUnrequestedProp') and proof.get('naturalSpeaking')
assert read(OUT/'tasks/V25-02.json')['status']=='succeeded'
assert hashlib.sha256((OUT/'generated/V25-02-raw.mp4').read_bytes()).hexdigest()==proof['rawSha256']
P=read(OUT/'plan.json')
speaking={
 'V25-04':('two short phrases','0.8 to 7.5 seconds','a small breath pause between the phrases'),
 'V25-05':('four short phrases','0.8 to 12.5 seconds','a thoughtful breath pause around the middle'),
 'V25-08':('two short phrases','0.8 to 8.5 seconds','a brief pause after the first phrase; his expression remains restrained')}
updated=[]
for c in P['clips']:
 id=c['id']
 if id not in ['V25-03','V25-04','V25-05','V25-06','V25-07','V25-08']:continue
 assert not (OUT/'tasks'/f'{id}.json').exists(),(id,'already accepted or uncertain; do not rewrite')
 base=f"A {c['duration']}-second continuous live-action historical film shot. Continue the supplied first frame with the same Gou An, gray linen, cot and warm night lamp. The observer stays still. Natural skin and subdued brown-gray materials. "
 if id in speaking:
  phrases,times,pause=speaking[id]
  text=base+f'Gou An rests his forearms on the cot and naturally addresses the observer in {phrases}, from {times}, with {pause}. His lips and jaw move naturally while speaking. His body keeps the supported resting pose. He gently closes his mouth at the end and keeps eye contact. Quiet room ambience. No music. No on-screen text.'
  c['audioMode']='guide_only_for_later_dubbing'
 else:
  text=base+'Gou An quietly listens to the observer. His forearms remain resting on the cot, his lips softly sealed, and his eyes gently stay on the observer with subtle breathing and one natural blink. He maintains the same supported resting pose throughout. Only natural room ambience. No human voice. No music. No on-screen text.'
  c['audioMode']='player_offscreen_in_unified_dubbing; closed_lip_listener'
 local=OUT/'requests'/f'{id}.local.json';body=read(local);body['content'][0]['text']=text
 local.write_text(json.dumps(body,ensure_ascii=False,indent=2),encoding='utf-8');(OUT/'prompts'/f'{id}.api.txt').write_text(text,encoding='utf-8')
 md=OUT/'prompts'/f'{id}.md';s=md.read_text(encoding='utf-8')
 note=('本次模型只生成NPC自然分句说话表演，正式中文原句留本文与JSON供后续统一配音。' if id in speaking else '本次模型只生成闭口听者，玩家画外原句留本文与JSON，采用既有中央音轨或后续统一配音。')
 s=s.replace('## 视频生成 Prompt',f'本片制作方式：{note} 本片原声不承担正式台词，口型仅待后续核对，不能声称已对齐。已先验证V25-02试片画面改善再扩展。\n\n## 视频生成 Prompt',1);md.write_text(s,encoding='utf-8');updated.append(id)
 s=s[:s.rfind('声音要求：')]+('声音要求：全片无BGM、无背景音乐、无配乐、无吟唱或音乐鼓点。'+('本请求仅为NPC自然说话表演，当前原声不承担正式台词；正式对白按上文逐句原文留待统一配音，口型后续核对，不声称已对齐。' if id in speaking else '本请求画内人物闭口，不生成任何人声；我的画外原句按上文完整保留，采用既有中央音轨或后续统一配音。')+'只留自然房间轻风、布料摩擦和呼吸，不增加未发生动作的声效。不新增TTS调用。\n')
 md.write_text(s,encoding='utf-8')
(OUT/'plan.json').write_text(json.dumps(P,ensure_ascii=False,indent=2),encoding='utf-8')
(OUT/'dispatch-allowlist.json').unlink(missing_ok=True)
print(json.dumps(dict(pilot='validated',unlocked=updated),ensure_ascii=False))
