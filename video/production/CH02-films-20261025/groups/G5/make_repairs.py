from pathlib import Path
import json,copy
OUT=Path(__file__).parent
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,x):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,ensure_ascii=False,indent=2),encoding='utf-8')
base=read(OUT/'plan.json')['clips'];comp=read(OUT/'references/composition-manifest.json')['byId']['gouan-tent-desk']
specs={
'V32A-02':('第一帧即苟安在夜间伤帐低案后坐稳，只他一个人。他看着摄影机说：“那就把纸铺开。”说完闭口，把视线落到案面，不伸手、不拿纸、不拿笔、不写字。','原片约2.8秒后有旁人躯干并转第三视角；字幕需消除'),
'V32A-03':('第一帧即苟安在夜间伤帐低案后坐稳。只有他一个人看着摄影机说：“你救不了这次北伐，也不一定保得住我。”说完闭口，保持坐姿等对方回答，全程不拿笔、不写字、不站起。','原片提前动笔、右侧人物躯干与武器入镜、第一视角失败'),
'V32A-04':('第一帧即苟安在夜间伤帐低案后坐稳，只有他一个人看着摄影机，嘴唇自然合拢。他安静听着、略微呼吸，表情克制；全片无说话、无伸手、无书写、无纸张运动、无站起。镜头全程保持中近景不低头。','原片约1秒后代玩家写字，并将制作提示画成纸面文字，无法作闭口听者'),
'V32A-05':('第一帧即苟安在夜间伤帐低案后坐稳。只有他一个人看着摄影机说：“愿意，我留下待核，不去魏国，也不散谣。”说完闭口，轻轻把案上纸边按平后停住，全程不拿笔不写字。','原片提前成文并纸上生成制作编号、另一人躯干入镜'),
'V32A-06':('第一帧即苟安在夜间伤帐低案后坐稳。只有他一个人，安静拿起案上的毛笔；摄影机从我双眼位置轻轻向下看他的右手，笔尖接触纸面写下少量细小模糊墨迹。纸放在同一张低案上，手不穿纸，笔不悬浮，不要生成能读出的正文或编号；最后提笔停稳。','原片书信制作信息与文字准确性需看出片后确认；仅在明确画面问题时采用返修'),
'V32A-07':('第一帧即苟安在夜间伤帐低案后坐稳。只有他一个人，摄影机从我双眼位置缓慢低头看对面苟安的右手；他用毛笔在已有的一行细小模糊墨迹上画一道清楚横线，提笔，移到纸面下方连写两笔作为署名，提起放到笔搁，手离开。全程不出现观看者肩背，纸始终在桌面，笔尖接触纸。墨迹只是动作纹路，不要生成可读字或编号。','原片灰衣肩背遮镜，纸面大片乱码且划去赴魏安排不清楚')}
repairs=[]
for parent,(action,reason) in specs.items():
    old=next(c for c in base if c['id']==parent);c=copy.deepcopy(old);c.update(id=parent+'-R2',parentId=parent,status='planned-visual-repair',visualRepairReason=reason)
    if parent=='V32A-06':
        # This draft is held until original has actually been reviewed.
        c['holdPendingOriginalReview']=True
    prompt=f'16:9历史电影实拍，蜀汉夜间伤帐，低饱和墨灰土褐麻白，自然肤色，小灯真实暖光，暗部清楚。严格沿用唯一首帧中同一苟安的脸、黑巾短须灰麻衣、木榻、右后悬甲及低案。{action} 全片{c["duration"]}秒只有一个连续镜头，不切空景，不反打，不出现第二人躯干，不增加武器或其他人。No subtitles, no on-screen text. 不生成字幕、编号、片名、水印、黑边。'+('没有人声，只有轻微布料、纸笔与环境声。' if not c['generatedSpokenLines'] else '只准苟安说上述原句，其余无人声。')+'全片无BGM、无背景音乐、无配乐、无吟唱、无鼓点。'
    local=OUT/'requests'/f'{c["id"]}.local.json'
    if not (OUT/'tasks'/f'{c["id"]}.json').exists():save(local,dict(model='MiniMax-H3',duration=c['duration'],resolution='768P',ratio='16:9',content=[dict(type='text',text=prompt),dict(type='image_url',image_url={'local_path':comp['path']},role='first_frame')]))
    md=f'尺寸：16:9\n模型：MiniMax-H3\n声音：有声音\n时长：{c["duration"]}秒\n\n## 参考图\n\n1. 图片1｜苟安夜间低案构图首帧\n   本地路径：`{comp["path"]}`\n   用途：中央苟安同脸、黑巾短须灰麻衣、伤帐、夜间灯与低案。\n\n## 视频生成 Prompt\n\n### 分镜1｜0-{c["duration"]}秒\n\n参考图关系：图片1为实际first_frame，锁身份、空间、机位与夜间光向，不混用其他参考图。\n\n画面与动作：{action}\n\n摄影与切点：我双眼位置，中近景或按动作低头，不反打，无第二人躯干。\n\n连续性与限制：{reason}；返修只针对画面，不为纯音频问题重拍。\n\n拍摄手法参考：《影》保留低饱和中的自然肤色（ASC访谈 https://theasc.com/article/dual-nature-shadow/ ），用于本镜人物与灯火；《1917》按实际动作耗时安排机位（ASC访谈 https://theasc.com/article/lives-under-siege-the-goldfinch-and-1917/ ），用于本镜视线变化。\n\n声音要求：全片无BGM、无背景音乐、无配乐、无吟唱、无音乐鼓点。只留上述原句及当前实际发生的布料/纸笔/环境声，无新增人声；无对白段完全无人声。\n'
    (OUT/'prompts'/f'{c["id"]}.md').write_text(md,encoding='utf-8')
    repairs.append(c)
save(OUT/'repair-plan.json',dict(group='G5',phase='visual-repairs',clips=repairs))
print('Prepared',len(repairs),'visual repair candidates; V32A-06 held for original review; no paid task submitted')
