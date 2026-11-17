from pathlib import Path
import json, re, hashlib
OUT=Path(__file__).resolve().parent
BASE=OUT.parents[1]
def read(p): return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,d): p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8')
assignment=read(OUT/'assignment.json'); src={l['node']:l for v in assignment['clips'] for l in v['lines']}
specs=[]
def add(id,duration,scene,action,end,lines,refs):
    specs.append(dict(id=id,parent=id.rsplit('-',1)[0],duration=duration,scene=scene,action=action,endState=end,lines=[dict(node=n,text=t or src[n]['text'],speaker=src[n]['speaker'],voiceAndLipOwner=src[n]['voiceAndLipOwner']) for n,t in lines],referenceKeys=refs))
add('V38-01',9,'收件案前，军吏在案后，材料尚在我手侧','第一视角低头，将一叠既有材料平稳推至案前；只露我的手。抬眼对着军吏，他闭口听我说完，不抢先宣布结案。','材料停在军吏手边，交接动作已完成',[('CH2-E2-001',None)],['clerk','case_desk'])
add('V38-02',9,'同一收件案前，材料已经推到军吏手边','军吏低头看收到的材料，再抬眼平静回应；不签署虚构判决，只有军吏开口。','军吏已明确记下停手补报，尚未宣布最终裁处',[('CH2-E2-002','材料收到了。苟安停手补报的经过已经记下，')],['clerk','case_desk'])
add('V38-03',7,'同一案前，军吏继续回应','军吏面对镜头把阶段处置说完，声音落定后合唇。视线停在我所在处。','留营受查与继续核查李严都已告知',[('CH2-E2-002','人先留营受查。李严一节，还要继续核。')],['clerk','case_desk'])
add('V38-04',11,'苟安伤帐外，白日天光，帐帘半落','第一视角站在帐口，苟安仍活着，坐在原铺位，军吏不在场。苟安闭口低头整理衣角，不听见我的心声；不拍押赴刑场。','苟安留营，镜头停在帐口，保留阶段结局',[('CH2-E2-003',None)],['gouan','wound_tent'])
add('V39-01',10,'收件案前，军吏闭口等候','第一视角将实际已有材料放到案前，不展示尚未获得的文书，不生成新证据文字；军吏只听。','材料实际交到案前',[('CH2-LY12A-001',None)],['clerk','case_desk'])
add('V39-02',9,'同一案前，材料已在军吏手边','军吏把材料归拢到案内，不凭空増加文书；抬眼说话，句末闭口。','收件完成；画面不替Q真或Q假作出结论',[('CH2-LY12A-003',None)],['clerk','case_desk'])
add('V40-01',11,'查办已持续一段时间，苟安留营问话，伤势和身份沿用','开头3秒看案头多次翻检留下的材料与侧方低灯，再抬眼看苟安。苟安用原句将推动责任揽下，只轻抬下颌，不猛站、不怒吼。','苟安仍没有与李严共同完成停手和补报；问话未结束',[('CH2-LY12A-004',None),('CH2-LY12A-005',None)],['gouan','case_desk'])
add('V40-02',8,'问话案前，苟安在镜头对面','苟安听我指出材料里的李严知情内容，闭口不代说。他看向案上材料，收住原先要继续揽责的动作。','我已要求照材料查李严，不能自动变成共同补报',[('CH2-LY12A-006',None)],['gouan','case_desk'])
add('V40-03',6,'时间推移至正式处置传来的另一天，营内军吏案前','第一视角从白昼帐口走近一两步，军吏将已经收到的正式卷束放平。我停在案前，没有夺令或改判动作。纯演出，导演说明不念出。','正式处置已经传来，接军吏宣告',[('CH2-LY12A-007',None)],['clerk','case_desk'])
add('V40-04',6,'军吏案前，正式卷束已经摊放','军吏面对我，克制宣读李严处置。只军吏开口；不插入李严交印特写以免凭空增加我的亲见。','李严革职交印已正式宣布',[('CH2-LY12A-008',None)],['clerk','case_desk'])
add('V40-05',9,'同一宣告案前','军吏继续宣告苟安死讯，语气平直沉重；镜头微微停住，无刑杀画面、无血腥、无额外评语。','正式处死消息已传达；不是点交案立即死亡',[('CH2-LY12A-009',None)],['clerk','case_desk'])
add('V40-06',13,'原伤帐，苟安铺位已经空了，帐外有退军空粮车','前6秒第一视角看空铺，原本衣被位置留痕，镜头缓缓转向帐口，外面一辆明显空着的木粮车匀速经过。后7秒停在车尾远去的帐口；没有突然变出粮袋。','空铺与空车留在同一视线关系中，转V42由G5提供',[('CH2-LY12A-010',None),('CH2-LY12A-011',None),('CH2-LY12A-012',None),('CH2-LY12A-013',None)],['wound_tent','camp_road'])
add('V41E-01',10,'早停查路线收件后，营中退军准备','第一视角站在营道边，军吏在近侧接过已交来的卷束，远处士卒收拢营具。一辆空粮车经过。不拍李严、合谋证据或苟安死亡。旁白叙述时间推进。','缺粮已上报，大军开始撤离',[('CH2-LY07-BAD1',None)],['clerk','camp_road'])
add('V41E-02',6,'伤帐原铺位，苟安仍活着','苟安坐着，听见帐外车轮远去，把视线抬到我所在处问一句。只苟安说话，问后合唇等候，不加我的回答。','停在苟安的问题之后',[('CH2-LY07-BAD2',None)],['gouan','wound_tent'])
add('V41E-03',9,'原伤帐口，苟安在原铺位闭口','第一视角看苟安低下眼，不让他对旁白作出知情回应；随后视线落到案侧收起的旧材料，不展示后段新证据。','旁白中段落在未再追问的材料上',[('CH2-LY07-BAD3','他一认罪，我就停了查。他借我报出了缺粮的实情，')],['gouan','wound_tent'])
add('V41E-04',9,'原伤帐口到营道的视线，承接上一片案侧材料','第一视角抬眼看向半落的帐帘，远处退军车轮渐远。不切到李严私议，不给未知合谋补画面。','早停查结局，认知边界保持没有问出合谋',[('CH2-LY07-BAD3','他和李严究竟商量过什么，我始终没问出来。')],['wound_tent','camp_road'])
add('V41L-01',8,'晚交案路线军吏案前，收到全部真实已知材料','军吏审阅材料后抬眼，面对我说第一层判断。不展示查明合谋、李严革职或死亡。','军吏承认材料里有李严参与线索',[('CH2-E4-LATE-001','你说李严参与，材料里也有这些线索。')],['clerk','case_desk'])
add('V41L-02',9,'同一军吏案前，承接未完成回应','军吏指尖只轻压卷束边缘，不点出虚构错处；平稳说清细节对不上，不敷衍怒斥我。','结论支撑不足已告知',[('CH2-E4-LATE-001','可几处细节还对不上，眼下不能照你的结论认定。')],['clerk','case_desk'])
add('V41L-03',8,'同一案前','军吏将认罪记录归入材料，动作不遮口。说完闭嘴，未查明材料仍留案上。','苟安责任先录案，其他继续核查',[('CH2-E4-LATE-002',None)],['clerk','case_desk'])
add('V41L-04',13,'同一案前，军吏闭口收拢文书','第一视角缓缓低头停在已经收到的卷束，不出现新文字；军吏在上方画外继续整理，听不见心声，不回应。','晚支撑不足阶段结局，不复用早停查自责',[('CH2-E4-LATE-003',None)],['clerk','case_desk'])
add('V43-01',9,'营外道路，实际放行确认已完成，苟安面向出营方向','第一视角向路边让开半步，苟安从前方侧身经过，沿出营方向慢慢离去。我的身体脸肩均不出现，只机位位移体现让路；苟安保持伤势步态，不突然奔跑。不拍呈报军吏。','苟安实际离营，停在道路尽头背影；尚未发生赴魏后果',[('CH2-E5-001',None)],['gouan','camp_road'])
add('V43-02',11,'明显晚于放行的另一天，阴天营内道路','第一视角看几名普通士卒原先低声交谈，见我经过就收口，各自散开。只有旁白原句清晰可听，不生成谣言内容；不转第三人称拍魏国，不新增指控内容。','后来散谣已传回的后果明确，E5结束',[('CH2-E5-002',None)],['camp_road'])

