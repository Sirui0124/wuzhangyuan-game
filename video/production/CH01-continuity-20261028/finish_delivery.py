from pathlib import Path
import json, hashlib, re, html
from PIL import Image, ImageDraw, ImageFont
O=Path(__file__).resolve().parent;R=O.parents[2]
P=json.loads((O/'audit/generation-plan.json').read_text(encoding='utf-8'))
I=json.loads((O/'audit/inventory.json').read_text(encoding='utf-8'));B={x['index']:x for x in I}
S_TEXT={x['id']:x['text'] for x in json.loads((R/'content/chapters/wuzhang/chapter-one.script.json').read_text(encoding='utf-8'))['rows']}
def link(p,label):return f'[{label}](<{Path(p).as_posix()}>)'
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',23)
small=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',18)
pairs=[
 ('斥候连续问答：棚外忽然变成棚内','05-9.875.jpg','06-0.125.jpg','C1T02-03 9.875秒','C1T03 0.125秒'),
 ('乙说明接报人：帐前变成木栏外','13-11.000.jpg','13-12.500.jpg','C1T10 11.000秒','C1T10 12.500秒'),
 ('去迎魏延：夜色退回暮色','16-3.500.jpg','16-5.000.jpg','C1T16-13 3.500秒','C1T16-13 5.000秒'),
 ('向姜维请求：近帐门变成远营地','23-8.000.jpg','23-9.500.jpg','C1T14-request 8.000秒','C1T14-request 9.500秒'),
 ('姜维答复后：摄影机突然远离大帐','29-24.500.jpg','29-26.000.jpg','C1FIX15 24.500秒','C1FIX15 26.000秒'),
 ('返回片尾内部：亲兵瞬间由右后换到左后','24-12.250.jpg','24-12.375.jpg','C1T18-walk 12.250秒','C1T18-walk 12.375秒')]
for n,(title,a,b,la,lb) in enumerate(pairs,1):
 canvas=Image.new('RGB',(1280,430),'#1c1c1c');d=ImageDraw.Draw(canvas)
 d.text((16,8),title,font=font,fill='white')
 for i,(f,label) in enumerate([(a,la),(b,lb)]):
  canvas.paste(Image.open(O/'audit/frames'/f).resize((640,360)),(640*i,45));d.text((640*i+12,408),label,font=small,fill='white')
 canvas.save(O/f'audit/对照{n:02d}.jpg',quality=93)

replaced={i for p in P for i in p['indices']}
report='''# 第一章视频连续性审核与替换建议

2026-10-28。本次建议替换14段现用视频，整理成12条生成请求，全部20—30秒，共300秒素材。重拍集中在传报处、向甲乙问讯、请姜维接报及往返带路；开场、重生、清晨问责与两条后续结局本轮保留。

我检查了游戏当前清单中的34条第一章影片，以每1.5秒一帧加首尾帧覆盖时间范围，对8处疑点补充每0.25秒一帧。审核重点是相邻镜头的空间、站位、人物身份、光线和道具；这不是逐帧播放或逐字听审，也不是用户批准。原片路径、SHA256和抽样时间保存在本目录 audit/inventory.json，本文时间码全部对应那里列出的现用文件。

在线协作原则修订39与本地副本一致；已读取视频制作台账修订223，保留原有意见和状态。旧在线Prompt的状态不代表这批新稿。本次新稿为待review，新视频尚未生成；游戏绑定、声音、字幕和存档均未改动。

## 需要替换什么

“优先替换”包括明确位置跳变及需要补足的接镜；“配套替换”表示自身未必有硬错误，但必须随相连片段统一夜色。普通景别变化、甲乙自由调查的场景切换、死亡后重生和明确的昼夜跳转，不按穿帮处理。

| 请求 | 时长 | 替换的现用段 | 处理 |
| --- | ---: | --- | --- |
'''
for p in P:
 report+=f"| {link(p['file'],p['code']+' '+p['name'])} | {p['duration']}秒 | {'、'.join(B[i]['id'] for i in p['indices'])} | {p['priority']} |\n"
report+='\n## 对照画面\n\n'
for n,(title,*_) in enumerate(pairs,1):report+=f"### {title}\n\n![{title}](<{(O/f'audit/对照{n:02d}.jpg').as_posix()}>)\n\n"
report+='## 逐条理由和剪裁边界\n\n'
for p in P:
 report+=f"### {p['code']} {p['name']}\n\n{p['problem']}\n\n{p['fix']}\n\n生成与剪裁：{p['edit']}\n\n"
 for i in p['indices']:
  x=B[i];report+=f"现用片：{link(x['path'],x['id'])}（{x['duration']:.3f}秒）；{link(O/f'audit/{i}-contact.jpg','全时段抽样画面')}"
  if (O/f'audit/{i}-detail.jpg').exists():report+='；'+link(O/f'audit/{i}-detail.jpg','0.25秒疑点图格')
  report+='。\n\n'
