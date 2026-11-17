from pathlib import Path
import json, re, hashlib

OUT=Path(__file__).resolve().parent
BASE=OUT.parents[1]
def read(p): return json.loads(p.read_text(encoding='utf-8-sig'))
def write(p,d): p.parent.mkdir(parents=True,exist_ok=True); p.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8')
A=read(OUT/'assignment.json'); C={c['id']:c for c in A['clips']}
PLAYER='同一个约30岁中国成年男性，中音略偏低、清晰自然普通话，胸声温和结实，轻微气息感，克制、有思考停顿，非播音腔、非老年沙哑、非少年尖亮，自然速度，句末落音。心声保持同一声线，更近、更轻，NPC听不见。'
STYLE='历史电影实拍；低饱和墨灰、山青、土褐、麻白，自然肤色、可读暗部与局部灯火，不用水墨贴图、磨皮、塑料皮肤、全局蓝橙或夸张HDR。所有普通镜头是我的双眼，不露我的脸、肩背、倒影，不做第三人称反打，不强塞手或长矛。'
TENT='伤帐与中央空间图一致，苟安侧卧伏在低榻上养杖伤，不能突然站起、翻身或换伤位。我的眼睛在榻侧交谈位置，苟安看镜头位置。榻边小案、帘门、挂甲保持方位，不新增同脸人物。'
MEM='本段明确是苟安口述的主观回忆，摄影机暂借当夜苟安眼睛，面对中央身份图中的李严；不是我亲眼见过。回忆中不拍苟安的脸或肩背，苟安回忆对白从摄影机位置画外说；李严只在自己的台词开口。书房灯位与桌案保持不变。'
REFS={
 'tent':['gouan','wound_tent'], 'manager':['grain_manager','camp_route'],
 'village':['village'], 'memory':['liyan','study'], 'transition':['gouan','wound_tent','liyan','study']}
spec=[]
def add(v,n,d,idx,scene,action,end,shots=None):
    lines=[dict(C[v]['lines'][i]) for i in idx]
    spec.append(dict(id=f'{v}-{n:02}',logicalId=v,duration=d,sourceLines=lines,referenceKeys=REFS[scene],scene=scene,entryState=(TENT if scene=='tent' else MEM if scene=='memory' else '承接前片的空间及人物身份。'),action=action,endState=end,shots=shots or [dict(start=0,end=d,action=action)],status='planned',review='待制作自查；不代表用户通过'))

add('V21',1,10,[0],'tent','我在榻侧停稳，苟安闭口听质问，抬眼后压住手边折信，不用大幅皱眉或怒瞪。','苟安仍伏榻，视线落回我。')
add('V21',2,12,[1],'tent','苟安略抬下巴回答，前半直视我，问句末目光短暂垂向信；手和身子均有榻面支撑。','他看向榻边第二封信。')
add('V21',3,7,[2,3],'tent','苟安从榻边取出已折好的第二封纸信，沿小案平面推向我，完整拍到纸与案面接触。视线低下看信，留出平整纸面。信上不生成可读字，准确摘要由后期文书叠字；所有人闭口。','信留在案上近我这一侧；只有实际呈现后才收录。',[
 dict(start=0,end=3,action='榻侧第一视角看苟安沿案面将第二封折信推来，手指松开后撤回。'),
 dict(start=3,end=7,action='沿视线低头看案上平展信纸，背景苟安虚化闭口；纸面稳定供后期叠加第二封信摘要。')])
add('V21',4,14,[4,5],'tent','视线从案上信抬回苟安；我的质问期间他闭口，停半拍再自己回答，只做很小的抬眼。','苟安接着供述，不新增交互。')
add('V21',5,12,[6],'tent','苟安伏在榻上陈述合谋，手指在毯边收紧后放松，不展示虚构已上报场面。','他停住，等我说话。')
add('V21',6,14,[7,8],'tent','我开口时苟安闭嘴，随后苟安回答，目光回到我；保持同一轴线的可读中近景。','停在苟安面部，不切去战场。')
add('V21',7,9,[9],'tent','我的画外疑问落在两人之间，苟安闭口听，视线停在我，不重演崖边、不拍第三人称救人画面。','留出回答气口。')
add('V21',8,13,[10,11],'tent','苟安回答救人那一刻，语气平实，随后短停顿再说骗你；说完闭口，眼神从我移到案上。','苟安闭口，信仍在近侧案上。')
add('V21',9,6,[12],'tent','停在苟安闭口、纸信在前景的画面，我的心声轻声画外出现，苟安不回应、不点头。','我的眼睛仍在榻侧，顺接V22。')

