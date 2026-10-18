"""导出编剧编辑稿。只读取正式 JSON，不把 Markdown 自动写回剧情。"""
import json
from pathlib import Path
root = Path(__file__).resolve().parents[1]
destination = root / 'content/chapters/wuzhang/五丈原_完整剧本与逻辑_编辑稿.md'
if destination.exists():
    raise SystemExit('编辑稿已存在，停止导出以保护人工修改。需要新快照时请先保存编辑稿并改用新目标文件。')
source = root / 'content/chapters/wuzhang/chapter.json'
p = json.loads(source.read_text())
names = {x['id']: x['name'] for x in p['characters']}
def cond(c):
    if 'all' in c: return ' 且 '.join('('+cond(x)+')' for x in c['all']) or '无附加限制'
    if 'any' in c: return ' 或 '.join('('+cond(x)+')' for x in c['any'])
    if 'not' in c: return '不满足：'+cond(c['not'])
    if 'flag' in c: return c['flag']+' = '+json.dumps(c['equals'],ensure_ascii=False)
    if 'evidence' in c: return ('本轮持有 ' if c['mode']=='held' else '本次出示 ')+c['evidence']
    return '意图 = '+c['intent']
def effect(xs):
    if not xs: return '无状态变化'
    return '；'.join((f"设置 {x['flag']} = {json.dumps(x['value'],ensure_ascii=False)}" if x['type']=='setFlag' else f"取得证据 {x['evidenceId']}" if x['type']=='grantEvidence' else f"{x['type']} {x['promiseId']}") for x in xs)
def lines(xs):
    result=[]
    for x in xs:
        result += [f"- **{names.get(x['speakerId'],x['speakerId'])}**〔`{x['id']}`〕：{x['text']}"]
        if x.get('when'): result += ['  - 显示条件：'+cond(x['when'])]
        if x.get('mediaId'): result += ['  - 媒体：`'+x['mediaId']+'`']
        if x['effects']: result += ['  - 确认此句后：'+effect(x['effects'])]
    return result or ['（无前置对白）']
def outcome(x):
    return lines(x['reply'])+['','反馈段结束后：'+effect(x['effects'])+'。','去向：`'+str(x['next'])+'`（null 表示结束当前段，返回交互）。','']
a=['# 五丈原 · 完整剧本与逻辑编辑稿','','这是供你修改的伪代码 Markdown 稿，覆盖正式章节所有节点、对白与规则。初稿由 `chapter.json` 导出，运行时不读取本文件。','','**改稿约定：直接修改此稿，保留节点 ID；新增段落标记【新增】，删去内容标记【删除】，规则疑问标记【待讨论】。修改后通知我，我再核对因果、同步正式 JSON、重新校验并刷新 HTML demo。不会自动把你的编辑覆盖回旧稿。**','','正式格式：`chapter.json`；格式契约：`../../schema/narrative.ts`。本稿中的条件与效果是便于阅读的说明，不是另一套可执行语言。','','## 故事与试玩顺序','','诸葛亮粉丝在电视前看见灯灭，穿越成为营中小卒，回到第六夜傍晚。先查清军情与报信规则，再说服魏延暂候。首轮直接递报保住灯，却因越职被问罪，临死听见传令侧帐线索。回溯后重新取证，由传令卒乙向姜维请示，取得当夜有限批准，完成请人、递报、收回话、转达四步，保灯且生还。普通灯灭也可回溯，但不会凭空提供侧帐线索。','','七星灯采用演义舞台；小卒、告示、凭条与处斩为架空补写。完整史料边界见 `notes.md`。安全结局只代表救下这一夜，不等于诸葛亮已痊愈。','','## 场景与人物','']
for x in p['scenes']: a += [f"### {x['title']}〔`{x['id']}`〕",'可见：'+cond(x['visibleWhen']),'进入：'+cond(x['enterWhen']),'无法进入提示：'+x['lockedText'],'']
for x in p['characters']: a += [f"- **{x['name']}**〔`{x['id']}`〕：{x['motivation']}"]
a += ['','## 证据卡','']
for x in p['evidence']: a += [f"### {x['title']}〔`{x['id']}`〕",'来源：'+x['source'],'可证明：'+'；'.join(x['proves']),'不能证明：'+'；'.join(x['cannotProve']),'属性：'+x['historicalBasis'],'']
a += ['## 完整节点（按内容源顺序，分支不同时发生）','']
for x in p['dialogues']:
    a += [f"### {x['title']}〔`{x['id']}`〕",f"场景 `{x['sceneId']}`；对象 `{x['characterId']}`；话题 `{x['topicId']}`。",f"触发 `{x['trigger']}`；优先级 {x['priority']}；重复 `{x['repeat']}`。",'出现条件：'+cond(x['availableWhen']),'']
    if x['targetStatement']: a += ['待回应的证词：'+x['targetStatement'],'']
    a += lines(x['lines'])+['']
    for ch in x['choices']:
        a += [f"#### 选项：{ch['label']}〔`{ch['id']}`〕",'意图：`'+ch['intentId']+'`。','可见：'+cond(ch['visibleWhen']),'可选：'+cond(ch['enabledWhen']),'锁定提示：'+ch['lockedText'],'实际执行动作：`'+str(ch['actionId'])+'`。','反馈：','']+outcome(ch['outcome'])
    f=x['freeInput']
    if f:
        a += ['#### 自由输入 / 举证','判定器：`'+f['judgeId']+'`；证据选择：`'+f['evidenceSelection']+'`；长度上限：'+str(f['maxLength'])+'。','意图：'+'；'.join(i['label']+'〔'+i['id']+'〕' for i in f['intentOptions']),'输入提示：'+f['placeholder'],'引导问题：'+'；'.join(f['guidingQuestions']),'可编辑起句：'+f['starterText'],'']
        for status,o in f['outcomes'].items(): a += ['##### 返回 '+status,'']+outcome(o)
    a += ['线性节点完成效果：'+effect(x['onComplete']),'线性后续：`'+str(x['next'])+'`。','']
