import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root=fileURLToPath(new URL('../../',import.meta.url));
const read=path=>JSON.parse(readFileSync(resolve(root,path),'utf8').replace(/^\uFEFF/,''));
const model=read('docs/design/personality/characters-and-model.json');
const first=read('docs/design/personality/chapter-one-two-scoring.json');
const third=read('docs/design/personality/chapter-three-scoring.json');
const answers=read('docs/design/personality/open-answer-fixtures.json');
const coverage=read('outputs/personality-design-20261026/coverage.json');
const extra=read('outputs/personality-design-20261026/coverage-supplemental.json');
const clean=s=>String(s??'—').replaceAll('|','／').replaceAll('\n',' ');
const vec=v=>v.map(x=>x===null?'—':x>0?'+'+x:String(x)).join(' / ');
const table=(heads,rows)=>'| '+heads.join(' | ')+' |\n| '+heads.map(()=>'---').join(' | ')+' |\n'+rows.map(r=>'| '+r.map(clean).join(' | ')+' |').join('\n')+'\n';
const names={wuzhang:'第一章·五丈原',grain:'第二章·粮案',jieting:'第三章·街亭'};
const all=[...first.choices,...third.choices];
const optionCount=all.reduce((n,c)=>n+c.options.length,0);
const opens=[...first.openQuestions,...third.openQuestions];
const details=[
'# 人格评分逐项配置（2026-10-26）',
'本稿从当前剧情和程序入口提取。全部数值是设计配置，尚未写入游戏运行时。原选项和去向不改，正式接入时仍需核对在线最新文案。',
'四列顺序固定为 A 谋定→敢行、B 直陈→周旋、C 守则→权变、D 大局→情义。−2/−1 偏左，+1/+2 偏右；0 为明确兼顾，— 表示没有这方面的依据。普通选择权重 1，开放回答和关键取舍权重 2。表中数值是证据方向，不是直接给界面坐标加减同样的点数。',
`共 ${all.length} 个选择节点、${optionCount} 个选项；另有 ${first.fixedFallbackSpeeches.length} 条离线固定发言、${opens.length} 个开放入口（其中第一章首轮教学排除）。强制对白、自动分支、题目正确率、电影播放和物品操作另见配置中的排除清单。`,
];
for(const chapter of ['wuzhang','grain','jieting']){
  details.push('## '+names[chapter]);
  for(const choice of all.filter(n=>n.chapter===chapter)){
    details.push('### '+choice.nodeId+(choice.prompt?' · '+choice.prompt:''));
    if(choice.preconditions)details.push('出现条件：'+(Array.isArray(choice.preconditions)?choice.preconditions.join('；'):choice.preconditions)+'。');
    details.push(table(['选项原文','编号','A / B / C / D','权重','说明'],choice.options.map(o=>[o.text,o.id,vec(o.personality.directions),o.personality.weight,o.personality.reason])));
  }
}
details.push('## 开放回答入口');
details.push(table(['章节','入口','当前提问','权重','记录时机'],opens.map(o=>[names[o.chapter],o.nodeId,o.prompt,o.personality.defaultWeight??o.personality.weight,o.personality.commitOn??o.personality.reason])));
details.push('开放回答按 [逐轴与场景判定规范](personality/open-answer-rubric.json) 评分。每个非空值必须引用玩家确认原话；事实补充、通关答案、AI润色增加的表达不自动计分。同一问题的必要追问保留最新有效记录，不累计发言次数。');
details.push('## 现有离线固定发言');
details.push(table(['轮次','原文','A / B / C / D','权重','说明'],first.fixedFallbackSpeeches.map(o=>[o.round,o.text,vec(o.personality.directions),o.personality.weight,o.personality.reason])));
details.push('## 开放回答校准样例');
details.push('这些是供评分器校准的完整输入样例，不是新增剧情选项。场景内样例与额外假设分开，人物覆盖主结论只使用前一类。剧情信任／严谨／担当的预期分与人格分分别保存，前者用于回放原有游戏分支。');
for(const scene of ['R2','O1','O2']){
  details.push('### '+scene);
  details.push(table(['编号','玩家原话','A / B / C / D','范围'],answers.fixtures.filter(f=>f.scene===scene).map(f=>[f.id,f.text,vec(f.values),f.coverageTier==='supplemental-conditional-intent'?'额外条件假设':'当前场景'])));
}
writeFileSync(resolve(root,'docs/design/PERSONALITY-SCORING-DETAILS-20261026.md'),details.join('\n\n')+'\n');

