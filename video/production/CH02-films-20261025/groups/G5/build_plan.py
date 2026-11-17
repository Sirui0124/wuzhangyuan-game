from pathlib import Path
import json, re, hashlib
OUT=Path(__file__).parent
ROOT=OUT.parents[1]
def read(p): return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,x):
    p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(json.dumps(x,ensure_ascii=False,indent=2),encoding='utf-8')
assignment=read(OUT/'assignment.json')
lines={x['node']:x for c in assignment['clips'] for x in c['lines']}
clips=[]
def add(id,duration,nodes,scene,refs,action,start,end,post=None):
    clips.append(dict(id=id,slot=id.rsplit('-',1)[0],duration=duration,nodes=nodes.split(),scene=scene,referenceKeys=refs.split(),action=action,startState=start,endState=end,post=post or []))
add('V32A-01',12,'CH2-LY11-001 CH2-LY11-002','伤帐夜内','gouan tent','苟安坐在榻侧看着我，闭口听完我的话才说自己的短句，随后视线落到低案空纸。','苟安尚未动笔，我坐在对面','纸尚未铺开，苟安视线落案')
add('V32A-02',8,'CH2-LY11-017','伤帐夜内','gouan tent','苟安向案面轻伸手停住，抬眼对着镜头位置说完，保持克制。','低案待写','话音落定，等我回答')
add('V32A-03',15,'CH2-LY11-018 CH2-LY11-019','伤帐夜内','gouan tent','苟安闭嘴听我问完，不点头抢答；停一口气后说愿意，伸手将纸在案上铺平。','苟安等待回答','苟安接受留下，不展示寄出或处分')
add('V32A-04',14,'CH2-LY11-020 CH2-LY11-021','伤帐夜内案头','gouan tent','我略低头看苟安右手持毛笔在纸上缓慢写交代，只有苟安手部及袖口；不把文书读出。最后纸面停稳，给后期准确文书内容留白。','纸铺在低案上','交代已经成文，但尚未署名',[
 {'text':lines['CH2-LY11-020']['text'],'start':1,'end':7}, {'text':lines['CH2-LY11-021']['text'],'start':7,'end':14}])
add('V32A-05',9,'CH2-LY11-022','伤帐夜内案头','gouan tent','我人眼位置低头看案面；苟安右手持笔划去一条既有短墨迹，再在下方签署，笔尖接触纸、提起、放回笔搁均真实；不写可读字，留后期字层。','交代成文，纸上还有行险安排','苟安已划去赴魏安排并署名；不得先交给信使',[
 {'text':'若仍不听便赴魏','start':0,'end':4,'strike':True}, {'text':'苟安','start':5,'end':9,'signature':True}])
add('V33-01',9,'CH2-LY11-024','营地传信处日间','courier camp','我手从画面下沿递出已封好的纸卷，传信人双手稳稳接住，抬眼说自己的话后将信收入包内；他未在话前离开。','玩家已在UI确认收件人与附件','信件已实际交给传信人；不显示回信')
add('V34-01',15,'CH2-LY12B-001 CH2-LY12B-002','李严日间书房','liyan study','本段是传信人目击视角，李严在对面案后先低头读信两秒，放下信抬眼向送信的镜头位置说原句，眼神停顿但不流泪。','信使已经把信交到李严案前','李严读完并提出疑虑，信使仍未取得补报')
add('V34-02',11,'CH2-LY12B-003 CH2-LY12B-004','李严日间书房','liyan study','李严坐在同一案后看向送信人，先说蜀魏一句，停顿，再说撤回计划；手把原行险纸卷推到案左边。','李严刚说出疑虑','原计划从面前移开，但补报还未写成')
add('V34-03',12,'CH2-LY12B-005','李严日间书房','liyan study','李严先看着送信人说原句，闭嘴后低头在右侧干净纸上开始落笔。保持案左旧纸与案右新纸方向。','旧安排位于案左','真实粮情与本人经过开始写成，不提前交出')
add('V34-04',12,'CH2-LY12B-ACT01','李严日间书房案头','liyan study','从送信人坐姿眼高略俯看案头，李严在更正说明末端完成落笔、提笔签署，最后把两张叠好的补报递向镜头，信使手在下沿接住；不出现玩家装束。','补报写就待签','李严已签署交给信使，我尚未取得附件',[
 {'text':'更正粮情及本人责任说明\n李严','start':7,'end':12,'signature':True}])
add('V35-01',8,'CH2-LY12B-RECV01','回到伤帐外日间','courier camp','回到玩家眼睛位置；传信人站在帐外，把一封回信和两张署名补报一起递给我，我两只手从下沿托住而非悬空抓取，传信人松手才完成交接。','传信人实际回营，材料还在他手中','回信和补报已真实到我手里')
add('V35-02',12,'CH2-LY12B-006 CH2-LY12B-007','伤帐案前日间','tent','我把刚接回的信放在案上展开；由我眼睛低头看信，只出现真实手与留白纸，不生成可读字；停稳等待核读。','回信刚交到我手','我已读到据实请退与再战另议',[
 {'text':lines['CH2-LY12B-006']['text'],'start':1,'end':6},{'text':lines['CH2-LY12B-007']['text'],'start':6,'end':12}])
