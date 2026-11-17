from user_repair import *
cid='V12-UR1';ref=O/'references/V12-user-clean-first.png'
run(['-ss','2','-i',O/'edited/V12-01-normalized.mp4','-frames:v','1',ref])
b=rd(O/'reference-bindings.json');b['v12_user_clean']=dict(path=str(ref),sha256=sha(ref),ready=True,purpose='同一苟安/伤帐/取凭据动作，未叠任何遮罩的原始首帧');save(O/'reference-bindings.json',b)
prompt='''Ten seconds, realistic historical film, one continuous first-person eye-level view, the exact same wounded grey-robed man and linen army tent as image 1. Preserve his face, dark cloth head wrap, posture on the straw bed, lighting, rough paper and army clothes. Continue the action of retrieving ONE folded paper from his pouch. The camera is the recipient. He hands this same paper forward to the viewer. Two ordinary hands belonging to the viewer enter from below and take its two lower corners. Show real contact and weight transfer. The man lets go ONLY after the viewer securely holds it, and retracts both his hands. From then until the end, the viewer keeps this same paper. No repeated transfer. Crucially, the ONLY surface of this paper ever seen by the camera is its plain, COMPLETELY BLANK REVERSE. The side with any marks ALWAYS faces away from the camera toward the man. Never rotate the front toward the lens. No writing, lines, ink, stamps, letters, symbols, diagrams, titles, subtitles, labels, cards or UI appear anywhere. Keep the paper at a natural oblique angle, a little below the man's face; no giant page covering the frame. Fibers and creases are visible, normal fingers, coherent hands, no hands passing through paper. Timing: 0-2 seconds finish drawing the paper; 2-5 seconds offer and recipient takes the paper; 5-6 seconds man releases and withdraws; 6-10 seconds quiet eye contact while recipient steadily holds the blank reverse in the foreground. He does not point yet. His mouth stays closed throughout: no speech, no narration, no vocal sound. Only synchronized cloth and paper rustles, tent wind. No music, no BGM, no score. No masks, blur patches, mosaic, local defocus, black boxes, color rectangles or editorial overlays.'''
save(O/'requests'/f'{cid}.local.json',dict(model='MiniMax-H3',duration=10,resolution='768P',ratio='16:9',content=[dict(type='text',text=prompt),dict(type='image_url',image_url=dict(local_path=str(ref)),role='first_frame')]))
p=rd(O/'repair-plan.json')
if not any(x['id']==cid for x in p['clips']):p['clips'].append(dict(id=cid,slot='V12',name='用户新标准真实纸背交付',duration=10,referenceKeys=['v12_user_clean'],sourceLines=[],entryState='苟安决定暂留，凭据在其怀中。',endState='凭据已实际转至我的手中；苟安已放手。',shots=[dict(start=0,end=10,action='取同一张凭据，递出，我双手接稳，苟安放手，纸背始终朝镜头，保持持有。',camera='伤帐第一视角连续单镜',lines=[])],audioMode='silent-action-existing-dialogue-in-post',repairOf='V12-01',reason='仅替换新标准命中的旧纸面模糊层，保留真实取/递/接/放手，不露原伪字。'))
save(O/'repair-plan.json',p)
(O/'prompts'/f'{cid}.md').write_text(f'''尺寸：16:9
模型：seedance2.5
声音：有声音
时长：10秒

参考图按实际上传顺序

图片1：{ref}
用途：未叠层原片的苟安身份、伤帐空间、服装、日光和正在取凭据的唯一首帧。SHA256：{sha(ref)}

视频生成Prompt

分镜1｜0-10秒

参考图关系：图片1负责苟安身份、服装、伤帐与卧榻、光照和取凭据首帧；纸张只延续纤维与折痕材质，不能生成文字内容。

画面动作：0-2秒取出同一张折纸；2-5秒递至我伸来的双手，我接稳两角；5-6秒苟安确认我承重后完全放手、收回双手；6-10秒我持续持同一张纸，苟安安静望向我。纸的完全空白背面始终朝镜头，有印迹的正面永远背向镜头。真实承重、接触和手指，禁止再次递交或拿回。

摄影切点：同一伤帐第一视角连续单镜，纸略低于苟安脸部并保持自然斜角，纸边/手部清楚，无剪辑卡片。

声音执行（控制说明，不朗读）：无人声；既定原句后期另行保留，不把台词或角色标签交给本次画面生成。

唯一允许发声的原句：无。禁止新增对白、旁白和任何控制文字的朗读。

连续性约束：凭据从苟安怀中实际交给我，放手后一直归我持有；不新增证据事实。无字、无印章、无框线、无标签、无字幕或UI；无阴影补丁、局部模糊层、黑框或马赛克。

拍摄手法参考：沿用本组已核验《1917》的连续空间观察方法，应用于单镜中的真实接触、递交与手部承重；不做第三人称反打。

声音要求：全片无BGM、无背景音乐、无配乐；只留同步纸张/衣料摩擦与轻微帐布风声。无对白，禁止新增人声。
''',encoding='utf-8')
print(cid,'prepared; no repeated POST')
