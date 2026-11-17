from pathlib import Path
import json,hashlib
OUT=Path(__file__).parent; CENTRAL=OUT.parents[1]/'references'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,x):
    p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,ensure_ascii=False,indent=2),encoding='utf-8')
ALIASES={'gouan':'苟安','tent':'伤帐','courier':'信使','camp':'粮仓','liyan':'李严','study':'书房','clerk':'收件军吏','desk':'收件案头','road':'粮仓','archive':'收件案头'}
USES={'gouan':'只锁苟安脸、头巾短须及灰麻衣；受杖伤势不新增绷带，归途只为普通粮兵，不戴队长标识', 'tent':'锁右侧木榻、榻头卷布、后悬旧甲与暗红布、左后小凳陶碗，低案在榻前；按本镜昼夜调整真实灯光', 'courier':'锁传信兵脸、布头带、灰褐衣与小皮护肩；两次往返同人', 'camp':'只取军营粗木与麻布、阴天天光及色调；本镜为营地递信处不在粮仓查粮，不复制堆袋或新增人物', 'liyan':'锁同一李严脸、年龄、胡须、黑冠暗褐袍，不改成诸葛亮或魏延', 'study':'锁日间书房左窗、右后简牍架与案面，始终日光从左，李严坐案后面对信使', 'clerk':'锁同一收件军吏脸、短髭、黑软冠及深灰袍', 'desk':'锁收件案、帐布、架、左侧柔光，先收齐材料再核收，不生成已完成回执', 'road':'只取蜀军木车、粗麻、旧木与灰褐营地实拍材质，不复制仓内位置；此镜是室外向南撤军土路和空木车', 'archive':'只取旧案粗木、麻纸、竹木牍及左侧柔光；此镜是玩家案前读旧卷，无军吏无人群'}
STYLE='三国蜀汉五丈原，历史电影实拍质感，低饱和墨灰山青土褐麻白，自然肤色和可读暗部，局部真实灯火；没有水墨贴图、塑料皮肤、全局蓝橙或HDR。镜头是第一人称人眼，禁止出现我/信使视点角色的脸、肩背、倒影，禁止第三人称反打，非航拍。正常交谈手和武器在画外，只在具体拿取/签署/扶车时出现手。'
VOICE='玩家固定同一约30岁中国成年男性，中音略偏低、清晰自然普通话，胸声温和结实，轻微气息感，克制、有思考停顿，非播音腔、非老年沙哑、非少年尖亮；自然速度，句末落音，与ICL_uranus_zh_male_xiaohouye_tob方向一致。心声保持同一声线，更近更轻，NPC听不见。苟安中年男性中低声略疲惫粗粝但吐字清楚，不持续呻吟；李严较年长低稳克制，区别苟安；军吏平稳中低男声；信使年轻成年男声清楚，不冒充玩家。'
FILM='拍摄手法参考：《影》只取低饱和物质色中保留人的肤色，应用本镜人物、木案与麻纸，依据ASC赵小丁访谈 https://theasc.com/article/dual-nature-shadow/ ；《1917》取先按动作路径与实际耗时安排眼高机位、因注意力改变视线，应用本镜动作与接物，依据ASC摄影访谈 https://theasc.com/article/lives-under-siege-the-goldfinch-and-1917/ 。本片不移植其时代、角色或第三人称背拍。'
END='声音要求：全片无BGM、无背景音乐、无配乐、无吟唱、无音乐鼓点。只留指定人声及同步的布料摩擦、纸张、笔尖、脚步、车轮与轻风等当前实际发生的环境动作声；没有对应动作就不添加该音效。无字幕、无可读文书、无水印、无黑边。除逐句指定对白外禁止任何新增人声，文书、署名、按钮和演出说明一律不念。'
plan=read(OUT/'plan.json')
manifest=read(CENTRAL/'manifest.json') if (CENTRAL/'manifest.json').exists() else None
entries={}
if manifest:
    values=manifest.get('assets',manifest.get('references',manifest.get('items',[])))
    if isinstance(values,dict):entries={k:dict(v,id=k) for k,v in values.items()}
    else:entries={x['id']:x for x in values}
