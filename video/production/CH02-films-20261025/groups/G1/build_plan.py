"""Frozen dialogue to reviewable G1 shot plan; never edits source or game files."""
from pathlib import Path
import json, hashlib, math
OUT=Path(__file__).resolve().parent
def load(p): return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,v): p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(v,ensure_ascii=False,indent=2),encoding='utf-8')
source=load(OUT/'assignment.json'); slots={c['id']:c for c in source['clips']}; clips=[]
STYLE='历史电影实拍质感。低饱和墨灰、山青、土褐、麻白，自然肤色，暗部可读，暖光只来自真实灯火。旧麻布、木器和哑光铁甲有重量；禁止水墨贴图、塑料皮肤、HDR亮边和蓝橙通染。'
POV='摄影机是我的双眼，全程玩家第一视角；禁止拍我的脸、肩背、倒影和第三人称反打。正常对话不露手、不持矛；仅实际掀帘、扶车或接物时手进入画面。'
VOICE='我的声音固定为同一个约30岁中国成年男性，中音略偏低，清晰自然普通话，胸声温和结实，轻微气息，克制并有思考停顿，非播音腔、非老年沙哑、非少年尖亮，句末落音。心声同一身份但更近更轻，NPC听不见。苟安固定中年男性，中低声，疲惫粗粝但吐字清楚，不持续呻吟。粮队管事为清楚平实的中年男声，区别于苟安。'
FILM='拍摄手法参考：《影》ASC摄影访谈（https://theasc.com/article/dual-nature-shadow/）关于低饱和材料及有限暖色的处理，用于本条各分镜的麻布、肤色与灯火；《1917》ASC摄影访谈（https://theasc.com/article/lives-under-siege-the-goldfinch-and-1917/）中以行动安排机位与行进距离，用于本条有行进或接物的分镜。具体第一视角及剪切由本项目设计，不声称原片使用相同机位。'
def ln(v,i,text=None):
    x=dict(slots[v]['lines'][i]);
    if text is not None:x['text']=text
    return x
def add(v,d,indices,action,*,refs=None,entry=None,end=None,camera=None):
    n=1+sum(c['slot']==v for c in clips); cid=f'{v}-{n:02d}'
    lines=[ln(v,i) if isinstance(i,int) else ln(v,*i) for i in indices]
    refs=refs or ['gouan','wound_tent']
    clips.append(dict(id=cid,slot=v,name=slots[v]['name'],duration=d,referenceKeys=refs,
        sourceLines=lines,entryState=entry or '承接前一子片，同一苟安、伤帐、灯向和服装，人物不跳位。',
        endState=end or '动作与句子均完整结束，留闭口反应，可在此切入同槽位下一片。',
        shots=[dict(start=0,end=d,action=action,camera=camera or '玩家眼高，正常交谈距离的稳定中近景；以视线的小幅变化代替无动机推拉，头顶留空间。',lines=lines)],
        continuity='苟安伤后只在榻上，灰麻衣黑巾短须，伤势与左右方位以中央伤帐图锁定；不添加新绷带，不站起走动。文书只见真实纤维与模糊墨迹，精确文字留游戏UI或后期；不生成字幕、水印、黑边。' if 'wound_tent' in refs else '保持同一空间、服装、道具状态；不新增证据、人物或剧情结论。禁止字幕、水印、黑边。',
        status='planned-reference-binding-pending'))

