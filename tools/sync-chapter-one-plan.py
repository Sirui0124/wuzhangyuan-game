"""Compile the reviewed Feishu row mapping; publish only with --publish after verification.

Input is a fresh CLI +csv-get export (including [row=N]); no positional old five-column importer.
Cloud writes compare each affected cell with the read snapshot, preserve other cells and verify readback.
"""
import csv
import io
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'outputs/mechanics-20261022'
CLI = Path.home() / 'AppData/Local/npm-cache/_npx/cca705bd6109e4e4/node_modules/@larksuite/cli/bin/lark-cli.exe'
TOKEN = 'WtGwsSisshygCat8XkBc96oCnll'
SHEETS = {'script': '0bQXZl', 'clues': '1srpiP', 'rules': '2PLUJn'}

def parse(data):
    return list(csv.reader(io.StringIO(re.sub(r'^\[row=\d+\] ', '', data['annotated_csv'], flags=re.M))))

def run(args):
    result = subprocess.run([str(CLI), *args], capture_output=True, encoding='utf-8')
    data = json.loads(result.stdout or result.stderr)
    if result.returncode or not data.get('ok'):
        raise RuntimeError(data)
    return data['data']

tables = {key: parse(json.loads((OUT / (key + '.json')).read_text(encoding='utf-8'))) for key in SHEETS}
writes = []
def setcell(sheet, row, col, text):
    before = tables[sheet][row-1][col-1]
    if before == text:
        return
    previous = next((w for w in writes if (w['sheet'],w['row'],w['col']) == (sheet,row,col)), None)
    if previous: previous['after'] = text
    else: writes.append({'sheet': sheet, 'row': row, 'col': col, 'before': before, 'after': text})
    tables[sheet][row-1][col-1] = text

def script(row, **values):
    columns = dict(id=1, speaker=2, text=3, note=4, clue=5, ids=6, human=7, rule=8)
    for key, value in values.items():
        setcell('script', row, columns[key], value)

script(13, rule='RULE-CHOICE-R1｜选A→A-24；选B→A-24B；只执行所选分支')
script(17, id='A-23B', speaker='主角·选项', rule='RULE-CHOICE-R1｜选项B；→A-24B')
script(18, id='A-24B', text='那便请你向魏将军说清楚。', rule='仅接选项B；→A-26B；不收录营门未失守')
script(19, id='A-26B', text='得先把话向魏将军说清楚。', rule='仅接选项B；→R1-GO')
script(16, rule='仅接选项A；→R1-GO')
script(20, id='R1-GO', speaker='系统·行动', text='去找魏延', rule='两分支汇合；玩家选择去找魏延→A-28')
script(7, ids='T01', rule='A-17读完收录T01；→A-18')
script(14, ids='T02', rule='仅选A；A-24读完收录T02；→A-25')
script(26, ids='T03（1/2）')
script(27, ids='T03（2/2）', rule='A-33/A-34均读完收录T03；→A-37')
script(28, rule='完成→R1-LANG；打开语言组织，不自动说出')
script(29, id='R1-LANG', clue='展示本轮已得T01/T02/T03；选B时不补造T02', ids='T01/T02/T03', rule='RULE-R1-EXPRESSION｜选择依据后生成AI预览；表达重点可空；确认后才发言')
script(30, id='R1-PREVIEW', speaker='系统·预览示例', text='禀将军，斥候说敌骑尚未攻营，阵前也只是叫嚷，来意还不明。帐前既有禁令，可否待丞相方便时再来？', note='已润色，待review；这是首轮不充分表达的示例，不把叫嚷断言为障眼法。实际预览仅用玩家已得且选用的依据。', rule='仅选依据、未提出即时转呈路径时的预览示例；预览不执行，不补造授权；确认→RULE-R1-EXPRESSION')
script(31, text='斥候说敌骑尚未攻营；阵前那些叫嚷，眼下还看不清来意。', note='已润色，待review；保留未知与不确定性。', rule='R1-PREVIEW对白示例；实际播放玩家确认文本，不固定连播')
script(32, text='帐前既有禁令，可否待丞相方便时再来？', rule='R1-PREVIEW对白示例；未安排即时转呈→A-40')
script(33, text='我不是闲人。军情不能没着落。', rule='RULE-R1-EXPRESSION未提出即时转呈→本反馈；留在原面板→R1-REPAIR')
script(34, id='R1-REPAIR', clue='保留本轮已得依据', ids='T01/T02/T03', rule='引导补充表达重点，例如“我来转呈信息”；可点用建议或自行输入，不要求固定口令')
script(35, id='R1-TRANSFER-PREVIEW', speaker='系统·预览示例', text='禀将军，军情不能耽搁，帐前的禁令也不能轻犯。请将军把急报交给我，我这就替您转呈。', rule='提出立即转呈的请求，不声称军报已经送达；AI预览须玩家确认→RULE-R1-EXPRESSION')
script(36, id='A-38B', text='禀将军，军情不能耽搁，帐前的禁令也不能轻犯。', rule='转呈预览对白示例；实际播放玩家确认文本')
script(37, id='A-39B', text='请将军把急报交给我，我这就替您转呈。', rule='已确认即时转呈且无冲突→A-40B')
script(38, id='A-40B', text='速速转达。', rule='魏延接受首轮转呈；置FIRST_TRANSFER_ACCEPTED；→A-41；未置REPORT_CLOSED')
script(39, text='人没进去，灯也没灭。真好。')
script(40, rule='→A-43；仅已得T02时说“营门未破”；选B未得T02时省略此句，不补造见闻')
script(86, ids='C01', rule='D24读完即收录C01；原D25已从主表删除；→D26')
script(88, speaker='系统·线索推理')
script(127, rule='RULE-EXPRESSION｜选择已有依据，可选填几个字的表达重点；AI生成可编辑预览；玩家确认→P2-SAY；不自动说出；不补造授权')
script(135, rule='交涉通过→W03；未公开核验→W04；已核验→W07；不再开面板')
setcell('clues', 2, 4, 'D24完成（D25已删除）；与首轮T02分开，回溯不自动继承')
new_clues = [
 ['T01','告示／首轮','今夜帐内有事，闲人不得擅入','A-17完成','禁令不是压报理由；不自动等于任何人永远不得入帐'],
 ['T02','斥候／首轮','营门尚未失守','仅选项A，A-24完成','未攻营不等于无危险；选B不得自动取得'],
 ['T03','魏延／首轮','魏军探问丞相与发令者','A-33/A-34均完成','只记录叫嚷，不认定障眼法、病情泄露或保证退兵'],
]
for row, values in enumerate(new_clues, 14):
    for col, value in enumerate(values, 1): setcell('clues', row, col, value)
