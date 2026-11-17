from pathlib import Path
import json, shutil, hashlib

R=Path(__file__).resolve().parent
OLD=R.parent/'PV-regrets-20261116-v1'
base=json.loads((OLD/'prompt-manifest.json').read_text('utf-8'))
old={u['id']:u for u in base['units']}
units=[]
common='\n16:9，真人历史电影实拍质感，自然皮肤与旧材料，方向明确的实际光源，中性自然色温，不加整体黄滤镜。无对白、旁白、歌词、音乐、低频Drone、心跳节拍、字幕、水印或工作文字。人物嘴唇闭合，声音仅为现场环境、真实呼吸与动作声。不在单条内自动切换场景，不生成转场特效；转场由后期按实际素材完成。'

def add(sid,src,name,duration,edit,prompt):
    refs=old[src]['reference_paths']
    for p in refs: assert Path(p).is_file(),p
    u=dict(id=sid,name=name,duration=duration,edit_duration=edit,depends_on=None,reference_paths=refs,prompt=prompt+common,prompt_status='待review',video_status='待生成',source_prompt=src)
    units.append(u)

add('H01','D01','灯前悬手·开场',5,4,'5秒单镜头。参考图锁定同一诸葛亮、黑冠黑袍、木案地图和画面右侧唯一桌灯。构图改为桌边近景：画面左侧是右手悬在地图上方两厘米的指尖，右侧是仍燃烧的同一油灯；背景只留原夜帐。人物脸不必入镜。固定50mm自然透视，手指轻微向纸面接近但始终不触纸，灯焰只轻偏一次，保持燃烧。手的关节、比例、地图和灯器不变。纸无清晰可读的生成文字。声音：一口浅呼吸、细微纸响、帐外轻风。')
add('A01','A01','谷地·雨幕压火',8,7,old['A01']['prompt'].replace('6秒','8秒',1)+' 摄影机横移只用于真实前中远层视差，最后1秒稳定，不甩镜；雨压火过程持续可见，近处焦木仍清晰。')
add('A04','A01','营道·雨水到达木架',5,4,'5秒连续单镜头，以参考图同一谷地火场为场景，不重画成另一座山。中景取原营道与一处燃烧木架，保留近处黑木、中间道路、后方原坡地。相机沿道路平稳前进约30厘米。细雨沿同一斜向落下，浅水沿现有坡向流过脚下泥土，碰到木架底部，暴露处的小火舌受到雨水压低，最后只剩低火与湿木。木架不倒塌，不出现人或冲锋，不出现大水冠、爆炸、巨浪和浓雾。声音只有较近雨声、细流水和渐弱火声。')
add('A02','A02','余炭·最后一点红',4,3,old['A02']['prompt'])
add('A03','A03','雨中诸葛亮·无言',5,4,old['A03']['prompt']+' 最后半秒保持眼线和羽扇位置，前景雨滴可轻微失焦，人物不能跟随相机转头。')
add('B01','B01','关羽·一人与远阵',7,6,old['B01']['prompt'].replace('6秒','7秒',1).replace('随后眼睛自然落向持刀的手，指节逐步松开，刀柄只倾斜几度','随后眼睛自然落向持刀的手，手仍握住刀柄，刀保持原位；只留一次呼吸'))
add('B03','B01','握刀之手·松开',5,4,'5秒连续真人电影手部近景。参考图只用于同一关羽、原衣袖和完整原长刀的身份与材质。相机取握住原刀柄的手与一段竖直刀柄，衣甲占画面左侧，远处湿地柔和失焦。准确起始状态是手指握紧刀柄；手背、五指和刀柄接触清楚。先保持半秒，随后食指、中指、无名指逐渐松开，掌心离开木柄，刀柄在重力作用下只向原落地方向倾斜少许，镜头在完整坠地前结束。不演握回，不新增第二只手，不换刀，不变成短刀，不展示死亡。50mm固定机位，风吹同一方向衣袖。声音为风、木柄与掌心轻擦、衣甲摩擦，无撞地声。')
add('B02','B02','刀留泥地·红缨静下',6,5,old['B02']['prompt'].replace('5秒','6秒',1)+' 刀刃位于右下形成向右下倾斜的弧形轮廓，保留原参考图的完整形制；后期与刑场低刀做形状接切，镜内禁止变刀、变场或出现刑场人物。')
add('C01','C01','刑场·右上凝望',6,5,old['C01']['prompt'].replace('five-second','six-second'))
add('C02','C02','监斩·完整举扇',8,7,old['C02']['prompt'].replace('6秒','8秒',1).replace('两秒后','三秒后')+' 举扇动作持续约三秒，末段扇遮眉眼后保持一秒，保留身体和案桌。不得让羽扇覆盖整块画面或凭空变成帐帘。')
add('C03','C01','刑场·仍在等回应',5,4,old['C01']['prompt']+' This is a NEW restrained reaction performance in the same exact framing: keep the upward-right gaze; at about two seconds the kneeling man takes one small breath, his chest settles, then he blinks once and continues waiting. No head turn or mouth movement. Do not raise or swing the executioner blade.')
add('D01','D01','五丈原·帐中地图',8,7,old['D01']['prompt'].replace('6秒','8秒',1)+' 相机从桌侧轻微横移20厘米，开头保持帐帘边缘的自然前景，随后看清人物、地图、单盏桌灯与帐门纵深。完整连续动作，不切镜，不揭开新场景。')
add('D03','D01','指尖·未能落下',6,5,'6秒真人电影近景。以参考图锁定同一右手、黑色衣袖、旧地图、木桌和右侧单盏油灯。构图以手与地图为主，灯只在画面右上边缘，仍保持燃烧；左手羽扇留在画外原位置。右手已经悬在地图上方，指尖轻轻接近半厘米又停止，始终与纸面有间隙，不落手、不写字、不指点新位置。手的五指与关节自然，不夸张颤抖。帐外的一阵风先使背景帐布轻动，再令灯焰小幅偏斜但本镜不熄灭。50mm桌高固定机位，脸可不入镜。声音为浅呼吸、衣袖、帐布与轻风，无人说话。')
add('D02','D02','灯灭·未竟',7,6,old['D02']['prompt'].replace('5秒','7秒',1)+' 前两秒正常燃烧，第三到第四秒偏斜收小并熄灭，后三秒保持灭灯状态与细烟消散，保留微弱环境冷光。不要重新点燃。')

