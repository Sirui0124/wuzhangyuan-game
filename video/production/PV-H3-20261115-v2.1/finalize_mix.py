from pathlib import Path
import json
R=Path(__file__).resolve().parent;p=R/'final-edit.json';v=json.loads(p.read_text('utf-8'))
gains={'V01':7,'V02':-6,'V03':-3,'V04':1,'V05':1,'V06':0,'V07':9,'V08a':1,'V08b':0,'V09':7,'V10':-3,'V11':-1,'V12':-3,'V13':0,'V14':0,'V15':0,'V16':5,'V17':24,'V18':3,'V19':4,'V20':4,'V21':4}
for s in v['shots']:
 s['gain_db']=gains[s['id']]
 if s['id']=='V21':s.update(sound_fade_at=.7,sound_fade_duration=.3)
v['mix_notes']=['按实际RMS与峰值调整对白和环境的场景级增益；保留动态，不将每镜拉成同响度。','削低骑行对白6dB，开篇环境提高7dB；细小动作与衣料适当补偿。','救人原生声音从暗场连续进入，起身后的短呼气延续到片名，1秒内自然淡出。','全片无音乐素材轨；排除已筛出配乐的原生声床。']
p.write_text(json.dumps(v,ensure_ascii=False,indent=2),'utf-8')
