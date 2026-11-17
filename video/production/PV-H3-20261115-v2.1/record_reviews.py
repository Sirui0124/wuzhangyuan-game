from pathlib import Path
import json,datetime
R=Path(__file__).resolve().parent
reviews={
'H01':{'method':'viewed 2fps contact sheet across entire source; technical full decode; automatic speech locator','findings':['近岸渡船和士卒保持小比例，远岸火线与山体纵深清楚。','向右横移有芦苇视差，水面与火线均有变化；不是静态图。','ASR未返回可转写片段。'],'decision':'candidate','audio_review':'尚未完成完整人工听审；无对白不等于已证明无BGM'},
'H02':{'method':'viewed 2fps contact sheet across entire source; automatic speech locator','findings':['脸和托印掌在前段共同可见，身份保持。','后段擅自溶接到参考2掌心特写，不能把溶接纳入成片。','ASR检测到目标句的同音转写，末句延伸到约7.3秒，不能按原6秒预算截断。'],'decision':'use clean face portion then hard cut to handover with continuous speech, or targeted replacement if continuity fails','audio_review':'目标对白待实际听看核对；不将机器同音转写直接作字幕'},
}
for i,v in reviews.items():
 p=R/i/'director-review.json'
 if not p.exists():p.write_text(json.dumps({'version':'v2.1','user_approval':'pending',**v},ensure_ascii=False,indent=2),'utf-8')
print('Recorded actual inspections; user approval remains pending.')
