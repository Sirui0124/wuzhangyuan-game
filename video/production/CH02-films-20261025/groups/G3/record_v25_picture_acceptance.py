from pathlib import Path
import json,hashlib,datetime
O=Path(__file__).resolve().parent;R=O/'review/picture-repair';read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
def write(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2),encoding='utf-8')
s=read(R/'staged-logical-versions.json')['V25'];h=hashlib.sha256(Path(s['file']).read_bytes()).hexdigest();assert h==s['sha256']
proof=dict(id='V25',file=s['file'],sha256=h,played=[[0,75.152]],ended=True,duration=75.152,observedUTC=datetime.datetime.now(datetime.timezone.utc).isoformat(),method='本轮浏览器完整静音播放新成片，结合原片/观察镜对比及全时段序列；非逐字听审',findings=['V25-06保留0–0.7秒自然听者表情，随后同场前臂与榻沿观察；不出现持续开口，不冒充冻结闭口。','V25-07保留0–2.7秒自然听者表情，随后同场灯火观察；前后接回同一人、同一夜帐，未代替必须看到的交接或新剧情动作。','全部中文原句映射保留，两个玩家问句既有音轨完整放入7秒/8.5秒；其后苟安在V25-08才作回应。','未见字幕、可读假证据、玩家脸、物权变化或把赴魏/散谣/召军拍成已经执行。'])
write(R/'V25-final-playback.json',proof)
d=read(O/'review/picture-usability.json');r=next(r for r in d['clips'] if r['id']=='V25');r.update(file=s['file'],sha256=h,pictureUsability='usable-with-integration-condition',reviewState='reviewed',deliveryAdoption='staged-validated-awaiting-atomic-commit',dynamicReview=dict(method=proof['method'],reviewedPeriodsThisPass=[[0,75.152]],proof=str(R/'V25-final-playback.json')),integrationConditions=['按本版7秒、8.5秒的两个问句窗口接入，玩家问句只从画外发出；保留当前表情/观察镜组合，不回切旧V25-06/07连续口型或循环补时长。','V25仍是未实行计划与风险讨论；不能按影片结束自动认为已经赴魏、散谣或召军。'],audioIssues=['复用现有中央玩家两条音轨，无新增TTS；其他临时NPC原声、音色、BGM及精确声口仍待统一处理，未逐字听审。'],userApproved=False)
for i in r['issues']:i.update(state='closed',repair='由错误口型画面改为自然听者起镜＋同场足长前向观察镜；不是只标音频待修。',evidence=str(R/'V25-final-playback.json'))
write(O/'review/picture-usability.json',d)
over=read(R/'candidate-overrides.json');dur={'V21-07':2.625,'V21-11':4.286,'V22-04':2.6,'V23-03':2.5,'V25-06':7,'V25-07':8.5};rows=[]
for id,t in dur.items():
 x=over[id];x['localDynamicReview']=dict(file=x['file'],sha256=x['sha256'],played=[[0,t]],ended=True,method='本轮浏览器逐子片完整静音播放，非听审');rows.append(dict(id=id,**x['localDynamicReview']))
write(R/'local-repair-playback-proof.json',rows);write(R/'candidate-overrides.json',over);print('V25 picture issue closed on actual new SHA; source/audio limits retained.')