# V01: chain of physically continuous actions; no injury bandages before punishment.
add('V01',8,[0],'崎岖山路上，我跟着一辆木轮粮车走。车轮压过湿石，车向崖侧歪斜；一袋沉重的粮滑到车沿。先看到粮袋与崖边的距离，未出现救援。',refs=['gouan','mountain_road'],entry='开章；苟安尚未受杖伤，不出现绷带或伤帐衣物。',end='粮袋停在车沿，视线跟着它下移。',camera='第一视角跟车缓行；随车轮绊动轻晃，俯看粮袋，不拍我的身体。')
add('V01',8,[],'接前片车沿粮袋，我右手扶袋；脚下湿岩打滑，摄影机失去重心向崖侧下降。右手及时攀住岩边，粮袋仍有实物重量，不飞起来；镜头停在崖外较低位置。',refs=['gouan','mountain_road'],entry='粮袋仍在车沿，车与岩壁方向不变。',end='我停在崖外，前臂靠近岩沿；没有已经被拉上去。',camera='玩家视线先看袋再随失足下降；不显示我的全身或越轴侧面，不快切掩盖坠落。')
add('V01',10,[],'从崖外仰望，同一未受伤的队长在岩沿伏低，将右手牢牢握住我的右前臂，先稳住接触，再向后移重心，将视线拉回路面。末尾看到他闭口确认我站稳，衣甲泥痕与前片一致。',refs=['gouan','mountain_road'],entry='我还在岩沿下，队长的手尚未接触我。',end='实际拉回山路后落稳；只知道他是救命队长，尚未认名。',camera='一镜完成握住、承重、拉起、站稳；双手接触处保持可见，不把抓手变拥抱，不出现第三只手。')

