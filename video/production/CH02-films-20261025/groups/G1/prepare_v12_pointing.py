from user_repair import *
cid='V12-UR2-point';ref=O/'references/V12-user-held-paper-first.png';run(['-ss','6.5','-i',O/'edited/V12-UR1-normalized.mp4','-frames:v','1',ref])
b=rd(O/'reference-bindings.json');b['v12_user_held']=dict(path=str(ref),sha256=sha(ref),ready=True,purpose='上一条已完成接稳放手后的同一纸背、我的双手和同一伤帐首帧');save(O/'reference-bindings.json',b)
prompt='''Six seconds, realistic historical film, continue the EXACT first-person shot in image 1. The viewer already holds the SAME folded paper securely by its lower corners. Ownership has already transferred: the man NEVER takes the paper back or hands it over again. The camera sees ONLY the blank, unmarked paper reverse, identical fibers and folds to image 1. Never turn the written front towards the camera. 0-1 seconds hold this same position. 1-3 seconds the grey-robed man leans forward slightly and brings his right index finger around the top edge to indicate a location on the OPPOSITE side of this same paper; from the camera only the fingertip near the top edge is visible, never penetrating the sheet. 3-4 seconds he retracts his hand completely. 4-6 seconds the viewer continues to hold the same blank reverse, gentle natural breathing motion. One ordinary sheet, two normal viewer hands, one normal pointing hand, no duplicate fingers. Same man's face and black head wrap, same linen tent and bed, same light and perspective. The mouth is closed throughout, no speech, no narrator, no vocal sound. Only paper and cloth rustles with gentle tent wind. No music/BGM/score. No writing, ink, letters, numbers, diagrams, frames, subtitles, labels, cards, UI, masks, blur patches, mosaic, shadows used for concealment, black boxes or overlays. No cut, no loop, no reverse.'''
save(O/'requests'/f'{cid}.local.json',dict(model='MiniMax-H3',duration=6,resolution='768P',ratio='16:9',content=[dict(type='text',text=prompt),dict(type='image_url',image_url=dict(local_path=str(ref)),role='first_frame')]))
p=rd(O/'repair-plan.json')
if not any(x['id']==cid for x in p['clips']):p['clips'].append(dict(id=cid,slot='V12',name='已接凭据后的真实指示',duration=6,referenceKeys=['v12_user_held'],sourceLines=[],entryState='凭据已在我手中，苟安已放手。',endState='苟安指示后收回手，我仍持同一凭据。',shots=[dict(start=0,end=6,action='我持续持纸背；苟安指正面上部一处并收手，不取回或再交。',camera='同一伤帐第一视角单镜',lines=[])],audioMode='silent-action-original-testimony-in-post',repairOf='V12-02',reason='新标准去纸面模糊层，保留接物后的指示顺序；无真实可采信伪文字。'))
save(O/'repair-plan.json',p)
(O/'prompts'/f'{cid}.md').write_text(f'''尺寸：16:9
模型：seedance2.5
声音：有声音
时长：6秒

参考图按实际上传顺序

图片1：{ref}
用途：上一条真实递交后，我已接稳同一纸张、苟安已放手的唯一首帧；负责人物、伤帐空间、纸背与双手、构图及日光。SHA256：{sha(ref)}

视频生成Prompt

分镜1｜0-6秒

参考图关系：图片1直接承接上一条已完成承重与放手的末状态；我仍持同一张纸，延续纸纤维/折痕、两手、苟安身份服装、卧榻、帐布和光照。纸背继续空白，不把任何文字生成进画面。

画面动作：0-1秒我双手稳持凭据；1-3秒苟安稍向前，右食指绕到纸上缘的另一面指示一处，镜头只见上缘附近的指尖，手指不能穿纸；3-4秒收回手；4-6秒我继续持同一纸。纸正面始终背向镜头，禁止取回或再次递交。

摄影切点：同一伤帐第一视角固定连续镜头，保留真实手部接触和轻微呼吸，无剪切、循环或倒放。

声音执行（控制说明，不朗读）：本次无人声；苟安原片合法口供另在后期保留，不把角色、动作或工作说明发给本镜发声。

唯一允许发声的原句：无。禁止新增对白、旁白及任何控制字段的朗读。

连续性约束：凭据已归我持有，苟安只有指示动作；不生成文书字句、村名、批次或任何事实；无文字、框线、编号、字幕、UI、卡片、局部散焦层、黑框、补丁或马赛克。

拍摄手法参考：沿用本组已核验《1917》的连续空间观察方法，应用于同一持纸状态中的真实指示和手部前后空间，不做第三人称反打。

声音要求：全片无BGM、无背景音乐、无配乐；只留同步纸张/衣料摩擦及轻微帐布风声。无对白，禁止新增人声。
''',encoding='utf-8');print(cid,'ready')
