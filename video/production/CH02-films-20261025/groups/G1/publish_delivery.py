from pathlib import Path
import json,time
OUT=Path(__file__).resolve().parent
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
plan=read(OUT/'plan.json');rows=[]
for sl in plan['slots']:
    p=OUT/'assembled'/f"{sl['id']}-assembly.json"
    if not p.exists():continue
    a=read(p)
    if not Path(a['path']).is_file():continue
    checks=[x['review'] for x in a['subclips']];actual=all(x.get('actualDynamicReview',isinstance(x.get('visualReview'),dict)) for x in checks)
    reuse=[x['review'] for x in a['subclips'] if x['review'].get('sourcePath')]
    reuse += [dict(sourcePath=x['sourcePath'],sourceSha256=x.get('sourceSha256'),sourceIntervals=[x.get('sourceTrim')],rate=x.get('rate',1)) for x in a['subclips'] if x.get('sourcePath')]
    rows.append(dict(id=a['id'],file=a['path'],status='制作候选',duration=a['duration'],sha256=a['sha256'],decode=a['decode'],subclips=a['subclips'],centralVoiceCues=a['centralVoiceCues'],visualReview=checks,actualDynamicReview=actual,audioIssues=a.get('audioIssues',[])+[issue for r in checks for issue in r.get('audioIssues',[])],userReview='待review',reuseSources=[dict(path=x['sourcePath'],sha256=x.get('sourceSha256'),intervals=x.get('sourceIntervals')) for x in reuse],entry=a['entry'],next=a['next'],endEvent=a['endEvent']))
ids={r['id'] for r in rows};data=dict(group='G1',title=plan['title'],status='production_complete-awaiting-user-review' if len(ids)==len(plan['slots']) else 'in_progress',clips=rows,coverage=dict(expectedSlots=len(plan['slots']),deliveredSlots=len(ids),deliveredIds=sorted(ids),outstandingSlots=[s['id'] for s in plan['slots'] if s['id'] not in ids]),audioPolicy='复用已完成中央音轨；未新增TTS。纯音频问题不付费重拍，等待统一配音。',updatedUtc=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),validation=plan['checks'],notes=['制作自查不等于用户通过。','播放器只登记明确成片，不把已提交或下载原片当成完成。','所有UI、互斥选项与确认边界分别保留；未修改游戏或在线表。'])
data['completionLimitations']=['用户15:49返修仍在进行，完成情况逐条见userReviewRepairReport；声音实际听审未完成。','L01仅在玩家确认本次原话后的播放／等待判定阶段单播；结束保持真实末帧，不自动循环、倒放或推进，取得判定／回应后才进入对应V11。输入界面不播放；动态内容仅使用confirmedText。','新标准禁止局部模糊/框层遮字；V06/V08A/V10已撤旧层，V12纸背真实交付替换仍在生成与核验中；旧版保存追溯，不视为新标准通过。']
data['audioPolicy']='中央既有音轨按原句复用；新的预置TTS2已隔离，未混片。所需苟安新句只走Seed-Audio1.0上传参考音频，样本成功但实际听审未完成，未扩生成。'
batch2=OUT/'user-review-batch2.json'
if batch2.exists():
    data['userReviewBatch2Report']=str(batch2)
    data['spokenWhitelist']=str(OUT.parents[1]/'reviews/user-20261025-batch2/spoken-whitelist.json')
    data['audioPolicy']='既有准确原声/中央玩家音轨优先复用；仅必要苟安原句采用Seed-Audio1.0真实上传同角色参考；旧7条预置TTS2隔离未采用。接口字幕与ASR只作文字定位，所有候选实际听审/音色/无BGM/精确口型待用户复审。'
    data['completionLimitations']=['本轮候选改版均待用户重新review；制作检查不等于用户通过。','工具不支持实际听音；音色、自然度、逐字、无BGM与精确口型仍待实际听审。','L01无固定对白，只在本次原话确认后的播放/等待判定阶段单播；动态声音仅使用confirmedText；结束保持真实末帧，不自动循环或推进。']
    for row in rows:
        a=read(OUT/'assembled'/f"{row['id']}-assembly.json")
        row['referenceVoiceCues']=a.get('referenceVoiceCues',[])
for row in rows:
    if row['id']=='L01':row.update(loopReady=False,loopLimitation='确认本次原话后的播放／等待判定阶段单播，结束保持真实末帧；不自动循环或推进，取得判定／回应后才进入对应V11。输入界面不播放。',dynamicSource='CH2-LY03-018.confirmedText')
picture_report=OUT/'review/picture-usability.json'
if picture_report.exists():
    picture=read(picture_report);picture_by_id={x['id']:x for x in picture['clips']}
    data['pictureUsabilityReport']=str(picture_report);data['pictureUsabilitySummary']=picture.get('summary')
    for row in rows:
        r=picture_by_id.get(row['id'])
        if r and r['sha256']==row['sha256']:
            row.update(pictureUsability=r['pictureUsability'],pictureReviewState=r['reviewState'],integrationConditions=r['integrationConditions'],userApproved=False)
            if r.get('reviewPolicy'):row['reviewPolicy']=r['reviewPolicy']
generation=[]
all_clips=plan['clips']+(read(OUT/'repair-plan.json')['clips'] if (OUT/'repair-plan.json').exists() else [])
for c in all_clips:
    p=OUT/'tasks'/f"{c['id']}.json"
    if p.exists():
        s=read(p);generation.append(dict(id=c['id'],task_id=s.get('task_id'),status=s['status'],error=s.get('error'),statePath=str(p)))
data['generationTasks']=generation
if (OUT/'POST-PAUSED.json').exists() and len(ids)<len(plan['slots']):data['status']='in_progress-upstream-recovery';data['newPostPause']=read(OUT/'POST-PAUSED.json')
user_repair_report=OUT/'user-review-repair.json'
if user_repair_report.exists():
    repair=read(user_repair_report);data['status']=repair['status'];data['userReviewRepairReport']=str(user_repair_report)
    data['userReviewRepairSummary']={s:sum(x['status']==s for x in repair['comments']) for s in sorted({x['status'] for x in repair['comments']})}
pending=OUT/'delivery.json.pending'
pending.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
for attempt in range(8):
    try:pending.replace(OUT/'delivery.json');break
    except PermissionError:
        if attempt==7:raise
        time.sleep(.15)
print(json.dumps(dict(delivered=len(ids),outstanding=data['coverage']['outstandingSlots']),ensure_ascii=False))
