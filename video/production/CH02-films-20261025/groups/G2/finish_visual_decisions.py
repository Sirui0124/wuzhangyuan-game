from pathlib import Path
import json
OUT=Path(__file__).parent
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,d):p.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8')
p=read(OUT/'plan.json');d=read(OUT/'review/decisions.json');o=read(OUT/'review/observations.json')
def line(id):return next(c for c in p['clips'] if c['id']==id)['sourceLines'][0]
d['V20-05']['version']='-R3'
same=line('V20-06');d['V20-07']=dict(version='-R3',knownTextPanel=dict(title='送达记录·已取得正文',text=same['text'],sourceNode=same['node'],start=4.25,end=8),review='前半仓中经手人回应，仓吏同框但未拍受杖或新签字；后半口头回答烧在纸面，4.25秒起用此前取得的同日送达记录准确正文覆盖，保留完整回应8秒。',audioIssue='原轨与口型待统一配音核验；双NPC同框视线有轻微偏离')
known=line('V18-02');d['V20-08']=dict(version='-R3',trimEnd=7.0,tailHold=2.0,knownTextPanel=dict(title='入仓收讫·已取得正文',text=known['text'],sourceNode=known['node'],start=3.3,end=11),review='原片7.3秒起生成假菜单按钮，取0–7秒真实核账动作并末帧静观2秒保留九秒原句空间；3.3秒后纸面口头反馈以已取得入仓原文覆盖。未播放假按钮，不新增游戏控件。',audioIssue='原轨与嘴动待统一处理，静观尾段环境声待补；未新TTS')
o['V20-07']='0–8秒仓中经手人拿起旧记录并说明，仓吏同框，人物视线略偏向对方；未演受杖或新签字。4.5秒起纸面烧入口头反馈，用此前同日送达记录正文覆盖。'
o['V20-08']='0–7秒仓吏取木牍、看账、指认；手与纸接触可用。7.3秒后生成假菜单，裁去并用7秒前账面静观补足九秒；纸面口头反馈改用已有入仓正文覆盖。'
save(OUT/'review/decisions.json',d);save(OUT/'review/observations.json',o)
print(len(o),'observed; final edits ready')
