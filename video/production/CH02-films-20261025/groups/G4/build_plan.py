"""G4 frozen-source shot planning. Only writes this group."""
from pathlib import Path
import json, math, re, hashlib
OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[1]
def read(p): return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,v):
    p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(json.dumps(v,ensure_ascii=False,indent=2),encoding='utf-8')
assignment=read(OUT/'assignment.json')
VOICE='同一个约30岁中国成年男性，中音略偏低、清晰自然普通话，胸声温和结实，轻微气息感，克制、有思考停顿，非播音腔、非老年沙哑、非少年尖亮；自然速度、句末落音。心声同一声线，更近、更轻，NPC听不见。'
STYLE='历史电影实拍，低饱和墨灰、山青、土褐、麻白，自然肤色、可读暗部，局部灯火。真人皮肤与衣料，不用水墨贴图、塑料皮肤、全局蓝橙或HDR。镜头始终是我的眼睛，不拍我的脸、肩背、倒影，不用第三人称反打。对话不出现长矛。'
REFSETS={'gou':['gouan','wound_tent'],'clerk':['military_clerk','receipt_desk']}
manifest_path=ROOT/'references/manifest.json'
manifest=read(manifest_path) if manifest_path.exists() else {}
# Resolved centrally by bind_references.py, never invent another face.
binding=read(OUT/'reference-binding.json') if (OUT/'reference-binding.json').exists() else {}
DESCRIPTIONS={'gouan':'苟安身份，锁脸、发髻、衣物与伤势；不复制身份图表情','wound_tent':'伤帐空间、床榻位置、灯火和材质；不增加人物','military_clerk':'同一收件军吏身份、衣冠，不带入别的角色','receipt_desk':'收件处案头、帐布、文书与光照，准确文字后期叠加'}
ACTION={
 'CH2-LY09-006':'苟安在原伤榻位置，嘴唇合拢听我说完；我不伸手。视线短暂落向帐门，结束仍不离开视角。',
 'CH2-LY09-007':'从收件处门口向案头走近两步，停稳。我将本次获准粮情材料放在桌边，军吏核收纸束，动作不等于正式交案；只见必要的一只手，纸束不增殖。',
 'CH2-LY09-008':'军吏在案后抬眼，手停在粮情材料旁，平稳说明，末尾闭口。',
 'CH2-LY09-009':'从案前第一视角低头观察一张展开的无字转运简报，平整纸面保留后期叠字空间；军吏手指只在页边，文字不由模型生成。',
 'CH2-LY09-010':'视线从纸面抬回军吏中近景，军吏闭嘴听问话，轻微抬眼。',
 'CH2-LY09-011':'军吏双手自然放低，不许断言来年胜负，短停顿后说完，眼神落回我。',
 'CH2-LY09-012':'军吏在原位继续传达答复，不拍丞相本人或虚构回令，表情克制。',
 'CH2-LY09-013':'军吏在原案后解释，视线始终面对我，不切虚构魏军现场。',
 'CH2-LY09-014':'军吏说到诺言时略停，说到能撑多久时降低音量；不用煽情手势，最后闭口等我。',
 'CH2-LY09-017':'从伤帐门帘内侧向床榻走近一步，苟安仍在原位，抬眼看我，闭口，不把简报当新取得的证物递交。',
 'CH2-LY09-018':'苟安在伤榻中近景闭口听消息，双手放在被褥上，不提前作答。',
 'CH2-LY09-020':'苟安看向我，眉心略收，缓慢问完，手不离榻。',
 'CH2-LY09-021':'苟安继续闭口听，目光留在我所在的镜头位置，只作一次自然呼吸。',
 'CH2-LY09-022':'苟安闭嘴听到谣言牵连百姓，视线短暂下落再看回我；不抢对白，不立刻接受补救。',
 'CH2-LY09-023':'苟安抬眼问我，句末停住，嘴唇合拢，保留不信任但不怒吼。',
 'CH2-LY09-024':'苟安闭嘴听完我的承诺，微微松开攥着的被边，不点头答应，不表示已获豁免。',
 'CH2-LY09-QA':'苟安闭口听我的理解，目光稍放松，没有口型。',
 'CH2-LY09-RA':'苟安缓缓吐气，再抬眼说完，语气疲惫、认真，不笑。',
 'CH2-LY09-QB':'苟安闭口，手指停在被边；听到由他自己说清楚时注视我，不回应。',
 'CH2-LY09-RB':'苟安略收下颌，看着我问后果，末尾停住，不起身。',
 'CH2-LY09-QC':'苟安闭嘴听我的包庇意向，不露出脱罪成功的笑容，不生成任何行动。',
 'CH2-LY09-RC':'苟安声音放轻，短暂移开视线，再望向我问能否躲过；仍不获免罪。',
 'CH2-LY10-001':'第一视角在同一收件案前停稳，军吏抬眼闭口等问；桌上没有正式案卷交接或落印。',
 'CH2-LY10-002':'军吏闭口听我咨询，目光在我所在镜头位置，双手静置，不收新案卷。',
 'CH2-LY10-003':'军吏在原案后说明途径，提到责任时稍停；不写赦免令，不盖章。',
 'CH2-LY10-004':'军吏平稳区分欠缺与欺瞒，双手不指认任何罪犯；不切审判或押解。',
 'CH2-LY10-005':'军吏以低稳清晰声线说风险，重罚和处死保留气口；不威吓式指人，不拍处刑画面。',
 'CH2-LY10-006':'军吏面对我说明不可撤回，末尾闭嘴，案卷仍未递交，保持咨询阶段。',
 'CH2-LY10-007':'我垂目看案边未提交的纸束。军吏在画外继续静候，听不见心声，不点头回应。',
 'CH2-O2-OPENING':'苟安在同一伤榻坐靠，看我回来，等我停稳后开口；话后闭口，等玩家输入。',
 'CH2-O2-RT':'苟安目光冷下来，收起原本的追问，声音压低；说完略移开眼神，不起身、不逃。',
 'CH2-O2-RD':'苟安短暂看向被褥，再看我，语气有迟疑，末尾闭口；不承认事情已被压下。',
 'CH2-O2-RR':'苟安面向我问凭据，语气认真，无嘲笑，双手不出示新证物。',
 'CH2-O2-RA':'苟安听完已确认的原话后平静回应，轻微抬眼；不拍签署、补报或已接受最终办法。',
 'CH2-O2-RN':'苟安注视我，语气平静中性；不补我未表达的关心或承诺，话后闭口等待。',
 'CH2-LY10-REFUSE':'苟安保持原伤姿，稍摇一次头说短拒绝，之后闭口；不逃跑、不死亡、不出现押解。'
}
clips=[]
for v in assignment['clips']:
    if v['id']=='L02':
        clips.append(dict(id='L02-01',slot='L02',name=v['name'],duration=12,refset='gou',sourceNodes=[],lines=[],silent=True,action='苟安在同一伤帐原伤榻上闭嘴听玩家的动态语音。嘴唇自然合拢，全段绝无说话、嘀咕、呻吟或口型。视线停在我所在镜头位置，只有自然呼吸、少量眨眼和一次轻微视线移动；手静放被边，不点头表示接受。首尾相同坐姿，方便必要的平滑续播。',entry=v['entry'],next=v['next'],endEvent=v['endEvent']))
        continue
    for i,l in enumerate(v['lines'],1):
        silent=l['speaker']=='演出' or '正文' in l['speaker']
        duration=4 if l['speaker']=='演出' else 6 if '正文' in l['speaker'] else max(6,min(15,math.ceil(len(re.findall(r'[\u4e00-\u9fff]',l['text']))/3.3+1.8)))
        refset='clerk' if v['id']=='V29' or (v['id']=='V26' and l['node']!='CH2-LY09-006') else 'gou'
        clips.append(dict(id=f"{v['id']}-{i:02d}",slot=v['id'],name=v['name'],duration=duration,refset=refset,sourceNodes=[l['node']],lines=[l],silent=silent,action=ACTION[l['node']],entry=v['entry'] if i==1 else '上一子片完整句末',next=v['next'] if i==len(v['lines']) else [f"{v['id']}-{i+1:02d}"],endEvent=v['endEvent'] if i==len(v['lines']) else '无新增剧情状态'))
