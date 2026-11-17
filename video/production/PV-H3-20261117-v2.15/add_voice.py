from pathlib import Path
import json,hashlib
R=Path(__file__).resolve().parent;d=R/'A01';d.mkdir(exist_ok=True)
p='''6-second historical film insert of the copper seal on silk as in the reference. Hold the composition steady, only tiny natural lamp flicker. No visible people or mouths. A young adult male standing behind the camera speaks Mandarin clearly, calm and slightly breathless from riding. Pronounce the name Fengchu as feng-chu (rising tone on chu), not Fengqu. This is spoken natural dialogue, not singing. The ONLY spoken words are:
“我受凤雏先生所托，持此印来见陛下。”
Finish the line by five seconds and leave a short quiet tail. No other speech. No narrator. No music. Only this voice and very quiet cloth/air. No captions or subtitles. No on-screen text added.'''
refs=[str(R/'references/L01-铜印全貌.png')]
(d/'prompt.txt').write_text(p,'utf-8');(d/'references.json').write_text(json.dumps(refs,ensure_ascii=False),'utf-8');(d/'视频生成Prompt.md').write_text('# A01｜玩家画外对白补录\n\nH3，768P，16:9，6秒。用途为独立取得玩家原句，画面不替代铜印揭示。旧L02提取音中凤雏/持此读音存在ASR疑点，本镜重录清晰发音。\n参考图：'+refs[0]+'\n\n'+p,'utf-8')
plan=json.loads((R/'production-plan.json').read_text('utf-8'))
if not any(u['id']=='A01' for u in plan['units']):plan['units'].append(dict(id='A01',title='玩家原句补录',duration=6,edit_duration=6,depends_on=None,reference_paths=refs,prompt_status='待review',video_status='待生成',prompt_path=str(d/'视频生成Prompt.md'),request_prompt_sha256=hashlib.sha256(p.encode()).hexdigest()))
(R/'production-plan.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2),'utf-8')
