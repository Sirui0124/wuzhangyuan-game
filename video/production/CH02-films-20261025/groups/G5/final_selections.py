from pathlib import Path
import json
OUT=Path(__file__).parent
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
d=read(OUT/'review/decisions.json')
d['V42-02']=dict(visualReview='candidate-pass-with-limits',trim=[5.4,15.08],visualIssues=['去掉案上旧卷到案下纸页的不连续下移，使用记录纸近景承载完整心声','旧墨字形仅作记录纹理，未引入精确数字或新增人口证据'],audioIssues=['未逐字听审，中央玩家声轨按原句覆盖'],dynamicReview='连续4fps序列已检查，采用段待整V动态审')
d['V42-03']['trim']=[2.5,7.29]
d['V42-03']['visualIssues']+=['裁去开头重置空案的构图；保留翻页及停稳，未新增穿越特效']
d['V36-02'].update(visualReview='candidate-pass-with-limits',spatialCrop=[200,0,896,504],visualIssues=['收齐后的口头核实采用军吏中近景，裁掉原片案上错误文字；完整13.67秒保留'])
plan=read(OUT/'plan.json')['clips'];c=next(c for c in plan if c['id']=='V36-03')
d['V36-03'].update(visualReview='candidate-pass-with-limits',postOverride=[dict(text=c['sourceLines'][0]['text'],start=3.5,end=10.13,fullFrame=True)],visualIssues=['保留军吏取卷与宣读起句后，准确裁处正文作后期文书插入，替换原片错误文字；不冒充生成手写'])
for id in ['V36-02','V36-03']:
    # Preserve every already delivered file. The next assembler selects a recipe-versioned path.
    d[id]['recipeChanged']=True
(OUT/'review/decisions.json').write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8')
print('V42 selected; V36 paper fixes prepared without changing any existing playable file')