add('V22',1,10,[0,1],'tent','问完合谋后仍在同一榻前；我画外问话，苟安闭口看我，手边第二封信已经留下。','苟安准备回答种粮的人。')
add('V22',2,10,[2,3,4],'tent','苟安先问种粮的人，再从榻边拿出一块无可读文字的旧木令牌，用拇指食指夹住边缘递到我的视线下方；说拿着后不强行露我接手。','令牌放稳在近侧案面，我可取用。',[
 dict(start=0,end=5,action='榻侧看苟安问话，只有苟安开口。'),
 dict(start=5,end=10,action='视线小幅低下，苟安将旧木令牌放到近侧案上，说拿着；完整拍到支撑与放手，不悬浮。')])
add('V22',3,9,[5,6],'tent','视线抬回苟安，他伏榻说明自己将禀报并劝我去村里，不能在这里出现批准的假动作或出营镜头。','仅表示将禀报，令牌是接待凭证。')
add('V22',4,14,[7,8],'tent','我询问令牌用途时苟安闭口；苟安随后解释接待和核对材料的用途，不递出第二块令牌。','苟安闭口，结束伤帐谈话。')
add('V22',5,12,[9],'manager','切到营内返程粮车旁，我第一视角面对中央粮队管事；他看我，口头明确出营已报准，手掌轻指停稳的返程粮车。没有我说话、签令或擅自出营。','管事说完才准备随队出发；正式批准与令牌分开。')

add('V23',1,10,[0],'village','我随已获准的返程粮队走进村中收粮木棚前，在木桌外停稳。中央村景中的老妇人闭口，将小袋里少量谷粒慢慢收拢到袋底。远处一辆静止粮车和普通村舍；不出现满仓、殴打、抢粮或新证据。','我的视线停在老妇人与很小的粮袋。',[
 dict(start=0,end=4,action='我的双眼沿村路走到木棚前停稳，天然阴天光，普通人保持各自位置。'),
 dict(start=4,end=10,action='我的眼睛轻微低下看老妇人把最后少量粮粒拢到小袋底，双手实际接触布袋，动作缓慢有重量。')])
add('V23',2,13,[1],'village','第一视角停留在木桌外，老妇人把小粮袋口慢慢拢紧后抱在手边，不表演哭喊。我的心声在画外，老妇人与其他人闭口，不对心声作反应；不把她的处境演成抢粮新剧情。','画面落到双手与小粮袋，再抬看她自然脸部，留沉默。')
add('V23',3,10,[2],'tent','无对白。白日访村结束以眼睛转向回营道路为前2秒过渡，随后明确时间略过硬切到傍晚伤帐门内，沿门帘进入两步，停回同一苟安榻前；不可变形穿越、不跨越未批准出营。','停稳于苟安榻侧，傍晚灯已点，承接夜访回忆。',[
 dict(start=0,end=2,action='画面仅为村口回营土路，视线平稳转向来路，允许明确时间跳切。'),
 dict(start=2,end=10,action='硬切到傍晚伤帐门内，我眼睛走两步到苟安榻前停稳；苟安闭口看我。')])
spec[-1]['referenceKeys']=['village','gouan','wound_tent']

add('V24',1,9,[0,1],'transition','现在时伤帐中苟安伏榻开口说那夜，停半拍；以清楚的短叠化转入油灯书房。回忆摄影机借苟安当夜眼睛面对坐在案后的李严，不见苟安或我的身体；此处尚未有李严对白。','回忆中李严坐在案后正看叙述者位置。',[
 dict(start=0,end=5,action='伤帐第一视角中近景，苟安只说那夜一句，口型准确。'),
 dict(start=5,end=9,action='以灯焰为切点短叠化进入李严书房，暂借当夜苟安眼睛，对面李严闭口坐定，明确回忆开始。')])
