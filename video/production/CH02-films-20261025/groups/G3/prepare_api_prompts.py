"""Full reviewable Markdown stays separate from concise model-facing direction."""
from pathlib import Path
import json,re,hashlib
OUT=Path(__file__).resolve().parent
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
P=read(OUT/'plan.json');binds=read(OUT/'reference-bindings.json')
def compact(c):
 if c.get('minimalV3'):
  if c['logicalId']=='V23' and c['id']!='V23-03':
   desc='The same elderly woman in the supplied frame slowly gathers the small amount of grain into her cloth bag and closes its mouth, her fingers touching the fabric naturally. The observer stays at the same wooden table. A quiet continuous scene with natural daylight.'
  elif c['id']=='V22-06':desc='The same grain officer stands in the same granary, looks toward the observer, and speaks calmly. Keep his same face and clothing, a small natural hand gesture, one continuous eye-level medium close-up.'
  elif c['logicalId']=='V24' and c['id']!='V24-01':desc='The same Li Yan sits at the same low desk at night, looking toward the observer. Keep the same warm oil lamp and dark window. His hands rest naturally by the desk. One continuous eye-level medium close-up.'
  else:desc='The same Gou An rests with his forearms supported on the same cot at night. Keep his face, black head wrap, gray linen and warm lamp unchanged. His eyes stay on the observer, with subtle breathing. One quiet continuous eye-level close-up.'
  text=f'Historical live-action cinema, {c["duration"]} seconds, 16:9. Continue the supplied first frame. Natural skin and subdued gray-brown materials. {desc}\n'
  speech=[l for l in c['sourceLines'] if l['spoken'] and not c.get('postVoiceOnly')]
  if speech:
   for l in speech:
    where=('The man on screen' if l['voiceMode']=='画内对白' else 'Gou An off camera, while Li Yan listens with his lips closed')
    text+=f'{where} says in natural Mandarin: 「{l["text"]}」\n'
  else:text+='His or her lips stay closed, only natural breathing and room or wind ambience. No human voice.\n'
  return text+'Natural cloth and room ambience. No music. No on-screen text.'
 refs=('Use the supplied first frame as the exact same man, pose and setting. Continue this one camera position; do not cut to a portrait or empty room.' if c.get('useFirstFrame') else ' '.join(f"Image {i}: {binds[k]['purpose']}" for i,k in enumerate(c['referenceKeys'],1)))
 base=f"A single {c['duration']}-second cinematic historical live-action scene, 16:9. Han-era China. Real human actors, natural skin, low saturation gray linen and brown wood, readable shadows. No painting texture. The camera is a person's eyes, no reverse shot, no body/face/shoulder of the camera owner. {refs}\n"
 if c.get('nightFrame'):base+='Night. Keep the exact supplied lamp illumination, dark window and readable shadows. Do not return to daylight. One continuous shot, no other people or locations.\n'
 if c['scene']=='tent' or c['id']=='V24-01':
  base+='苟安保持参考脸、黑巾、灰麻衣，杖伤后伏卧在右侧低木榻上。伤帐位置不变，旧甲挂在榻后。不要绷带、血伤，不站起。\n'
 if c['logicalId']=='V24' and c['id']!='V24-01':base+='镜头是当夜苟安的双眼，面前只有李严席坐低案后，窗在左、书架在右。不拍高背椅。苟安不出镜，其声音从镜头位置画外传来。保持同一书房镜头，不出现伤帐。\n'
 if c['postVoiceOnly']:
  if c['logicalId']=='V23':base+='我的眼睛在村中木桌外停稳。参考图同一个老妇人，把少量谷粒收进小布袋，拢紧袋口。只保留真实缓慢手部接触与轻风。她和背景所有人嘴唇完全闭合，没有说话、呢喃或哭喊，不看镜头表演。\n'
  else:base+='A quiet stationary close view of Gou An in exactly the supplied pose. His forearms remain resting on the cot. His eyes gently stay on the camera position, with subtle breathing and one natural blink. His lips remain softly sealed throughout. The entire frame continues the same resting pose. No human voice at all; only soft natural room ambience.\n'
 else:
  shots=c['shots']
  if c['id']=='V24-01':shots=[dict(start=0,end=c['duration'],action='夜间伤帐同一卧榻第一视角，苟安只说那夜一句，随后闭口平静看向镜头。不要换空间、不要站起。')]
  if c['id']=='V24-06':shots=[dict(start=0,end=c['duration'],action='夜间书房面对李严席坐低案，李严全程闭口听镜头位置苟安的画外疑问，之后沉默。不要换场景。')]
  if c['id']=='V23-03':shots=[dict(start=0,end=c['duration'],action='夜间伤帐，苟安卧榻闭口，眼睛看向镜头，只有自然呼吸和灯芯声，没有对白、拿纸、走动或站起。')]
  for s in shots:
   action=s['action']
   for token in ['，准确摘要由后期文书叠字','，留出平整纸面','供后期叠加第二封信摘要','不念任何演出说明','，文书准确文字后期绘制']:
    action=action.replace(token,'')
   base+=f"{s['start']}-{s['end']}秒：{action}\n"
  for l in c['sourceLines']:
   if not l['spoken']:continue
   lip=(l['actor']+'在画内自己开口') if l['voiceMode']=='画内对白' else '画外声音，李严全程嘴唇合拢'
   base+=f"{l['start']}-{l['end']}秒，{lip}，只说：『{l['text']}』。其他人不说话、不做口型。\n"
  if not any(l['spoken'] for l in c['sourceLines']):base+='No human speech, no dialogue, no voice-over. Everyone keeps lips closed.\n'
 base+='自然声音：布料摩擦；实际走路才有脚步；实际接触才有纸、木响。苟安中年男声，中低略粗但清楚、克制；李严较年长，低稳。No BGM. No music, score, singing, chant or rhythmic music. NO SUBTITLES, CAPTIONS, TEXT, TITLES, LOGOS OR WATERMARKS. 不出现任何文字。不要朗读画面描述。'
 return base