add('V02',7,[0],'山路之后的营地路口，第一视角低头看一次自己沾泥的运粮袖口，再抬眼望粮队；只听我的心声，远处兵卒不开口。',refs=['camp_night'],entry='获救后，尚未进伤帐。',end='视线落在通往伤帐的营道。',camera='眼高稳定行走，轻俯仰；不看见我的脸、背影或现代物件。')
add('V02',10,[1],'我沿营道缓步，视线掠过空下来的木车与帐绳。心声回想苟安的旧事，只拍此刻营地；不重演受罚、不展示判罪文书或未来事件。',refs=['camp_night'],end='停在营道转角，远处伤帐门灯可见。',camera='一段稳定的第一视角行进，前景帐绳掠过但不遮满画面。')
add('V02',12,[2],'延续同条营道，远处兵卒整理车绳、灯火在麻布上轻动。我的心声提及记忆里的降魏与谣言；这些只存在声音，不拍魏营、宫廷、谣言传播或丞相撤军。',refs=['camp_night'],end='转向伤帐门前，尚未掀帘。')
add('V02',9,[3],'在伤帐前停一步，望着低垂门帘，心声说完后才抬起右手靠近帘边，手没有碰到里面的人。',refs=['wound_tent'],entry='我站在伤帐外，门帘挡住榻上伤者。',end='右手贴近帘边，句子结束。',camera='第一视角看门帘与门侧灯，留正常停顿，不出现苟安对心声的回应。')
add('V02',6,[4,5],'右手掀开帐帘，视线进入后抬向榻上；同一崖边队长如今穿伤后衣物卧坐在榻上，伤口遮蔽，闭口。认出身份的心声从画外传来，他不对心声点头或开口。',entry='门帘尚未掀开。',end='我停在榻前正常交谈距离，苟安看向来人。',camera='掀帘跟随动作入帐，慢抬视线落在苟安脸，不闪回救援。')
add('V02',7,[6],'苟安原本看着我，听到冒失问话后眼神收紧，下颌轻抬。他全程闭嘴倾听，不抢说我的问题，不指向魏营。',end='我的问题完整说完；苟安准备回问。')
add('V02',7,[7,8],'苟安先短促反问，停半秒，再盯住摄影机问是谁让来问的；他只微收身前衣襟，不站起、不抓住我。',end='苟安闭口，保持警觉；停在UI-LIGHT选择之前。')
add('V03A',10,[0],'苟安保持上一段警觉坐姿，听我解释；先盯着我，再略松开攥住的衣边，嘴唇始终闭合，没有提前原谅或点头。',entry='只有UI-LIGHT选A后才播放。',end='我解释完毕，苟安闭口等共同后续。')
add('V03B',6,[0],'苟安听到我提救命一事，视线停在我所在位置，肩膀稍落下，嘴唇闭合；不重演救援，不让我出镜。',entry='只有UI-LIGHT选B后才播放。',end='我说完来意，苟安闭口等共同后续。')
add('V04',9,[0],'苟安将视线从我脸上挪开片刻，再说起永安五月喝酒。他只是叙述，不取酒、不饮酒，不生成回忆。',entry='V03A或B结束，同一伤帐坐姿。')
add('V04',11,[1,2],'前半我在画外说误了，苟安闭口；停半秒，他才开口说认栽，低头整理膝上的被布，完整说完再抬眼。')
add('V04',8,[3,4],'苟安明确否认赴魏，完整结束并闭嘴后，我在画外承认多心；他闭口听，不插入新对白。',end='双方话音落下；片尾仍在伤帐，不提前到夜间。')
add('V05',10,[0,1],'三段各有完整空间建立的第一视角夜间观察：0–3秒第一夜营外望停着的木车；3–6秒第二夜在另一帐绳边停步望运粮队；6–10秒第三夜走近灯下两名粮兵交接文书，一名管事在桌旁。用直切表示隔夜，不生成日期字卡。',refs=['camp_night','grain_clerk'],entry='V04后经过数夜；服装保持我运粮兵袖口。',end='第三夜交接完成，管事面前留一本记录。',camera='三个第一视角观察镜，3秒及6秒直切；末镜停在灯下案前，不进入仓内或拿走文书。')
add('V05',9,[2,3],'我从镜头位置开口请求查看交接记录；管事闭口听，随后只由管事回答，手掌把记录推到桌边许可查看。我的右手等他说完才扶住记录边，原件始终留在桌上。',refs=['grain_clerk','camp_night','grain_table'],entry='第三夜灯下案前，交接记录仍在管事身前。',end='获准查看记录，原件未被拿走；停UI-DATE之前。',camera='先管事中近景，回答后顺视线俯看手与案面，墨迹不可辨读。')
add('V06',8,[0],'读完日期后，第一视角俯看桌上原记录，我右手指尖从一行移到另一行但不变造文字；末尾收回手，纸面仍留在桌上。只有心声，不把日期推断拍成扣粮实锤。',refs=['grain_table'],entry='UI-DATE实际读完。',end='停在是否去找苟安的选择之前；不自动出发。',camera='稳定俯拍第一视角，只见袖口、指尖和模糊文书，不生成日期字幕。')
add('V07',12,[0,1],'我带着折好的抄件走入伤帐，右手把抄件放在自己一侧的矮案，不是拿走的原件。视线抬到苟安，他看我一眼后开口问来看他还是怕他跑了；说完嘴唇闭合。',entry='UI-GO-GOUAN实际选去找后；抄件已获准抄取。',end='停UI-N1之前，苟安仍在榻上。',camera='0–3秒随视线进帐和放抄件，3–12秒眼高苟安中近景。')
add('V08A',10,[(0,'你心里就是委屈。我查了记录，你五月喝酒，六月才领到粮。')],'我在画外点出记录日期，苟安闭口听；视线短暂落向案上的抄件，仍不伸手夺走。',entry='UI-N1选A后，抄件在我的案侧。')
add('V08A',7,[(0,'这笔迟粮，不能只拿喝酒来解释吧？')],'苟安抬眼看我，手指在被边停住，嘴唇闭合；只让我的画外问题说完，不新增证据画面。')
add('V08A',12,[1,2,3],'我先说他上次瞒我，苟安全程闭口听；我的句子结束后他沉默两秒，省略号只用沉默演出，不念出来；随后只有苟安承认委屈。',end='苟安承认后闭口，接V09共同段。')
add('V08B',13,[0,1,2],'我画外说怕他难过、毕竟不容易，两句之间短停；苟安闭口听。话音落下，他才回答伤能好但这口气难过去，手放松地落在被上。',entry='UI-N1选B后。',end='苟安说完闭口，接V09共同段。')
add('V09',8,[0,1],'苟安听我连问两句，目光短暂落在帐口又收回，没有开口或替我发问，不出现李严实景。',entry='V08A或B结束。')
add('V09',13,[2,3],'苟安先说自己只是跑腿，肩膀稍垮下，停一口气后说认酒误还能吃这碗饭；保持卧坐，不夸张捶床，不新增喝酒动作。')
add('V09',12,[4,5],'苟安说完往后领粮的顾虑，缓慢从榻侧衣囊抽出一封折好的李丰信，放在榻边。信始终是一件物体，平放后手离开，不提前展开让玩家读到内容。',end='信已放到榻边；停UI-FIRST-LETTER之前。',camera='先眼高说话，再顺他的取信动作轻俯到榻边，不切第三人称。')
add('V10',10,[0,1],'已读信后，我在画外问先前议什么，苟安闭口听，随后只由他回答迟粮要不要往上说；信折好放在榻边，不重复读信。',entry='UI-FIRST-LETTER实际读完。')
add('V10',14,[2,3],'苟安先说不想一直背饮酒误军，抬眼后继续说想揭开事情让北伐先停；不出现撤军画面，不把他说法当已实现。')
add('V10',12,[4,5],'前半我画外追问为何要停北伐，苟安闭口；等我的问句结束，他才反问下一回呢，两人不重叠发声。')
add('V10',14,[6,7,8],'苟安先反问换个人挨打粮是否长出；说完闭口，我画外问没人查怎么办；停半秒，苟安才说换个肯听的地方。视线来回都在正常距离，不加魏军画面。')
add('V10',11,[9,10],'我在画外问信不信得过魏国，苟安闭口听；他看我一会，坦承也没底并请我指路。说完合唇等待，不预演玩家回答。',end='停UI-O1自由输入之前，不生成任何玩家回答。')
add('L01',10,[],'苟安在同一榻上闭口安静倾听，呼吸平稳，偶尔自然眨眼，视线落在摄影机位置；头尾坐姿与手位置一致，适合柔和循环。不点头承诺，不嘟嘴、不动嘴、不说任何字。',entry='只在玩家确认当次原话后供动态语音使用。',end='无状态变化；首尾闭口近似同姿态。')
for v,d,action in [('V11T',11,'苟安听完威胁或羞辱，眉头微收，先质问信任，再停一口气，将话题拉回粮；不威胁玩家，不站起。'),('V11D',9,'苟安短暂低头，说领情后抬眼追问下回，手不交出新物件；不预设玩家已做了其他承诺。'),('V11R',9,'苟安看我，先轻吸气再问拿什么让人认，不作认可判决，不新增证据。'),('V11A',8,'苟安把目光稳定落在我脸的位置，要求查到什么照实告诉他；不递出物件，留给V12。'),('V11N',6,'苟安语气平实，说先看这批粮；不补玩家的关心、承诺或动机，末尾闭嘴。')]:
    add(v,d,[0],action,entry=slots[v]['entry'],end='本模板句子结束后闭口；仅接V12，不与其他V11模板拼接。')