report+='''## 一轮生成时如何保持连续

本批两张新参考图分别固定“夜间传报棚里的魏延”和“中军帐前的姜维与亲兵”。同场每条都使用同一张场景图；人物身份图不再决定摄影机位置。其余11张是原片提帧或现有场景图，未重绘人脸，来源见参考图文档。

R07抵达中军帐后，亲兵在左、姜维在右；R08结束前这两个位置不变。R09把亲兵从左侧带入前方营道，抵达传报棚时亲兵在右、魏延在左。R10保留这个位置；R11沿同一路线返回，亲兵走在右前方，所以到达后留在姜维右后方。R12也保留右后方位置，随后用较近景别自然把亲兵排出画面，接现用下令镜头。空间变化通过真实行进完成，不靠一句“保持连续性”让模型自行猜测。

在R07约7秒和R09约18秒预留拆条位置，按游戏原有节点分别剪入。素材一条20—30秒，不代表玩家必须连续看完这整条才有操作机会。R09末尾仍是玩家自由发言；R10按原判定选播；带路确认后才播放R11。不要把玩家的自由回答或AI动态结果写进固定生成片。

20—30秒包含正常步行、转头、听完后的反应和接镜余量。后续可剪掉多余等待，保留真实动作和完整原句；不通过拖慢说话、冻结人物或循环动作凑时长。复用现有玩家声线时，要按新画面的口型与动作重新对齐，时长变化则声音与画面一起调整。

生成后先对照参考图核验人物、灯架、门帘和告示位置，再连着看“上一段末尾3秒—本段—下一段开头3秒”。若模型做出了少量位置偏移，先选新片中位置正确的可剪区间；明显穿墙、换脸、NPC代说玩家台词仍需重生成，不能用遮挡补丁或改字幕掩盖。

## 本轮保留的部分

'''
retain={
 '01':'现代回忆是有意的时间与场景跳转，原回忆段保留。开篇掀帘到灯灭本轮抽样未定位出需新增整段重拍的明确站位问题。',
 '02':'同袍画外提醒、抬眼守营可保留；与下一条近景是省略接近距离的剪辑，可先用接镜处理。',
 '03':'作为帐门、火盆和右侧告示的布局依据保留。',
 '04':'走近右侧告示的运动成立。精确文字继续由游戏信息层显示。',
 '06':'棚内回答保留；由R01负责补足走进棚口的过程。',
 '07':'另一互斥回答保留；不与营门问答串播。',
 '09':'甲的现用换声版保留。问句切帐门空镜的观感可剪辑改善，本轮不据此整片重拍。',
 '11':'纯黑场死亡心声按原设计保留。',
 '12':'死亡后回到暮色是重生；甲离开画面有可见运动。',
 '14':'作为乙的固定机位保留，R04结尾向它对齐。',
 '15':'斥候继续汇报的机位保留，R05向它对齐。',
 '19':'下令主体站位保留。R12补足递卷动作，并向它的首帧对齐。',
 '20':'复述及魏延离开保留。离开后看向帐门为可理解的视线切换，不恢复曾弃用的误入帐版本。',
 '27':'乙倾听问题的近景保留，R04继续同一帐前问答。',
 '28':'将军帐闭帘保留；R07由同位置转头露出亲兵。',
 '30':'成功后的天亮与松手按剧情保留，不把时间跳转当错。',
 '31':'未获营门信息的互斥转呈版本保留，不把另一分支“营门未破”补进来。',
 '32':'问责时为次日，立矛及收矛保留，不重做成横拿。',
 '33':'七日后灯存与诸葛亮动作保留。',
 '34':'病中军务与帐外姜维为后续叙事场景；本轮不按同一对话连续性强制重拍。'}
report+='| 现用段 | 本轮判断 |\n| --- | --- |\n'
for x in I:
 if x['index'] not in replaced:report+=f"| {x['id']} | {retain[x['index']]} |\n"
report+='''
“保留”只代表本次没有列入连续性重拍清单，不替代声音、逐帧细节或用户实审。第一章失败处刑目前使用静态演出，execution清单为空，未把旧停用处刑片重新纳入制作。第二章预览LI01—LI04也不计入这34条。

## 生成以外的接镜事项

游戏有独立的阅读页、对话背景和视频结束静态图配置。源码中 story-films.ts 会在部分结束状态使用 endFrame，另一些状态回到阅读页；这些转换的实际观感还需游戏内连播核验。本轮没有运行完整游戏实测，也没有把可能来自界面切换的闪动全部归咎于原片。新片接入时应同步检查静态背景与新尾帧的站位，重生成本身不能证明界面接镜已经修好。

## 拍摄参考依据

《影》的摄影访谈明确谈到克制而有意图的机位运动，以及服装、布景和人物肤色的统一；本批把这个方法用于减少无动机反打和大幅绕拍。[ASC《影》摄影访谈](https://theasc.com/article/dual-nature-shadow/)

《1917》的摄影访谈说明，拍摄前根据演员路线、到达距离、对白和时间决定机位，并用回放核对镜头两侧的人物位置与摄影机速度；本批把这个方法用于亲兵带路和魏延返回。[ASC《1917》摄影访谈](https://theasc.com/article/lives-under-siege-the-goldfinch-and-1917/)
'''
(O/'00-第一章连续性审核与替换清单.md').write_text(report,encoding='utf-8')