# Each spoken source must round-trip exactly, while direction rows remain silent.
coverage={}
for c in specs:
    assert 4<=c['duration']<=15
    for l in c['lines']: coverage[l['node']]=coverage.get(l['node'],'')+l['text']
assert coverage=={n:l['text'] for n,l in src.items()}, 'Frozen lines are not covered exactly'
player='同一个约30岁中国成年男性，中音略偏低、清晰自然普通话，胸声温和结实，轻微气息感，克制、有思考停顿，非播音腔、非老年沙哑、非少年尖亮；说话自然速度，句末落音。对齐现用player TTS ICL_uranus_zh_male_xiaohouye_tob；心声同声线但更近更轻。'
manifest=BASE/'references/manifest.json'
refs=read(manifest) if manifest.exists() else {}
save(OUT/'plan.json',dict(group='G6',status='planned-awaiting-central-references',source_sha256=hashlib.sha256((OUT/'assignment.json').read_bytes()).hexdigest(),clips=assignment['clips'],requests=specs,totalSeconds=sum(c['duration'] for c in specs),requestCount=len(specs),pollMinimumSeconds=120,maxInflight=6,playerVoice=player,sourceCoverage='exact',referencesManifest=str(manifest),review='待用户review；未生成'))
for c in specs:
    p=['尺寸：16:9','模型：MiniMax-H3','声音：有声音',f"时长：{c['duration']}秒",'', '## 参考图', '', '中央参考图待 ready；下列 referenceKeys 将按 manifest 解析为实际附件顺序和存在的绝对路径。未完成绑定前不可提交。', ', '.join(c['referenceKeys']),'', '## 视频生成 Prompt','',f"{c['id']}｜{c['scene']}。玩家眼睛所在第一视角，历史电影实拍、低饱和墨灰山青土褐麻白，自然肤色、可读暗部和局部灯火。无水墨贴图、塑料皮肤、全局蓝橙或夸张HDR。",'',f"### 分镜1｜0-{c['duration']}秒",'',f"参考图关系：{'; '.join(k+'负责其中央身份或空间，按manifest用途绑定' for k in c['referenceKeys'])}。只作参考，不默认复刻全图为首帧。",'',f"画面与动作：{c['action']}", '',f"摄影与切点：平视第一视角，随当前动作轻微移动，人物景别保持可读。入镜状态：{c['scene']}。结束状态：{c['endState']}。留句首句尾呼吸；不跨用户确认边界。",'', '对白与口型：']
    for l in c['lines']:
        silent=('演出' in l['speaker'] or (l['speaker']=='视频（LI06A2）'))
        l['spoken']=not silent
        p.append(f"- 原编号{l['node']}；原说话人{l['speaker']}；受话人："+('无，画面说明' if silent else '我' if ('军吏' in l['speaker'] or l['speaker']=='苟安') else '军吏' if '我'==l['speaker'] else '无，画外心声或旁白')+f"；声音位置与唯一口型承担：{l['voiceAndLipOwner']}；听者按当前动作自然回应，不回应听不见的心声。"+('演出说明不朗读：' if silent else '逐字原句：')+l['text'])
    p+=['',f"全片连续性：{c['endState']}。不拍我的脸、肩背、镜中倒影，不用第三人称反打。我的画外声期间NPC闭口；只有对应NPC原句才开口。文书不生成可辨识文字，精确文字留后期。禁止新增对白、字幕、水印、黑边、额外人物与粮袋；双手只在具体交接动作时出现。角色身份、伤势、服装和空间沿中央参考。",'', '拍摄手法参考：采用项目已核验的《影》摄影研究（ASC：https://theasc.com/article/dual-nature-shadow/）所述低饱和材质和有限暖色，应用于分镜1人物与帐内局部灯火；动作驱动机位借鉴已核验《1917》摄影研究（ASC：https://theasc.com/article/lives-under-siege-the-goldfinch-and-1917/），只将机位随当下动作轻移用于分镜1，不复刻原片具体镜头。','',f"声音要求：全片无BGM、无背景音乐、无配乐、无吟唱、无音乐鼓点。只保留本条指定原句及与画面同步的衣料、卷束、帐布风声、脚步和车轮声（仅实际出现的动作）；无对白段禁止新增人声。玩家固定声音：{player} 苟安中低声、略疲惫粗粝但清楚，不持续呻吟；军吏成年男性清晰克制，区别苟安。旁白沿玩家声线但不让画内人物代读。"]
    (OUT/'prompts'/f"{c['id']}.md").write_text('\n'.join(p)+'\n',encoding='utf-8')