add('V35-03',15,'CH2-LY12B-008 CH2-LY12B-009 CH2-LY12B-RECV02','伤帐案前日间','tent','我将回信旁的两张补报并排放稳，指尖仅沿纸边逐一核阅；最后两份材料同在案上，手离开不遮文字；无朗读，无自动递交给军吏。','已读回信前两项','我已核读粮情与责任附件，等待UI正式提交',[
 {'text':lines['CH2-LY12B-008']['text'],'start':0,'end':6},{'text':lines['CH2-LY12B-009']['text'],'start':6,'end':15}])
add('V36-01',10,'CH2-LY12B-010','军吏收件案日间','clerk desk','我站在收件案前，军吏在对面闭嘴听我请求；我的手把叠齐的原信、查粮材料和两人补充说明放稳案前；不提前宣布结案。','UI正式提交已确认','全部材料摆到军吏面前，等待核收')
add('V36-02',13,'CH2-LY12B-011','军吏收件案日间','clerk desk','军吏手按纸边逐份确认材料，抬眼对我说自己的原句；先收齐才谈核实，声音平稳。','材料已在案上','军吏正式确认收齐，尚未宣布处分')
add('V36-03',10,'CH2-LY12B-014','军吏收件案日间','clerk desk','军吏看一眼案上正式纸卷后抬眼向我宣读李严的裁处，面部自然，没有愤怒说教；我始终画外。','正式核收与核实后的裁处时段','李严交出粮运调度职责并仍须查问')
add('V36-04',12,'CH2-LY12B-015','军吏收件案日间','clerk desk','军吏在同一位置向我宣读苟安的具体裁处；身体不夸张摆动，不拍苟安穿上军官衣甲。','李严裁处已读完','苟安免队长、留下普通粮兵，责任没有免除')
add('V36-05',11,'CH2-LY12B-016','军吏收件案日间','clerk desk','军吏放低纸卷，看着我说完补救情节与仍须担责的原句，停稳后闭口。','双方具体裁处已说明','正式处置说明完整，E1成立所需实际裁处发生')
add('V36-06',7,'CH2-LY12B-017','营地日间收件案','clerk desk','保持玩家眼高，一名无台词传令兵从侧面把退军令纸卷交到军吏案边；军吏接过，没有欢呼。镜头转向帐外待退军的空粮车，车内空而非凭空装满。','双方已经受裁处','退军令到，粮缺仍在，无新增对白')
add('V37-01',14,'CH2-LY12B-018 CH2-LY12B-019','向南归途阴天','gouan road','我站在空车后几步，苟安穿普通粮兵粗麻衣立于车侧，身体恢复到可缓慢扶车而非奔跑；他忙于调整车把，闭口且听不见我的心声。镜头视线自其普通衣着移向空车与缓慢南撤军列。','E1已裁处，已在归途','我仍站在车后尚未搭手，苟安闭嘴')
add('V37-02',6,'CH2-LY12B-020','向南归途阴天','gouan road','苟安在空车侧转头看向落后几步的我，说原句，随即转回车行方向；只他一人开口，无新增对白。','我站在空车后','苟安叫我搭手，我尚未伸手')
add('V37-03',9,'CH2-LY12B-021','向南归途阴天','gouan road','镜头随我走近空车后端，我两手自然从下沿落在坚实后横木，两手掌各自完整接触，车开始向南动；苟安在左侧扶车，轮子压过浅车辙，不悬空不穿轴。','空车后横木在前方一步','车轮越过浅辙继续向南，我手保持受力')
add('V42-01',7,'CH2-LY13-001','旧卷案头室内','archive','玩家人眼俯看旧木案，双手把旧卷从近处向前摊开，露出户口、征发、损耗的留白栏目，仅有旧墨痕不生成精确数字；最后摊平停止。','E1或E3各自裁处完成后的独立尾声入口','旧卷已展开，无新增结局',[
 {'text':'户口　　征发　　历次损耗','start':3,'end':7}])
