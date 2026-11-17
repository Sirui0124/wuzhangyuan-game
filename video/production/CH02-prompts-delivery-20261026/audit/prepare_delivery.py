from pathlib import Path
import json, re, shutil, hashlib

ROOT = Path(__file__).resolve().parents[4]
OUT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'outputs/ch2-review-20261026/prompt-handoff.json'
handoff = json.loads(SOURCE.read_text('utf-8-sig'))
sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
source_hash = sha(SOURCE)
(OUT / 'prompts').mkdir(exist_ok=True)
shutil.copy2(SOURCE, OUT / 'audit/source-handoff.json')
all_refs = {r['name']: r for s in handoff['segments'] for r in s['referenceImages']}
characters = {'苟安', '粮队管事', '仓吏', '前线接收人', '地方经手人', '仓中经手人'}
player_target = {'C01':'苟安','C02':'粮队管事','C04':'粮队管事','C05':'前线接收人','C06':'仓吏','C07':'地方经手人','C08':'地方经手人','C09':'地方经手人','C10':'仓中经手人','C11':'苟安','C12':'苟安','C13':'苟安','C05R':'前线接收人','C05C':'粮队管事与前线接收人','C09A':'地方经手人','C09C':'地方经手人','E01':'苟安'}
spoken_rows, delivered, edits = [], [], []