ready=0
for c in plan['clips']:
    if (OUT/'tasks'/f'{c["id"]}.json').exists():continue
    refs=[];allready=True
    for key in c['referenceKeys']:
        eid=ALIASES[key];entry=entries.get(eid,{})
        path=entry.get('path');valid=path and Path(path).is_file() and (entry.get('ready') or manifest.get('ready'))
        if valid and entry.get('sha256'):valid=hashlib.sha256(Path(path).read_bytes()).hexdigest()==entry['sha256']
        allready=bool(allready and valid)
        refs.append(dict(key=key,id=eid,path=str(Path(path).resolve()) if valid else None,use=USES[key]+('；中央限制：'+entry['constraint'] if entry.get('constraint') else '')))
    composition={'V32A':'gouan-tent-desk','V34':'liyan-study-desk','V36':'clerk-receiving-desk','V37':'gouan-empty-cart-road'}.get(c['slot'])
    role='reference_image'
    if composition and (OUT/'references'/'manifest.json').exists():
        own=read(OUT/'references'/'manifest.json').get('byId',{}).get(composition,{})
        if own.get('ready') and Path(own['path']).is_file():
            refs=[dict(key=composition,id=composition,path=own['path'],use=own['use'])];role='first_frame';allready=True
    c['references']=refs
    refrows=[f'{i+1}. 图片{i+1}｜{r["id"]}｜用途：{r["use"]}\n   本地路径：`{r["path"]}`' if r['path'] else f'{i+1}. 图片{i+1}｜中央ID：{r["id"]}｜待中央ready后绑定实际路径；用途：{r["use"]}' for i,r in enumerate(refs)]
    relation='；'.join(f'图片{i+1}：{r["use"]}' for i,r in enumerate(refs))+('。图片1是实际首帧，保持人物、机位、光照和空间；不重新切到空景或身份图。' if role=='first_frame' else '。所有图片都是reference_image，不锁首帧，不复刻拼图。')
    dialogue=[];t=1.0
    # 3.4字/秒是排程参考，不要求机械匀速；按顺序说完，保留末端停顿。
    for line in c['generatedSpokenLines']:
        npc=line['voiceAndLipOwner'].startswith('只由')
        owner='苟安' if '苟安' in line['speaker'] else '李严' if '李严' in line['speaker'] else line['speaker']
        dur=len(''.join(ch for ch in line['text'] if '\u4e00'<=ch<='\u9fff'))/3.5
        recipient='送信的信使（摄影机位置）' if c['slot']=='V34' else '我（摄影机位置）' if npc else '苟安' if c['slot']=='V32A' else '军吏' if c['slot']=='V36' else '自己；NPC听不见'
        dialogue.append(f'{line["node"]}｜原说话人：{line["speaker"]}｜受话对象：{recipient}｜{line["voiceAndLipOwner"]}。约{t:.1f}秒后开始顺序说，不重叠：『{line["text"]}』。'+(f'唯一开口者{owner}，其他人闭口。' if npc else '画内所有人嘴唇合拢，不能替我张嘴代说。'))
        t+=dur+0.6
    if not dialogue:dialogue=['本片只生成环境声，绝对无对白、无旁白、无人声；画内所有人必须闭口，不做说话口型。玩家对白/心声由统一TTS后期加入，视频模型绝对不能发出玩家声或任何台词；源中书信与演出只做动作/后期字层。']
    source='\n'.join(f'{x["node"]}｜{x["speaker"]}｜{x["text"]}｜{x["voiceAndLipOwner"]}' for x in c['sourceLines'])
    body=f'{STYLE}\n场景：{c["scene"]}。起始状态：{c["startState"]}。\n{VOICE}\n\n分镜1｜0-{c["duration"]}秒\n参考图关系：{relation}\n画面与动作：{c["action"]}\n摄影与切点：自然40–50mm透视，人眼位置稳定或随明确走近/低头动作平稳改变；本片只一个连续镜头，禁止对我反打；最后0.7秒动作落稳无新增台词，结束于{c["endState"]}。\n对白：'+ '\n'.join(dialogue)+f'\n\n连续性与限制：动作顺序不可提前，纸张从拿取、接触到松手有完整过程；无瞬移、手指融合、悬浮笔、轮轴穿模、纸上乱码。不凭此镜跳过UI确认或制造回令。{c["endState"]}。\n{FILM}\n\n{END}'
    postvoice='\n'.join(f'{x["node"]}｜{x["speaker"]}｜受话对象：'+('苟安' if c['slot']=='V32A' else '军吏' if c['slot']=='V36' else '自己，NPC听不见')+f'｜{x["voiceAndLipOwner"]}｜原句：{x["text"]}' for x in c.get('postVoiceLines',[]))
    voice_note=f'\n## 后期统一玩家声音（以下不提交视频模型朗读）\n\n{postvoice}\n' if postvoice else ''
    md=f'尺寸：16:9\n模型：MiniMax-H3（本轮OpenAI Next实际使用）\n声音：有声音\n时长：{c["duration"]}秒\n\n## 参考图（上传顺序）\n\n'+ '\n'.join(refrows)+voice_note+f'\n\n## 视频生成 Prompt\n\n{body}\n'
    (OUT/'prompts').mkdir(exist_ok=True)
    (OUT/'prompts'/f'{c["id"]}.md').write_text(md,encoding='utf-8')
    c['promptPath']=str((OUT/'prompts'/f'{c["id"]}.md').resolve())
    if allready:
        # Detailed production notes remain in MD; paid model sees only the actual shot.
        clean_action=c['action'].replace('给后期准确文书内容留白','纸面留白').replace('留后期字层','纸面留白').replace('不生成可读字，留后期字层','不生成可读字').replace('不把文书读出','人物闭口').replace('无自动递交给军吏','不向外递交').replace('等待UI正式提交','材料停于案上')
        clean_refs='；'.join(f'图片{i+1}只负责{r["use"].split("；中央限制")[0]}' for i,r in enumerate(refs))
        speech=' '.join(('苟安' if '苟安' in x['speaker'] else '李严' if '李严' in x['speaker'] else x['speaker'])+'面对摄影机说：“'+x['text']+'”' for x in c['generatedSpokenLines'])
        if not speech:speech='没有对白和旁白，画内人物全程闭口，无人声。'
        api_prompt=f'16:9历史电影实拍，三国蜀汉，低饱和土褐麻白墨灰，自然肤色，暗部清楚。{c["scene"]}。{clean_refs}。\n从第一帧开始人物和道具已经位于本镜位置。{clean_action}\n0-{c["duration"]}秒只有一个连续镜头，镜头是观看者双眼，不出现观看者脸、肩背或倒影，无第三人称反打。自然眼高40–50mm透视，动作有真实接触与受力，不瞬移。{speech}\nNo subtitles or any on-screen text. 中文台词仅声音，不添加字幕、片名、文字、水印或黑边。没有BGM、背景音乐、配乐、吟唱或鼓点，只保留上述人声和同步环境动作声。'
        save(OUT/'requests'/f'{c["id"]}.local.json',dict(model='MiniMax-H3',duration=c['duration'],resolution='768P',ratio='16:9',content=[{'type':'text','text':api_prompt}]+[dict(type='image_url',image_url={'local_path':r['path']},role=role) for r in refs]))
        c['status']='ready-to-prepare';ready+=1
save(OUT/'plan.json',plan)
print(f'{len(plan["clips"])} independent prompts written; {ready} requests have actual ready images')
