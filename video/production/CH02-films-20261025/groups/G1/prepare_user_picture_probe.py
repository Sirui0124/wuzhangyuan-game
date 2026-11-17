from user_repair import *
cid='V06-UR1';ref=O/'references/V06-user-clean-first.png';run(['-ss','0.1','-i',O/'edited/V06-01-normalized.mp4','-frames:v','1',ref])
b=rd(O/'reference-bindings.json');b['v06_user_clean']=dict(path=str(ref),sha256=sha(ref),ready=True,purpose='未叠层原片真实营帐案头与空白纸背构图；唯一首帧，不含伪字');save(O/'reference-bindings.json',b)
prompt='A realistic historical film shot, six seconds, continuous first-person eye view inside the exact same linen army camp tent as image 1. Natural daylight, real rough wood, linen and paper fibers. A single sheet of yellowish paper is already on the table. The hands belonging to the viewer gently grasp its corners and tilt it a little towards the viewer. The only visible surface is its completely unmarked, plain paper reverse, with natural fibers and folds. Keep the paper oblique; never turn the printed front towards the camera. The hands hold it steadily with small natural breathing movements. One real sheet, normal fingers, realistic contact and weight; all props and the same camp stay coherent. No other person enters. No writing, symbols, border lines, text cards, subtitles, labels, UI, overlays, shadows used as patches, blur rectangles or mosaic. No speech, no narrator, no vocal sound whatsoever. Only synchronized paper and cloth rustle and gentle tent wind. No music, no BGM, no score.'
body=dict(model='MiniMax-H3',duration=6,resolution='768P',ratio='16:9',content=[dict(type='text',text=prompt),dict(type='image_url',image_url=dict(local_path=str(ref)),role='first_frame')]);save(O/'requests'/f'{cid}.local.json',body)
plan=rd(O/'repair-plan.json');x=dict(id=cid,slot='V06',name='用户新标准纸背观察镜头',duration=6,referenceKeys=['v06_user_clean'],sourceLines=[],entryState='精确日期已由UI-DATE显示，原件仍在案头。',endState='我仅持同一纸的空白背面思索，无新增证据/状态。',shots=[dict(start=0,end=6,action='双手从案头拿起同一张纸，镜头仅见空白纸背与斜角纸边，稳定持有。',camera='同一营帐第一视角单镜，纸正面始终不入镜。',lines=[])],audioMode='environment-only-new-player-voice-in-post',repairOf='V06-01',reason='用户新标准禁止局部模糊遮字层；仅补必要真实道具观察画面。')
if not any(z['id']==cid for z in plan['clips']):plan['clips'].append(x)
save(O/'repair-plan.json',plan)
md=f'''尺寸：16:9
模型：seedance2.5
声音：有声音
时长：6秒

参考图按实际上传顺序

图片1：{ref}
用途：未叠层原片的真实营帐、案头、空白纸背、日光与第一视角构图。仅作本镜唯一首帧。SHA256：{sha(ref)}

视频生成Prompt

分镜1｜0-6秒

参考图关系：图片1负责同一营帐空间、案头与纸张位置、柔和日光和首帧。双手从镜头下方进入，纸背材质延续该图，不生成正面内容。

画面动作：双手拿起同一张纸，保持完全空白纸背朝向镜头，以斜角观察纸边和纤维，轻微呼吸动作，真实接触和承重。纸正面不展示，不新增人物或物件。

摄影切点：第一视角固定连续单镜，纸边/手指均清楚，0到6秒动作完整，结尾仍持纸。

声音执行（控制说明，不朗读）：无人声，纸与衣料动作声同步。既有心声另在后期复用，不发给生成模型。

唯一允许发声的原句：无。禁止对白、旁白、额外人声以及任何控制字段的朗读。

连续性约束：精确日期已在既定UI呈现，不在影片中另做字卡或账页摘要；纸背朝镜头、印字正面不可见，不允许工作文字、字幕、编号、框线、阴影补丁、模糊层或马赛克。

拍摄手法参考：沿用本组已核验《1917》的第一视角连续空间观察，应用于本镜自然手部接触与纸面持有；不做第三人称反打。

声音要求：全片无BGM、无背景音乐、无配乐；只留同步纸张/衣料摩擦与轻微帐布风声。无对白，禁止新增人声。
''';(O/'prompts'/f'{cid}.md').write_text(md,encoding='utf-8');print(cid,'prepared; one local picture probe only')