for c in clips:
    c['references']=[dict(id=k,path=binding.get(k),purpose=DESCRIPTIONS[k]) for k in REFSETS[c['refset']]]
    c['frames']=[dict(start=0,end=c['duration'],action=c['action'],camera='第一视角35–50mm自然透视，机位保持人眼高度；案头观察仅低头，不用第三人称。无无缘由推拉和绕人。',referenceRelations=[f"图片{i+1}：{r['purpose']}，只参考具体职责，不默认首帧。" for i,r in enumerate(c['references'])])]
    c['audioOverlay']=any(l['speaker'].startswith('我') for l in c['lines'])
    c['textOverlay']=c['sourceNodes']==['CH2-LY09-009']
    c['status']='待生成' if all(r['path'] for r in c['references']) else '待中央参考图ready绑定；禁止提交'
plan=dict(group='G4',title=assignment['title'],source='assignment.json + ../../sources/CHAPTER-TWO-VIDEO-SEGMENTS.json',sourceSha256=hashlib.sha256((OUT/'assignment.json').read_bytes()).hexdigest(),model='MiniMax-H3',resolution='768P',ratio='16:9',maxConcurrent=6,minPollIntervalSeconds=120,referenceStatus=manifest.get('status','pending'),voice=VOICE,slots=[dict(id=v['id'],name=v['name'],entry=v['entry'],next=v['next'],endEvent=v['endEvent'],clipIds=[c['id'] for c in clips if c['slot']==v['id']],semanticGuard=v.get('semanticGuard')) for v in assignment['clips']],clips=clips)
save(OUT/'plan.json',plan)
summ=['# G4｜军情与第二次交谈分镜脚本','来源为冻结逐句源；不改对白。单片4–15秒。所有输出待用户review。','固定分支各自成片；L02无固定玩家台词；咨询不提前交案，V32R仅拒绝后返回补选。','## 连续性',STYLE,'苟安全程沿用伤帐身份与伤势。军吏在V26、V29保持同一人及收件案位置。','## 逻辑槽位']
for v in plan['slots']:
    summ += [f"### {v['id']}｜{v['name']}",f"入口：{v['entry']}。出口：{'、'.join(v['next'])}。事件：{v['endEvent']}。"]
    if v['semanticGuard']:summ += ['语义前提：'+v['semanticGuard']]
    for c in [x for x in clips if x['slot']==v['id']]:
        summ += [f"#### {c['id']}｜0–{c['duration']}秒",c['action'],'参考：'+ '；'.join(r['id']+'负责'+r['purpose'] for r in c['references']),f"结束：保持完整句末/动作完成，接{'、'.join(c['next'])}。"]
        for l in c['lines']:summ += [f"{l['node']}｜{l['speaker']}｜{l['text']}｜{l['voiceAndLipOwner']}"]
    summ += ['']
