import json
from pathlib import Path
import subprocess
import sys

R=Path(__file__).resolve().parent
def read(name): return json.loads((R/name).read_text(encoding='utf-8'))
def save(name,value): (R/name).write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf-8')
v=read('visual-review.json')
v['C1END-TENT-R2']={'method':'全长每秒3帧取样，未冒充逐帧动态或听审','decision':'candidate-with-limits','observations':['玩家始终后脑背影，未出现可辨面孔；两巡营军士引路，三人沿原路远离。','摄影机实际逐渐上仰，最后以夜空和帐顶收束；不是脚本所写完全固定机位。','帐布始终不透明，无新增帐内信息。'],'audio':'未听审，保留原始生成音轨。'}
v['C1END-LIGHT-R2']={'method':'全长每秒3帧取样，未冒充逐帧动态或听审','decision':'candidate-with-limits','observations':['魏延、姜维身份服装持续；手电全程由相同灰褐衣袖的手持有，末段同手放低。','未再出现第一版穿透式光束和换手；光斑照到魏延及帐面，魏延抬手回应。','实际只作近距离灯光演示；不能将其表述成已经验证远距离信号。','灯光照面较亮，抬手可同时理解为示意/遮光，保留供用户审阅。'],'audio':'未听审，保留原始生成音轨。'}
save('visual-review.json',v)
reports=read('technical-review.json')
for row in reports:
    row['visualReview']=v[row['take']]
save('technical-review.json',reports)
subprocess.run([sys.executable,str(R/'publish.py')],check=True)
report=['# 第一章缺失结局视频：实际交付记录','',
'2026-10-25。五条候选全部实际生成并下载，均通过全片解码。图片使用OpenAI Next gpt-image-2，视频使用同一服务MiniMax-H3。已有结局视频保持原样。', '',
'## 本轮采用文件','', '| 结局 | 实际影片 | 独立分镜 |','| --- | --- | --- |']
plan=read('plan.json')
for row,s in zip(reports,plan):
    report.append('| '+row['title']+' | ['+row['duration']+']('+Path(row['path']).as_posix()+') | [分镜]('+Path(s['prompt']).as_posix()+') |')
report += ['', '五条均为1280×720、24fps，实际文件约12.26秒；请求时长12秒，未为了凑整数裁掉生成尾部。统一审片入口：[本地审片页]('+ (R/'审片.html').as_posix()+')。', '',
'## 检查与限制','',
'- 全片解码无错误；全时段每秒3帧抽样核对人物、道具与场面因果。《军令落下》《匣中有军令》另做过浏览器播放检查。浏览器随后超时，因此不把抽样检查写成五条全片动态验收。',
'- 帐后第一版露出未经确定的玩家侧脸，灯号第一版出现夸张光束及道具换手，均未采用。两条R2沿用原首帧和身份源，原版保留作修订记录。',
'- 帐后R2末段有向上摇镜；灯号R2仅为近距离演示，光斑照面较亮。对讲机片部分有口部动作；均如实记入visual-review.json，不宣称毫无瑕疵。',
'- 原始生成音轨保留，尚未听审，不能据无对白Prompt宣称没有新增人声或配乐。未另开TTS。',
'- 新片均为待review候选，未标记用户通过，未接入游戏；尤其物品片不能替代原文中的身份复核、信号约定与能力边界。', '',
'## 第二章承接','',
'用户已授权同步到现有总控，现有G5/G6按结局可用客观镜头、保持身份与原剧情因果的要求继续生产。本轮不重复提交第二章任务。最近读取的G6交付表包含V38、V39、V40、V41E候选；G5交付表仍列V37/V42未合成，G6晚E4与E5仍待其原任务完成。此处是读取快照，第二章动态进度以原制作任务为准。',
'', '完整覆盖与边界：[两章结局覆盖与镜头设计]('+(R/'两章结局覆盖与镜头设计.md').as_posix()+')。']
(R/'实际交付与审片记录.md').write_text('\n'.join(report)+'\n',encoding='utf-8')
assert len(reports)==5 and all(row['decode']=='passed' and Path(row['path']).exists() for row in reports)
assert all(Path(s['prompt']).exists() for s in plan)
print('Five selected films and prompt documents verified; user approval and game integration remain false.')