add('V24',2,13,[2,3],'memory','回忆第一视角面对李严。李严坐在案后说蜀国与权柄，灯光照清脸，语气压低克制，不拍诸葛亮、不示意已经行动。','李严闭口等回忆中的苟安。')
add('V24',3,13,[4,5,6],'memory','回忆中苟安三句都从镜头位置画外说，李严全程闭口倾听，垂眼看案上卷牍后再抬眼，不用李严口型代说。','李严抬眼准备接话。')
add('V24',4,13,[7,8],'memory','李严开口反问错了一回，再慢慢说赔进去的；手停在案边，不新增粮图、密令或篡位实锤。','李严眼睛仍落在叙述者位置，等待下一句。')
add('V24',5,13,[9,10],'memory','李严在同一书房说今日明日和照旧征粮出兵，不拍已经传开的谣言、不切军队出征；动作是很轻地将案上一卷合起。','李严合卷后闭口，书房保持原样。')
add('V24',6,12,[11,12],'transition','回忆苟安疑问从镜头位置画外说，画内李严全程闭口；句末停留1秒。灯影短叠化退回现在时伤帐，同一苟安伏榻闭口，我还站在原处。','明确回到伤帐，回忆只属苟安供述。',[
 dict(start=0,end=8,action='书房回忆第一视角面对李严，苟安在镜头位置画外发问，李严不代说。'),
 dict(start=8,end=12,action='灯影短叠化回现在伤帐，我仍在榻侧，苟安伏榻闭口，不念任何演出说明。')])

add('V25',1,9,[0],'tent','回忆结束后苟安在伤帐开始说另一个打算，面向我，没有起身赴魏，所有画面保持计划正在被讲述的现在。','他继续说明，未发生赴魏。')
add('V25',2,13,[1],'tent','苟安伏榻讲述赴魏散谣的设想，语气坚定但压着气息；不闪回魏营、不展示已散开的谣言或朝廷召军结果。','计划只停留在供述中。')
add('V25',3,11,[2,3],'tent','我问李严知道时苟安闭口，停半拍后由苟安回答李严和李丰；信留在案上，不新增第三封信或新画面人物。','保持伤帐，准备明确未实施。')
add('V25',4,14,[4,5],'tent','苟安先清楚说没有赴魏、没有散谣，再说想让这些人活过这一回；不站起、不喊口号，不拍计划已经成功。','苟安闭口，我准备提出风险。')
add('V25',5,9,[6],'tent','我的画外质问从镜头位置传来，苟安闭口听，视线短暂避开；只用当前伤帐表演，不拍不存在的逼问。','苟安没有回答，继续听后续风险。')
add('V25',6,11,[7],'tent','我继续画外说追击与谣言收场，苟安全程闭口，不做点头认可或预演追击画面。','我的句子结束后停半拍，苟安再答。')
add('V25',7,10,[8,9],'tent','苟安先承认没有把握，停顿后问后方撑不撑得住；不抹掉风险、不暗示我已同意计划。','苟安闭口看我；留待V26，不替玩家作决定。')

splits={'V21-04':(8,9),'V21-06':(5,11),'V22-04':(5,11),'V25-03':(4,9)}
expanded=[]
for c in spec:
 if c['id'] in splits:
  import copy
  for i,d in enumerate(splits[c['id']]):
   part=copy.deepcopy(c);part['sourceLines']=[part['sourceLines'][i]];part['duration']=d
   part['shots']=[dict(start=0,end=d,action=c['action'])]
   part['splitFrom']=c['id'];expanded.append(part)
 else:expanded.append(c)
spec=expanded
counts={}
for c in spec:
 v=c['logicalId'];counts[v]=counts.get(v,0)+1;c['id']=f'{v}-{counts[v]:02}'

def actor(l):
 s=l['speaker']; return '我（心声）' if '心声' in s else '我' if s=='我' or '，我）' in s else '苟安' if '苟安' in s else '李严' if '李严' in s else '粮队管事' if '管事' in s else None
for c in spec:
 for l in c['sourceLines']:
  who=actor(l); l['actor']=who
  l['spoken']=who is not None
  l['recipient']='李严' if c['scene']=='memory' and who=='苟安' else '苟安' if who=='我' else '无（心声他人听不见）' if who=='我（心声）' else '当夜苟安（回忆视点）' if who=='李严' else '我'
  l['voiceMode']='画外心声' if who=='我（心声）' else '画外对白' if who=='我' or (c['logicalId']=='V24' and c['id'] not in ['V24-01'] and who=='苟安') else '画内对白' if who else '无发声'
  l['lipOwner']=who if l['voiceMode']=='画内对白' else '无；画内人物闭口'
  l['listenerReaction']='自然看向说话位置，闭口听；心声不作反应。'
 c['postVoiceOnly']=any(l['actor'] in ['我','我（心声）'] for l in c['sourceLines'])
 assert not (c['postVoiceOnly'] and any(l['actor'] not in [None,'我','我（心声）'] for l in c['sourceLines']))
 if c.get('splitFrom'):
  if c['postVoiceOnly']:c['action']='我的双眼停在苟安榻侧，苟安全程闭口看向我，听者反应仅是轻微抬眼；本请求无任何人声，玩家原句后期加入，不露我的身体，不提前回答。'
  else:c['action']='我的双眼停在同一榻侧，苟安在短暂停顿后自己开口说本请求唯一原句，句末闭口；不重复上一句、不增加我说话的声音。'
  c['shots']=[dict(start=0,end=c['duration'],action=c['action'])]
 # conservative speech slots; keeps half-second margins and time for actions
 spoken=[l for l in c['sourceLines'] if l['spoken']]
 max_t=5 if c['id']=='V24-01' else 8 if c['id']=='V24-06' else c['duration']
 start=.5
 total=sum(max(3,len(re.sub(r'[^\u4e00-\u9fff0-9]','',l['text']))) for l in spoken)
 for l in spoken:
  weight=max(3,len(re.sub(r'[^\u4e00-\u9fff0-9]','',l['text'])))
  budget=(max_t-1.2)*weight/total
  l['start']=round(start,2); l['end']=round(start+budget-.15,2); start+=budget
 # token line intentionally occurs after placing token
 if c['id']=='V22-02':
  spoken[0].update(start=.5,end=4.5); spoken[1].update(start=7.0,end=8.0)

