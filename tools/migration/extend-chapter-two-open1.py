"""Extend the reviewed chapter prefix using a freshly fetched editing workbook."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LIVE = ROOT / 'outputs/chapter-two-review-20261023/standard-live.json'
TARGET = ROOT / 'content/chapters/grain/chapter-two.playable.json'
read = lambda p: json.loads(p.read_text(encoding='utf-8-sig'))
write = lambda p, v: p.write_text(json.dumps(v, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

rubric = {
    'version': 'gouan-open1-20261025-review2',
    'initial': {'trust': 2, 'rigor': 0, 'responsibility': 1},
    'rules': ['每项独立评分，每次整数-2至2；未体现给0。', '不按字数、文采、敬语或是否赞同北伐打分。',
              '引用玩家真实原话；推测不得升级为已证实事实。', '重说覆盖本轮记录，按剧情顺序从初始值重算，每步限制0至10。',
              '本轮不直接触发章末结局。', '礼物接受另行记录本章至多1点信任；对话维度不重复计算礼物本身，只看其余表达。',
              '信任只看关系：替他喊冤即使推理错误，仍可+1；不能因结论错误而扣信任。用时间疑点说明饮酒不能解释迟粮，已体现理解委屈，不要求说出委屈二字。',
              '严谨只看事实与推理：假设有错也包庇属于担当-2；没有断言虚假事实时严谨仍为0，不重复惩罚。',
              '承担核查上报行动可加担当，即使推理错误；空口保命不算担当。'],
    'examples': [
        {'words': '你救过我的命，我不想看着你去送死。先留下，让我帮你。', 'delta': [1, 0, 0]},
        {'words': '你先别走。我去查查这批粮，查到什么都回来告诉你，不会让你白等。', 'delta': [2, 0, 1]},
        {'words': '你五月喝酒，六月才领粮，不能只拿喝酒解释这中间的事。你先留下，我去核记录，查明白再如实报。', 'delta': [2, 2, 2]},
        {'words': '我想帮你，可你也得把实情告诉我。你受了什么委屈，我去查；真有你的错，我不能替你藏。', 'delta': [1, 1, 2]},
        {'words': '我一定能替你翻案，保你没事。李严再大的官，我也替你扳倒。', 'delta': [0, -1, 0]},
        {'words': '这封信还不明白吗？李严父子就是串通好了，让你背锅。我去告他们。', 'delta': [1, -2, 1]},
        {'words': '只要你不走，我就替你瞒着。账上真有你的错，我也当没看见。', 'delta': [1, 0, -2]},
        {'words': '你敢去魏国，我现在就把你交给军吏。你自己想清楚。', 'delta': [-2, 0, -1]}
    ],
    'dimensions': {
        'trust': {'name': '苟安的信任', 'question': '这句话让苟安更愿意把实情告诉我、给我一点时间吗？', 'levels': {
            '2': '理解他的委屈或处境，并承诺具体核查、把结果如实带回，使他有理由暂时信任我。',
            '1': '表达感恩、关心、尊重，或站在他的立场支持他，但尚不足以建立明确合作。迎合可能加信任，严谨与担当另评。',
            '0': '中性询问、单纯讲道理，或空口保证翻案保命，没有可信的关系改善。',
            '-1': '轻视处境、敷衍责怪、用救命恩情逼他服从，但未直接威胁。',
            '-2': '明确恐吓、羞辱或以抓捕强迫服从。提出不藏错的边界不等于威胁。'}},
        'rigor': {'name': '调查严谨度', 'question': '有没有分清眼前证据、推测和仍需核实的部分？', 'levels': {
            '2': '准确使用五月饮酒、六月领粮等已知事实指出解释缺口，并提出核验；不越界断言阴谋。',
            '1': '明确要求实情、核对记录或承认结论未定，但尚无完整的具体事实分析。',
            '0': '只说关心、帮忙或泛泛查查，没有证据判断；未提证据不扣分。',
            '-1': '尚未查清就保证翻案、保人无罪，或把可疑迹象过早说成确定。',
            '-2': '凭首封信断言李严父子合谋，或编造、歪曲关键事实作为定罪依据。'}},
        'responsibility': {'name': '补救担当', 'question': '我是否提出自己愿意实施的行动，并愿意面对查明后的责任？', 'levels': {
            '2': '具体核验后如实上报；或明确自己查清委屈，同时不隐瞒苟安真实过错。',
            '1': '提出由自己去查、回来说明或正式报告的行动，但责任边界尚不完整。行动可能积极而推理错误，严谨另评。',
            '0': '只有想救他、空口保命、情绪支持或要求他等待，没有自己的可落实行动。',
            '-1': '只用抓捕威胁逼他就范，或明确把全部后果推给别人、自己不负责。',
            '-2': '承诺掩盖真实过错、伪造材料或帮助他实施有害计划。'}}
    }
}
write(ROOT / 'content/chapters/grain/chapter-two.rubric.json', rubric)
book = read(LIVE)
rows = book['sheets'][0]['data']
source = {r[6]: r for r in rows if len(r) > 6 and isinstance(r[6], str) and r[6].startswith('CH2-')}
story = read(TARGET)
nodes = [n for n in story['nodes'] if not n['id'].startswith('CH2-LY03') and n['id'] != 'CH2-PREFIX-END']
for n in nodes:
    row = source.get(n['id'])
    if row and n['kind'] in ('line', 'action'):
        n['text'] = row[3] or n['text']
        n['speaker'] = row[2] or n['speaker']
    if n.get('next') == 'CH2-PREFIX-END':
        n['next'] = 'CH2-LY03-001'
ids = ['001', '002', '004', '005', '006', '007', '008', '010', '011', '012', '013', '014', '015', '016', '017', '018']
clues = {
    '002': ('LY-C02', '李丰的第一封家书', '前议之事，切勿再行。若有人问起，莫再牵及家父。信中未说明合谋事实。'),
    '010': ('LY-X07', '苟安想让本次北伐停止', '苟安说想把事情揭开，让这回北伐先停下来。是他的主张，不是已实施行动。'),
    '017': ('LY-X08', '苟安考虑另找出路', '苟安不知道魏国是否更好，希望我给出留下的另一条路。尚未投魏。')}
for i, suffix in enumerate(ids):
    id = 'CH2-LY03-' + suffix
    row = source[id]
    node = {'id': id, 'kind': 'open' if suffix == '018' else 'line', 'speaker': row[2] or '演出', 'text': row[3],
            'next': 'CH2-LY03-' + ids[i+1] if i+1 < len(ids) else 'CH2-PREFIX-END'}
    if suffix in clues:
        cid, title, detail = clues[suffix]
        node['clues'] = [{'id': cid, 'title': title, 'detail': detail}]
    nodes.append(node)
nodes.append({'id': 'CH2-PREFIX-END', 'kind': 'finish', 'speaker': '首次交谈完成', 'text': '接下来，还要查清这批粮的来龙去脉。后续调查暂未开放。'})
# 2026-10-25 user correction: restore the existing inquiry film omitted by the editing sheet.
nodes = [n for n in nodes if n['id'] != 'CH2-LY01-V02A']
opening = next(n for n in nodes if n['id'] == 'CH2-LY01-001')
opening['next'] = 'CH2-LY01-V02A'
nodes.insert(nodes.index(opening)+1, {'id': 'CH2-LY01-V02A', 'kind': 'video', 'speaker': '视频（LI02A）',
    'text': '营外打听苟安。', 'clip': 'LI02A', 'next': 'CH2-LY01-002'})
clue_map = {
    'CH2-LY01-008': ('LY-X02', ['CH2-LY01-007', 'CH2-LY01-008']),
    'CH2-LY01-011': ('LY-X01', ['CH2-LY01-011']),
    'CH2-LY01-012': ('LY-X03', ['CH2-LY01-001', 'CH2-LY01-011', 'CH2-LY01-012']),
    'CH2-LY02-005': ('LY-X04', ['CH2-LY02-005']),
    'CH2-LY02-014': ('LY-X06', ['CH2-LY02-014']),
    'CH2-LY03-002': ('LY-C02', ['CH2-LY03-002']),
    'CH2-LY03-010': ('LY-X07', ['CH2-LY03-010']),
    'CH2-LY03-017': ('LY-X08', ['CH2-LY03-015', 'CH2-LY03-016', 'CH2-LY03-017'])}
for node in nodes:
    node.pop('clues', None)
    row = source.get(node['id'])
    if row and row[4]:
        cid, source_ids = clue_map[node['id']]
        fragments = [{'node': sid, 'speaker': source[sid][2] or '演出', 'text': source[sid][3]} for sid in source_ids]
        node['clues'] = [{'id': cid, 'title': row[4], 'detail': '\n'.join(f['text'] for f in fragments), 'sources': fragments}]
    if node.get('options'):
        for option in node['options']:
            if option['id'] in source: option['text'] = source[option['id']][3]
# User-added unnumbered sentence is preserved with an executor-maintained stable ID.
after = next(n for n in nodes if n['id'] == 'CH2-LY02-009')
added = rows[18]
if not added[6] and added[3]:
    extra = {'id': 'CH2-LY02-009A', 'kind': 'line', 'speaker': added[2], 'text': added[3], 'next': after['next']}
    nodes = [n for n in nodes if n['id'] != extra['id']]
    extra['next'] = 'CH2-LY02-010'
    nodes.insert(nodes.index(after)+1, extra)
    after['next'] = extra['id']
story['nodes'] = nodes
story['version'] = 'grain-open1-' + hashlib.sha256(json.dumps([nodes, rubric], ensure_ascii=False).encode()).hexdigest()[:12]
write(TARGET, story)

folder = ROOT / 'docs/design/dialogue'
folder.mkdir(exist_ok=True)
for key, spec in rubric['dimensions'].items():
    lines = [f'# 第一次与苟安交谈｜{spec["name"]}', '', '状态：待逐项审核；当前试玩采用本稿尺度。分数不向玩家显示。', '', spec['question'], '',
             '| 本轮分数 | 判断标准 |', '|---|---|']
    lines += [f'| {int(n):+d} | {text} |' for n, text in spec['levels'].items()]
    lines += ['', 'AI必须给出该项分数、玩家原话摘录和简短理由。不因另外两个维度表现好而连带加分；正负表现并存时按实际主要行为选一个档位，不逐句累加。', '', *rubric['rules'][6:], '',
              '修改由执行者同步到运行配置；改本稿不会自动改变游戏。重说替换本轮得分，服务异常不扣分、不推进。', '']
    (folder / f'gouan-open1-{key}.md').write_text('\n'.join(lines), encoding='utf-8')
print(f'Updated {len(nodes)} nodes and three independent review standards.')