done=[]
for c in P['clips']:
 # An accepted or uncertain submission remains immutable. New revisions use new IDs.
 if (OUT/'tasks'/f"{c['id']}.json").exists():continue
 c['minimalV3']=c['logicalId'] in ['V23','V24','V25'] or c['id']=='V22-06'
 c['useFirstFrame']=(c['scene']=='tent' and c['logicalId']!='V23') or c['logicalId'] in ['V23','V24'] or c['id']=='V22-06'
 c['nightFrame']=c['logicalId'] in ['V24','V25'] or c['id']=='V23-03'
 text=compact(c);(OUT/'prompts'/f"{c['id']}.api.txt").write_text(text,encoding='utf-8')
 if c['useFirstFrame']:
  fp=(Path(binds['grain_manager']['path']) if c['id']=='V22-06' else Path(binds['village']['path']) if c['logicalId']=='V23' and c['id']!='V23-03' else OUT/'references/liyan-night-desk/image-01.png' if c['logicalId']=='V24' and c['id']!='V24-01' else OUT/'references/gouan-night-prone/image-01.png' if c['nightFrame'] else OUT.parents[1]/'references/source-frames/gouan-talk.png');assert fp.is_file()
  media=[dict(type='image_url',image_url=dict(local_path=str(fp)),role='first_frame')]
  md=OUT/'prompts'/f"{c['id']}.md";s=md.read_text(encoding='utf-8')
  who='粮队管事' if c['id']=='V22-06' else '老妇人与村景' if c['logicalId']=='V23' and c['id']!='V23-03' else '李严' if 'liyan' in fp.as_posix() else '苟安'
  s=re.sub(r'## 参考图（按实际上传顺序）.*?(?=## 视频生成 Prompt)',f'## 参考图（按实际上传顺序）\n\n图片1：{who}同身份空间构图\n完整本地路径：`{fp.as_posix()}`\n用途：唯一first_frame，锁同一人脸、衣服、姿态、空间和灯光；不混reference_image。\n\n',s,flags=re.S)
  s=re.sub(r'参考图关系：.*?(?=\n\n画面动作)', f'参考图关系：图片1作为唯一首帧，同时锁{who}身份、空间与当前构图。仅延续此视点，不插入身份照或空房。',s,flags=re.S)
  if c['id'] in ['V23-03','V24-01','V24-06']:s=s.replace('## 视频生成 Prompt', '本次镜头适配：跨场景衔接由后期完成；当前生成只保持唯一首帧的连续空间。V24开头以伤帐末帧短叠化进入书房；V24末尾接回同一伤帐闭口反应，不增加对白或交互。\n\n## 视频生成 Prompt',1)
  md.write_text(s,encoding='utf-8')
 else:media=[dict(type='image_url',image_url=dict(local_path=binds[k]['path']),role='reference_image') for k in c['referenceKeys']]
 local=dict(model='MiniMax-H3',duration=c['duration'],resolution='768P',ratio='16:9',content=[dict(type='text',text=text)]+media)
 prepared=OUT/'requests'/f"{c['id']}.json"
 if prepared.exists():
  archive=OUT/'requests/history';archive.mkdir(exist_ok=True)
  digest=hashlib.sha256(prepared.read_bytes()).hexdigest()[:10];prepared.replace(archive/f"{c['id']}-{digest}.json")
 (OUT/'requests'/f"{c['id']}.local.json").write_text(json.dumps(local,ensure_ascii=False,indent=2),encoding='utf-8');done.append(c['id'])
print(json.dumps(dict(updatedUnsubmitted=done),ensure_ascii=False))