add('V12',9,[0,1],'苟安说先不走，完整说完后，从榻侧取出本队领取凭据，伸到我右手可接范围；我的右手从镜头下方托住凭据后，他才放手。凭据墨迹不可辨，不凭镜头添写村名。',entry='定制①一个安全回应结束。',end='凭据完整交到我的右手，苟安食指准备指示。',camera='前半眼高中近景，接物时自然下视；双手接触和放手过程持续可见。')
add('V12',14,[2],'凭据已在我的手中，苟安指向其中一行后收回食指，向摄影机说早备好、被李严扣着不发的口供。只拍他说话与手中凭据，禁止出现满仓或李严扣押实景来替口供背书。',entry='我的右手托住刚交来的凭据，苟安尚未指示。',end='苟安说完口供并闭口，我仍持同一凭据。',camera='0–3秒第一视角俯看指示，3–14秒自然抬眼到苟安中近景。')
add('V12',12,[3,4],'苟安先叮嘱凭这个领取本队材料，不可乱闯；他说完闭口，视线退回手中凭据，我用同一声线更轻的心声说先查清。苟安不对心声回应。',entry='同一凭据仍在我手中。',end='已交付凭据且暂留，口供仍未核实；接V13，非自由进入全部仓库。',camera='眼高苟安中近景，句末后下视凭据。')

