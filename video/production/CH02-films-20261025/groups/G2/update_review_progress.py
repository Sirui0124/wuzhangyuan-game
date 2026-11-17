from pathlib import Path
import json,datetime
OUT=Path(__file__).parent
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,d):p.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8')
p=OUT/'review/browser-playback.json';r=read(p)
for id in ['V20-01','V20-02','V20-03','V20-04','V20-05','V20-06']:
    if id not in r['completedIds']:r['completedIds'].append(id)
r['lastObservedEventUtc']='2026-10-24T20:34:47.642Z';r['confirmedAtUtc']=datetime.datetime.now(datetime.timezone.utc).isoformat();save(p,r)
d=read(OUT/'review/decisions.json')
d['V13-02']['review']='手把凭据置案动作可保留；0.5秒序列与浏览器自然速度静音播放已检查，见具体观察记录。'
d['V14-02']['review']='0.5秒序列与浏览器自然速度静音播放已检查：裁0–4.8秒重复入仓与再次展开，保留停稳粮图，以准确五阶段流程示意沿领取处回看。'
d['V16B-01']['review']='原片多出案头与坐姿；改取同场V16B-02卧榻反应4.5–7.29秒，末尾闭口静止延长2秒承载3.79秒原玩家问句；不是嘴动循环。原NPC发言在V16B-02完整保留，重复反应源音轨静音后复用已有玩家WAV，不新合成。'
d['V20-05']['review']='0–3.95秒纸面出现口头回答，用此前已取得缺额报告原文覆盖；人物近景回应保留，完整7秒原句时长不缩短。'
save(OUT/'review/decisions.json',d)
o=read(OUT/'review/observations.json');o['V20-05']=o['V20-05'].replace('3.6','3.95');save(OUT/'review/observations.json',o)
print('Visible raw ended events recorded',len(r['completedIds']))