add('V42-02',15,'CH2-LY13-002 CH2-LY13-003','旧卷案头室内','archive','保持玩家视点在案前，旧卷左右幅相接；视线从更辽阔地域记录移向蜀中多次损耗栏目，指尖轻移到纸边后停住，不添加具体人口数字、不虚造地图证据。心声同一玩家声线。','旧卷摊开，已能看见三类记录','视线停于缺口记录上，不产生回溯光效')
add('V42-03',7,'CH2-LY13-004','旧卷案头室内','archive','仍是我眼睛俯看旧卷，我的手轻轻按住卷首，将纸卷往更早记录翻过一页，停在旧纸纹理与柔和天光中；不拍我的脸、肩背或倒影，不新增重生特效。','案上旧卷停于损耗记录','更早记录翻开，静止收尾')
# 根任务统一玩家TTS；混合片先拆成闭口底片与NPC发声片，避免后期误伤NPC。
revised=[]
for c in clips:
    if c['id']=='V32A-01':
        a=dict(c,id='V32A-01',duration=9,nodes=['CH2-LY11-001'],action='苟安坐在榻侧看着我，自始至终闭口听我的请求，只有微小呼吸与目光移动；不发声不做说话口型。',endState='我的请求已说完，苟安待答')
        b=dict(c,id='V32A-02',duration=4,nodes=['CH2-LY11-002'],action='苟安看着镜头位置说“那就把纸铺开。”随后视线落到低案空纸，尚未署名。',startState='我已说完请求，苟安准备回答')
        revised.extend([a,b])
    elif c['id']=='V32A-02':revised.append(dict(c,id='V32A-03'))
    elif c['id']=='V32A-03':
        revised.extend([
            dict(c,id='V32A-04',duration=8,nodes=['CH2-LY11-018'],action='苟安闭嘴听我问完，不点头抢答；视线留在镜头位置，自始至终不发声、不做说话口型。',endState='我已问完，苟安待表态'),
            dict(c,id='V32A-05',duration=8,nodes=['CH2-LY11-019'],action='苟安看着我说原句，话音落下才伸手把低案空纸铺平。',startState='我的询问已说完')])
    elif c['id']=='V32A-04':revised.append(dict(c,id='V32A-06'))
    elif c['id']=='V32A-05':revised.append(dict(c,id='V32A-07'))
    else:revised.append(c)
clips=revised
for c in clips:
    c['sourceLines']=[lines[n] for n in c['nodes']]
    c['spokenLines']=[x for x in c['sourceLines'] if x['voiceAndLipOwner'].startswith(('我的','只由'))]
    c['postVoiceLines']=[x for x in c['spokenLines'] if x['voiceAndLipOwner'].startswith('我的')]
    c['generatedSpokenLines']=[x for x in c['spokenLines'] if x['voiceAndLipOwner'].startswith('只由')]
    c['shots']=[dict(start=0,end=c['duration'],action=c['action'])]
    c['status']='planned-awaiting-central-references'
    c['entry']=next(s['entry'] for s in assignment['clips'] if s['id']==c['slot'])
    c['next']=next(s['next'] for s in assignment['clips'] if s['id']==c['slot'])
covered=[n for c in clips for n in c['nodes']]
assert sorted(covered)==sorted(lines)
assert len(covered)==len(set(covered))
save(OUT/'plan.json',dict(group='G5',title=assignment['title'],source='assignment.json; frozen sources rev7/rev11',slots=7,requestCount=len(clips),estimatedDuration=sum(c['duration'] for c in clips),status='planning-awaiting-central-references',clips=clips,sourceCoverage={'covered':covered,'missing':[]},reviewStatus='制作候选，待用户review',boundaries='V32A后Q/SEND确认；V35后UI-E1-FILE；不跨确认点合并'))
script=['# G5 共同补救与归途｜分镜脚本','',f'7个逻辑段，{len(clips)}次请求，预计{sum(c["duration"] for c in clips)}秒。每请求4–15秒；所有文书/演出不自动朗读。', '', '情绪推进：接受留下并如实署名 → 信件实际寄出 → 远方撤回并署名 → 真实回营核阅 → 正式收件与担责 → 扶空车南撤 → 旧卷引向更早时点。', '', 'V34仅信使目击；V35才回到玩家。V32A后、V35后分别保留确认UI。V42仅E1/E3共用一次，不为其他结局自动播放。']
for c in clips:
    script += ['',f'## {c["id"]}｜{c["scene"]}｜{c["duration"]}秒',f'进入：{c["startState"]}',f'分镜1｜0–{c["duration"]}秒：{c["action"]}',f'结束与接法：{c["endState"]}']
    for x in c['sourceLines']:script += [f'- {x["node"]}｜{x["speaker"]}｜{x["voiceAndLipOwner"]}｜{x["text"]}']
(OUT/'分镜脚本.md').write_text('\n'.join(script)+'\n',encoding='utf-8')
save(OUT/'status.json',dict(group='G5',phase='planning',requests=len(clips),estimated_seconds=sum(c['duration'] for c in clips),centralReferences='awaiting ready manifest',submitted=0,unresolved=['动态审片及听审尚未进行','中央参考图尚未发布ready，未提交视频']))
print(f'G5 planned {len(clips)} requests / {sum(c["duration"] for c in clips)} sec; all {len(lines)} source nodes covered once')
