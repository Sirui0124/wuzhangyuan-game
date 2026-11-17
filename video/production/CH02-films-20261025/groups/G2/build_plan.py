from pathlib import Path
import json,re,math,hashlib
OUT=Path(__file__).parent;BASE=OUT.parents[1]
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,d):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8')
A=read(OUT/'assignment.json')
STYLE='玩家第一视角，摄影机就是我的眼睛；禁止拍我的脸、肩背、倒影和第三人称反打。三国军营历史电影实拍，低饱和墨灰山青土褐麻白，保留自然肤色和暗部细节，真实旧木、粗麻、竹木简牍。柔和侧向阴天天光；不全局蓝橙、不HDR、不水墨纹理、不塑料皮肤。无长矛常驻前景，无字幕、水印、黑边。'
VOICE='我的画外对白统一为同一个约30岁中国成年男性，中音略偏低、清晰自然普通话，胸声温和结实，轻微气息感，克制、有思考停顿，非播音腔、非老年沙哑、非少年尖亮，自然语速，句末落音；对齐player TTS ICL_uranus_zh_male_xiaohouye_tob。苟安中低声略疲惫粗粝且清楚；管事较沉稳中音；仓吏清晰稍干涩中低音；地方经手人朴实平缓。描述是约束，不能保证锁定声纹。'
FILM='拍摄手法参考：《影》取灰阶层次中保留肤色、旧木麻布的触感，用于本条所有分镜的材质与侧向光线；参考研究为ASC摄影访谈 https://theasc.com/article/dual-nature-shadow/ 。《1917》取按人物行动距离安排机位和步行节奏，用于入仓、低头核账和抬眼交谈的有动机运动；参考 https://theasc.com/article/lives-under-siege-the-goldfinch-and-1917/ 。具体第一视角与剪接由本项目设计，不照搬原片人物或故事。'
ACT={
'CH2-LY04-001':'我已走到仓门内的核验案前，右手将真实本队凭据放在近侧桌面；管事看凭据再看摄影机，始终闭嘴听。结束时凭据平放，手退下。',
'CH2-LY04-002':'管事在同一案边低头比对凭据上的经手印记，再抬眼向我开口；说完侧身让开通往仓吏案头的路。凭据不变成新物件。',
'CH2-LY04-003':'我沿刚才让出的通道来到仓吏案前。仓吏先将本批账牍取到桌上，开口说明边界，另一捆其他队账牍仍捆好放远处，不打开。',
'CH2-LY04-F01':'我低头看刚获准查阅的一批账牍，右手仅把近侧一片木牍转正；远侧仓吏闭口。镜头沿凭据与交付账之间自然移动，没有仓内藏粮的画面。',
'CH2-LY04-D01':'本批签收木牍已放近侧，右手扶住下缘，镜头俯看经手印记、分栏和空白文字区。两秒后手退出，保持6秒安静观察。木牍内容由后期准确叠加，模型不造字。',
'CH2-LY04-D02':'左边保留上一片签收木牍，仓吏单手把同批出仓交付木牍放在右边，物体完整接触桌面后手退出。镜头观察两片的同批印记与分栏，保持6秒。不可出现足额实粮或贪污实锤。',
'CH2-LY04-D03':'前两份账牍不换形，右手把本队行程册展在最下方，与交付木牍分开；镜头从已签收处落向行程册的损耗栏。落稳后安静观察6秒。不让模型写可读字，不新增人声。',
'CH2-LY04-Q1A':'保持仓案和并排交接账，摄影机略抬到管事闭口倾听的脸；随后视线回到两片账牍，右手只指向两处经手印记，不画答案箭头。',
'CH2-LY07-W01':'已按选项回到原伤帐榻前，坐姿眼高看同一苟安，他保持中央图伤势和衣物，闭口听我询问；不补念按钮，不移动伤处。',
'CH2-LY07-W02':'延续同一伤帐位置，苟安看向我，轻收下颌后开口认罪，说到末句把视线压低。仅嘴唇与小幅呼吸运动，伤势不变化，不站起来。',
'CH2-LY04-Q1C':'仍在仓案，管事看向摄影机，听我的判断时嘴闭合，末尾视线落回出仓账；不切到苟安，不出现受罚回忆。',
'CH2-LY04-Q1FB0':'管事先看已经摆出的交付账，再抬眼提出反问；说到再对对时手掌停在两份账的旁边，不遮住证物，不用手指穿过木牍。',
'CH2-LY04-F02':'前线接收人在同一仓案对面，将本队签收与出仓交付两份木牍并排，落稳后先看我再开口。说到路上损耗时只短看独立行程册，结束保留三份账。中性承接A/C或B明确返回，不暗示已选A。',
'CH2-LY04-T01':'摄影机从已核对的交付账缓慢移向仓吏另取出的本批入仓账，手只稳住木牍边缘；仓吏闭口听。仓内粮袋零散正常放置，不出现隐蔽满仓。',
'CH2-LY04-D04':'入仓账平置在近侧旧木案，上一批交付木牍保留在边缘，右手依次指向实际入仓与对应发出分栏，动作完成后退下，留6秒核看。木牍文字区留白由后期叠加。',
'CH2-LY04-W01':'摄影机从刚核过的入仓账抬眼向仓中经手人发问，对方闭口听完才将视线转向本批地方实收账，不得替我说话。',
'CH2-LY04-D05':'入仓账仍在左侧，经手人把地方实收账完整摆在右侧，手退出。两份同批经手印记落在同一视线高度，镜头安静观察6秒。精确文字后期叠加，不出现新的粮食数量。',
'CH2-LY04-C01':'视线从并排实收和入仓账略抬向地方经手人，他闭口听我的问题，结束低头看即将展开的应征账，不提前回答。',
'CH2-LY04-D06':'地方经手人将本批应征账平放在近侧，右手只指过应征、实收、欠交三栏留白区域，不书写、不改数。手退出后镜头安静观察6秒，只在本取得时点后期出现准确文字。',
'CH2-LY04-Q4A':'仓案上的应征与实收账保持，摄影机略抬向地方经手人。他闭口听我错误判断，微皱眉但不提前说话；没有扣粮或满仓的画面。',
'CH2-LY04-Q4FB0':'地方经手人先低头看应征栏，再抬眼反问我；说到粮在哪儿时手仍放在桌沿，不指向虚构藏粮。',
'CH2-LY04-Q4B':'摄影机低头从应征账移向实收和交付记录，再抬眼向地方经手人说话。他闭口听，末尾仅轻点头，不新增催征公文或承诺。',
'CH2-LY04-Q4C':'摄影机看桌上本批账后向地方经手人说话；他闭口听完，不抢答，不提早取出缺额报告。',
'CH2-LY04-Q4FB1':'地方经手人向我回应，说到交付入仓记录时将已经展示过的木牍归到近侧，放稳后撤手，不另造新证据。',
'CH2-LY04-C04':'同一地方经手人立在仓案对面，向我解释既有调度决定；他看一眼本批应征账，再回看我，口型只说本句。不切李严镜头，不演未发生的催征。',
'CH2-LY06-014':'视线沿桌面转到仓中经手人，他从案侧取出一份旧纸缺额报告，平置后开口说明。纸不穿模，印记和同批标识仅作图案，文字留白待后期。',
'CH2-LY06-015':'缺额报告完整平放，摄影机俯看，手仅压住下缘随后退出，保持6秒观察。正文区域留白，由后期在此取得时点准确叠加；不读正文，不提前展示签认与送达结论。',
'CH2-LY06-016':'摄影机从缺额报告下方确认区域抬眼问仓中经手人；对方嘴闭合，只把眼神从纸转向我，不能提前开口。',
'CH2-LY06-017':'仓中经手人回应我，先看报告确认区域，再看我，动作克制；不插入苟安过去签字的伪亲见回忆，不额外证明。',
'CH2-LY06-018':'经手人把同批送达记录放在缺额报告旁，接触桌面后手退出，镜头观察同日的对照位置6秒。模型不造可读文字，准确正文仅此时后期叠加。',
'CH2-LY06-019':'仓中经手人对着我说本句，手掌靠近已经摆出的回执和仓账，停在纸外不遮字。无受杖场面、无新增签字场面。',
'CH2-LY06-021':'摄影机转向同一仓吏，他指一下当天本批仓账的留白缺额栏，再抬眼向我说话；最后手退下，留下缺额报告、回执和当天仓账并排，接玩家确认界面，不自动回伤帐。'
}
ROLE={'粮队管事':'grain_manager','仓吏':'warehouse_clerk','前线接收人':'frontline_receiver','地方经手人':'local_handler','仓中经手人':'warehouse_handler'}
clips=[]
for v in A['clips']:
    idx=0
    def add(lines,duration,action,roles,kind='dialogue',part=None):
        global idx
        idx+=1
        clips.append(dict(id=f'{v["id"]}-{idx:02}',parent=v['id'],name=v['name'],duration=duration,kind=kind,sourceLines=lines,referenceRoles=roles,shots=[dict(start=0,end=duration,action=action,camera='第一视角眼高或自然俯看，35至50mm正常透视，小幅有动机运动；动作落稳和句末留气口后硬切，末0.7秒稳定。')],entry=v['entry'],nextBoundary=v['next'],endEvent=v['endEvent'],status='planned_waiting_central_references',part=part))
    if v['id']=='V13':add([],8,'由玩家眼睛沿仓门内侧向案头走两步。管事在案旁闭口等候，零散粮袋与通道保持现实规模，不是满仓。我走稳后视线落到案头，本队凭据仍在手外，下一片才放上。全程无对白无旁白。',['grain_manager','warehouse'],kind='observation')
    if v['id']=='V14':
        l=v['lines']
        add(l,10,'我在仓案前低头，双手从卷轴外缘把一张浅麻白粮运图摊开，实物展开后双手退出。卷上只有淡山形、河道与留白，不生成人物、关系符号、数字或任何文字。摄影机稳看五个后期位置：地方应征、实际征收、入仓、调拨发出、粮队领取；只示关系不出现缺额答案。',['warehouse'],kind='map',part='forward')
        add(l,10,'延续已经完全摊开的同一粮运图，卷边及桌面物件位置不变。摄影机轻向图的领取端落低，再稳定。图面仅淡地形留白，无文字无箭头；后期沿粮队领取、调拨发出、入仓、实际征收、地方应征顺序回看，不泄露缺额结论。全程无对白。',['warehouse'],kind='map',part='reverse')
        continue
    for l in v['lines']:
        doc='文书准确叠字' in l['voiceAndLipOwner']
        speaker=l['speaker'];roles=['gouan','injury_tent'] if v['id']=='V16B' else ['warehouse']
        listener={'CH2-LY04-001':'grain_manager','CH2-LY04-T01':'warehouse_clerk','CH2-LY06-016':'warehouse_handler'}.get(l['node'],'local_handler' if v['id'].startswith('V19') else 'grain_manager' if v['id'].startswith('V16') else 'warehouse_handler' if v['id']=='V18' else 'warehouse_clerk')
        if not doc and v['id']!='V16B':roles.insert(0,ROLE.get(speaker,listener))
        if doc or v['id'] in ['V14','V15','V18','V20']:roles.append('desk')
        chars=len(re.findall('[\u4e00-\u9fff]',l['text']))
        duration=10 if doc else max(6,min(15,math.ceil(chars/3.3+2.0)))
        add([l],duration,ACT[l['node']],roles,kind='document' if doc else 'dialogue')