# Central player TTS: keep original text in the design, generate separate silent
# picture for every player turn so NPC source audio is never overwritten.
SPLITS={
 'V04-02':[(4,[0],'苟安闭口听我说话，低头整理膝上被布，不开口。'),(8,[1],'苟安等前句结束后才回答认栽、没委屈，整理被布，最后抬眼闭口。')],
 'V04-03':[(5,[0],'苟安看我，否认去魏国，说完自然闭口。'),(4,[1],'苟安保持前句结束的坐姿，闭口听我的回答，不代说。')],
 'V05-02':[(6,[0],'我在镜外请求查看，管事闭口听，记录留在管事身前，不提前推来。'),(5,[1],'管事回答嗯看吧，说完将记录推到桌边；我的右手等许可后才扶边，原件留桌。')],
 'V08A-03':[(8,[0],'苟安闭口听我说上次瞒我，手指在被边停住，不抢答。'),(6,[1,2],'苟安先沉默两秒，省略号不念，再抬眼承认委屈，说完闭口。')],
 'V08B-01':[(7,[0,1],'苟安闭口听我的两句关心，微松肩，不回答也不点头承诺。'),(9,[2],'苟安等我说完才回答伤能养好但这口气难过去，手落在被上。')],
 'V10-01':[(5,[0],'已读信，苟安闭口听我问先前议什么，信折好放榻边。'),(7,[1],'苟安回答迟粮要不要往上说，视线在我与折信之间短暂变化，最后闭口。')],
 'V10-03':[(7,[0],'苟安闭口听我问为何停北伐，不做同句口型，不出现撤军画面。'),(6,[1],'苟安等我问完后反问这次送到下一回呢，说完闭口。')],
 'V10-04':[(7,[0],'苟安看我，反问换个人挨打粮是否自己长出来，克制说完并闭口。'),(5,[1],'苟安听我问没人查怎么办，嘴唇全程闭合，不预先回答。'),(6,[2],'苟安停半秒后说换个肯听的地方，说完闭口，不新增魏营画面。')],
 'V10-05':[(5,[0],'苟安闭口听我问信不信魏国，不提前回应。'),(8,[1],'苟安坦承也没底，要求我指路；说完合唇等回答，不预录玩家回答。')],
 'V12-03':[(8,[0],'苟安叮嘱凭据能领本队材料但别乱闯，凭据仍在我手中，说完闭口。'),(5,[1],'第一视角下视刚取得凭据；苟安闭口在画外，不对我的心声反应。')],
}
expanded=[]
PICTURE_FIRST_SLOTS={'V05','V08A','V08B','V09','V10','V12'}
for c in clips:
    # Latest user direction permits incomplete temporary audio. Unsubmitted
    # mixed dialogue can stay one motivated shot; preserve every original line.
    # Already dispatched V01/V02/V03/V04 IDs remain immutable.
    parts=None if c['slot'] in PICTURE_FIRST_SLOTS else SPLITS.get(c['id'])
    if not parts:expanded.append(c);continue
    for j,(duration,ids,action) in enumerate(parts):
        p=dict(c);p['sourceLines']=[c['sourceLines'][i] for i in ids];p['duration']=duration
        p['shots']=[dict(start=0,end=duration,action=action,camera=c['shots'][0]['camera'],lines=p['sourceLines'])]
        if j:p['entryState']='承接同槽位上一子片结束，前一位说话人已闭口；人物、道具、光线和位置不变。'
        if j<len(parts)-1:p['endState']='本句完整结束，镜头稳定，所有人闭口；同槽位下一子片续接另一位说话人。'
        expanded.append(p)
