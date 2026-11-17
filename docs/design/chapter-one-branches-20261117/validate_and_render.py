"""Validate the isolated design graph and derive its reading manuscript. No game imports."""
import hashlib
import json
from collections import defaultdict, deque
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / 'chapter-one.design.v1.json'
doc = json.loads(SOURCE.read_text(encoding='utf-8'))
nodes = {n['id']: n for n in doc['nodes']}
assert len(nodes) == len(doc['nodes']), '重复节点编号'
initial = doc['initialState']
keys = sorted(initial)

def matches(state, condition):
    return all(state[k] == v for k, v in condition.items())

def exits(n):
    if 'next' in n:
        yield {'id': 'next', 'target': n['next']}
    yield from n.get('choices', [])
    yield from n.get('routes', [])
    for r in n.get('freeInput', {}).get('intentRoutes', []):
        yield {'id': 'free:' + r['intent'], 'target': r['target']}

predecessors = defaultdict(set)
for n in nodes.values():
    assert n['kind'] in ('choice', 'passage', 'router', 'ending', 'terminal')
    if n['kind'] in ('choice', 'ending'):
        assert len(n['choices']) == 2, n['id']
        assert len({c['id'] for c in n['choices']}) == 2, n['id']
    if n['kind'] == 'passage':
        assert n.get('next'), n['id']
    if n['kind'] == 'terminal':
        assert not list(exits(n)), n['id']
    for e in exits(n):
        assert e['target'] in nodes, (n['id'], e['target'])
        predecessors[e['target']].add(n['id'])
        assert set(e.get('effects', {})) <= set(initial)
        assert set(e.get('when', {})) <= set(initial)
    assert set(n.get('requires', {})) <= set(initial)
    assert set(n.get('afterLines', {})) <= set(initial)
for h in doc['hints']:
    assert nodes[h['sourceNode']]['hintAward'] == h['id']
    assert nodes[h['sourceNode']]['afterLines'][h['state']] is True

def transitions(node_id, state):
    n = nodes[node_id]
    assert matches(state, n.get('requires', {})), ('前置不满足', node_id, state)
    state = {**state, **n.get('afterLines', {})}
    if n['kind'] == 'router':
        edges = [e for e in n['routes'] if matches(state, e['when'])]
        assert len(edges) == 1, ('条件缺口或重叠', node_id, state)
    else:
        edges = list(exits(n))
    return [(e.get('id', 'route'), e['target'], {**state, **e.get('effects', {})}) for e in edges]

def key(node_id, state):
    return (node_id, tuple(state[k] for k in keys))

queue = deque([(doc['entry'], dict(initial), [])])
visited = set()
reachable = set()
links = defaultdict(set)
terminal_states = set()
ending_paths = {}
while queue:
    node_id, state, path = queue.popleft()
    k = key(node_id, state)
    if k in visited:
        continue
    visited.add(k)
    reachable.add(node_id)
    n = nodes[node_id]
    if n.get('endingId') in ('E-FORMAL', 'E-COOP'):
        assert state['knowsJiang'] and state['jiangAgreed']
        assert state['reportHandled'] and state['orderDelivered']
        assert not state['enteredWithoutDuty']
    if n.get('endingId') == 'E-DEATH':
        assert state['enteredWithoutDuty'] and not state['knowsJiang']
    if n.get('endingId') == 'E-LAMP':
        assert state['knowsJiang'] and state['jiangAgreed']
    if node_id == 'C01-GUARD-2':
        assert state['deathSeen']
    if n['kind'] == 'terminal':
        terminal_states.add(k)
    if n['kind'] == 'ending':
        ending_paths.setdefault(n['endingId'], path + [node_id])
    for action, target, new_state in transitions(node_id, state):
        nk = key(target, new_state)
        links[k].add(nk)
        queue.append((target, new_state, path + [node_id + ':' + action]))
assert reachable == set(nodes), ('不可达节点', set(nodes) - reachable)

# Every reachable state must have an exit to a declared terminal, even when the
# user voluntarily asks the guard repeatedly or restarts the chapter.
can_finish = set(terminal_states)
while True:
    more = {k for k, targets in links.items() if targets & can_finish} - can_finish
    if not more:
        break
    can_finish.update(more)
