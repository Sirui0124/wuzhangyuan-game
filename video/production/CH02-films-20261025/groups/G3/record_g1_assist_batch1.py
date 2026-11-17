from pathlib import Path
import json,datetime
O=Path(__file__).resolve().parent;p=O/'review/G1-template-assist-review.json';d=json.loads(p.read_text(encoding='utf-8'))
findings={
'L01-01':dict(visualReview='不能整段用作稳定闭口循环；可免费取前段',findings=[dict(time=[0,4.5],issue='闭口为主，但约1.5秒后镜头持续横移/推近，姿态和视线逐步下移；不是首尾同姿态。'),dict(time=[4.7,10.125],issue='出现开口，后半转明显侧脸，帐外白帐篷和树景进入背景；不宜将完整10秒标成闭口循环。')],usableWindows=[dict(start=0,end=1.5,purpose='稳定正面闭口短反应，供G1评估柔和往返/叠化循环'),dict(start=0,end=4.5,purpose='非循环的短听者反应，允许自然低头和摄影移动')],freeEditSuggestion='优先从0–1.5秒构造短呼吸循环，交G1复核循环接缝；也可将0–4.5秒作为非循环反应。无需因临时口型/音频自动付费重拍。',loopReady=False),
'V11T-01':dict(visualReview='制作自查可用，待G1采用/用户review',findings=[dict(time=[0,11.542],issue='同一日间伤帐与人物，前倾和微推近自然；自然开口回应，无额外人脸、物件、伪字幕或站立离榻。')],usableWindows=[dict(start=0,end=11.542,purpose='完整回应画面')],freeEditSuggestion='保留全段，做中央16:9小幅裁边即可；只接V12，不拼其他V11互斥模板。'),
'V11D-01':dict(visualReview='需免费裁掉取出计划外物件的尾部',findings=[dict(time=[0,6.0],issue='短暂低头、抬上身靠近说话，仍留榻上；身份/昼夜稳定，没有交付新物件。'),dict(time=[6.2,9.417],issue='下方举起并保留黑色系绳小袋状物，源脚本没有该物件；改变该模板状态。')],usableWindows=[dict(start=0,end=6.0,purpose='无新物件的完整表演窗口，待统一配音排句')],freeEditSuggestion='优先取0–6.0秒；为完整保留“你肯替我遮掩，我领情。可遮过这一回，下回呢？”由G1结合最终统一配音核时，必要可轻缓速/短静帧接尾，不删原句。不要仅裁下沿而保留伸取动作。'),
'V11A-01':dict(visualReview='需免费移除前段伸出计划外物件',findings=[dict(time=[0.8,3.05],issue='右前景伸出一个黑色棕色小物件并有手交接感，与本模板不递物/留V12交付的要求不符。'),dict(time=[3.15,8.0],issue='物件退出后为清晰自然开口，人物和背景稳定，无额外人脸/伪字幕。')],usableWindows=[dict(start=3.15,end=8.0,purpose='自然开口回应，足够15字左右源句的常态配音时长，仍须G1核最终语速')],freeEditSuggestion='优先取3.15–8.0秒作为回应底片，源句完整保留到统一配音；不要提前表现领取凭据。')
}
durations={'L01-01':10.125,'V11T-01':11.542,'V11D-01':9.417,'V11A-01':8.0}
for id,notes in findings.items():
 row=d['clips'][id];row.update(notes);row.update(actualPlayback=True,playback=dict(duration=durations[id],played=[[0,durations[id]]],ended=True,method='本地浏览器完整静音播放＋3fps全时段序列＋动作点截图，非逐字听审'),recommendPaidRegeneration=False)
d['updatedLocal']=datetime.datetime.now().astimezone().isoformat();d['batch1Complete']=list(findings)
row=d['clips']['L01-01']
row['usableWindows']=[dict(start=0,end=4.5,purpose='非循环的短听者反应，允许自然低头和摄影移动；可评估适度慢放')]
row['freeEditSuggestion']='只建议0–4.5秒非循环反应，或经G1核对后适度慢放；本轮不允许一两秒反复循环凑长。游戏若需循环玩法，需另设计自然完整循环，当前片不能当作完整循环交付。'
row['withdrawnSuggestion']='已撤回0–1.5秒柔和往返/叠化循环建议；本轮不得以短循环凑时长。'
p.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8');print('Batch 1 saved: '+', '.join(findings))