plan=dict(group='G3',title=A['title'],version=1,status='planning-await-central-references',frozenSourceSha256=hashlib.sha256((OUT/'assignment.json').read_bytes()).hexdigest(),constraints=dict(maxDuration=15,minDuration=4,maxInflight=6,pollIntervalSeconds=120,ratio='16:9',model='MiniMax-H3',resolution='768P',approval='待用户review'),logicalClips=[dict(id=c['id'],name=c['name'],entry=c['entry'],next=c['next'],endEvent=c['endEvent'],subclips=[s['id'] for s in spec if s['logicalId']==c['id']]) for c in A['clips']],clips=spec)
write(OUT/'plan.json',plan)

def render(c, refs, generation=False):
 head=f"尺寸：16:9\n模型：MiniMax-H3\n声音：有声音\n时长：{c['duration']}秒\n\n"
 head+='## 参考图（按实际上传顺序）\n\n'
 for i,r in enumerate(refs,1): head+=f"图片{i}：{r['key']}\n完整本地路径：`{r['path']}`\n用途：{r['purpose']}\n\n"
 if not refs: head+='中央图尚未ready；以下为镜头草稿，禁止提交。\n\n'
 text=head+f"## 视频生成 Prompt｜{c['id']}\n\n{STYLE}\n\n{c['entryState']}\n\n入镜状态：{c['entryState']}\n\n"
 for i,s in enumerate(c['shots'],1):
  rel='；'.join(f"图片{n}负责{r['purpose']}" for n,r in enumerate(refs,1)) or '待中央参考图正式绑定'
  text+=f"### 分镜{i}｜{s['start']}-{s['end']}秒\n\n参考图关系：{rel}。身份图只锁本人，不继承身份照站姿；空间图只锁场景；其他图的人不可复制进当前镜头。\n\n画面动作：{s['action']}\n\n摄影切点：{('依视线或动作落稳切镜；不跨对白字音。' if i<len(c['shots']) else '句末与动作落稳后留静止气口。')}\n\n"
  ls=[l for l in c['sourceLines'] if l.get('spoken') and l['start']<s['end'] and l['end']>s['start']]
  if generation and c['postVoiceOnly']:ls=[]
  if c['postVoiceOnly']:text+='本请求只拍闭口听者/动作底片，全程人物嘴唇自然合拢；绝对不生成任何人声。玩家固定声音由中央TTS后期加入，禁止画内NPC代念。\n\n'
  if not ls: text+='对白：无；不念演出、证物摘要、编号、导演说明。\n\n'
  for l in ls:
   text+=f"{'后期配音（模型不生成人声）' if c['postVoiceOnly'] else '对白'} {l['start']}-{l['end']}秒｜原编号{l['node']}｜说话人：{l['actor']}；受话人：{l['recipient']}；声音：{l['voiceMode']}；唯一口型承担者：{l['lipOwner']}；听者反应：{l['listenerReaction']} 原句：『{l['text']}』\n\n"
 text+=f"连续性约束：出镜状态：{c['endState']} 未指定时不引入新人物和新证物，不生成可读文字、字幕、水印、黑边。玩家画外发声时画内NPC全程闭口；只有指定画内说话人做口型。第二封信摘要后期叠加，不朗读。V24的回忆视角只代表苟安口述，不能当作我的亲见；散谣只是一项尚未实施的计划，不拍执行结果。\n\n"
 text+='拍摄手法参考：沿项目已核验的《影》摄影访谈所述有限色彩与明暗层次，应用于本请求全部分镜，保证帐布、面部和灯火分层且暗部可读；《1917》的行动与摄影机关系用于有行走、递物或低头抬眼的分镜，保持目标明确与空间连续。本条具体机位与剪接是本项目设计。研究沿用 docs/video/review-20261021/cli-import/LI02B.md 的核验记录。\n\n'
 text+=f"声音要求：全片无BGM、无背景音乐、无配乐、无吟唱、无音乐鼓点。{'本请求无任何人声，禁止新增对白、旁白、心声；只留环境动作声，玩家声音后期加入。' if c['postVoiceOnly'] else '只留上述逐句原声，无新增人声。'}同步布料摩擦、轻风、脚步（实际行走才有）、纸信或木令牌接触（实际接触才有）、灯芯微响（夜景才有）；没有对应动作不乱加音效。{'后期我的固定音色：'+PLAYER if not generation else ''} 苟安中年中低声，略疲惫粗粝但清楚，不持续呻吟；李严较年长、低稳克制，区别苟安；粮队管事朴实中年男声、简短自然。所有对白自然普通话，留气口，不赶词、不念导演说明。\n"
 return text