save(OUT/'plan.json',dict(group='G2',version=1,source_sha256=hashlib.sha256((OUT/'assignment.json').read_bytes()).hexdigest(),sourceFrozen='dialogue rev7 / logic rev11',status='waiting_central_references',clips=clips,parents=[dict(id=v['id'],name=v['name'],entry=v['entry'],next=v['next'],endEvent=v['endEvent'],children=[c['id'] for c in clips if c['parent']==v['id']]) for v in A['clips']],requestCount=len(clips),totalCandidateSeconds=sum(c['duration'] for c in clips),review='制作自查不等于用户通过'))
save(OUT/'status.json',dict(group='G2',phase='planning_complete_waiting_references',requestCount=len(clips),submitted=0,sourceSlots=len(A['clips']),notes=['central manifest not yet ready','no paid video requests submitted']))
script=['# G2 查粮取证与三种判断分镜脚本','冻结源：纯对白rev7、逻辑rev11；候选片待用户review。','以实际物件展示和核对推进，不拍隐藏满仓、不添加贪污证据。每片单一说话人；文书无朗读。所有互斥选项和UI边界独立。',f'计划{len(clips)}条请求，总候选{sum(c["duration"] for c in clips)}秒（含互斥分支）。']
for c in clips:
    script += [f'## {c["id"]}｜{c["name"]}｜{c["duration"]}秒',f'入口：{c["entry"]}；本V结束接：{c["nextBoundary"]}。',f'分镜1｜0–{c["duration"]}秒',c['shots'][0]['action'],c['shots'][0]['camera']]
    for l in c['sourceLines']:script += [f'{l["node"]}｜{l["speaker"]}｜{l["voiceAndLipOwner"]}：{l["text"]}']
    if not c['sourceLines']:script += ['无对白、无旁白、无新增人声。']
(OUT/'分镜脚本.md').write_text('\n\n'.join(script),encoding='utf-8')
print(json.dumps({'requests':len(clips),'seconds':sum(c['duration'] for c in clips),'parents':len(A['clips'])}))