clips=expanded
head=[c for c in clips if c['slot']=='V08A']
if len(head)==3:
    a,b=head[:2];a['duration']=15;a['sourceLines'][0]['text']+=b['sourceLines'][0]['text'];a['endState']=b['endState'];a['shots']=[dict(start=0,end=15,action='苟安闭口听我点出日期和迟粮的疑问，目光从案上抄件回到摄影机，手停在被边。',camera=a['shots'][0]['camera'],lines=a['sourceLines'])];clips.remove(b)
counts={}
for c in clips:
    counts[c['slot']]=counts.get(c['slot'],0)+1;c['id']=f"{c['slot']}-{counts[c['slot']]:02d}"
    has_player=any(x['speaker'].startswith('我') for x in c['sourceLines']);has_npc=any(x['speaker'].startswith(('苟安','粮队')) and x['text'].strip('.… ' ) for x in c['sourceLines'])
    c['audioMode']='mixed-picture-audio-pending' if has_player and has_npc else 'central-player-voiceover' if has_player else 'npc-native' if has_npc else 'environment-only'
# Rescue uses the existing LI01 clothes/identity, never the wounded costume.
for c in clips:
    if c['slot']=='V01':
        c['referenceKeys']=['rescue_gouan','mountain_road']+(['rescue_grip'] if c['id']=='V01-03' else [])
    elif c['referenceKeys']==['gouan','wound_tent'] and c['id'] not in ['V02-05','V07-01']:
        c['referenceKeys']=['gouan_talk_frame'];c['referenceRole']='first_frame'
    elif c['id'] in ['V05-02','V05-03']:
        c['referenceKeys']=['grain_clerk'];c['referenceRole']='first_frame'
    elif c['id']=='V06-01':
        c['referenceRole']='first_frame'
# Expand the one montage and maintain continuous timecodes.
montage=next(c for c in clips if c['id']=='V05-01')
montage['shots']=[dict(start=a,end=b,action=t,camera='玩家第一视角静观；镜间直切表示不同夜晚，不叠日期或新增旁白。',lines=montage['sourceLines'] if i==0 else []) for i,(a,b,t) in enumerate([(0,3,'第一夜营外，看停在木栅旁的粮车。'),(3,6,'第二夜另一帐绳边，看粮兵整理车绳。'),(6,10,'第三夜走近灯下案边，两名粮兵将文书交到管事手里，交接结束手离开。')])]
def spoken(x):return not (x['speaker']=='演出' or x['speaker'].startswith('视频')) and x['text'].strip('.… 。')!=''
def text_rule(x,api_only=False):
    if not spoken(x):return f"原编号{x['node']}｜{x['speaker']}：只演出“{x['text']}”，不念说明或省略号，不新增人声。"
    player=x['speaker'].startswith('我');inner='心声' in x['speaker']
    if player:
        return f"原编号{x['node']}｜后期中央玩家音轨，当前生成只拍无声画面；所有NPC闭口，禁止任何对白、旁白、口型或额外人声。"+('' if api_only else f"后期配音原句：“{x['text']}”")
    rule=('我的内心画外声；无受话人，所有出镜NPC闭口且听不见，不作针对性反应。' if inner else '我从摄影机位置向对面NPC画外说话；NPC闭口倾听，仅少量自然眼神变化。') if player else f"受话人：摄影机位置的我；声音在画内，只由{x['speaker']}开口做本句口型，其他人闭嘴。"
    return f"原编号{x['node']}｜说话人{x['speaker']}｜{rule}原句：“{x['text']}”"
