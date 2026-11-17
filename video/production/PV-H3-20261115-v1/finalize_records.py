from pathlib import Path
import json,hashlib,datetime
import pipeline

OUT=Path(__file__).resolve().parent
notes={
 'G10':['已查看2fps联系表；傅肜有拒降口型与持刀动作，实际说话时刻与原稿预设不同，无声版不表示逐字口型已同步。','原生片内嵌上下黑边，工作剪辑从有效画面内重新取16:9构图，已查看裁后联系表；原片保留。'],
 'G04':['采用正常军帐中景修订v2；原v1内容策略失败记录保留。','2fps抽帧可见印从庞统掌中实际交到接收手上，确认承住后发送手退出。接收手入画侧与原稿预设不同，保留待review。'],
 'G09':['此3秒是已生成原片未采用尾段的替代剪辑，不是原背向迎敌动作生成成功。','依次采用G07的7—8秒、G08的3—4秒、G05的1—2秒，无静态补帧或重复已采用范围。原无ID提交保留且未重投。'],
 'G11':['原G11完成回望、中箭但未完整坠马；补镜G11B单独完成离鞍和落地。','工作版使用G11的0—4秒＋G11B的2—4秒，合计6秒；2fps抽帧可见人落地、马继续离开。箭和骨朵的外露形态、落点顺序在补镜之间仍需人工连续性审阅。'],
 'G17':['已查看2fps联系表；长柄刀从竖直倾倒到地面，红缨随后落下。','采用前3秒已包含触地结果，原生原片和续镜实际起始帧保留。'],
 'G19':['已查看2fps联系表；马谡由低头抬眼，捆缚及主要身份连续。','嘴形张合比原稿中欲言又止的设计明显；本版无声，不把嘴形当作新对白。'],
 'G20':['原片擅加前景铠甲人物，工作剪辑改为右侧面部特写，主要排除该人物。','已查看裁后联系表：诸葛亮垂眼、细泪下落可见；局部裁切后放大到720p，不能称为原生高分辨率细节。'],
 'G21':['2fps抽帧可见宽羽扇从腰前上举遮住眉眼并停住，左手仍在案边。','动作完成，扇面从侧转到正面的宽度变化、具体羽毛连续性仍待实速审核。'],
 'G22':['2fps抽帧可见从羽扇和手移向地图、手伸向地图。','手最终落到图面而非停在图面上方，原稿的悬停未完全实现；列待review差异。'],
 'G23':['依实际熄灭时刻改取原片1—4秒，已查看调整后联系表。','3秒采用范围包含火焰变小、熄灭和细烟，不以整体淡黑代替灭灯。'],
 'G24':['原v1出现施救者背影，旧版不采用。','采用单一干净参考重做的连续POV v2的0—3秒；已查看2fps总览，近处没有施救者头肩背或完整身体。'],
 'G25':['采用同一连续POV v2的3—8秒；已查看4—8秒的8fps动作联系表。','右前臂入镜，伤兵后段双手抓住前臂并开始上移；与原稿单手回握有差异，未完成逐帧、实速视觉或用户审核。']
}
review_path=OUT/'frame-review-notes.json';review=pipeline.read(review_path)
stamp=pipeline.now()
for uid,rows in notes.items():
    review['units'][uid]={'checked':True,'checked_at':stamp,'notes':rows}
    d=OUT/uid;local=pipeline.read(d/'review.json',{})
    local.update(technical='pass',motion_review='contact_frames_checked',method='查看2fps联系表；救人另查看4—8秒8fps动作联系表。未称为完整实速观看或听审。',notes=rows,user_review='待review')
    pipeline.save(d/'review.json',local)
pipeline.save(review_path,review)

for d in OUT.glob('G*'):
    if not d.is_dir():continue
    state=pipeline.read(d/'state.json')
    if not state:continue
    plan=pipeline.read(d/'plan.json',{})
    if state.get('status')=='downloaded':
        if state.get('error'):state['resolved_preparation_error']=state.pop('error')
        if d.name.endswith('v2'):state['version']='v2'
        pipeline.save(d/'state.json',state)

active={u['id']:pipeline.read(OUT/u['id']/'state.json',{}) for u in pipeline.PLAN['units']}
tasks={};attempts=[]
for d in OUT.glob('G*'):
    if not d.is_dir():continue
    for p in sorted(d.glob('api/**/task.json')):
        t=pipeline.read(p);tid=t.get('task_id')
        if not tid:continue
        task=tasks.setdefault(tid,{'task_id':tid,'directory':str(d),'records':[],'active_units':[]})
        task['records'].append(str(p.relative_to(OUT)))
    for req in sorted(d.glob('api/**/request.json')):
        body=pipeline.read(req);run=req.parent;task=pipeline.read(run/'task.json',{})
        attempts.append({'directory':str(run.relative_to(OUT)),'task_id':task.get('task_id'),'model':body.get('model'),'duration':body.get('duration'),'resolution':body.get('resolution'),'reference_count':sum(c.get('type')=='image_url' for c in body.get('content',[])),'submission_error':pipeline.read(run/'submission-error.json'),'submission_status':'accepted' if task.get('task_id') else 'unknown_outcome','request_sha256':hashlib.sha256(req.read_bytes()).hexdigest()})