(OUT/'分镜脚本.md').write_text('\n\n'.join(summ),encoding='utf-8')
for c in clips:
    refs='\n'.join(f"{i+1}. 图片{i+1}｜{r['id']}｜用途：{r['purpose']}\n   本地路径：`{r['path'] or '待中央manifest.ready后绑定；此稿不可提交'}`" for i,r in enumerate(c['references']))
    l=c['lines'][0] if c['lines'] else None
    if c['silent']:
        dialogue='无对白、无旁白，禁止新增人声。'+('原演出说明只转动作，不朗读。' if l and l['speaker']=='演出' else '')
    elif l['speaker'].startswith('我'):
        dialogue='本条只生成环境声和闭口听者/动作底片，无对白、无旁白、无呻吟，禁止生成任何人声。玩家画外对白由后期统一音轨加入，本次视频模型不得朗读任何对白、编号或导演说明。可见NPC全段嘴唇自然合拢、绝无说话口型。'+('心声NPC听不见，不能对此作出反应。' if '心声' in l['speaker'] else 'NPC等待摄影机位置的玩家讲话，只有克制的非语言倾听动作。')
    else:
        dialogue=f"原编号{l['node']}；说话人{l['speaker']}；受话人：我所在的摄影机位置。只准{l['speaker'].split('（')[0]}开口并同步口型；我不发声，其他人闭口。原句：『{l['text']}』。{'中年男性中低声，略疲惫粗粝、吐字清楚，受伤不持续呻吟。' if c['refset']=='gou' else '中年中国男性，低稳、清晰、克制，军中公事语气。'}"
    body=f"""尺寸：16:9
模型：MiniMax-H3（本轮用户指定，覆盖旧Seedance默认）
声音：有声音
时长：{c['duration']}秒

## 参考图
{refs}

{('## 后期配音索引（不交给视频模型）' + chr(10) + l['node'] + '｜' + l['speaker'] + '｜' + l['text'] + chr(10) + VOICE) if c['audioOverlay'] else ''}

## 视频生成 Prompt

{STYLE}
本条是{c['id']}，{c['name']}；只拍本条原句，不生成前后句、标题、编号、字幕、UI、水印或黑边。

### 分镜1｜0-{c['duration']}秒

参考图关系：{'；'.join(c['frames'][0]['referenceRelations'])}

画面与动作：{c['action']}

摄影与切点：{c['frames'][0]['camera']} 前0.5秒稳定入镜，最后0.7秒保留闭口/动作完成的自然停顿。结尾保持原空间、人物位置与完整句末，供同槽位子片衔接；不越过UI或选择。

对白：{dialogue}

连续性与限制：锁定中央图中的人物脸型、发型、年龄、衣物、伤势；人物不增殖，不变脸，不穿模，不瞬移。手仅在指定放材料动作入画，五指正常并接触实体；不生成无来源证物、签认、收案、赦免或处刑。不得用纸面乱码冒充证据。{('转运简报准确正文后期叠加，模型只生成无字纸面：'+l['text']) if c['textOverlay'] else ''}

拍摄手法参考：参考《影》的有动机局部光源与克制机位，用于本条分镜1的帐布层次、自然肤色和可读暗部；据本项目已核验摄影指导访谈（American Cinematographer，Dual Nature: Shadow），不复刻未经核查的具体原片镜头。动作观察维持同一人眼机位，不引入参考片人物和剧情。

声音要求：全片无BGM、无背景音乐、无配乐、无吟唱、无音乐鼓点。只保留{'轻微脚步、纸束接触木案声、衣料摩擦和帐外微风' if c['refset']=='clerk' else '帐布轻响、轻微衣料与被褥摩擦、远处微弱营地风声'}，随实际动作同步；不要无动作却重复音效。{'本条是环境声底片，禁止生成任何人声，包括玩家、NPC、旁白、呻吟。' if c['audioOverlay'] else '人声严格按上述对白执行，正常语速约每秒3–4汉字，不吞字、不增删、不把我的画外句交给NPC，不朗读导演说明和文书。无对白条禁止新增任何人声。'}"""
    p=OUT/'prompts'/f"{c['id']}.md";p.parent.mkdir(exist_ok=True);p.write_text(body,encoding='utf-8')
    save(OUT/'requests'/f"{c['id']}.local.json",dict(model='MiniMax-H3',duration=c['duration'],resolution='768P',ratio='16:9',content=[dict(type='text',text=body[body.index('## 视频生成 Prompt')+len('## 视频生成 Prompt'):].strip())]+[dict(type='image_url',role='reference_image',image_url=dict(local_path=r['path'] or f"UNBOUND-{r['id']}")) for r in c['references']]))
save(OUT/'status.json',dict(group='G4',stage='分镜和逐请求稿已完成；等待中央参考图',slots=len(plan['slots']),requests=len(clips),seconds=sum(c['duration'] for c in clips),referenceReady=all(r['path'] for c in clips for r in c['references']),warnings=['未绑定参考图的请求禁止提交','生成音色描述不保证跨片锁声纹，必要时补统一TTS','未完成听审，不声称对白通过']))
print(json.dumps(dict(slots=len(plan['slots']),requests=len(clips),seconds=sum(c['duration'] for c in clips),maxDuration=max(c['duration'] for c in clips)),ensure_ascii=False))