for u in units:
    d=R/u['id'];d.mkdir(exist_ok=True)
    (d/'prompt.txt').write_text(u['prompt'],'utf-8')
    (d/'references.json').write_text(json.dumps(u['reference_paths'],ensure_ascii=False,indent=2),'utf-8')
    refs='\n'.join(f'{i+1}. [{Path(p).name}]({Path(p).as_posix()})，锁定原有人物/布景/材质。' for i,p in enumerate(u['reference_paths']))
    doc=f"# {u['id']}｜{u['name']}\n\n2026-11-17，v2。Prompt状态：待review；用户本轮已授权生成并合并，此授权不等于文稿或视频通过。\n\nMiniMax-H3，768P，16:9。整数请求时长 {u['duration']} 秒，计划原速选用 {u['edit_duration']} 秒，以实际动作复核。\n\n唯一允许发声的原句：无。无对白、旁白和BGM；允许真实呼吸、衣料和环境声。\n\n## 实际参考图与顺序\n\n{refs}\n\n接口统一使用reference_image，不宣称严格锁定首尾帧。\n\n## API正文\n\n```text\n{u['prompt']}\n```\n\n## 验收\n\n核对真实人物身份、道具形制、接触与运动因果，排除额外人声、音乐、伪字、变脸及错误动作。马谡全组只用E07，保持右上望；监斩反打左下看。失败另存，不以技术解码或自动分析替代用户通过。\n"
    (d/'生成文档.md').write_text(doc,'utf-8')

plan=dict(version='v2',date='2026-11-17',authorization='用户2026-11-17明确要求：增加电影大片感转场，使用此处MiniMax H3 API生成并合并。授权首次提交各镜，未知POST不得自动重投。',requested_seconds=sum(u['duration'] for u in units),planned_selected_seconds=sum(u['edit_duration'] for u in units),planned_title_seconds=5,planned_transition_overlap_seconds=1,target_seconds=75,units=units)
(R/'production-plan.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2),'utf-8')
legacy=R.parent/'PV-H3-20261115-v2.5'
for name in ['pipeline.py','invoke_unit.ps1']:
    if not (R/name).exists():shutil.copy2(legacy/name,R/name)
p=R/'pipeline.py';s=p.read_text('utf-8').replace("'version':'v2.5'","'version':'v2'");p.write_text(s,'utf-8')
(R/'导演与转场执行.md').write_text('''# 三国遗憾 PV｜75秒生成与转场执行 v2

2026-11-17。状态：已获生成与合并授权，成片待review。旧v1文稿、夷陵独立成片和旧素材均保留。

以诸葛亮的未完成动作贯穿四章。14条全新短镜，按实际动作原速选片；片名5秒，计划总时长75秒。镜头运动服从人物与动作，不以静态图推拉、重复镜头或大段慢放凑长。

## 主要转场

- H01→A01：桌灯亮部接谷火。后期约0.25秒短焦点/亮度匹配切，不加白闪或新火球；以真实画面为准，不做道具形变。
- A03→B01：0.25秒整幅焦点过渡，雨声短尾后转旷野风，区分不同地点。人物不透明重叠成双脸。
- B03→B02：松手后切落地结果，使用一次克制的接触声表达省略；不倒放或让已落地的刀再落一次。
- B02→C01：刀刃向右下斜线形状匹配硬切，刀形各自真实，不做武器变形；刑场仍保持E07完整原构图。
- C01→C02→C03：右上望/左下看原轴线硬切，完整保留举扇。不能甩镜、翻转或遮掉关键表演。
- C03→D01：0.25秒暗部遮入式过渡，用夜帐自身前景与整幅曝光完成，不增加局部矩形遮罩、假黑条或跨场变形。帐布声音可先入约0.15秒。
- D02→片名：在灯已实际熄灭后0.25秒整体淡黑，片名在黑底后期制作，环境余声消退。无字幕列表和说明卡。

其余接点以动作、视线和景别切换为主。若实际素材不支持原定接法，优先保留真实动作，记录实际选片与转场变化；不强称匹配通过。

## 声音与素材

无对白、旁白、BGM、旋律、Drone及节拍。原片声音先检测；有音乐或人声的音轨不得混入成片，改用已有干净现场声并记录来源。呼吸与环境声应按实际素材保留，禁止把未听审记成已听审。

马谡仅E07，停用M04及其视频，右上望；诸葛亮监斩反打左下看。五丈原为单盏桌灯，不增七星灯阵。上方谷雨灭后不得复燃。

按指定H3 SOP上传校验→请求预览→单次POST→保存任务ID→查询同一任务→下载与完整解码→动作和接点抽查→合并→用户review。保留原片、Prompt、API记录、剪辑源与实际验证报告，不额外打压缩包。
''','utf-8')
print(json.dumps({k:v for k,v in plan.items() if k!='units'},ensure_ascii=False))
