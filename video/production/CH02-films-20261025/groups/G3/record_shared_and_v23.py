from pathlib import Path
import json,hashlib,datetime
O=Path(__file__).resolve().parent;R=O/'review/picture-repair';read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
def write(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2),encoding='utf-8')
rows=read(R/'shared-listener-reuse.json');dur={'G1-L01':6.020996,'G4-L02':7.458333}
for r in rows:
 r.update(reviewState='own-dynamic-review-passed',actualPlayback=dict(played=[[0,dur[r['id']]]],ended=True,duration=dur[r['id']]),findings='本轮完整静音播放及全时段序列：同一苟安、日间伤帐、灰衣黑巾、留榻姿态匹配，未见持续说话表演、新道具或文字；轻微呼吸/吞咽式嘴形不等同代说。不进一步慢放或短循环。')
write(R/'shared-listener-reuse.json',rows)
s=read(R/'staged-logical-versions.json')['V23'];h=hashlib.sha256(Path(s['file']).read_bytes()).hexdigest();assert h==s['sha256']
proof=dict(id='V23',file=s['file'],sha256=h,played=[[0,17.417]],ended=True,duration=17.417,observedUTC=datetime.datetime.now(datetime.timezone.utc).isoformat(),method='本轮浏览器完整静音播放，结合前后收粮与回帐时点核对；非听审',findings=['收粮从袋口未合状态接下一次取粮，不重复完整封口；接触动作连续。','心声期间老妇人处理粮袋，无听见心声的定向回应。','回到同一夜帐、苟安闭口；未见新的说话表演、字幕、玩家脸或证据。'])
write(R/'V23-final-playback.json',proof)
d=read(O/'review/picture-usability.json');r=next(r for r in d['clips'] if r['id']=='V23');r.update(file=s['file'],sha256=h,pictureUsability='usable',reviewState='reviewed',dynamicReview=dict(method=proof['method'],reviewedPeriodsThisPass=[[0,17.417]],proof=str(R/'V23-final-playback.json')),integrationConditions=[],audioIssues=['正式声音仍待统一；不新增TTS；现有心声完整映射保留，未逐字听审。'],userApproved=False)
for issue in r['issues']:issue.update(state='closed',repair='独立V2保留0–2.5秒闭口回帐反应，删除其后无源说话表演。',evidence=str(R/'V23-final-playback.json'))
write(O/'review/picture-usability.json',d);print('Shared sources and V23 final dynamic evidence recorded; main delivery awaits atomic adoption.')
