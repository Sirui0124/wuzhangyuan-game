from pathlib import Path
import json,hashlib
R=Path(__file__).resolve().parent;P=R.parent
out=R/'三国遗憾-PV-v5-写实谷地与马谡叩首.mp4'
technical=json.loads((R/'technical.json').read_text('utf-8'))
assert technical['sha256']==hashlib.sha256(out.read_bytes()).hexdigest()
old=json.loads((P/'PV-regrets-20261117-v3/edit-timeline.json').read_text('utf-8'))
rows=[]
for s in old['shots']:
 s=s.copy();id=s['id']
 if id=='C03':continue
 if id=='A01':s.update(id='A01R',source=str(R/'A01R/source.mp4'),source_in=2.5,source_out=8,timeline_in=1.25,timeline_out=6.75,selection_reason='剔除前2.5秒夸张火球，保留后5.5秒雨中残火渐弱。')
 elif id=='C01':s.update(id='C01K2',source=str(R/'C01K2/source.mp4'),source_in=0,source_out=7,timeline_in=23.5,timeline_out=30.5,selection_reason='替换为同机位凝望后叩首，首版新增人物弃用。')
 elif id=='C02':s.update(timeline_in=30.5,timeline_out=38.5)
 elif id in ('D01','D03R','D02'):s['timeline_in']+=1.5;s['timeline_out']+=1.5
 elif id!='H01':s['timeline_in']-=2.5;s['timeline_out']-=2.5
 rows.append(s)
(R/'edit-timeline.json').write_text(json.dumps(dict(version='v5',duration=62.75,frames=1506,shots=rows,title=[57.75,62.75],removed=['A04','A02','C03'],speed=1,freeze_frames=False,user_review='待review'),ensure_ascii=False,indent=2),'utf-8')
record=json.loads((R/'production-record.json').read_text('utf-8'))
record.update(output=str(out),output_status='待review',actual_submissions=3,selected_shots=['A01R 2.5—8秒','C01K2 0—7秒'],excluded_shots=['C01K全部：右侧新增人物','A01R前2.5秒：夸张火球'],technical='全片完整解码；62.75秒，1506帧，1280×720，24fps',audio='原v3已选音轨和本地合成非音调风声；两条新视频原声不进入成片；无新增BGM或对白。',review_scope='原片2fps联系表及成片开场、叩首反打、夜帐接点抽帧；未声称完整人工听审或用户通过。')
for u in record['units']:u['当前状态']='待review' if u['id']=='A01R' else '待更新'
record['units'].append(dict(id='C01K2',prompt=str(R/'C01K2/prompt.txt'),prompt_sha256=hashlib.sha256((R/'C01K2/prompt.txt').read_bytes()).hexdigest(),prompt状态='待review',当前状态='待review',reference=str(P/'PV-opening-20261114/references/existing/E07-马谡刑场.png')))
(R/'production-record.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),'utf-8')
(R/'交付与检查.md').write_text('''# 三国遗憾PV v5｜2026-11-17

成片：三国遗憾-PV-v5-写实谷地与马谡叩首.mp4。62.75秒，1280×720，24fps，1506帧。状态待review，未替换正式游戏绑定。

已按用户要求调用MiniMax-H3生成并剪辑。此次共提交3条：上方谷8秒、马谡首版7秒、马谡定向修正版7秒。请求为768P，回片原生1344×768；成片正常裁为16:9并缩至720p，不称原生1080p或真人实拍。

上方谷采用新生成的实拍质感参考图。原片前2.5秒出现夸张火球，不采用；保留2.5—8秒雨中残火减弱，散落木料与残帐保持原场景。没有恢复被删除的重复柴火近景。

马谡首版出现右前景新增持扇人物，整条弃用。修正版保留E07原构图、左侧刀斧手和低刀，完成凝望后俯身叩首；取消原C03昂首回看。后接诸葛亮左下反打举扇，五丈原悬手与灯灭沿用既有素材。

声音：不使用两条新H3原声，保留v3已选音轨；新马谡段使用本地非音调滤波噪声风声，不伪称现场录音。无新增对白、音乐或BGM；没有将自动识别当听审。

检查：原片与成片完整解码；实际成片时长与1506帧核验；原片2fps联系表、成片开场及叩首反打与夜帐转场抽帧。未声称完成完整人工听审，仍请用户视听审核。具体来源、切点、哈希和状态见edit-timeline.json、technical.json及production-record.json。

API凭据保存在项目外本机DPAPI加密文件，未写入项目Prompt或生产日志。新调用脚本generate.py恢复同一服务与MiniMax-H3，已有任务只查询同一ID，不重复POST。
''','utf-8')
print('Final manifest and delivery notes saved.')
