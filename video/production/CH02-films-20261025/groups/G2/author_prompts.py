from pathlib import Path
import json,ast,hashlib
OUT=Path(__file__).parent;BASE=OUT.parents[1]
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,d):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8')
constants={}
for n in ast.parse((OUT/'build_plan.py').read_text(encoding='utf-8')).body:
    if isinstance(n,ast.Assign) and len(n.targets)==1 and isinstance(n.targets[0],ast.Name) and n.targets[0].id in ['STYLE','VOICE','FILM']:constants[n.targets[0].id]=ast.literal_eval(n.value)
NAMES={'gouan':'苟安','injury_tent':'伤帐','warehouse':'粮仓','desk':'查粮案头','grain_manager':'粮队管事','warehouse_clerk':'仓吏','warehouse_handler':'仓中经手人','frontline_receiver':'前线接收人','local_handler':'地方经手人'}
USES={'gouan':'唯一苟安脸、年龄、黑巾发髻短须与灰麻衣；伤势按原伤帐，不复制中性胸像姿势','injury_tent':'原伤帐木榻、帐柱、悬甲与侧光空间，参考图无人物不意味着场面无人','warehouse':'粮棚通道、右侧仓案、少量封口麻袋和天光；不把粮袋多少当作证据','desk':'同一仓案旧木与细木牍、麻纸材质；文字面留白，数量位置由本镜动作决定','grain_manager':'粮队管事固定脸和灰褐衣褐巾，不复制身份照胸像构图','warehouse_clerk':'仓吏固定窄长脸、黑帽、稀山羊须与深灰衣','warehouse_handler':'仓中经手人固定年轻无须脸、厚眉、灰巾与青灰衣','frontline_receiver':'前线接收人固定无须脸、黑头带与小皮护肩','local_handler':'地方经手人固定微灰短须圆脸、旧褐帽与浅土麻衣'}
plan=read(OUT/'plan.json');scripts=[]
for c in plan['clips']:
    refs=[]
    for role in c['referenceRoles']:
        name=NAMES[role];path=BASE/'references/generated'/name/'image-01.png'
        refs.append(dict(id=name,role=role,path=str(path.resolve()),use=USES[role]))
    c['references']=refs
    header=f'尺寸：16:9\n模型：MiniMax-H3\n声音：有声音\n时长：{c["duration"]}秒\n\n'
    reftext='## 参考图\n\n'+'\n\n'.join(f'{i}. 图片{i}｜{r["id"]}｜用途：{r["use"]}\n   本地路径：`{r["path"]}`' for i,r in enumerate(refs,1))
    rel='；'.join(f'图片{i}负责{r["use"]}' for i,r in enumerate(refs,1))+'。均为reference_image视觉参考，不是首帧，不把参考图人脸贴到木牍或纸上。'
    speech=[]
    if c.get('voice'):
        l=c['sourceLines'][0]
        speech=[f'原编号：{l["node"]}；原说话人：{l["speaker"]}；受话人：镜头对面的NPC；声音位置：我的画外对白由后期固定player TTS承担。本次视频模型不生成人声，不朗读下列台词，对面NPC全片闭口倾听，不动嘴模仿我。后期在1秒处加入原句：“{l["text"]}”。听者反应只用注视、低头看凭据、轻点头。']
    elif c['kind']=='dialogue':
        l=c['sourceLines'][0];speaker=l['speaker']
        speech=[f'原编号：{l["node"]}；说话人：{speaker}；受话人：摄影机位置的我；声音：画内同步，唯一允许开口并做口型的人是{speaker}，我与其他人均不发声。开始0.8秒后按自然语速逐字说：“{l["text"]}”。句末停顿，嘴闭合；不读角色名和编号，不增删字，不加旁白。']
    else:speech=['无对白、无旁白、无新增人声。文书、图示与导演说明绝不朗读，禁止无意义呢喃。']
    sound='全片无BGM、无背景音乐、无配乐、无吟唱、无音乐鼓点。仅留与画面同步的低风声、帐布轻响、衣料摩擦，以及本镜实际发生的脚步、木牍放桌和纸卷展开声；无动作不凭空加音效。'+('本次模型绝不生成人声，玩家原句后期用固定TTS加入，必须保留原环境声。' if c.get('voice') else '人声严格按本镜规定执行，不增加对白、旁白或群杂声。')
    content='## 视频生成 Prompt\n\n参考对应：'+rel+'\n\n整体画面：'+constants['STYLE']+'\n\n声音身份：'+constants['VOICE']+f'\n\n### 分镜1｜0-{c["duration"]}秒\n\n参考图关系：'+rel+'\n\n画面与动作：'+c['shots'][0]['action']+'\n\n摄影与切点：'+c['shots'][0]['camera']+'\n\n对白：'+''.join(speech)+'\n\n### 全片约束\n\n连续性与限制：仅执行已获准的本批核查，木牍与手不穿模、不瞬移、不变数量；手指正常，取放有实际接触和承重。不得新增数字、藏粮、贪污证据或预演受杖；所有纸木表面留白，不生成可读字。每段结尾停在本段结束状态，UI或分支由游戏决定，不跨界替我选择。'+('苟安保持原伤势和半趴榻上姿势，不加绷带，不站立。' if c['parent']=='V16B' else '')+'\n\n'+constants['FILM']+'\n\n声音要求：'+sound
    (OUT/'prompts').mkdir(exist_ok=True);(OUT/'prompts'/f'{c["id"]}.md').write_text(header+reftext+'\n\n'+content+'\n',encoding='utf-8')
    body=dict(model='MiniMax-H3',duration=c['duration'],resolution='768P',ratio='16:9',content=[dict(type='text',text=content)]+[dict(type='image_url',image_url=dict(local_path=r['path']),role='reference_image') for r in refs])
    save(OUT/'requests'/f'{c["id"]}.local.json',body)
    scripts += [f'## {c["id"]}｜{c["name"]}｜{c["duration"]}秒',f'入口：{c["entry"]}；本V结束：{c["nextBoundary"]}',f'分镜1｜0–{c["duration"]}秒',c['shots'][0]['action'],c['shots'][0]['camera'],*speech]
    if c['kind']=='document':scripts += ['后期证据文字（仅对应取得时点；无朗读）：'+c['sourceLines'][0]['text']]
save(OUT/'plan.json',plan)
(OUT/'分镜脚本.md').write_text('# G2 查粮取证与三种判断\n\n冻结源：纯对白rev7 / 逻辑rev11。35条请求，各自4–15秒，12个V独立交付。\n\n'+ '\n\n'.join(scripts),encoding='utf-8')
print('Authored',len(plan['clips']),'independent prompts; submission still gated by manifest ready')
