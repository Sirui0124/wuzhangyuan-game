from pathlib import Path
import json,copy,hashlib
O=Path(__file__).resolve().parent
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
id='V24-03-R3';P=read(O/'plan.json');assert not (O/'tasks'/f'{id}.json').exists()
if any(c['id']==id for c in P.get('revisions',[])):raise SystemExit('Revision already prepared; do not rewrite.')
ref=O/'references/liyan-night-desk/image-01.png';assert ref.exists()
prompt='''One uninterrupted 15-second live-action reaction shot, continuing the supplied first frame exactly. The same older Chinese man sits at the same low wooden desk at night, warm oil lamp on the left, dark lattice window behind him. He silently receives troubling news from a person beside the camera. Both lips stay gently pressed together and the jaw stays at rest throughout; his visible performance is in his eyes and brows, never in speaking. From 0 to 5 seconds his eyes hold steady and he blinks once. From 5 to 10 seconds his brow tightens slightly and his gaze briefly drops to the empty desk before returning to the same listener position. From 10 to 15 seconds he holds a guarded, concerned look, breathing slowly through the nose, shoulders moving subtly. His hands stay resting on the desk. No nod of agreement, no new object, no reaching, no standing. The camera remains an eye-level medium close-up with a very slight natural drift. Real skin texture, restrained gray-brown colors, readable shadows. Only quiet room air, faint fabric and oil-lamp ambience. No human voice, no spoken words, no music, no captions or visible writing.'''
base=next(c for c in P['clips'] if c['id']=='V24-03');c=copy.deepcopy(base)
c.update(id=id,revisionOf='V24-03',duration=15,status='ready-local-request',audioMode='silent_listener_for_unified_dubbing',generationPurpose='画面返修试片：李严完整无声倾听，消除苟安回忆对白被李严代说；通过动态验证后才采用。',reuseCandidates=['V24-03','V24-06'])
c['shots']=[dict(start=0,end=15,action='李严闭口倾听，以眼神、眉间及鼻息呼吸表演担忧，双手留案上，不点头承诺，不新增行动或证物。',camera='苟安口述回忆的视点，面对李严；眼高中近景轻微自然漂移，不露苟安/玩家身体。',lines=[])]
P.setdefault('revisions',[]).append(c)
(O/'plan.json').write_text(json.dumps(P,ensure_ascii=False,indent=2),encoding='utf-8')
body=dict(model='MiniMax-H3',duration=15,resolution='768P',ratio='16:9',content=[dict(type='text',text=prompt),dict(type='image_url',image_url=dict(local_path=str(ref)),role='first_frame')])
(O/'requests'/f'{id}.local.json').write_text(json.dumps(body,ensure_ascii=False,indent=2),encoding='utf-8');(O/'prompts'/f'{id}.api.txt').write_text(prompt,encoding='utf-8')
md=f'''尺寸：16:9
模型：MiniMax-H3
声音：有声音
时长：15秒

## 参考图（实际上传顺序）

图片1：李严夜间低案身份与构图。
完整本地路径：`{ref.as_posix()}`
用途：唯一 first_frame，锁定李严脸型、帽服、夜间低案、左侧灯火、窗格及摄影机位置；不混 reference_image。

## 视频生成 Prompt｜{id}

本请求只生成无声倾听表演，不把正式中文对白发给模型。摄影机属于苟安口述回忆中的当夜苟安视点，面对李严；不是玩家亲见。无玩家或苟安正脸、肩背，无反打身份切换。

### 分镜1｜0-15秒

参考图关系：图片1同时负责李严身份、低案空间、夜间照明和首帧构图；延续同一人物与同一房间，不添新图或新证物。

画面动作：0–5秒李严静看镜头旁的讲述者，眨眼一次；5–10秒眉间轻收，短暂垂眼到空案再抬回；10–15秒保持克制担忧，鼻息呼吸带动肩部。嘴唇自然合拢、下颌不作说话运动，双手留案上，不点头承诺。

摄影切点：一个连续眼高中近景，轻微自然漂移，不推近到失去身份和空间。结尾留同一倾听姿态。

对白：本次请求不生成任何对白。剪辑时完整保留原编号 CH2-LY08-005『真要做到这一步？』、006『粮草供不上，他总得退。』、007『往后，也未必还能打几次。』；说话人均为回忆中的苟安，受话人为李严，声音从摄影机位置画外发出，李严不能代做口型。经试片验证后，未使用的自然倾听时段可供 CH2-LY08-012『可借魏人的手……还能由得我们吗？』作为同一回忆视点的观察镜；不能重复短循环凑长或改变句子/归属。具体源片时间由后期记录，不把上述四句挤进本请求15秒原声。

连续性约束：保持同一夜间书房、低案和灯位；画面不证明玩家亲见往事，不拍执行散谣、赴魏或召军；不新增证据、文字、人物或物权变化。原片及R2保留，本次为独立R3；动态验收前不替换delivery。

拍摄手法参考：沿用项目已核验的《影》摄影访谈有限色彩与明暗分层描述，应用于本镜的人脸、暗窗和局部灯火；具体听者机位与眼神调度是本项目设计，不向影片归因。核验记录沿用 docs/video/review-20261021/cli-import/LI02B.md。

声音要求：全片无BGM、无背景音乐、无配乐、无吟唱、无音乐鼓点；本次不生成任何人声或对白。仅同步轻微衣料、鼻息呼吸、房间轻风和灯芯微响；无对应动作不加脚步、纸张或碰撞声。正式苟安回忆画外原句留待统一配音，不新增TTS，不声称本片口型或原声已经正式核对。
'''
(O/'prompts'/f'{id}.md').write_text(md,encoding='utf-8');(O/'dispatch-allowlist.json').write_text(json.dumps([id]),encoding='utf-8')
print(json.dumps(dict(prepared=id,referenceSha256=hashlib.sha256(ref.read_bytes()).hexdigest(),newRequests=1),ensure_ascii=False))