for seg in handoff['segments']:
    sid = seg['id']
    source = Path(seg['file'])
    original = source.read_text('utf-8-sig')
    text = original
    refs = [dict(r) for r in seg['referenceImages']]
    if sid == 'C06':
        refs.append(dict(all_refs['地方经手人']))
        edits.append({'id':sid,'change':'补入末镜等候的地方经手人身份图；对白、动作与时长不变。'})
    if sid == 'C09':
        refs.append(dict(all_refs['粮队管事']))
        edits.append({'id':sid,'change':'补入末镜走向存档处的粮队管事身份图；对白、动作与时长不变。'})
    if sid == 'E01':
        refs.append({'name':'苟安夜间伏榻构图','path':str(ROOT/'video/production/CH02-films-20261025/groups/G3/references/gouan-night-prone/image-01.png'),'purpose':'同一苟安的夜间伏榻姿态、榻侧眼位、左灯右挂甲及光照；不作精确首帧，不替换图片1的身份，不要求复制手边无信的状态。'})
        edits.append({'id':sid,'change':'增加已存在的夜间伏榻参考，限制日间身份和空间图不带入日光；台词不变。'})
    ref_dir = OUT / 'references' / sid
    ref_dir.mkdir(parents=True, exist_ok=True)
    ref_lines = ['## 参考图','','按编号顺序上传本段专用图片。以下均为身份、空间或构图参考，不是精确首帧；不要把多个身份图当作依次播放的画面。','']
    for i, r in enumerate(refs, 1):
        src = Path(r['path'])
        assert src.is_file(), src
        if r.get('sha256'): assert sha(src) == r['sha256'], src
        dst = ref_dir / f'{i:02d}_{r["name"]}{src.suffix}'
        shutil.copy2(src, dst)
        assert sha(src)==sha(dst)
        r.update(index=i, sourcePath=str(src), path=str(dst), sha256=sha(dst), uploaded=False)
        if r['name'] in characters:
            purpose=f"锁定{r['name']}的脸型、年龄、发型、胡须与衣服；只取画面中前景主体，不取背景人物，不继承参考照的站姿、表情或背景。"
        elif r['name']=='粮仓':
            purpose='锁定仓门、通道、木架与白天光向；背景粮袋属于未指定批次，不以其数量证明本批足粮；不带入无关背景人物。'
        elif r['name']=='查粮案头':
            purpose='锁定旧木案、简牍、纸张和束带材质；按各镜动作摆放，空白参考纸不能当作已经读到的剧情正文。'
        elif r['name']=='伤帐':
            purpose='锁定木榻、门帘、案边和挂甲位置；苟安按分镜伏卧，不继承身份照坐姿。' + ('本段夜间，不继承本图日光；以图片3的夜灯、暗帐光照为准。' if sid=='E01' else '保持日间柔光，不因说话人切换改变床沿方向。')
        else: purpose=r['purpose']
        r['purpose']=purpose
        ref_lines += [f'{i}. 图片{i}｜{r["name"]}｜用途：{purpose}',f'   本地路径：`{dst.as_posix()}`','']
    text = text[:text.index('## 参考图')] + '\n'.join(ref_lines) + '\n' + text[text.index('## 视频生成 Prompt'):]
    matches=list(re.finditer(r'### 分镜(\d+)｜([\d.]+)-([\d.]+)秒',text))
    assert len(matches)==len(seg['shots'])
    replacements=[]
    for i,(m,q) in enumerate(zip(matches,seg['shots'])):
        stop=matches[i+1].start() if i+1<len(matches) else text.index('### 全片约束')
        block=text[m.start():stop]
        existing=re.search(r'唯一允许发声的原句：(.*)',block).group(1)
        expected=q['onlyAllowedSpokenSentence']
        assert q['ttsText']==expected
        assert (existing==f'“{expected}”') if expected else ('无' in existing)
        relations=[]
        for r in refs:
            n=r['name'];ix=r['index']
            if n in characters:
                relations.append(f'图片{ix}锁定{n}的身份与衣着；本镜动作出现{n}时按此图保持同一人，未入镜时留在画外，不为了用图强行加人')
            else:relations.append(f'图片{ix}负责{n}：{r["purpose"].rstrip("。") }')
        if sid=='C03':relations.append('本镜只提取仓区方位与物件材质，转成无文字的平面粮路示意；这不是本批实况，不建立任何本批证据，也不生成流程标签')
        relation='参考图关系：'+'；'.join(relations)+'。各图均不作精确首帧，人物的站位与动作以本镜描述为准。'
        block=re.sub(r'参考图关系：[^\n]*',lambda _:relation,block,count=1)
        speaker=q['speaker']
        if speaker=='无':
            target='无';voice='无对白、无旁白';lip='无'
            control='本镜无说话者、无受话对白、无口型承担者；苟安与画外的我都不发声。只按原动作取、递、接信，苟安嘴唇自然合拢；不得读出结局、动作、时间或“无”字。'
        elif speaker=='我（心声）':
            target='无（内心独白，不对人说）';voice='画外心声';lip='无'
            control='说话人：我；声音位置：画外心声；受话人：无。唯一画内口型承担者：无，示意人物与现实NPC均不随台词张嘴。使用我的既有声线，近而克制。NPC听不见心声，不因此点头、接话或转头。仅说下一行引号内原句一次。'
        elif speaker=='我':
            target=player_target[sid];voice='镜头位置的画外普通对白';lip='无'
            control=f'说话人：我；受话人：{target}；声音位置：摄影机位置的画外普通对白。唯一画内口型承担者：无，不拍我的脸。{target}以及其余所有入镜NPC嘴唇自然合拢，按本镜动作倾听，不能代我说任何一个字；等我的整句结束后才进入后续回答。仅说下一行引号内原句一次。'
        else:
            target='镜头位置的我';voice='画内对白；取纸特写暂不见脸时为同一人物原位置连续画外声';lip=speaker
            others='、'.join(r['name'] for r in refs if r['name'] in characters and r['name']!=speaker) or '其他入镜人物'
            control=f'说话人：{speaker}；受话人：镜头位置的我；声音来自{speaker}本人所在的位置。唯一口型承担者：{speaker}，正脸入镜时口型与本句同步；若机位转到手部或纸面，同一个人的声音连续，不让别的人做口型。{others}保持闭口，只在本镜已安排的范围内看人或看材料。我的画外声音此镜关闭，不抢话、不接句。仅说下一行引号内原句一次。'
        if speaker!='无':
            control+='每句在本镜时间窗内以自然普通话完整说完，前后留给已有动作和呼吸；不增词、不改词、不重复、不吞字、不朗读控制字段。'
        block=re.sub(r'声音执行（仅为控制说明，不朗读）：[^\n]*',lambda _:'声音执行（仅为控制说明，不朗读）：'+control,block,count=1)
        if sid in {'C05','C05R','C05C'} and i==len(seg['shots'])-1:
            block=block.replace('\n\n声音执行', '\n\n构图补充：仓吏此镜留在画外；只用视线方向接下段，不新增无身份参考的仓吏正脸。\n\n声音执行')
        if sid in {'C01','C11','C12','C13','E01'}:
            block=block.replace('\n\n声音执行','\n\n机位连续：沿用本段榻侧眼位、床沿方向与苟安伏卧位置；仅随已写明的递信或看材料动作小幅低头抬眼，不因换说话人另换侧面或反打。\n\n声音执行')
        replacements.append((m.start(),stop,block))
        spoken_rows.append({'segmentId':sid,'shot':i+1,'startSeconds':q['startSeconds'],'endSeconds':q['endSeconds'],'speaker':speaker,'addressee':target,'voicePosition':voice,'lipOwner':lip,'text':expected,'sourceNodes':q['sourceNodes'],'status':'待用户审核，禁止自动提交生成'})
    for start,stop,block in reversed(replacements):text=text[:start]+block+text[stop:]
    if sid=='C03':
        ambient='本片画卷示意中只在量粮、倒粮、搬袋、签收动作发生时出现相应低声量动作音；首尾现实案头仅保留纸张、木案轻触与仓外轻风。'
    elif '苟安' in seg['refs']:
        ambient='只保留伤帐中与动作对应的轻微衣料、纸张、木榻或案面接触、帐布风声；有灯芯声时保持轻微。无仓外人群、搬粮、马匹或无关脚步声。'
    else:
        ambient='只保留仓门通道与仓案现场声：已写明的落脚、衣料、纸张摩擦、束带解开、木案轻触及微弱仓外风声；没有对应动作就不加倒粮、搬袋或翻书声。'
    sound='声音要求：全片无BGM、无背景音乐、无配乐。'+ambient+' 环境声低于对白，远近随动作和空间变化。仅允许各镜“唯一允许发声的原句”引号内的文字，严格依镜头次序、由指定角色说出一次；不加画外闲聊、讲解、感叹词、呻吟、吟唱或第二层人声。角色名、“某某说”、“旁白”、“画外”、分镜编号、标题、时间段和导演说明绝不发声。普通对白、心声与静默各按本镜规则执行；没有原句的镜头禁止任何额外人声。'
    text=text[:text.rindex('声音要求：')]+sound+'\n'
    dest=OUT/'prompts'/source.name
    dest.write_text(text,'utf-8')
    delivered.append({'id':sid,'title':seg['title'],'seconds':seg['seconds'],'sourcePrompt':str(source),'sourceSha256':sha(source),'promptPath':str(dest),'sha256':sha(dest),'entry':seg['entry'],'end':seg['end'],'references':refs,'userApproved':False})