def resolve():
 p=BASE/'references/manifest.json'
 if not p.exists(): return {}
 m=read(p)
 # bind is explicit after seeing actual manifest schema
 bindings=OUT/'reference-bindings.json'
 return read(bindings) if bindings.exists() else {}
bindings=resolve()
script=f"# G3 揭穿与访村夜谈｜分镜脚本\n\n制作候选；冻结源逐句保留，待用户review。共{len(spec)}次请求，预估{sum(c['duration'] for c in spec)}秒。每次4–15秒，各V单独拼接。\n\n本次是已冻结剧本的演出执行，沿用screenwriting-master视听与节奏检查；用户已授权持续制作，不设逐步确认。\n\n"
for logical in plan['logicalClips']:
 script+=f"## {logical['id']} {logical['name']}\n\n入口：{logical['entry']}。结束事件：{logical['endEvent']}。\n\n"
 for c in spec:
  if c['logicalId']!=logical['id']: continue
  refs=[dict(key=k,**bindings[k]) for k in c['referenceKeys']] if bindings and all(k in bindings for k in c['referenceKeys']) else []
  prompt=render(c,refs);(OUT/'prompts'/f"{c['id']}.md").write_text(prompt,encoding='utf-8')
  script+=f"### {c['id']}｜{c['duration']}秒\n\n入镜：{c['entryState']}\n\n"
  for s in c['shots']:script+=f"- {s['start']}-{s['end']}秒：{s['action']}\n"
  script+='\n'
  for l in c['sourceLines']: script+=f"- {l['node']}｜{l['speaker']}｜{l['voiceMode']}｜唯一口型：{l['lipOwner']}｜{l['text']}\n"
  script+=f"\n结束：{c['endState']}\n\n"
  if refs and all(r.get('ready') for r in refs):
   write(OUT/'requests'/f"{c['id']}.local.json",dict(model='MiniMax-H3',duration=c['duration'],resolution='768P',ratio='16:9',content=[dict(type='text',text=render(c,refs,True))]+[dict(type='image_url',image_url=dict(local_path=r['path']),role='reference_image') for r in refs]))
(OUT/'分镜脚本.md').write_text(script,encoding='utf-8')
for v,c in C.items():
 original=[(l['node'],l['text']) for l in c['lines']]
 actual=[(l['node'],l['text']) for s in spec if s['logicalId']==v for l in s['sourceLines']]
 assert original==actual,(v,'source coverage drift')
assert all(4<=s['duration']<=15 and s['shots'][0]['start']==0 and s['shots'][-1]['end']==s['duration'] for s in spec)
if not list((OUT/'tasks').glob('*.json')):
 write(OUT/'status.json',dict(group='G3',status='ready-to-bind' if bindings else 'planned-awaiting-central-references',logicalCount=5,requestCount=len(spec),estimatedSeconds=sum(c['duration'] for c in spec),sourceCoverage='all exact and ordered',videoTasksSubmitted=0,referenceNeeds=REFS,remaining=['绑定中央ready图并核对图序','顺序分批提交，最多6在途，每任务至少120秒查询','动态审画面，技术验证、文书准确叠字、同V拼接，逐字听审如未完成须保留限制']))
print(json.dumps(dict(requests=len(spec),seconds=sum(c['duration'] for c in spec),bound=bool(bindings)),ensure_ascii=False))
