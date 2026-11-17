from pathlib import Path
import json,sys
OUT=Path(__file__).parent
def read(p):return json.loads(p.read_text(encoding='utf-8'))
plan=read(OUT/'production.json');extra=[]
for oldid in ['G10Q','G14Q']:
    original=next(c for c in plan['clips'] if c['id']==oldid)
    id=oldid+'R2';c={**original,'id':id,'duration':4,'supersedes':oldid,'postAudio':'player voice, exact source row only','rows':original['rows']}
    p=read(OUT/'requests'/(oldid+'.local.json'));p['duration']=4
    person='年轻的传令文书乙，黑软巾深灰布衣，手持文书' if oldid=='G10Q' else '中年亲兵，黑布包髻、短须和旧铁札甲'
    p['content'][0]['text']=f'4秒，16:9真人历史电影。一名{person}站在将军帐前，正面胸像，仅这一个人入画。镜头是对面来访者的眼睛，画面没有来访者的头、后脑、肩背、手或长矛。此人正在安静听对面的人讲话，整个4秒嘴唇保持自然合拢，从看手中文书缓缓抬眼至摄影机，收在专注倾听的神情。只做真实呼吸和小幅眼神变化，不点头、不张嘴。图片1仅锁此人的脸与衣服，图片2只锁背景帐篷和灯架，不复制图中其他人和手。低饱和墨灰与麻白，真实肤色，侧向火光。固定50mm中近景，不推拉、不环绕、不剪镜。没有对白、没有旁白、没有人声、没有音乐，只有轻风、帐布和衣料声。严禁任何人物张嘴，后期另配来访者画外声音。无字幕、文字、水印、黑边。'
    (OUT/'requests'/(id+'.local.json')).write_text(json.dumps(p,ensure_ascii=False,indent=2),encoding='utf-8')
    extra.append(c)
for c in extra:
    if not any(x['id']==c['id'] for x in plan['clips']):plan['clips'].append(c)
(OUT/'production.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2),encoding='utf-8')
print('Prepared two silent listening retakes; voice will use the configured player TTS, no metadata in speech.')