shutil.copy2(handoff['authoritativeFiles']['dialogue'],OUT/'01-台词单独审阅.md')
shutil.copy2(handoff['authoritativeFiles']['review'],OUT/'04-原分段规划.md')
(OUT/'逐镜对白白名单.json').write_text(json.dumps(spoken_rows,ensure_ascii=False,indent=2)+'\n','utf-8')
dialogue=['# 逐镜对白与口型对照','','全部台词与交接稿逐字一致，待用户审核。此文档用于核对，不把表头、角色名或控制说明复制到TTS text；真正可发声的字段只有白名单JSON的text。空text表示禁止人声。','']
for seg in delivered:
    dialogue += [f'## {seg["id"]}｜{seg["title"]}｜{seg["seconds"]}秒','','| 镜头与时段 | 说话人 | 受话人 | 声音位置／唯一口型 | 唯一发声原句 |','| --- | --- | --- | --- | --- |']
    for q in [r for r in spoken_rows if r['segmentId']==seg['id']]:
        dialogue.append(f'| {q["shot"]}：{q["startSeconds"]}–{q["endSeconds"]}秒 | {q["speaker"]} | {q["addressee"]} | {q["voicePosition"]}；口型：{q["lipOwner"]} | {q["text"] or "无：禁止任何人声"} |')
    dialogue += ['']
(OUT/'02-逐镜对白与口型对照.md').write_text('\n'.join(dialogue)+'\n','utf-8')