a += ['## AI 判定与接受分支','','AI 只解释说法；接受后按下列当前事实检查，取首个满足的分支。无分支满足时使用节点的 accept 兜底，不自动授权。','']
for x in p['judges']:
    a += ['### `'+x['id']+'`','接受意图：'+'、'.join(x['acceptedIntentIds']),'论证要点：'+'；'.join(x['requiredPoints']),'禁止主张：'+'；'.join(x['forbiddenClaims']),'']
    for n,c in enumerate(x['acceptanceCases'],1): a += [f"#### 合法接受分支 {n}",'当：'+cond(c['when']),'则：','']+outcome(c['outcome'])
a += ['## 动作定义','','选项必须引用动作，跳转不代替执行。','']
for x in p['actions']: a += ['### '+x['title']+'〔`'+x['id']+'`〕','可执行：'+cond(x['availableWhen']),'时间：`'+x['timeCost']+'`。','执行后：'+effect(x['effects']),'后续：`'+str(x['next'])+'`。','']
a += ['## 等待承诺与违约','']
for x in p['promises']: a += ['### `'+x['id']+'`',x['description'],'必做动作：'+' → '.join(x['requiredActionIds']),'完成条件：'+cond(x['completedWhen']),f"拖延阈值：{x['delayBudget']}；第一次警告，达到阈值破约。",'破约效果：'+effect(x['brokenEffects']),'']
a += ['## 结算事件','']
for x in p['events']: a += ['### `'+x['id']+'`',f"优先级：{x['priority']}。",'当：'+cond(x['when']),'效果：'+effect(x['effects']),'进入：`'+str(x['next'])+'`。','']
a += ['## 回溯状态表','','memory 保留，loop 重置至下列初值；当轮证据、出示记录、承诺与行动进度清空。','', '| ID | 范围 / 归属 | 初值 | 含义 |','| --- | --- | --- | --- |']
for x in p['initialFlags']: a += [f"| `{x['id']}` | {x['scope']} / {x['owner']} | {json.dumps(x['initial'],ensure_ascii=False)} | {x['description']} |"]
a += ['','## 修改记录（由你填写）','','- 【待讨论】','- 【新增】','- 【删除】','']
destination.write_text('\n'.join(a))
print('已导出',len(p['dialogues']),'个节点；保留完整对白、分支、条件和效果。')