setcell('rules', 7, 3, '首轮加入斥候二选一与语言组织教学，转呈未竟后仍经历死亡回溯。')
setcell('rules', 7, 4, 'RULE-CHOICE-R1；R1-LANG；R1-REPAIR；A-40B')
setcell('rules', 7, 5, '以最新主表为准：取消A-38/A-39固定自动发言；仅确认预览后发言。没提出即时转呈则魏延反馈，补充重点后可重试。首轮转呈不等于有人处置。')
setcell('rules', 4, 3, '语言组织以当前选用的线索／推论为基础，可额外输入几个字作为表达重点，由AI生成可编辑预览。')
setcell('rules', 4, 4, 'R1-LANG／R1-REPAIR／P2-01')
setcell('rules', 4, 5, '重点可空；不能成为虚构事实或授权。玩家确认才实际说出。改变依据／重点后旧生成失效；异常保留输入，可重试或明确使用参考句。')
setcell('rules', 16, 4, '八列：编号／说话人／一句文案／文案说明／人工线索／线索编号／人工逻辑／规则衔接')
setcell('rules', 16, 5, '人工列保留设计意图；程序按稳定ID与已审阅规则映射执行。分支各有独立ID；预览示例不是固定对白；空ID、重复ID、未知引用与未映射逻辑阻止导入。')
new_rules = [
 ['RULE-CHOICE-R1','分支规则','斥候二选一，只执行所选分支。','A-23 / A-23B','A→A-24/A-25/A-26并取得T02；B→A-24B/A-26B且无T02；汇合到R1-GO。'],
 ['RULE-R1-EXPRESSION','首轮表达','即时转呈是玩家的行动提议，不是已完成事件。','本轮选用T01/T02/T03＋可选表达重点','无即时转呈或压报拖延／强闯／虚构事实→A-40并原位修补；明确愿立即转呈且无冲突→A-40B→A-41；不设置姜维授权／正式接报。'],
 ['RULE-EXPRESSION','生成契约','AI仅组织所选证据，不直接修改剧情。','所选有效笔记与递归原话；表达重点；阶段；本次反馈','返回预览文本和引用ID；引用必须来自输入；可编辑，确认后才判定；取消、换依据、改重点、读档与重开使迟到生成失效。'],
 ['RULE-SYNC','自然语言映射','人工意图→条件、输入、操作、结果、重试出口。','稳定行ID＋人工线索／逻辑两列','映射稿与测试通过后定点同步；新增措辞先解释成结构化规则，禁止把自由文本当代码执行；云端回读比对后才标为已同步。'],
]
for row, values in enumerate(new_rules,18):
    for col, value in enumerate(values,1): setcell('rules',row,col,value)

