"""Export the reviewed prefix from a fresh Feishu snapshot; never interpret stale logic as code."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'outputs/chapter-two-review-20261023'
source = json.loads((OUT / 'playable-source.json').read_text(encoding='utf-8'))
rows = source['sheets'][0]['data']
prefix = []
for raw in rows:
    row = list(raw)
    if row[0] == 'CH2-LY03-001':
        break
    if row[0] == 'CH2-FB-001':
        continue
    if not row[0]:
        row[0] = 'CH2-LY02-ACT01' if row[2] == '去找苟安' else 'CH2-LY02-018A'
    prefix.append(row)
assert len({r[0] for r in prefix}) == len(prefix)
clues = {
    'LY-X01': ('苟安眼前的伤', '在伤帐亲眼看到苟安受伤；伤情本身不能证明受罚缘由。'),
    'LY-X02': ('记忆中的苟安故事', '我记得苟安受罚、投魏与散谣的故事；个人回忆不能证明本轮已经发生。'),
    'LY-X03': ('崖边救命恩人', '山路上救我的队长，就是伤帐中的苟安。'),
    'LY-X04': ('苟安的饮酒自述', '苟安说五月在永安喝过酒。这是他的自述。'),
    'LY-X06': ('交接记录：六月初二领到粮', '领粮日期：六月初二 于永安城 督卫苟安。记录可与五月饮酒作时间对照，未载应交日期，不能单凭它判定迟交责任。'),
}
nodes = []
for i, r in enumerate(prefix):
    if r[0] in ('CH2-LY02-003', 'CH2-LY02-004'):
        continue
    n = dict(id=r[0], kind='line', speaker=r[1], text=r[2], next=prefix[i+1][0] if i+1 < len(prefix) else 'CH2-PREFIX-END')
    if r[0] == 'CH2-LY02-002':
        n.update(kind='choice', speaker='我', options=[dict(id=p[0], text=p[2], next='CH2-LY02-005') for p in prefix if p[0] in ('CH2-LY02-003','CH2-LY02-004')])
        n.pop('next')
    if r[0] in ('CH2-LY01-001', 'CH2-LY01-011'):
        n.update(kind='video', clip='LI01' if r[0].endswith('001') else 'LI02B')
    if r[0] == 'CH2-LY02-ACT01':
        n.update(kind='action', speaker='行动')
    if r[4] in clues:
        title, detail = clues[r[4]]
        n['clues'] = [dict(id=r[4], title=title, detail=detail)]
    nodes.append(n)
nodes.append(dict(id='CH2-PREFIX-END', kind='finish', speaker='第二节已完成', text='后续从苟安取出李丰的信开始。本次试玩到此，后续画布与结局待审核后接入。'))
version = hashlib.sha256(json.dumps(nodes,ensure_ascii=False).encode()).hexdigest()
dest = ROOT / 'content/chapters/grain'
dest.mkdir(parents=True,exist_ok=True)
def save(path, value):
    path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
save(dest/'chapter-two.source.json', dict(sourceUrl='https://my.feishu.cn/sheets/HDuhsadNNhnzgBtG6vScRQo0nEc', snapshotDate='2026-10-23', sheets=source['sheets']))
save(dest/'chapter-two.playable.json', dict(version=version,start=nodes[0]['id'],nodes=nodes))

# Structure proposal is a separate review workbook, not a replacement of the active source.
sheets=[]
def sheet(name, columns, data):
    sheets.append(dict(name=name,columns=columns,data=data,dtypes={c:'object' for c in columns}))
by_id={n['id']:n for n in nodes}
labels={r[0]:f'{i+1:02}｜'+r[2][:12] for i,r in enumerate(prefix)}
main=[]
for i,r in enumerate(prefix):
    n=by_id.get(r[0])
    kind='普通选项' if not n else {'line':'对白','choice':'选项入口','action':'行动','video':'视频'}[n['kind']]
    if kind=='对白' and r[1]=='演出': kind='演出'
    if kind=='对白' and '心声' in r[1]: kind='心声'
    if kind=='对白' and '文书' in r[1]: kind='文书展示'
    nxt='选择 → '+labels['CH2-LY02-003']+' 或 '+labels['CH2-LY02-004'] if n and n['kind']=='choice' else labels['CH2-LY02-005'] if not n else '第二节试玩结束；完整剧情接李丰的信' if n['next']=='CH2-PREFIX-END' else labels[n['next']]
    recorded='；'.join(c['title'] for c in (n or {}).get('clues',[]))
    speaker='' if kind in ('选项入口','行动','视频','演出','文书展示') else r[1].replace('（选项）','')
    main.append([f'{i+1:02}｜'+r[2][:12],kind,speaker,r[2],recorded,nxt,r[0]])
sheet('开场与第二节', ['节点名称','节点类型','说话人','文案／按钮文字','完成后录入线索','下一步','稳定编号（执行者维护）'],main)
sheet('展开规则', ['类型','何时使用','玩家操作','何时向后走','不满足／取消'],[
 ['对白／心声／演出','已经写定的剧情内容','点继续','本句读完，进入下一步指定节点','停留当前句；不因说话人名字触发画布'],
 ['普通选项','需要玩家选择一句话或一种行动；不核对证据','点击其中一个选项','立即走该选项的去向；需要汇合则各选项填同一去向','未选时停在入口；不出现提交判断或二次确认'],
 ['行动','需要明确出发、查阅、交付等事件','点击动词按钮，如去找苟安','行动实际完成后再入下一节点／发放线索','未点击不移动、不发线索'],
 ['思绪画布','必须根据已得材料回答一个明确问题','添入依据→思考→点击明确出口','判断成立只产生一个答案；点击继续推理或行动后离开','不足留原题、保留输入、提示缺口；取消回原入口'],
 ['对白画布','确需玩家用依据组织自己的话；固定对白不用','添入依据→编辑话语→确认说出','实际话语符合条件且确认后，才播放对应回应','不足留草稿并提示缺项；取消不视为已说出'],
 ['结局确认','只有真正停止调查、正式交案等不可回退剧情决定','先选路线，再确认具体后果','满足结局页的真实事件门槛并确认后进入结局','取消回当前路线入口，不自动换到其他结局'],
 ['视频','已有影像承担该段剧情','播放或跳过','播放完／跳过后进入下一步','不把同段内容再作为对白重复播放'],
 ['线索录入','只写本节点完成时新取得的完整线索','读完对白／原件／视频','完成时录入一次；引用或暂存片段不另录','无需录入的格子留空，不写“无”“不新增”'],
 ['维护方式','本表为结构试稿，原章表仍为正式来源','黄色内容供修改，蓝色编号由执行者维护','审核结构后再迁移整章；不会因改表自动开发','当前开场至第二节已按最新正式表接入，其余未接入'],
])
sheet('画布展开', ['画布／状态','从哪里进入','问题或表达目标','依据与成立条件','成立后按钮 → 去向','不成立／取消去向','对应节点或原稿'],[
 ['说明来意｜普通选项','苟安问谁让你来问','两句预设话任选其一','无证据门槛','点击选项 → 永安饮酒自述','未选留在选项入口','CH2-LY02-002 → 003/004 → 005'],
 ['安慰苟安｜固定对白','去找苟安→回到伤帐→他询问来意','按你最新两句“我”的对白播放','六月初二领粮记录与五月饮酒已读；不做提交判断','继续 → 苟安沉默→承认委屈','无画布；不生成迟发口供','CH2-LY02-018 → 018A → 021 → 022'],
 ['请苟安暂留｜对白画布待审','读完李丰第一封信','先核查本批材料、正常报告，请他暂留','第一封信；不保证无罪、不假称已有查账许可','确认说出 → 暂留回应→实际交付凭据→管事陪同','保留草稿；关闭回信后交谈','对白审核稿：请苟安暂留'],
 ['粮账Q1｜思绪画布待审','管事陪同、仓吏准查，读完本批原件','缺额从哪里追问？','签收＋出仓：领取前已有缺口；签收＋损耗只支持有限核问','继续核入仓与发出 → 查阅Q2；或去核问损耗 → 支路','不足留Q1；取消回查账现场','思绪审核稿：粮账第一问'],
 ['粮账Q2｜思绪画布待审','Q1主线后实际读到入仓记录','这批入仓粮后来发往哪里？','同批入仓＋出仓；已有发运对应，不扩大为所有仓空','继续核地方实收与入仓 → 查阅Q3','不足留Q2；取消回查账现场','思绪审核稿：粮账第二问'],
 ['粮账Q3｜思绪画布待审','实际查阅地方实收','实收是否都记入仓？','地方实收＋同批入仓相合','核对应征与实收 → 查阅Q4','不足留Q3；取消回查账现场','思绪审核稿：粮账第三问'],
 ['粮账Q4｜思绪画布待审','实际读到应征缺额栏并明白栏义','应征等于实际收到吗？','应征／缺额栏＋地方实收；本批没有备齐，不杜撰石数','核缺额报告与签认 → 固定核验对白','不足留Q4；取消回查账现场','思绪审核稿：粮账第四问'],
 ['口供矛盾｜思绪画布待审','同批同日报告、受杖前签认及未补足均核验','先前说法与记录能对上吗？','完整口供＋报告＋签认＋当日未补足；第二节新版尚未提供迟发口供，须先补核来源','当面问清 → 对质对白画布；不重复核同一道题','不足留题；取消回对质入口；可走有限损耗核问','开场删改后的口供来源待审核，禁止自动补给'],
 ['当面对质｜对白画布待审','矛盾成立并行动，或已有完整原件支持','指出他签认未征齐却称备齐被扣的矛盾并问缘由','继承真实证据；不得预先引用尚未发生的坦白','确认说出 → 坦白→读第二封信→访村；关闭W入口','不足留草稿；取消回对质入口','对白审核稿：当面对质'],
 ['送案方式｜思绪画布待审','访村、夜谈及军情均完成','按哪种方式处理真实案情？','事实、责任、缺粮后果分开；不保证免罪或继续北伐','立即送核 → A确认；共同写信 → B修补流程','不足留题；取消回商议；尚未形成结局','思绪审核稿：送案方式'],
 ['共同写信｜对白画布待审','选择先写信','保留责任、制止后手、说明补救与军情','商谈与实际信稿分别核验；寄信不等于李严停手','确认商谈→审阅信稿→确认寄信→核实双方停手→正式送核','缺项保留草稿；取消不寄信、不发停手状态','对白审核稿：共同写信；B门槛见结局衔接'],
 ['处境／计划／回顾｜可选思绪画布待审','各段已经取得对应资料后主动打开','帮助整理已经知道的事实','只引用已发生事件；不加重复考试，不伪造独立问题因果线','收起回顾 → 原剧情位置','随时收起；不挡主线，不补发物证','思绪审核稿后半幕可选整理'],
])
sheet('结局衔接', ['路线','出现选择的位置','必须真实发生','确认文案／动作（待审）','确认后流程','人物与军情结果','取消／回退与边界'],[
 ['W｜认下来的罪','有限损耗核问后，苟安认罪催结案；成功坦白前','已听到认罪；仍保留领取前缺口等相反账证','停止追查，把现有材料和这份口供一并交付？','确认→交付当前真实材料→W','缺粮退军；不追加苟安死亡','取消→继续核查；早入回未完成账题，晚入回对质；坦白开始后不再开放W'],
 ['A｜直接送核','访村与夜谈后选择送案方式','真实调查与责任材料齐全；不隐去军情与反证','按现有全部材料正式送核？','确认→正式交案与接收→处理结果→A','李严被废；苟安伏法；缺粮退军','取消→送案方式；不能仅选A按钮就跳过交付事件'],
 ['B｜共同补救后送核','送案方式选择先共同写信','商谈完成、真实信稿寄出、双方实际停手、完整材料正式送核并被接收','双方停手已经核实，现将全部责任与补救材料送核？','写信→寄信→核实双方停手→确认正式送核→接收→B','二人仍受罚；苟安活着做普通粮兵；仍退军','取消→当前商谈／送核入口；写好信、寄出信都不等于B达成；具体失败反馈仍待审核'],
 ['本次试玩停止点','第二节最后一句对白之后','读完“往后还在谁手底下领粮？”','第二节已完成','返回开始页或重玩开场；后续正式节点为李丰的信','不是W/A/B结局，不发放整章通关状态','独立第二章存档，不改变第一章进度'],
])
sheet('整章衔接总览', ['阶段','进入条件','主要内容与交互','下一步','接入状态'],[
 ['开场','进入第二章','救援视频→回忆→认人视频→冒失发问','说明来意','本次试玩'],
 ['第二节前段','苟安追问','普通二选一→五月饮酒→夜间查记录','去找苟安行动','本次试玩'],
 ['第二节后段','点击去找苟安','固定安慰对白→委屈→不敢找李严','李丰的第一封信','本次试玩到本段结束'],
 ['暂留与查账许可','读完第一封信','对白画布→暂留→交凭据→陪同与准查','四步核账','待审核未接入'],
 ['四步核账','逐步实际取得账页','Q1→查阅→Q2→查阅→Q3→查阅→Q4','报告与签认','待审核未接入'],
 ['对质准备','核验同批同日、签认及未补足','口供矛盾思绪→对质表达；可选有限损耗核问','W确认或继续调查／坦白','新版口供来源待补核'],
 ['坦白','真实话语指出矛盾并确认说出','坦白与第二封信→情感回应→访村差遣','村中见闻','待审核未接入'],
 ['访村至夜谈','正式差遣','访村视频→返回见苟安→夜谈→军情','选择送案方式','被删访村线索来源须核对实际视频'],
 ['送案方式','责任、处境与军情已明','可选处境整理→路线选择','A直接送核或B写信补救','待审核未接入'],
 ['结局与回顾','实际事件门槛齐备','按结局页执行；回顾可选','本章结束','待审核未接入'],
])
save(OUT/'structure-draft.json',dict(sheets=sheets))
styles=[]
for s in sheets:
    last=chr(64+len(s['columns'])); end=len(s['data'])+1
    styles.append(dict(name=s['name'],cell_styles=[
        dict(range=f'A1:{last}{end}',word_wrap='auto-wrap',vertical_alignment='center',background_color='#FFF8DA'),
        dict(range=f'A1:{last}1',background_color='#D9E5EB',font_weight='bold',horizontal_alignment='center'),
    ],col_sizes=[dict(range=f'A:{last}',size=240)],row_sizes=[dict(range=f'2:{end}',size=112),dict(range='1:1',size=36)],freeze=dict(rows=1,cols=1)))
styles[0]['cell_styles'].append(dict(range=f'G2:G{len(main)+1}',background_color='#E8F0FF'))
styles[0]['col_sizes']=[dict(range='A:C',size=160),dict(range='D:D',size=420),dict(range='E:G',size=230)]
save(OUT/'structure-styles.json',dict(styles=styles))
print(f'Exported {len(nodes)} runtime nodes, {len(rows)} source rows and {len(sheets)} review sheets.')
