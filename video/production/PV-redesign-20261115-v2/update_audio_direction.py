from pathlib import Path
import json,hashlib,shutil
R=Path(__file__).resolve().parent
history=R/'revision-history/before-audio-clarification-20261115'
policy='''## 2026-11-15用户补充：整体重做与声音要求

用户原话：“感觉挺多要重做的。这里整体要强调。不要BGM，可以有人物声音。”

本条适用于本开篇PV，更新导演要求至v2.1；替代此前可能将“保留背景音”理解为只留环境声、将“去异常人声”理解为删除全部人物声音的做法。**最终全片不要BGM，允许人物对白、呼吸、喘息等剧情内声音，保留环境声与动作同期声。** “不要BGM”包含原生生成片里混入的配乐，不能只保证后期没有另加音乐。无配乐不等于全片静音，也不等于所有角色都不得发声。

对白逐句指定说话人、受话人、画内／画外与唯一口型承担者；原句见导演稿。不把“可以有人物声音”扩写为人人增加对白或遗言。呼吸、用力、喘息跟随身体动作，无对白镜仍可有这些人物声音。角色名、导演控制、无关旁白、乱码朗读不允许进入影片。人物对白、环境／动作、BGM分别检查；背景声分离候选不是最终声轨，因为它可能同时删掉有效人物声音或保留乐声。

整体制作要求：按各段重新核对构图、人物身份、场景空间、动作因果、镜长和声音，再决定能采用的片段。旧片只作可用素材候选，不以现有片段数量决定重拍范围。现有92秒仍是剪辑预算，按完整表演和正确对白调整，不为了卡时长剪断台词、接触和受力。

| 段落 | 处理要求 |
| --- | --- |
| 开场与奔赴 | 重拍江岸火线；骑行重新选动作和剪点，同步马蹄与鼻息。旧腰间近照停用。 |
| 庞统托付与交印 | 托付重拍，脸、掌与听者关系清楚；交印连同左右手、私印尺寸、完整条件句重新核对，接不上就一起重拍。 |
| 冯习张南与傅肜 | 夹击重建共同空间；傅肜按听劝、回答、迈步完整表演。保留正确人物声音。 |
| 沙摩柯 | 回望、命中中断、空鞍结果整组重新制作与配声；不恢复旧怪箭与坠马拼接。 |
| 上方谷 | 重拍雨压火与闭口仰望，环境声保持雨势连续；呼吸可保留，不新增台词。 |
| 关羽 | 落刀全过程和同期逐帧核对；出现兵器变形、接地跳变或人声污染无法修复时重拍。 |
| 马谡与诸葛亮 | 同场连续重拍，相视、垂眼、举扇连贯；允许自然呼吸，目前不额外添加求情对白。 |
| 五丈原 | 重新核对演员年龄、地图手势、灭灯与声音，旧片可用性待审，不将原生音乐一并保留。 |
| 救人与片名 | 第一视角抓握、受力保持连续；我的“拉住我”来自摄影机位置，伤兵喘息跟动作；片名延续短呼气后安静，禁止配乐起势。 |

当前已明确重拍的九条请求仍是第一批待审清单，不能据此把其他段落自动标为通过。本补充不代表用户通过全部v2分镜或九条Prompt；未提交新视频任务。现有MP4内容没有因本文更新而改变，仍是v2预演与旧分离候选，不能标为已满足v2.1的终版。
'''
targets=[R/'开篇PV-整体优化导演稿-v2.md',R/'声音匹配与待修清单.md',R/'README.md',R/'整体优化审阅.html',R/'make_review_page.py',R/'write_production_docs.py',R/'review-status.json',R/'h3-remake-manifest.json',R/'checksums.json']+list((R/'H3待审请求').rglob('*.md'))+list((R/'H3待审请求').rglob('prompt.txt'))
for p in targets:
 if p.exists():
  dest=history/p.relative_to(R);dest.parent.mkdir(parents=True,exist_ok=True)
  if not dest.exists():shutil.copy2(p,dest)
(R/'整体重做与声音要求-v2.1.md').write_text('# 开篇PV制作要求 v2.1\n\n'+policy,'utf-8')
banner='> **2026-11-15声音要求已更新至v2.1：最终全片不要BGM（包括原生混入的配乐）；允许并保留正确人物对白、呼吸、喘息，以及环境与动作声。现有背景声分离预演不是最终声音方案。** 详见[整体重做与声音要求](整体重做与声音要求-v2.1.md)。\n\n'
for name in ['开篇PV-整体优化导演稿-v2.md','声音匹配与待修清单.md','README.md']:
 p=R/name;t=p.read_text('utf-8');pos=t.find('\n')+1
 if banner not in t:t=t[:pos]+'\n'+banner+t[pos:]
 p.write_text(t,'utf-8')
# Regenerating request documents must also retain the latest sound contract.
p=R/'write_production_docs.py';t=p.read_text('utf-8')
old='声音要求：保留当前场景的环境底声与清楚的动作同期声；只允许“唯一允许发声的原句”中的对白，其他镜头无额外人声。无新增BGM、无角色标签或导演控制朗读。最终声音按实际生成内容逐句核对，不能把此文稿直接当作转录或字幕。'
new='声音要求（v2.1）：最终全片不要BGM，包括原生生成片混入的配乐。保留环境底声、动作同期声、符合动作的人物呼吸与喘息；对白只说“唯一允许发声的原句”，无对白不等于无人类呼吸。禁止角色标签、导演控制、无关旁白与乱码朗读。分别核验正确人物声音、环境／动作声和是否混入配乐，不以全轨静音或删除全部人声代替修正。最终按实际声音逐句核对，不把本文直接当转录或字幕。'
t=t.replace(old,new)
insertion="\nfor unit in units:\n unit['prompt'] += ' Sound contract: absolutely no background music or score, including music generated inside the source clip. Preserve scene ambience, synchronized physical sound and appropriate natural human breathing or exertion. Spoken dialogue is limited to the explicitly permitted lines in this request. Do not read control instructions, labels or unrelated narration.'\n"
needle="folder=R/'H3待审请求';folder.mkdir(exist_ok=True)"
if insertion not in t:t=t.replace(needle,insertion+needle)
p.write_text(t,'utf-8')
notice='<p class="note"><strong>v2.1声音要求：全片不要BGM，允许人物声音。</strong>保留正确对白、呼吸、喘息和环境／动作声；原生混入的配乐同样要排除。下方仍为旧v2分离候选预演，尚未完成这项声音制作。<a href="整体重做与声音要求-v2.1.md">查看整体重做要求</a></p>'
for name in ['整体优化审阅.html','make_review_page.py']:
 p=R/name;t=p.read_text('utf-8')
 if notice not in t:t=t.replace('<div class="docs">',notice+'<div class="docs">',1)
 p.write_text(t,'utf-8')
p=R/'review-status.json';v=json.loads(p.read_text('utf-8'));v.update(direction_revision='v2.1',audio_requirement={'BGM':'prohibited including source-generated music','dialogue':'permitted, exact approved lines and matching speaker','character_breathing_exertion':'permitted when motivated','ambience_sync_sound':'preserve and match'},existing_video='v2 preview unchanged, not v2.1 final mix',prompt_status='待review')
quote='感觉挺多要重做的。这里整体要强调。不要BGM，可以有人物声音。'
if quote not in v['user_feedback']:v['user_feedback'].append(quote)
p.write_text(json.dumps(v,ensure_ascii=False,indent=2),'utf-8')
print('Updated direction v2.1; preserved previous text versions; videos unchanged.')