rd='''# 第一章重拍参考图与上传顺序

2026-10-28。本批13张参考图：2张通过内置imagegen基于现片生成的夜景场面图，10张现用影片直接提帧，1张原有将军帐图。新图为待review参考，不是已完成的视频；其余图片保留原始内容，没有用裁图或遮挡补丁制造审核结论。

每份Prompt内的“图片1、图片2……”只在该文档内生效。生成时只上传该条列出的图片，按文中顺序，不把这13张全部混投。审核对照图含时间码与标题，只用于看问题，不作为视频参考上传。

'''
for n in ['传报棚魏延夜景','中军帐姜维亲兵夜景']+[p.stem for p in (O/'references').iterdir() if p.stem not in ['传报棚魏延夜景','中军帐姜维亲兵夜景']]:
 pp=next((O/'references').glob(n+'.*')); use=[p['code'] for p in P if n in p['refs']]
 rd+=f"## {n}\n\n{link(pp,'打开原图')}。用于：{'、'.join(use) if use else '身份核对备用，不需要额外上传'}。\n\n完整路径：`{pp.as_posix()}`\n\n![{n}](<{pp.as_posix()}>)\n\n"
rd+='## 每条上传清单\n\n| Prompt | 依次上传 |\n| --- | --- |\n'
for p in P:rd+=f"| {link(p['file'],p['code']+' '+p['name'])} | {'；'.join(str(i+1)+' '+n for i,n in enumerate(p['refs']))} |\n"
(O/'01-参考图与上传顺序.md').write_text(rd,encoding='utf-8')

edit='# 第一章重拍剪裁与接入映射\n\n12条生成请求共300秒；它们不是新的游戏流程。新视频收到后按下表剪分，再回到原有稳定ID与台词行。估计切点只指导生成，成片须以实际动作和声音定点，不能把预估秒数直接当字幕时间码。\n\n'
for p in P:
 edit+=f"## {p['code']} {p['name']}\n\n{p['edit']}\n\n"
 for idx in p['indices']:
  x=B[idx];edit+=f"- 原稳定ID：`{x['id']}`；覆盖行：`{'、'.join(x.get('rows',[]))}`。原文件：{link(x['path'],Path(x['path']).name)}。\n"
 edit+='\n'
edit+='新视频和旧视频分别保留。字幕从成片实际声音与时间码重新核对，不从旧VTT机械复制。换片后再检查首尾三秒、字幕、玩家声线和各原确认停点；技术解码、自动检查和助手看图均不等于用户批准。\n'
(O/'02-剪裁与游戏节点映射.md').write_text(edit,encoding='utf-8')

# Readback validation, with current-source drift check.
errors=[];checks=[]
current=json.loads((R/'GameStarter/web-demo/public/cinematics.json').read_text(encoding='utf-8'))
current_by={x['id']:x for value in current.values() if isinstance(value,list) for x in value if isinstance(x,dict) and 'id' in x}
for x in I:
 if current_by[x['id']]['src']!=x['src']:errors.append('Source changed: '+x['id'])
 if hashlib.sha256(Path(x['path']).read_bytes()).hexdigest()!=x['sha256']:errors.append('Video bytes changed: '+x['id'])
for p in P:
 text=Path(p['file']).read_text(encoding='utf-8');ranges=[tuple(map(float,m)) for m in re.findall(r'^### 分镜\d+｜([\d.]+)-([\d.]+)秒',text,re.M)]
 assert 20<=p['duration']<=30
 if ranges[0][0]!=0 or ranges[-1][1]!=p['duration'] or any(a[1]!=b[0] for a,b in zip(ranges,ranges[1:])):errors.append('Time gap: '+p['code'])
 if '{{' in text:errors.append('Placeholder: '+p['code'])
 if text.splitlines()[:4]!=['尺寸：16:9','模型：seedance2.5','声音：有声音',f"时长：{p['duration']}秒"]:errors.append('Header: '+p['code'])
 if not text.strip().split('\n\n')[-1].startswith('声音要求：'):errors.append('Final paragraph: '+p['code'])
 for n in p['refs']:
  if not list((O/'references').glob(n+'.*')):errors.append('Missing reference: '+n)
 for z in p['shots']:
  for rid in z['rows']:
   if S_TEXT[rid] not in text: errors.append('Missing source line: '+rid)
 checks.append(dict(code=p['code'],seconds=p['duration'],shots=len(ranges),references=len(p['refs']),sha256=hashlib.sha256(text.encode()).hexdigest()))
validation=dict(date='2026-10-28',currentSourceFilesChecked=len(I),prompts=len(P),replacementClips=len(replaced),seconds=sum(p['duration'] for p in P),errors=errors,checks=checks,userApproved=False,videoGenerated=False,gameChanged=False)
(O/'audit/validation.json').write_text(json.dumps(validation,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in validation.items() if k!='checks'},ensure_ascii=False))