def prompt(c,bindings,api_only=False):
    refs=[]
    for key in c['referenceKeys']:
        item=bindings.get(key)
        refs.append((key,item))
    ready=all(item and Path(item['path']).is_file() for key,item in refs)
    if api_only:
        # User's latest direction: keep production metadata out of model input.
        if c.get('referenceRole')=='first_frame':
            s='写实历史电影，低饱和土褐与麻白，自然皮肤和柔和现场光。延续图片1，同样的人物、衣服、道具和空间。玩家眼睛的主观镜头，眼高，机位稳定。\n'
        else:s='写实历史电影，低饱和土褐与麻白，自然皮肤和柔和现场光。玩家眼睛的主观镜头，眼高。'+'；'.join(f'图片{i}参考{item["purpose"]}' for i,(key,item) in enumerate(refs,1))+'。\n'
        if c['slot'] in {'V05','V06'}:s+='夜间蜀军营地，近处麻布和木案由一盏灯笼的局部暖光照亮，背景为可辨材质的深灰夜色。\n'
        for sh in c['shots']:
            s+=f"{sh['start']}–{sh['end']}秒：{sh['action']} {sh['camera']}\n"
        npc=[x for x in c['sourceLines'] if spoken(x) and not x['speaker'].startswith('我')]
        if npc:
            s+='苟安说话中低声、疲惫粗粝但清楚。\n' if any(x['speaker'].startswith('苟安') for x in npc) else '粮队管事说话是平实的中年男声。\n'
            for x in npc:s+=f"只有{x['speaker'].split('（')[0]}对摄影机位置的人开口，清楚自然地说：“{x['text']}”其他人闭口。\n"
        else:s+='人物闭口，自然呼吸并倾听。无对白、无旁白。\n'
        s+='动作和物件有真实接触和重量。画面干净，无字幕。声音只留指定对白与同步现场声：轻风、衣料、帐布、脚步、接物摩擦。无BGM、无背景音乐、无配乐。'
        return s,ready
    s=f"尺寸：16:9\n模型：MiniMax-H3\n声音：有声音\n时长：{c['duration']}秒\n\n## 参考图\n\n"
    for i,(key,item) in enumerate(refs,1):s+=f"{i}. 图片{i}｜{key}｜用途：{item['purpose'] if item else '待中央manifest发布后绑定；当前禁止提交'}\n   本地路径：`{item['path'] if item else '待定'}`\n"
    s+='\n## 视频生成 Prompt\n\n'+STYLE+'\n\n'+POV+'\n\n'+VOICE+'\n\n入镜状态：'+c['entryState']+'\n\n'
    mapping='；'.join(f"图片{i}锁定{item['purpose'] if item else key+'（待绑定）'}" for i,(key,item) in enumerate(refs,1))+('。图片1是唯一首帧，直接延续此同一苟安、伤帐与当前视角，不切成另一张空景。' if c.get('referenceRole')=='first_frame' else '。身份图只取同一张脸和衣物，不复制其表情或构图；空间图只取布局、光源与材质。除明确要求外均为视觉参考，不是强制首帧。')
    for i,sh in enumerate(c['shots'],1):
        s+=f"### 分镜{i}｜{sh['start']}-{sh['end']}秒\n\n参考图关系：{mapping}\n\n画面与动作：{sh['action']}\n\n摄影与切点：{sh['camera']}\n\n对白：\n"
        s+='\n'.join(text_rule(x,api_only=api_only) for x in sh['lines']) if sh['lines'] else '无对白、无旁白，不生成额外人声。'
        s+='\n\n'
    s+='### 全片约束\n\n连续性与限制：'+c['continuity']+'结束状态：'+c['endState']+'台词按列出顺序自然语速逐字说完，禁止抢说、改词、加词或说错人。\n\n'+FILM+'\n\n'
    s+='声音要求：全片无BGM、无背景音乐、无配乐、无吟唱、无音乐鼓点。只保留严格指定的原句人声与同步现场声：轻风、帐布、衣料、实际脚步；有木车才有轮轴声，有接物才有纸布摩擦声，有救援才有湿石摩擦和呼吸。不得添加喊声或导演说明，L01禁止任何人声。声音远近对应画面，不生成字幕。\n'
    return s,ready