save(OUT/'plan.json',dict(read(OUT/'plan.json'),requests=specs))
doc=['# G6 救人交案与放行结局｜分镜脚本','', '冻结源逐句覆盖；6个V独立回拼，不跨选择/确认边界。所有原句不增不删，演出说明不朗读。当前参考图待绑定，不代表视频已生成。','',f"共{len(specs)}请求，预估{sum(c['duration'] for c in specs)}秒。",'']
for c in specs:
    doc += [f"## {c['id']}｜{c['duration']}秒",'',f"入镜：{c['scene']}",f"动作：{c['action']}",f"出镜：{c['endState']}", f"参考职责：{', '.join(c['referenceKeys'])}",'']
    for l in c['lines']: doc.append(f"- {l['node']}｜{l['speaker']}｜{'原句' if l['spoken'] else '纯演出不念'}：{l['text']}")
    doc+=['']
(OUT/'分镜脚本.md').write_text('\n'.join(doc),encoding='utf-8')
save(OUT/'status.json',dict(group='G6',phase='planned-awaiting-central-references',requests=len(specs),seconds=sum(c['duration'] for c in specs),submitted=0,sourceCoverage='exact',needs=['中央军吏身份与收件案头','中央苟安、伤帐与营道参考图'],review='未生成，未用户审核'))
print(json.dumps(dict(requests=len(specs),seconds=sum(c['duration'] for c in specs),coverage=len(coverage)),ensure_ascii=False))
