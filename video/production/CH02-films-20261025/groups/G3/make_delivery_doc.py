from pathlib import Path
import json
OUT=Path(__file__).resolve().parent
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
P=read(OUT/'plan.json');D=read(OUT/'delivery.json');R=read(OUT/'review/decisions.json');Q=read(OUT/'review/picture-usability.json');q={x['id']:x for x in Q['clips']}
if D.get('userReviewBatch2Status'):
 import runpy
 runpy.run_path(str(OUT/'make_batch2_delivery_doc.py'),run_name='__main__')
 raise SystemExit(0)
if D.get('userReviewRepairStatus')=='picture-repair-complete':
 import runpy
 runpy.run_path(str(OUT/'make_user_review_delivery_doc.py'),run_name='__main__')
 raise SystemExit(0)
def link(label,p):return f'[{label}](<{Path(p).resolve().as_posix()}>)'
lines=['# G3 揭穿与访村夜谈｜制作候选交付','',
'本组覆盖 V21–V25。当前采用V21“画面修复V4”、其余四条“画面修复V2”，五条均完成浏览器0至终点静音播放、关键时点画面观察及疑点时间序列检查，文件SHA与复核证据绑定。V21另经独立视频轨解码确认2061帧/85.875秒，完整音频PCM逐样本一致。冻结台词的说话人、原句、来源与后续事件映射保留；这是执行者画面复核结果，userApproved=false，待用户 review。',
'', '正式声音尚未完成：既有中央玩家音轨按原句复用，本轮零新增TTS；NPC临时原声、音色、混音/BGM与精确声口仍待统一，未逐字听审。玩家画外句配NPC持续开口的问题已作为画面错误修复。','',
'V21旧V2因视频轨覆盖不足已撤回，当前只采用V4。总控已独立核验V4当前SHA对应2061帧/85.875秒，并接受本组五条当前SHA的生产画面结论；全63条视频轨审计无问题。本组画面制作收口，正式声音、接入条件和用户审核仍按各条记录继续维护。','',
link('完整分镜脚本',OUT/'分镜脚本.md')+' · '+link('逐句与请求计划',OUT/'plan.json')+' · '+link('机器交付索引',OUT/'delivery.json'),'','## 可播放逻辑段','',
'| 逻辑段 | 文件 | 时长 | 画面自查 |','|---|---|---:|---|']
for v in D['logicalClips']:
 name=v.get('name') or next(x['name'] for x in P['logicalClips'] if x['id']==v['id'])
 lines.append(f"| {v['id']} {name} | {link('播放 MP4',v['path'])} | {v.get('duration',0):.3f} 秒 | {q[v['id']]['pictureUsability']}；声音待统一 |")
lines+=['','## 本轮处理与边界','',
'- V21：五个玩家画外句采用自然听者；去掉持乱字信纸起镜和重复递纸，唯一递信保留完整接住及松手，纸面乱字局部失焦后切准确摘要，不伪造原信全文。既有去字幕、裁多余观看者、肩部局部色彩修复v4及删拿信靠灯动作均保留。',
'- V22：两个玩家问句采用自然听者并移除不适用纸张；令牌只表示接待与核对材料，正式出营批准仍由粮队管事单独说出。管事镜头保留已去多余第三人称越肩的版本。',
'- V23：两片按收粮动作接起来，避免重复表演完整收口；心声原句和原中央音轨长度可完整容纳。返回伤帐用夜间同姿态画面承接，不新增选择或证据。',
'- V24：夜间卧榻进入李严夜间低案，首尾短叠化回同一伤帐，只代表苟安所述回忆。03/06用新素材已复核的6秒自然听者片段及同室前向桌案/灯火观察；不采用新素材其余说话、新纸及旁观者部分，不生成R4。',
'- V25：06/07已改为自然听者起镜接同场足长前向观察镜，玩家两条长问句完整保留，无NPC持续代说、冻结嘴部或短循环。整段仍是未实行计划与风险讨论，不能按影片结束判定已赴魏、散谣或召军。',
'',link('五条成片画面可用性与接入条件',OUT/'review/picture-usability.json')+' · '+link('逐子片来源与处理记录',OUT/'review/decisions.json')+' · '+link('交付一致性核验',OUT/'review/delivery-audit.json'),'','## 接入条件','']
for v in D['logicalClips']:
 for condition in q[v['id']]['integrationConditions']:lines.append(f"- {v['id']}：{condition}")
lines+=['','## 本轮生成与素材复用','',
'本轮画面返修只新增1次15秒视频生成（V24-03-R3），整条原始结果未通过；仅采用已独立复核的原片3.5–9.5秒和精确裁框。白天听者复用已核SHA的G1-L01、G4-L02，只复用表演，不导入其原节点剧情/声音；没有追加白天生成，没有新增TTS。34条原子片、2次修订共36条任务记录保留，其中35成功、1历史失败已由修订恢复，当前无在途任务。',
'','## 夜间补充图','',
'使用既有 OpenAI Next image_api.py，以 gpt-image-2、2048×1152 生成，锁中央身份和原构图，只改夜间照明。没有新增同名角色身份图。','']
for id,title in [('gouan-night-prone','苟安夜间卧榻'),('liyan-night-desk','李严夜间低案')]:
 p=OUT/'references'/id/'image-01.png';prompt=OUT/'references'/f'{id}.prompt.txt'
 lines.append(f'- {title}：'+link('实际图片',p)+' · '+link('实际 API Prompt',prompt))
lines+=['','## 每请求独立 Prompt','', '独立正文列真实参考图顺序、绝对路径、用途、逐镜时码、逐句来源与声音责任。实际提交的精简正文另存 .api.txt；两者分别承担审核与模型调用用途。','',
'| 子片 | 请求时长 | 独立正文 | 远端状态 |','|---|---:|---|---|']
for c in P['clips']+P.get('revisions',[]):
 sp=OUT/'tasks'/f"{c['id']}.json";s=read(sp).get('status') if sp.exists() else '未提交'
 if c['id']=='V24-03':s+='；使用 R2 恢复'
 lines.append(f"| {c['id']} | {c['duration']} 秒 | {link(c['id']+'.md',OUT/'prompts'/f'{c["id"]}.md')} | {s} |")
lines+=['','## 验证的实际范围','',
'每条原片保留任务 ID、请求与技术记录，已下载者核视频解码、时长、尺寸和音轨。画面采用实际播放器播放、动作点截图及完整 3fps 时间序列检查；具体是否完成动态复核以逐片记录为准，不以抽帧或自动验证代替用户通过。','',
'音频没有完成逐字听审；生成字幕与画面问题按记录裁剪，原声错词、额外制作词、音色、BGM 等问题单独登记。原片和各轮编辑均保留，裁剪来源与时间可回溯。','']
(OUT/'本组交付.md').write_text('\n'.join(lines),encoding='utf-8')
print('Delivery document refreshed; status:',D['status'])
