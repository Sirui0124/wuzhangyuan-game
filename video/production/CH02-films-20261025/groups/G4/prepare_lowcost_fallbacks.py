from pathlib import Path
import json
OUT=Path(__file__).resolve().parent
p=OUT/'review/selection.json';d=json.loads(p.read_text(encoding='utf-8'))
def generated(cid):return str(OUT/'generated'/f'{cid}-16x9.mp4')
for cid in ['V26-02','V26-04','V26-08','V26-09']:
    d[cid]=dict(hold=True,review='待统一服务恢复与单条最简画面试片；原片存在可见乱码/错误证物，不进入增量成片')
d['V26-01']=dict(source=generated('V28A-01'),start=0,end=5.9,review='只读复用同日间同伤帐同姿势V28A01闭口0–5.9秒，去掉原版越肩字纸；已有原玩家音轨完整配入。')
d['V26-05']=dict(source=generated('V29-01'),start=0,end=4.46,crop=[320,360,640,360],review='复用同场无字案头第一视角，不露军吏口部，原玩家问句保留于配音索引；不是交案动作。',audioIssues=['来源V29-01疑似额外人声，需统一配音，当前只交画面候选'])
d['V27-02']=dict(source=generated('V28A-01'),start=0,end=6.25,speed=.75,review='同场同脸日间卧榻闭口段0–6.25秒，0.75倍均匀放慢为8.33秒，不循环、不新增剧情，承载6.62秒既有玩家原句。')
d['V27-04']=dict(source=generated('V28A-01'),start=0,end=5.9,crop=[112,0,1056,594],review='复用同场完整闭口段并收紧景别；移除原越肩递乱码纸动作，完整原玩家音轨4.60秒。')
d['V28B-01']=dict(source=generated('V28A-01'),start=0,end=6.25,speed=.8,crop=[112,0,1056,594],review='同场闭口段0.8倍均匀放慢为7.81秒，承载6.19秒原玩家句；没有原版递字纸/新增人物。')
d['V29-06']=dict(start=0,end=8,crop=[112,0,1056,594],review='仅裁掉底部烧录字幕，保留军吏完整句子和脸部动作，不删追责/撤案风险。')
d['V29-07']=dict(source=generated('V29-01'),start=0,end=4.46,speed=.8,crop=[320,360,640,360],review='同场无字案头画面0.8倍为5.58秒；去掉原纸面乱写，NPC不对心声作反应。',audioIssues=['来源V29-01疑似额外词，保留标记待统一配音，不因此重拍'])
d['L02-01']=dict(source=generated('V28A-01'),start=0,end=6.25,speed=.75,review='原L02任务因参考图下载失败；无新增请求，只读复用同场日间闭口段为8.33秒听者候选，0.75倍均匀放慢，不循环口型。非夜间，不适用于夜间坐案。',audioIssues=['不预录玩家自由句；环境声未听审；长输入续播方式留后续游戏整合'])
p.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8');print('fallback selections ready')
