import json
import time
from pathlib import Path
import pipeline as p

R=Path(__file__).resolve().parent
take='C1END-TENT-R2'
text='''16:9，12秒，一镜到底的历史电影实拍，低饱和夜营，火把局部暖光。严格延续首帧的三个人与帐后道路。镜头始终位于灰褐布衣男子身后，绝对不绕到他的身侧或身前。他的头、下巴和双肩全程朝画面深处，脸始终朝远离镜头的方向。他不回头，不转身。无字幕、标志、水印、配乐、人声。
0—4秒：灰褐布衣男子保持原地背对镜头。两名巡营军士在前方将路挡住，持火把者抬起空手示意停住，另一名军士看向道路深处。没有触碰帐布，没有看见帐内人物。
4—8秒：持火把的军士转身，先沿原有土路走向画面深处，火把远离帐布。灰褐男子仍只露完整后脑与背影，跟随他向画面深处走两步；第二名军士跟在男子侧后方一同行进。摄像机不动，人物自然变小。
8—12秒：三人继续沿土路远离摄影机，不改变行进方向，不回头，不转身，不横穿前景。火光随三人走远，前景只剩绳索与不透明的帐布。最后一秒平缓淡黑。完整12秒内无剪切、无反打。
衣甲、人数和道具不变，不新增兵器或证据，不展示刑罚，不泄露帐内秘密。灰褐男子从第一帧到最后一帧都背对摄影机，始终只见背影。
声音要求：全片无BGM、无背景音乐、无配乐、无吟唱、无对白、无旁白、无人声。只保留同步的踏土脚步、甲片轻碰、火把燃烧及风吹帐布声。'''
(R/'prompts'/f'{take}.api.txt').write_text(text,encoding='utf-8')
old=(R/'prompts/C1END-TENT-帐后有刀.md').read_text(encoding='utf-8')
head=old.split('## 视频生成 Prompt')[0]
tail=old.split('拍摄手法参考：',1)[1]
tail=tail.replace('应用于三镜的环境与人物照明','应用于本段连续镜头的环境与人物照明')
doc=head+'## 视频生成 Prompt\n\n### 分镜1｜0-12秒\n\n参考图关系：图片1固定三个人、服装、火把与帐后道路，作为真实首帧。灰褐背影代表我，不建立玩家面孔；两名巡营军士沿用图中面貌与衣甲。\n\n画面、动作与摄影：\n\n'+text.split('声音要求：')[0]+'\n对白：无。\n\n连续性：第一版转身露出新玩家侧脸，故本版取消转身与侧移。全程仅背影，单一方向行进。旧片保留但不采用。\n\n拍摄手法参考：'+tail
(R/'prompts'/f'{take}-帐后有刀.md').write_text(doc,encoding='utf-8')
body=p.read(R/'requests/C1END-TENT.json')
body['content'][0]['text']=text
p.api.atomic_json(R/'requests'/f'{take}.json',body)
adopt=p.read(R/'adoption.json')
adopt['C1END-TENT']=take
p.api.atomic_json(R/'adoption.json',adopt)
plan=p.read(R/'plan.json')
for s in plan:
    if s['id']=='C1END-TENT':
        s['prompt']=str(R/'prompts'/f'{take}-帐后有刀.md')
        s['apiPrompt']=str(R/'prompts'/f'{take}.api.txt')
p.api.atomic_json(R/'plan.json',plan)
log=p.read(R/'revision-log.json')
if not isinstance(log,list): log=[log]
log.append({'id':'C1END-TENT','rejectedTake':'C1END-TENT','reason':'约6–8秒玩家转身，出现未经设定的可辨侧脸；改为固定后方机位、全程背向单方向行进。','replacement':take})
p.api.atomic_json(R/'revision-log.json',log)
p.recovery_ready()
state=R/'tasks'/f'{take}.json'
if not state.exists():
    orig=p.api.poll_task
    p.api.poll_task=lambda path,**kw:orig(path,interval=120,max_polls=1)
    result=p.api.submit_request(R/'requests'/f'{take}.json',state)
    result['last_poll_epoch']=time.time()
    p.api.atomic_json(state,result)
    print(take,result.get('task_id'),result.get('status'))
else:
    print('Submission record exists; no duplicate POST.')
