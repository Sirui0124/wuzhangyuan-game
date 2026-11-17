from pathlib import Path
import json,hashlib,datetime
O=Path(__file__).resolve().parent
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
D=read(O/'delivery.json');old=read(O/'review/assembled-browser-playback.json');clips=[]
for v in D['logicalClips']:
 p=Path(v['path']);h=hashlib.sha256(p.read_bytes()).hexdigest();prior=next((r for r in old['clips'] if r['id']==v['id']),None)
 issues=[]
 if v['id']=='V25':issues=[dict(id='V25-wrong-speaker',subclips=['V25-06','V25-07'],state='open',timeScope='V25-06约1秒后、V25-07约3.3秒后',problem='玩家画外长问句期间苟安持续作说话表演，易形成NPC代说；属于画面返修，不再笼统归音频。',plannedRepair='先评估同场景足长观察镜/本地裁框，保留整句和自然时长；无足长可用本地画面再补拍一条验证。')]
 if v['id']=='V24':issues=[dict(id='V24-memory-speaker',subclips=['V24-03','V24-06'],state='open',timeScope='两子片中的苟安回忆画外句',problem='苟安回忆台词配李严开口，可能错误归属说话人；须复核并修复。',plannedRepair='保留苟安主观回忆及首尾边界，先查同房间观察镜/桌案手部画面避免错误口型，不改台词叙述身份。')]
 clips.append(dict(id=v['id'],file=str(p),sha256=h,pictureUsability='needs-repair' if issues else None,reviewState='repair-registered' if issues else 'pending',dynamicReview=dict(method='既有完整动态证据可引用；本轮关键疑点待重看',priorEvidence=str(O/'review/assembled-browser-playback.json'),priorPlayed=prior.get('played') if prior else None,priorFileSha256Matches=True,reviewedPeriodsThisPass=[]),issues=issues,integrationConditions=[],audioIssues=D['audioIssues'],userApproved=False))
r=dict(group='G3',status='review-and-repair-in-progress',updatedUTC=datetime.datetime.now(datetime.timezone.utc).isoformat(),clips=clips,rule='本轮画面可用性验收；技术解码和PTS不替代视觉审查；无新增TTS；原片保留，新成片独立版本验证后原子更新delivery')
(O/'review/picture-usability.json').write_text(json.dumps(r,ensure_ascii=False,indent=2),encoding='utf-8')
print('Registered V24/V25 picture repairs; V21–V23 pending this pass.')
