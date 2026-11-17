from pathlib import Path
import json,copy,hashlib
O=Path(__file__).resolve().parent;BASE=O.parents[1];R=O/'user-review-20261025'
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
id='V21-03-UR1';P=read(O/'plan.json');assert not (O/'tasks'/f'{id}.json').exists()
assert not any(x['id']==id for x in P.get('revisions',[]))
ref=BASE/'references/generated/伤帐/image-01.png';assert ref.exists()
prompt='''One continuous 8-second live-action historical-film insert, starting from the supplied empty daytime tent cot. Keep the same coarse grey bedding, pale tent cloth, hanging dark armour, daylight direction and restrained natural colours. The camera is the receiving person's eyes beside the cot, tilted down toward the near edge of the bedding. Faces and bodies stay outside the frame; only two people's hands and forearms enter. At 0–1 seconds hold the quiet empty cot edge with subtle real camera drift. At 1–3 seconds a right hand in a coarse grey linen sleeve enters from screen right and offers one small letter folded into a closed palm-sized cream paper rectangle over the cot edge. The side facing the camera is completely plain unmarked paper. At 3–5 seconds the receiver's left hand, in a darker coarse linen sleeve, enters from the lower left and grips the near left corner. Show a clean physical handover: both hands touch the same single folded letter, then the offering fingers release and withdraw to the right. At 5–8 seconds the receiver draws the closed letter gently toward the lower-left foreground and holds it; keep its plain outer back facing camera. Never unfold, rotate to an inked side, duplicate, vanish or exchange the letter again. All fingers remain anatomically coherent and the paper moves only where the hands contact it. No readable marks, handwriting, labels, text, captions, graphics, information cards, blur patches or masks anywhere. Do not add a third person, a face, a weapon, a new document or an object on the bedding. No frozen frames or repeated motion. Permitted spoken utterances: NONE. Absolutely no speech, narrator, whispering, singing or other human voice. No BGM or music. Only synchronized faint cloth and folded-paper rustle and quiet daytime tent air.'''
base=next(x for x in P['clips'] if x['id']=='V21-03');c=copy.deepcopy(base);c.update(id=id,revisionOf='V21-03',duration=8,status='ready-local-request',referenceKeys=['wound_tent'],generationPurpose='用户20261025实审返修：撤掉摘要卡和纸面模糊层，补拍折信背面完整交接；空对白白名单。',userReviewRound='user-20261025-1549',audioMode='no_speech_no_bgm',shots=[dict(start=0,end=8,action='单次折信交接，素白外侧朝向镜头，接住后松手并收近；不展开，不添证物或文字。',lines=[])])
P.setdefault('revisions',[]).append(c);(O/'plan.json').write_text(json.dumps(P,ensure_ascii=False,indent=2),encoding='utf-8')
whitelist=dict(id=id,duration=8,allowedUtterances=[],noNarration=True,noExtraHumanVoice=True,noBGM=True,controlFieldsAreNeverSpeech=True)
(R/(id+'-dialogue-whitelist.json')).write_text(json.dumps(whitelist,ensure_ascii=False,indent=2),encoding='utf-8')
body=dict(model='MiniMax-H3',duration=8,resolution='768P',ratio='16:9',content=[dict(type='text',text=prompt),dict(type='image_url',image_url=dict(local_path=str(ref)),role='first_frame')])
(O/'requests'/f'{id}.local.json').write_text(json.dumps(body,ensure_ascii=False,indent=2),encoding='utf-8');(O/'prompts'/f'{id}.api.txt').write_text(prompt,encoding='utf-8')
md=f'''尺寸：16:9
模型：MiniMax-H3
声音：有声音
时长：8秒

## 参考图（实际上传顺序）

图片1：伤帐无人空间及首帧。完整本地路径：`{ref.as_posix()}`。
用途：唯一first_frame，锁定日间帐布、灰麻低榻、挂甲、光照和榻侧第一视角；不复制新人物。

## 视频生成 Prompt｜{id}

本请求仅补拍真实折信交接。实际API只提交独立.api.txt中的镜头指令与空对白白名单，不提交本审核文档或正式台词映射。

### 分镜1｜0-8秒

参考图关系：图片1负责伤帐空间、日光、灰麻床褥、挂甲及首帧构图；身份不露正脸，仅右侧苟安灰麻衣袖及左下我的较深麻袖，双人手部各自独立。

画面动作：0–1秒保持榻沿；1–3秒右手递来掌心大小闭合折信，素白外背朝镜头；3–5秒左下我的手接住同一封信，苟安手指明确松开并撤回；5–8秒我将折信收向左下近处。全程不展开、翻到有墨一面、复制、消失或二次交接。

摄影切点：一个连续榻侧眼高向下的近景，真实轻微漂移，双手接触关系清楚。无人脸、肩背、第三人，不出现任何文字卡、字幕、编号、模糊块或遮罩。

对白白名单：空。无对白、无旁白、无额外人声；姓名、说话人、画外等控制信息均不得朗读。剧情来源CH2-LY07-005/006只留后期映射，本次不发给模型、不新增朗读；李丰担忧父亲并劝停止计划的事实不删除，由既有对白和已设计游戏信息层承载，不擅自改游戏。

连续性约束：保持同一伤帐；第二封信只交接一次；折信素白外背始终朝镜头，不新增写字、证物或人物。保留旧片、旧卡及评论作历史，本片验收后才接入独立新版本。

拍摄手法参考：沿用项目已核验《1917》行动与摄影机关系的限定研究，用于本镜接触、松手、收近的连续观察；具体交接构图为本项目设计，不把本镜归因于影片。

声音要求：全片无BGM、无背景音乐、无配乐、无音乐鼓点；禁止对白、旁白、姓名朗读、耳语、歌唱及额外人声。只保留与实际接触同步的轻微衣料、折纸声和白天帐内空气声；无脚步或无源碰撞。本轮不新增TTS。
'''
(O/'prompts'/f'{id}.md').write_text(md,encoding='utf-8');(O/'dispatch-allowlist.json').write_text(json.dumps([id]),encoding='utf-8')
print(json.dumps(dict(prepared=id,duration=8,whitelist=[],referenceSha256=hashlib.sha256(ref.read_bytes()).hexdigest()),ensure_ascii=False))
