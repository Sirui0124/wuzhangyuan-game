from pathlib import Path
import json
OUT=Path(__file__).parent
clips=json.loads((OUT/'plan.json').read_text(encoding='utf-8'))['clips']
if (OUT/'repair-plan.json').exists():clips+=json.loads((OUT/'repair-plan.json').read_text(encoding='utf-8'))['clips']
for c in clips:
    path=OUT/'prompts'/f'{c["id"]}.md'
    if not path.exists():continue
    original=path.read_text(encoding='utf-8')
    if '## 逐句映射（仅制作记录）' in original:continue
    mapping=['## 逐句映射（仅制作记录）','','本节留作逐句回溯，不发送视频生成接口。API仅收到 requests 中的实际镜头提示。','']
    for x in c['sourceLines']:mapping.append(f'- {x["node"]}｜{x["speaker"]}｜{x["voiceAndLipOwner"]}｜{x["text"]}')
    if c.get('post'):
        mapping+=['','文书准确字层：']
        for row in c['post']:mapping.append(f'- {row["start"]}–{row["end"]}秒：{row["text"]}'+('；划去' if row.get('strike') else '；署名' if row.get('signature') else ''))
    mapping+='\n'
    marker='## 视频生成 Prompt'
    original=original.replace(marker,'\n'.join(mapping)+'\n'+marker,1)
    path.write_text(original,encoding='utf-8')
print('Source mapping added to independent MD; no API payload or accepted request changed')