for tid,item in tasks.items():
    d=Path(item['directory']);queries=sorted(d.glob('api/**/latest-query.json'))
    remote=pipeline.statusofresult(pipeline.read(queries[-1])) if queries else ('unknown',{})
    item.update(remote_status=remote[0],error=remote[1].get('error'),active_units=[uid for uid,s in active.items() if s.get('task_id')==tid])
registry={'date':'2026-11-15','updated_at':stamp,'tasks':list(tasks.values()),'submissions':attempts,'unknown_submissions':[a for a in attempts if a['submission_status']=='unknown_outcome'],'active_units':[{'id':uid,'status':s.get('status'),'version':s.get('version'),'task_id':s.get('task_id'),'selected_file':s.get('selected_file'),'selection_recipe':s.get('selection_recipe')} for uid,s in active.items()],'user_review':'待review'}
pipeline.save(OUT/'task-registry.json',registry)
provenance={}
for name,path in [('sop',Path(r'D:/AI视频/VJ-1106/api-tools/docs/MiniMax-H3-API视频生成SOP-20261114-v1.md')),('api_entry',pipeline.ENTRY)]:
    provenance[name]={'path':str(path),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
pipeline.save(OUT/'sop-provenance.json',provenance)

summary='''# 逆转五丈原 开篇PV H3动态审阅版

2026年11月15日 · v1 · 用户审核待定。

[播放108秒无声动态审阅版](./开篇PV-H3-v1-108秒-无声动态审阅.mp4) · [逐条视频审阅页](./视频审阅.html) · [原导演稿](../PV-opening-20261114/开篇PV-导演修订稿-v1.md)

## 本次交付

本版使用你指定的MiniMax-H3 SOP生成素材并完成工作剪辑。全片108秒、2592帧、1280×720、24fps、H.264，无音轨。多数原生素材为1344×768、24fps；原片单独保留，工作版中心轻裁为16:9并缩至720p。傅肜片去除了模型内嵌上下黑边，诸葛亮含泪镜头另作局部构图后放大，见G10与G20的reframe-record.json，不称为原生高分辨率生成。

无声是本轮按SOP采用的素材方式：本版不含配音、环境音或BGM。原稿台词及音效安排仍在导演稿中，不把嘴形视为逐字口型已同步。

## 主要处理

- 保留铜印奔马、庞统托付、夷陵人物、雨火、关羽落刀、马谡对视、羽扇、灯灭和救人的顺序。
- G03原请求HTTP520无ID，经你明确允许后另存v2重提一次，旧提交保留。
- G04原任务因服务端内容策略失败，未产出视频；改为衣着和交接关系清楚的军帐中景v2，现采用此版。
- G11初版未完整坠马，拆成G11B单独补足；现用初版前4秒和补镜2—4秒，仍占6秒。
- G20收紧为诸葛亮面部特写，主要排除模型擅加的前景武将；原片保留。
- G23根据实际灯焰熄灭时刻改取原片1—4秒。
- G24、G25旧版出现第三人称施救者，未采用；改用干净无玩家起始图生成连续第一视角v2，再分成3秒和5秒。
- G09网络中断无ID，重投确认尚未收到，未自动重投。其3秒位置暂用G07、G08、G05尚未采用的动态尾段组成战况蒙太奇。原设计“两人分别迎敌”没有独立生成成功，本版明确保留这项差异。

## 已做检查和待审阅差异

所有采用素材及整片已完整解码，已核对时长、尺寸、帧率和音轨。已查看2fps联系表；结尾互握另查看8fps动作联系表。抽帧不等于完整实速视听审阅，也不等于用户通过。

仍需你重点看：庞统镜头自动推近到掌心；夷陵前后夹击的空间是否足够清楚；马谡与雨中诸葛亮的嘴形张合偏明显；五丈原的手落到图面而非悬停；落马补镜的箭与兵器细节；伤兵最终改为双手攀住我的右前臂。这些均在逐条审阅页记录，不由技术检查替代审核。

## 文件与恢复

每个G目录保存Prompt、参考图记录、已验证URL、API请求与任务记录、原片、技术信息及抽帧。G03-v2、G04-v2、G11B、G24-25-v2分别保存修订或补镜来源。全局任务记录见task-registry.json，选片与来源时间见edit-timeline.json；assemble.py可重新合成同一剪辑，未在此脚本中提交生成请求。

G03与G09的无ID原提交状态仍不明，不能据本地失败推断远端没有任务或不会计费。G03只按明确授权重提过一次；G09未重投。已有ID任务只恢复查询及同一结果下载，未重新POST。

未更新飞书制作台账，未接入游戏，未改变任何既有用户通过结论。交付原文件，不额外打包压缩文件。
'''
if (OUT/'browser-verification.json').exists():
    summary=summary.replace('所有采用素材及整片已完整解码，已核对时长、尺寸、帧率和音轨。','所有采用素材及整片已完整解码，已核对时长、尺寸、帧率和音轨。浏览器正常速度播放至108秒结尾，无播放错误；26个预览视频元数据均可读取，移动布局无横向溢出，见browser-verification.json。')
(OUT/'README.md').write_text(summary,'utf-8')
pipeline.snapshot()
print(json.dumps({'known_task_ids':len(tasks),'submission_attempts':len(attempts),'unresolved_no_id':len(registry['unknown_submissions']),'active_segments':len(active),'frame_checked':len(review['units'])},ensure_ascii=False))