const body=[
'# 三国人格体系：第二章可见与最新记录规则（2026-10-26）',
'这一版把 36 位人物放在同一套四维坐标里。玩家从中点出发，实际选择和确认说出的理由改变坐标，第二章任一结局结束后首次展示“目前更像谁”；第三至第六章继续计算，结果可以改变。人物不按章节锁定，也不根据成功或死亡直接分配。',
`当前场景的设计回放已覆盖 ${coverage.reached}/${coverage.total} 位人物（${(100*coverage.reached/coverage.total).toFixed(1)}%），达到第二章覆盖至少 30 位的目标。${coverage.reached} 条人物见证路径均推进过当前第二章实际状态机。开放输入的性格与剧情分、第一章交涉能否通过仍是人工标注预期，尚未验证真实 AI 的判定一致性。本稿与配套程序属于设计和验证，未修改游戏界面、AI提示词或玩家存档。`,
'## 玩家怎样得到结果',
'第二章结束页先展示人物、四条双向刻度和两三条本次游玩的依据。依据必须说明发生在哪一章、选了什么，并区分“你曾表示愿意……”与“你最后实际选择……”。玩家可以展开查看原话。人物画像提供比较参照，不能把该人物的所有特征套在玩家身上。',
'例如，玩家选择交案，解释可以写“第二章里，你知道苟安可能受重处，仍把全部真实材料交给军吏。这一次，你把军中的责任放在了救命恩情之前。”如果玩家随后重玩并改为放行，这段解释必须消失，改用新一轮实际行为。',
'首次展示后保留查看入口。重玩时界面显示“本章重新判断中”，用当前已确认的新记录与其他章节各自最新记录计算；尚未重新作出的选择显示证据不足。当前人物结果只存一份，不另建旧人格结果相册。',
'## 四个维度与数值',
table(['维度','0 分一侧','100 分一侧','实际判断'],[
['A 行动方式','谋定','敢行','面对不确定性，先准备核实，还是愿意先承担风险行动。'],
['B 交涉方式','直陈','周旋','把分歧直接说开，还是先铺垫、协调或寻找对方愿意接受的说法。'],
['C 规则边界','守则','权变','遇到目标与程序、正式责任冲突时，守住边界，还是主动绕开或调整。'],
['D 取舍对象','大局','情义','公共责任与具体关系发生冲突时，先保哪一边。关心他人本身不等于情义分。'],
]),
'初始坐标为 [50, 50, 50, 50]，但初始中点标记为“尚无依据”。后续相反的选择可以把坐标拉回中间，再越过中点。不会要求每次选择都离中点更远，也不会把没有观察到的维度解释成性格均衡。',
table(['方向值','含义'],[['−2 / +2','A/C/D有明确取舍、代价或坚持边界；B有充分的直陈边界或具体协调方法。按各轴规范判断强度。'],['−1 / +1','表达了可判断的倾向，但没有充分体现上述强度。'],['0','原话明确兼顾两端；必须有依据，不能用来填空。'],['null（表中为 —）','没有谈到、属于固定剧情要求，或无法从原话可靠判断。该轴不进入分母。']]),
'普通选择权重 1，关键行动和开放回答权重 2。权重表示这项证据的分量，方向值表示倾向强弱。长篇回答、重复强调、反复点击不能提高权重。普通选项只改变有依据的维度，不要求一题同时给四个轴打分。',
'每章先分别算各轴的加权平均，再把各章合并。一个章节在同一轴上的最大分量为 1，避免第三章问题较多就覆盖前两章。中点保留少量初始分量 0.25，因此前两章已有机会接近人物的边缘坐标。公式如下，v 是方向值，w 是该选择权重，null 不参与求和：',
'```text\n每章每轴：W = Σw\n          V = Σ(w × v/2) / W\n          R = min(1, W/4)\n跨章坐标：P = 50 + 50 × Σ(R × V) / (0.25 + ΣR)\n没有任何依据时：P = 50，observed = false\n```',
'单条普通 +1 证据会把尚未观察的该轴从 50 推至 62.5；单条关键 +2 证据推至约 83.3。一章拥有充分且完全同向的证据可到 10 或 90，两章可到约 5.6 或 94.4。这里是数值可达范围，实际人物覆盖另按完整剧情路径验证。',
'## 前两章怎样计分',
table(['位置与行为','A / B / C / D','权重','处理'],[
['第一章初始必挂任务、首轮魏延回答、教学死亡','— / — / — / —',0,'整个 round=1 排除；教学死亡可存历史。'],
['重生后魏延正式交涉','按已确认的原话判断',2,'姜维授权、军情事实和必答内容本身不加人格。'],
['偷听后选择离开','−1 / — / — / —','1 或 2','侧面听声权重1、发现脚步后的取舍权重2；同一风险决定只记最新。'],
['明确听到脚步仍继续','+1 / — / — / —',2,'死亡前的当前行为可记录；重试时删除，死亡历史保留。'],
['第二章调查日期、伤势、核账、粮情判断','— / — / — / —',0,'记录经历，但不把正确率当人格。'],
['第二章两次开放交涉','按逐轴规范',2,'分别记 O1/O2；O2的责任与保人意图最终由实际行动替换。'],
['已经知道调查有缺口，仍确认提前交案','+1 / — / −1 / —',2,'只用到此时已发生的选择，不能借后面的O2回答。'],
['最终共同停手、补报并正式交件','— / +1 / −1 / —',2,'不保证免责；成功程度不另外改变人格。'],
['知苟安可能重处，仍确认交全部真实材料','— / — / −2 / −2',2,'风险已经明确，按强取舍计分。'],
['知放行后果不可控，仍隐去安排让他离开','— / — / +2 / +2',2,'风险已经明确，按强取舍计分。'],
]),
'点击最终行动时先保存意图，正式确认后才记分。取消不记反向分；影片、收件、结局不再重复给分。O2中与最终处理相同的C/D意图被实际行动替换，独立的A/B表达可保留。通关失败不抹掉一次真实、自主的选择，但复活回到选择前时，当前记录必须一起回退。',
`逐步配置已覆盖前三章 ${all.length} 个选择节点、${optionCount} 个选项，另有 ${first.fixedFallbackSpeeches.length} 条固定发言和 ${opens.length} 个开放入口。完整原文、逐项数值、条件与解释见 [逐项评分表](PERSONALITY-SCORING-DETAILS-20261026.md)。第三章采用当前代码中的信任门槛；兵力不足导致的被迫下山不记谋定，常规合法战术不自动记权变。`,
'## 开放问题怎样判',
'判定器同时接收玩家确认原话、该节点实际已知信息和玩家自己补充的内容来源。它逐轴返回方向值、连续原话引文和理由。无法找到相应引文就返回null。只把玩家主动选择的内容算进去；AI代拟增加的态度、NPC是否接受、给了多少兵力，都不能替代人格依据。固定预写选项则按已经标定的语义评分。',
'例如“先把交接记录核清，再回来商量；就算慢一些，也不拿没查明的话作保”，可观察到较强的谋定。只说“你救过我，我愿帮你”尚未体现公共责任与情义的冲突，D留空。“即使你可能受重处，我仍会把真实材料交案”才有清楚的守则与大局依据。',
'同一问题的必要追问属于一次判断。保留最新确认输入，在重试点之后的旧分与旧引文一并清除。请求失败或结果无法对应当前输入时标为待评，不用通关分或默认人格代替。旧请求晚到，必须检查章节轮次、规则版本和输入内容后再决定是否接收。',
`已整理 ${answers.fixtures.length} 条自然语言校准样例，其中 ${coverage.fixtureCount} 条属于当前场景；其余 ${answers.fixtures.length-coverage.fixtureCount} 条是额外条件假设，单独保存，不混入主覆盖率。逐轴及各开放节点规则见 [判定规范](personality/open-answer-rubric.json)。`,
'## 重玩、复活与死亡历史',
table(['操作','当前人格记录','死亡历史'],[
['开始重玩某一章','立即替换该章轮次，清空该章旧选项、开放发言、分值、引文和结局；其他章节各自最新记录保留。整体结果重新计算。','保留。'],
['同章从某检查点复活或重试','保留检查点之前仍有效的选择，删除其后记录，新的选择各计一次。','失败时的记录保留为只读快照。'],
['加载同一轮次的有效旧检查点','只恢复当前轮次的真实前缀，不能把已废弃的另一条分支重新拼回来。','不参与计算。'],
['加载重玩前的旧剧情存档','不得恢复已经清空的人格分；若要从旧剧情继续，建立新轮次，仅记录之后的新行为。','保留原历史，不把它当当前人格。'],
['到达新的普通死亡结局','先归档本次选择和死亡原因；当前记录保持到玩家明确重试/重玩。死亡事件本身不加分。','保存章节、时间、结局、关键选择、原话和当时快照。'],
['第一章开场被魏延杀死','整个教学阶段均无贡献。','可标注“剧情必经”，不显示为玩家的性格依据。'],
['再次计算人格结果','覆盖唯一的最新结果与说明。','不额外存一份常规人格历史。'],
]),
'人格主记录独立于剧情存档保存。每章只持有一份当前记录；历史死亡放在单独列表中。历史快照用于回看“这一回怎么死的”，这版没有从死亡历史继续游玩的功能。第二章记录保留而第一章被重玩后，当前画像会组合各章最新经历，不声称它们来自一次连续通关。',
'## 第二章覆盖检查',
`主检查枚举了 ${coverage.ordinaryMainPlans} 种主线普通选项组合，连同开放样例、提前交案和补救失败后的备选行动，共有 ${coverage.rawChapterTwoRoutes.toLocaleString('en-US')} 条第二章候选路线。合并相同评分状态后，再与第一章正式交涉和可完成的偷听分支组合。每位命中的人物均保存了完整原话、选项编号、最终坐标和实际状态机路径。`,
`主覆盖 ${coverage.reached}/${coverage.total}；当前样例尚未覆盖：${coverage.missing.join('、')}。额外条件假设测试覆盖 ${extra.reached}/${extra.total}，不作为主目标依据。所有 36 位都从第二章起允许匹配，未验证到的人物不设人为章节锁。`,
'覆盖表示至少存在一条人工预期路径能够得到该人物，不表示所有人物等概率出现。现有离线固定发言池也没有被验证为相同覆盖。正式接入后应使用真实AI检验这些输入，并观察实际玩家是否过度集中在少数结果；如果过度集中，先检查表达机会与判定偏差，再讨论是否需要调整人物参考值。',
'许褚的最佳见证路径与第二名距离差较小，属于容易改变的早期结果；魏延等结果也可能只是36位中的最近参照。结果页应使用“目前更像”，不显示未经校准的“98%准确率”。人物解释只引用实际支持的维度；接近的人物可以放在展开说明中，不为了凑一个确定标签编造依据。',
table(['人物','见证坐标 A / B / C / D','第二章结局','领先第二名距离'],coverage.witnesses.map(w=>[w.character,w.coordinates.map(x=>x.toFixed(1)).join(' / '),w.chapterTwo.ending,w.margin.toFixed(2)])),
'## 人物参考坐标',
'以下均为游戏创作中的人物参照值，用于保持匹配一致。它们不是对历史人物做过心理测量，也不直接套用MBTI的官方维度。后续修改需要写版本并重跑覆盖检查。',
table(['人物','A 敢行','B 周旋','C 权变','D 情义'],model.characters.map(c=>[c.name,...c.coordinates])),
'## 后三章接入与验证边界',
'第四至第六章沿用相同坐标、方向值、权重和存档规则。每章尽量给四个维度各安排至少两次相互独立的自主取舍，让后续行为有机会修正早期画像；不要为了凑数量把固定对白或唯一正确答案计入。某章缺少某维度就保留缺失，不能当作中点投票。具体新剧情尚未编写，因此这版不虚构后三章的选项。',
'已提供独立计分器、最新记录与死亡历史的数据模型，以及对应回归检查。它们没有读写浏览器存储。第二章覆盖验证使用本地编译后的真实GrainSession；第三章完成选项与当前源码的对应检查，尚未做人格结果的完整路线回放。正式上线仍需接入各章提交/重试/存档入口、真实AI语义判断和结果页，并完成浏览器试玩。',
'相关文件：[人物与公式](personality/characters-and-model.json)、[前两章配置](personality/chapter-one-two-scoring.json)、[第三章配置](personality/chapter-three-scoring.json)、[开放回答样例](personality/open-answer-fixtures.json)、[主覆盖记录](../../outputs/personality-design-20261026/coverage.json)、[补充覆盖记录](../../outputs/personality-design-20261026/coverage-supplemental.json)。',
'复现命令：先在项目根目录执行npm run build，再执行下列命令。构建产物不纳入提交。',
'```text\nnode tools/personality/validate-config.mjs\nnode --test tools/personality/score.test.mjs tools/personality/latest-store.test.mjs\nnode tools/personality/coverage.mjs\nnode tools/personality/coverage.mjs --include-supplemental\nnode tools/personality/write-design.mjs\n```',
];
writeFileSync(resolve(root,'docs/design/PERSONALITY-SYSTEM-20261026.md'),body.join('\n\n')+'\n');
console.log(JSON.stringify({choiceNodes:all.length,options:optionCount,openNodes:opens.length,fixedSpeeches:first.fixedFallbackSpeeches.length,coreReached:coverage.reached,supplementalReached:extra.reached}));