# Resolve links affected by the user's deleted rows, without restoring deleted dialogue.
redirects = {'A-06':'A-07', 'A-10':'A-15', 'A-27':'R1-GO', 'A-35':'A-37', 'D25':'D26'}
for index, row in enumerate(tables['script'][1:],2):
    if not row[0]: continue
    value = re.sub(r'→\s*([A-Z][A-Z0-9_-]*)', lambda m: '→'+redirects[m[1]] if m[1] in redirects else m[0], row[7])
    setcell('script',index,8,value)

if '--publish' in sys.argv:
    # Optimistic concurrency check for every target, including newly occupied cells.
    live = {key: parse(run(['sheets','+csv-get','--spreadsheet-token',TOKEN,'--sheet-id',sheet,'--as','user'])) for key,sheet in SHEETS.items()}
    for item in writes:
        actual = live[item['sheet']][item['row']-1][item['col']-1]
        if actual not in [item['before'],item['after']]:
            raise RuntimeError(f"Concurrent edit at {item['sheet']} {item['row']},{item['col']}; refusing overwrite")
    pending = [w for w in writes if live[w['sheet']][w['row']-1][w['col']-1] != w['after']]
    for start in range(0,len(pending),80):
        batch = [{'sheet_id':SHEETS[w['sheet']], 'range':chr(64+w['col'])+str(w['row']), 'cells':[[{'value':w['after']}]]} for w in pending[start:start+80]]
        path = OUT / 'write-batch.json'; path.write_text(json.dumps(batch,ensure_ascii=False),encoding='utf-8')
        run(['sheets','+cells-set','--spreadsheet-token',TOKEN,'--sheet-id',SHEETS['script'],'--writes','@'+str(path),'--as','user'])
    for key,sheet in SHEETS.items():
        data = run(['sheets','+csv-get','--spreadsheet-token',TOKEN,'--sheet-id',sheet,'--as','user'])
        (OUT/(key+'-verified.json')).write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
        actual = parse(data)
        assert actual == tables[key], f'Unexpected differences in {key}'
    print(f'CLI published and verified {len(pending)} cell edits.')
else:
    source = ROOT/'content/chapters/wuzhang/chapter-one.script.json'
    old = json.loads(source.read_text(encoding='utf-8'))
    # The opening is an existing movie; retain its source records solely for coveredRows.
    movie_rows = [r for r in old['rows'] if r['id'] in ['A-01','A-02','A-03','A-04','A-05']]
    for row in movie_rows:
        row['transition'] = re.sub(r'→\s*A-06\b','→ A-07',row['transition'])
    rows = [dict(zip(['id','speaker','text','note','clue','clueIds','humanCondition','transition'],r[:8]), sourceRow=i+1) for i,r in enumerate(tables['script']) if i and r[0]]
    ids = [r['id'] for r in rows]
    assert len(ids)==len(set(ids)), 'Duplicate runtime ID'
    assert all(r[0] or not any(r) for r in tables['script'][1:]), 'Unmapped row'
    old.update(version='ch1-mechanics-20261022-v2',retrieved='2026-10-22',source_revision=156,rows=movie_rows+rows,
        clues=[dict(zip(['id','kind','summary','collect','boundary'],r[:5])) for r in tables['clues'][1:] if r[0]],
        rules=[dict(zip(['id','kind','summary','input','contract'],r[:5])) for r in tables['rules'][1:] if r[0]])
    old.pop('workbook_sha256',None)
    source.write_text(json.dumps(old,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (OUT/'reviewed-cell-patches.json').write_text(json.dumps(writes,ensure_ascii=False,indent=2),encoding='utf-8')
    print(f'Compiled {len(rows)} live rows; {len(writes)} reviewable cell patches prepared.')
