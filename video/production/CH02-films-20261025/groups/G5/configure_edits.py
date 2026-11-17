from pathlib import Path
import json
OUT=Path(__file__).parent
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,x):p.write_text(json.dumps(x,ensure_ascii=False,indent=2),encoding='utf-8')
plan=read(OUT/'plan.json')['clips'];d=read(OUT/'review/decisions.json')
def use(id,status='candidate-pass-with-limits',**kw):
    old=d.get(id,{})
    old.update(visualReview=status,**kw)
    old.setdefault('audioIssues',['尚未逐字听审；按用户要求保留画面，统一配音阶段处理'])
    d[id]=old
shared=OUT.parent/'G4/assembled/L02-定制②听者反应底片-闭口有效段.mp4'
for id in ['V32A-01','V32A-04']:
    use(id,sourceId='G4-L02-closed-effective',sourceFile=str(shared.resolve()),trim=[0,7.4],reuse={'authorization':'总控明确允许同组/协调后跨组闭口段剪辑替代；G4已协调只读引用','originalSource':'G4 V28A-01 0–6.25秒以0.75倍均匀放慢，G4有效段限制0–7.4秒','newPaidRequest':False},visualIssues=['听者半趴与相邻坐姿/起身镜头仍需用户审阅连续性；没有新增玩家正脸'],dynamicReview='G4已整片动态审；G5连续4fps复核同脸闭口，G5采用版待动态复核')
use('V32A-02',trim=[0,2.8],spatialCrop=[112,0,1120,630],visualIssues=['为去掉后段旁人躯干与字幕保留0–2.8秒；不是因音频重复缩短'])
use('V32A-03',trim=[5.5,8],visualIssues=['已裁去提前写字与右侧旁人段，保留正确苟安面部回应；此子片较短，后续完整配音需重新安排气口'])
use('V32A-05',trim=[0,3.38],visualIssues=['裁在纸上制作编号显露前；起身取纸动作保留，后续完整配音节奏待统一'])
c=next(x for x in plan if x['id']=='V32A-06')
use('V32A-06',postOverride=[dict(text=c['post'][0]['text'],start=3.2,end=8.9,fullFrame=True),dict(text=c['post'][1]['text'],start=8.9,end=14.38,fullFrame=True)],visualIssues=['实际书写镜头后用准确文书插入画面替换错误文字特写；保留原片可回溯'])
use('V32A-07','review-candidate-with-issues',postOverride=[dict(text='若仍不听便赴魏',start=0,end=4),dict(text='若仍不听便赴魏',start=4,end=7.8,strike=True),dict(text='苟安',start=7.8,end=9.42,signature=True,fullFrame=True)],visualIssues=['原片纸面乱码尚未完全清除','演员的划去动作未能清晰区分于书写；未声称实际划去演出已通过；必要画面修复仍待做'])
use('V33-01','candidate-pass',visualIssues=[])
use('V34-01',sourceId='V34-01-C1',sourceFile=str((OUT/'edited/sources/V34-01-C1.mp4').resolve()),visualIssues=['剪去被制作信息污染的纸面特写并裁字幕；保留读信与人物反应','原句声音将统一阶段完整处理，不以本次剪辑音轨冒充完整听审'])
use('V34-02',visualIssues=['按结局新授权保留信使越肩，未让玩家提前取得附件；纸面小字不作准确证据'])
use('V34-03',sourceId='V34-03-C1',sourceFile=str((OUT/'edited/sources/V34-03-C1.mp4').resolve()),visualIssues=['已删除双李严叠影与生成字幕，保留先回应后动笔'])
use('V34-04',postOverride=[dict(text='李严\n更正粮情、本人责任说明',start=10.8,end=12.25,fullFrame=True)],visualIssues=['结局允许信使背影；实际签署与交出动作保留','准确文书标题为后期字层；不把远方镜头等同玩家已收件'])
use('V35-01',sourceId='V35-01-C1',sourceFile=str((OUT/'edited/sources/V35-01-C1-return-handoff.mp4').resolve()),visualIssues=['V33 2.2–8.2秒画面倒放形成取卷与递回；已明确剪辑来源，不宣称新生成','信卷作为合在一起的回信/附件包，后续两片才展开核阅'],dynamicReview='IAB C1从头播放至尾、4fps逐时段核接触/松手；待与整V再次连看')
for id,t1,t2 in [('V35-02',3.8,8.0),('V35-03',4.2,9.0)]:
    c=next(x for x in plan if x['id']==id)
    end=12.25 if id=='V35-02' else 15.08
    use(id,postOverride=[dict(text=c['post'][0]['text'],start=t1,end=t2,fullFrame=True),dict(text=c['post'][1]['text'],start=t2,end=end,fullFrame=True)],visualIssues=['展开/并排核阅动作后采用准确文书插入画面，覆盖模型错误纸面字；后期字层不新增朗读','结局新授权允许背影与局部，未新增玩家正脸'])
for id in ['V36-01','V36-02','V36-03']:
    use(id,'review-candidate-with-issues',visualIssues=['收件/核实/宣读动作及人物稳定；原片纸面部分生成字形仍需精确替换或处理，未声称视觉完全通过'])
use('V36-04',trim=[7.5,12.25],visualIssues=['去掉挡镜、叠影及无功能递件段，只保留军吏宣读苟安裁处的清楚画面'])
use('V36-05',spatialCrop=[448,0,896,504],visualIssues=['局部重新构图裁去生成字幕与接收者面部；保留军吏身份与担责说明，未新增玩家正脸'])
use('V36-06',trim=[0,3.65],visualIssues=['实际退军令交到军吏手中后收束；裁去无法确认内容的蒙布车，避免暗示粮已补足'])
use('V37-01',visualIssues=['新授权允许结局环绕镜头，空车与普通粮兵苟安可用；尚不代表我已搭手'],dynamicReview='4fps全时段已检查，采用版待动态复核')
save(OUT/'review/decisions.json',d)
print('Editorial selections updated; visual issues remain explicit, original tasks untouched')