assert visited <= can_finish, '存在无法结束阅读的状态'

def walk(actions, stop):
    state = dict(initial)
    node_id = doc['entry']
    trail = []
    actions = deque(actions)
    for _ in range(250):
        trail.append(node_id)
        if node_id == stop and not actions:
            return {'nodes': trail, 'state': state}
        n = nodes[node_id]
        options = transitions(node_id, state)
        if n['kind'] in ('passage', 'router'):
            assert len(options) == 1
            _, node_id, state = options[0]
        else:
            wanted = actions.popleft()
            picked = [x for x in options if x[0] == wanted]
            assert len(picked) == 1, (node_id, wanted)
            _, node_id, state = picked[0]
    raise AssertionError('测试路径超过上限')

tests = {}
tests['首轮默认禁令问题后死亡'] = walk(['rules','meet','concern','arrange','wait','admit'], 'C01-END-DEATH')
tests['首轮默认敌情问题后死亡'] = walk(['enemy','meet','order','relay','urge','defend'], 'C01-END-DEATH')
tests['两个默认问题都问仍不获得姜维'] = walk(['rules','ask','enemy','meet','concern','wait','correct','wait','admit'], 'C01-END-DEATH')
tests['自由问出姜维先取得承诺首轮合作成功'] = walk(['free:ask_decision_maker','jiang','ask','concern','arrange','direct','judge','follow'], 'C01-END-COOP')
tests['知道当值先见魏延再请姜维成功'] = walk(['free:ask_decision_maker','wei','order','relay','go','duty','stay'], 'C01-END-FORMAL')
tests['答错后修正仍可首轮成功'] = walk(['free:ask_decision_maker','jiang','go','concern','wait','correct','direct','absolute','repair','stay'], 'C01-END-COOP')
tests['坚持封死上报导致灯灭'] = walk(['free:ask_decision_maker','jiang','go','concern','arrange','direct','absolute','insist'], 'C01-END-LAMP')
tests['死亡回溯后默认正确问题通关'] = walk(['rules','meet','concern','arrange','wait','admit','rewind','decision','jiang','go','concern','arrange','direct','judge','stay','continue','next'], 'C01-NEXT-CHAPTER')
tests['灯灭重试不冒充死亡解锁提示'] = walk(['free:ask_decision_maker','jiang','go','concern','arrange','direct','absolute','insist','rewind'], 'C01-GUARD-1')
assert not tests['灯灭重试不冒充死亡解锁提示']['state']['deathSeen']
assert not tests['灯灭重试不冒充死亡解锁提示']['state']['knowsJiang']
for name, result in tests.items():
    if '首轮' in name and result['nodes'][-1] in ('C01-END-FORMAL','C01-END-COOP'):
        assert not result['state']['deathSeen']

def link(node_id):
    return f'[{node_id} {nodes[node_id]["title"]}](#{node_id.lower()})'

def say(body):
    return '\n\n'.join(f'**{l["speaker"]}：**{l["text"]}' for l in body)

def cond(c):
    return '且'.join(f'`{k}={json.dumps(v, ensure_ascii=False)}`' for k,v in c.items()) or '无额外条件'

md = ['# 第一章完整对话链 待审稿',
      '本阅读稿由 `chapter-one.design.v1.json` 自动生成。修改以 JSON 为准，再运行 `python validate_and_render.py` 更新本稿和校验报告。未接入游戏，未核对为现用影片转录。',
      '覆盖告示后的守卫对话至章末；既有穿越开场作为入口前情。每个选择节点两个默认选项；守卫另有自然语言输入。连续对白自动接续，条件分流节点没有玩家选项。',
      '最新约定：首轮默认问题不透露姜维；主动问谁能处理或担责才得到提示。没拿到该提示便见魏延，本轮走转呈未竟死亡。死亡回溯后出现正确默认问题。已有线索时仍可在首轮成功。',
      '阅读时按选项链接跳转。前驱是全部可能来路，不代表一次游玩依次发生。技术条件仅供审稿，正式玩家界面不展示。',
      '## 先读这几条完整路线']
