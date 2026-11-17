from pathlib import Path
import json,hashlib
R=Path(__file__).resolve().parent;d=R/'L02S';d.mkdir(exist_ok=True)
p='''A six-second silent live-action portrait reaction, tightly framed head and shoulders exactly like the reference. Fixed camera. Preserve this exact elderly Chinese man's face, graying hair, beard, worn dark cloak, warm light on the right and cool predawn behind him. His lips stay gently pressed together throughout. He watches someone just beside the lens in quiet thoughtful silence. One subtle breath, one natural blink, eyes settle downward slightly at the very end. Keep his expression composed, attentive and tired. The frame remains the same tight head and shoulders throughout. Quiet room tone and soft breathing only. This is an entirely silent listening performance with no spoken words, no singing and no music. Clean film picture with no captions or subtitles.'''
refs=[str(R/'references/L02S-刘备静听近景.png')]
(d/'prompt.txt').write_text(p,'utf-8');(d/'references.json').write_text(json.dumps(refs,ensure_ascii=False),'utf-8');(d/'视频生成Prompt.md').write_text('# L02S｜静听近景\n\n6秒，H3 768P，16:9。L02R仍发生文书与朗读，停用；本镜收紧构图，API正文完全不含中文控制说明，只有自然闭口倾听。对白另配。\n参考图：'+refs[0]+'\n\n'+p,'utf-8')
plan=json.loads((R/'production-plan.json').read_text('utf-8'))
for u in plan['units']:
 if u['id']=='L02R':u.update(selected_for_edit=False,video_status='待更新',rejection='仍有新增文书及中文控制说明朗读，改紧景与纯英文静默提示')
if not any(u['id']=='L02S' for u in plan['units']):plan['units'].append(dict(id='L02S',title='静听近景',duration=6,edit_duration=6,depends_on=None,reference_paths=refs,prompt_status='待review',video_status='待生成',prompt_path=str(d/'视频生成Prompt.md'),request_prompt_sha256=hashlib.sha256(p.encode()).hexdigest()))
(R/'production-plan.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2),'utf-8')