upload=['# 参考图上传清单','','每段使用自己的编号图片，按01、02、03……上传。图片为实际PNG文件，路径文字和本清单都不能代替图片附件。人物图只负责身份，场景图负责空间；所有图片均非强制首帧。参考图已按段复制，哈希与来源一致，未重新换脸或修改图像。','']
for s in delivered:
    upload += [f'## {s["id"]}｜{s["title"]}','','| 上传顺序 | 图片文件 | 具体用途 |','| --- | --- | --- |']
    for r in s['references']:upload.append(f'| {r["index"]} | [{Path(r["path"]).name}](<{Path(r["path"]).as_posix()}>) | {r["purpose"]} |')
    upload += ['']
(OUT/'03-参考图上传清单.md').write_text('\n'.join(upload)+'\n','utf-8')

index=['# 第二章补片MD与参考图｜交付版','','2026-10-26。承接“梳理第二章查粮视频脚本”的 review1；18份均为待审核候选，未提交生成、未替换游戏。13段主线、4条互斥替代段、1段后期补缺。台词、时长、故事动作与交互边界保持交接版本，仅收紧声音和参考图执行约束。','',f'[台词单独审阅](<{(OUT/"01-台词单独审阅.md").as_posix()}>) · [逐镜对白与口型对照](<{(OUT/"02-逐镜对白与口型对照.md").as_posix()}>) · [参考图上传清单](<{(OUT/"03-参考图上传清单.md").as_posix()}>)','', '| 段号 | 内容 | 时长 | 独立Prompt | 图片数 |','| --- | --- | ---: | --- | ---: |']
for s in delivered:index.append(f'| {s["id"]} | {s["title"]} | {s["seconds"]}秒 | [打开MD](<{Path(s["promptPath"]).as_posix()}>) | {len(s["references"])} |')
index += ['','## 播放与版本关系','','C04结束停在第一次普通选择；C05/C05R/C05C是对应路线，不能串播。选B先使用原有V16B，玩家明确继续查后才接C05R。C08结束停在第二次普通选择；C09/C09A/C09C互斥。C10保留读报告与回帐确认，C11保留读第二封信停点，读完才接C12。E01要到访村及夜谈回忆后的赴魏计划处，不能紧接C13。','','E01是30秒整段改写备选，旧13秒V25-02原句补片仍保留。两种方案覆盖同一缺口，不要同时生成并顺播；由用户审台词后决定采用哪版。第一章“偷听被处斩”和“妖孽现世”的交付继续保留，本次第二章梳理不替换它们。','','## 本轮完成的核对','','18份参数与时间轴、61个镜头的发声白名单（以核验记录实际统计为准）、台词逐字一致性、身份及空间图序、每段文件与参考图哈希已检查。没有进行实际配音试读或新片音画验收，格式通过不代表用户审批。C03沿用交接的无字粮路画卷方案，现有图片只作材质与空间参考，不宣称已经准备了专门画卷首帧。','','每镜“唯一允许发声的原句”是唯一人声来源。角色名、编号和控制说明不得进入TTS text；玩家画外说话时NPC闭口，NPC台词只有本人承担口型，心声无人听见，静默镜头无额外人声。','',f'[原分段规划](<{(OUT/"04-原分段规划.md").as_posix()}>) · [文档核验记录](<{(OUT/"audit/validation.json").as_posix()}>)']
(OUT/'00-交付清单.md').write_text('\n'.join(index)+'\n','utf-8')
manifest={'version':'delivery1','sourceVersion':handoff['version'],'sourceHandoffSha256':source_hash,'sourceApprovalStatus':handoff['status'],'segments':delivered,'adjustments':edits,'dialogueUnchanged':True,'submitted':False,'userApproved':False}
(OUT/'交付映射.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n','utf-8')
assert sha(SOURCE)==source_hash
print(json.dumps({'prompts':len(delivered),'shots':len(spoken_rows),'spokenLines':sum(bool(r['text']) for r in spoken_rows),'imageCopies':sum(len(s['references']) for s in delivered),'uniqueImages':len(set(r['sha256'] for s in delivered for r in s['references']))},ensure_ascii=False))