for name in ['首轮默认禁令问题后死亡','自由问出姜维先取得承诺首轮合作成功','知道当值先见魏延再请姜维成功','答错后修正仍可首轮成功','死亡回溯后默认正确问题通关']:
    md += [f'### {name}', ' → '.join(link(i) for i in tests[name]['nodes'] if nodes[i]['kind'] != 'router')]
md += ['## 提示与状态']
for h in doc['hints']:
    md += [f'- **{h["title"]}**：{h["text"]} 来源：{link(h["sourceNode"])}。']
md += ['', '自由输入识别“询问谁能接报、作决定、承担处置责任或请有权者协助”的语义；例如“还有谁能处理军情？”。“出事我负责”不是询问他人职责。技术错误留在原输入，不推进剧情。本稿用意图分支模拟，未接入模型。', '## 全部节点']
for n in doc['nodes']:
    i = n['id']
    md += [f'<a id="{i.lower()}"></a>', f'### {i} {n["title"]}',
           '**前驱：**' + ('、'.join(link(p) for p in sorted(predecessors[i])) or '章节入口')]
    if n.get('requires'):
        md += ['**进入条件：**' + cond(n['requires'])]
    if n['lines']:
        md += [say(n['lines'])]
    if n.get('hintAward'):
        h = next(h for h in doc['hints'] if h['id'] == n['hintAward'])
        md += [f'**读完收录提示：{h["title"]}。** {h["text"]}']
    if n.get('afterLines'):
        md += ['**读完记录：**' + cond(n['afterLines'])]
    for c in n.get('choices', []):
        md += [f'**选项：{c["label"]}**']
        if c.get('say'):
            md += [say(c['say'])]
        if c.get('response'):
            md += [say(c['response'])]
        if c.get('effects'):
            md += ['选中后记录：' + cond(c['effects'])]
        md += ['→ ' + link(c['target'])]
    if n.get('freeInput'):
        md += ['**自然语言输入：**“向小甲问一句……”']
        labels = {'ask_decision_maker':'问谁能接报、作决定或担责','ask_restriction':'问禁令','ask_enemy':'问敌情','other':'未问清或其他问题'}
        for r in n['freeInput']['intentRoutes']:
            md += [f'- {labels[r["intent"]]} → {link(r["target"])}']
        md += ['', '识别技术失败：留在此处，保留输入供重试。']
    for r in n.get('routes', []):
        md += [f'- {cond(r["when"])} → {link(r["target"])}' + (f'；记录 {cond(r["effects"])}' if r.get('effects') else '')]
    if n.get('next'):
        md += ['**读完接续：**' + link(n['next'])]
    if n.get('endingId'):
        md += ['**结局编号：**' + n['endingId']]
    if n.get('boundary'):
        md += ['**本章阅读到此结束。**' + ('下一章为祁山；这里只声明设计边界，不启动游戏。' if n['id']=='C01-NEXT-CHAPTER' else '可从目录重新选择一条阅读路线。')]
    if n.get('note'):
        md += ['**审稿说明：**' + n['note']]
(ROOT / '第一章完整对话链-阅读稿.md').write_text('\n\n'.join(md) + '\n', encoding='utf-8')
report = {'source': SOURCE.name, 'sha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
          'status':'静态图与状态路径检查通过，未接入游戏或真实模型，待用户审阅对白',
          'nodes':len(nodes),'reachableStates':len(visited),'endings':sorted(ending_paths),
          'checks':['节点编号唯一','全部内部出口有效','选择与结局节点各两个按钮','所有节点状态可达','条件出口无重叠无缺口','全部可达状态能结束阅读','缺当值提示不可成功或转灯灭','成功前已实际应允接报回令','死亡后才开放第二轮守卫问题'],
          'routeTests':tests,'predecessors':{i:sorted(predecessors[i]) for i in nodes}}
(ROOT / 'validation-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'nodes':len(nodes),'states':len(visited),'routeTests':len(tests),'status':'passed'},ensure_ascii=False))
