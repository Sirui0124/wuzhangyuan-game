from pathlib import Path
import json,re
OUT=Path(__file__).resolve().parent
p=OUT/'plan.json';d=json.loads(p.read_text(encoding='utf-8'))
for c in d['requests']:
    npc=[l for l in c['lines'] if l['spoken'] and (l['speaker']=='苟安' or '军吏' in l['speaker'])]
    off=[l for l in c['lines'] if l['spoken'] and l not in npc]
    c['audioStrategy']='npc-generated-original' if npc else 'central-voice-over-environment' if off else 'environment-only'
    c['centralVoiceNodes']=[l['node'] for l in off]
    f=OUT/'prompts'/f"{c['id']}.md";s=f.read_text(encoding='utf-8')
    if off:
        s=s.replace('对白与口型：','后期统一配音与口型（本次视频只拍闭口底片，完全不生成人声）：')
        s=s.replace('逐字原句：','后期配音原句（此视频请求禁止念出）：')
        s=re.sub(r'声音要求：.*$', '声音要求：全片无BGM、无背景音乐、无配乐、无吟唱、无音乐鼓点。本次视频完全无对白、无旁白、无心声、无新增人声，只生成与画面同步的环境与动作声音。以上原句由中央统一player TTS在后期配入，所有画内人物必须全程闭口，不得对听不见的心声点头回应。保留衣料、卷束、帐布风声、脚步、车轮等实际可见动作声；没有对应动作就不添加。',s,flags=re.S)
    f.write_text(s,encoding='utf-8')
p.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8')
print('central-voice',sum(c['audioStrategy']=='central-voice-over-environment' for c in d['requests']))