bindings=load(OUT/'reference-bindings.json') if (OUT/'reference-bindings.json').exists() else {}
for c in clips:
    s,ready=prompt(c,bindings);(OUT/'prompts').mkdir(exist_ok=True);(OUT/'prompts'/f"{c['id']}.md").write_text(s,encoding='utf-8')
    if ready:
        api_prompt,_=prompt(c,bindings,api_only=True)
        content=[dict(type='text',text=api_prompt)]+[dict(type='image_url',image_url={'local_path':bindings[k]['path']},role=c.get('referenceRole','reference_image')) for k in c['referenceKeys']]
        save(OUT/'requests'/f"{c['id']}.local.json",dict(model='MiniMax-H3',duration=c['duration'],resolution='768P',ratio='16:9',content=content));c['status']='ready-local-request'
coverage=[]
for slot in source['clips']:
    cs=[c for c in clips if c['slot']==slot['id']]
    for line in slot['lines']:
        got=''.join(x['text'] for c in cs for x in c['sourceLines'] if x['node']==line['node'])
        assert got==line['text'],(line['node'],got,line['text'])
    coverage.append(dict(id=slot['id'],entry=slot['entry'],next=slot['next'],endEvent=slot['endEvent'],subclips=[c['id'] for c in cs],duration=sum(c['duration'] for c in cs),mode=slot['mode']))
for c in clips:
    assert 4<=c['duration']<=15
    assert c['shots'][0]['start']==0 and c['shots'][-1]['end']==c['duration']
    for a,b in zip(c['shots'],c['shots'][1:]): assert a['end']==b['start']
    chars=sum(len(x['text']) for x in c['sourceLines'] if spoken(x))
    assert chars/max(1,c['duration']-1)<4.1,(c['id'],chars,c['duration'])
plan=dict(group='G1',title=source['title'],source='assignment.json (frozen online dialogue rev7 / logic rev11)',sourceSha256=hashlib.sha256((OUT/'assignment.json').read_bytes()).hexdigest(),status='reference-binding-pending' if any(c['status']!='ready-local-request' for c in clips) else 'ready',clips=clips,slots=coverage,checks=dict(dialogueExactCoverage=True,allDurations4to15=True,timecodesContinuous=True,branchBoundariesPreserved=True),totalCandidateSeconds=sum(c['duration'] for c in clips),notes=['18个互斥/交互逻辑槽位分别交付；累计时长不是单一路径时长。','L01只有闭口底片，动态回答不预录。','V01救援无伤后绷带；V02未来事件只作心声。','V08A日期推断保留冻结原句，不能作为扣粮事实。','制作候选待用户review；不改游戏或在线表。'])
save(OUT/'plan.json',plan)
script='# G1｜伤帐初识与第一次交谈\n\n冻结对白逐字覆盖；19个逻辑槽位独立成片（含L01听者底片）。每次请求4–15秒，玩家第一视角，无BGM。中央图绑定完成前禁止提交。\n\n'
for sl in coverage:
    script+=f"## {sl['id']}｜{slots[sl['id']]['name']}\n\n入口：{sl['entry']}。出口：{' / '.join(sl['next'])}。本段结果：{sl['endEvent']}。\n\n"
    for c in clips:
        if c['slot']!=sl['id']:continue
        script+=f"### {c['id']}｜{c['duration']}秒\n\n入镜：{c['entryState']}\n\n"
        for sh in c['shots']:script+=f"{sh['start']}–{sh['end']}秒：{sh['action']}\n\n摄影：{sh['camera']}\n\n"+'\n\n'.join(text_rule(x) for x in sh['lines'])+'\n\n'
        script+=f"结束与接法：{c['endState']}\n\n独立Prompt：[{c['id']}]({(OUT/'prompts'/f'{c["id"]}.md').as_posix()})\n\n"
(OUT/'分镜脚本.md').write_text(script,encoding='utf-8')
if not any((OUT/'tasks').glob('*.json')):
    save(OUT/'status.json',dict(group='G1',phase=plan['status'],slots=len(coverage),requests=len(clips),candidateSeconds=plan['totalCandidateSeconds'],submitted=0,waitingFor='central references/manifest.json ready and reference-bindings.json',validation=plan['checks']))
print(json.dumps(dict(slots=len(coverage),requests=len(clips),seconds=plan['totalCandidateSeconds'],status=plan['status']),ensure_ascii=False))
