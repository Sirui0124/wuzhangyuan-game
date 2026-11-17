from pathlib import Path
import json,hashlib,datetime,subprocess,re,collections
O=Path(__file__).resolve().parent; R=O/'review/picture-repair'
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def write(p,x):
 t=p.with_suffix(p.suffix+'.tmp');t.write_text(json.dumps(x,ensure_ascii=False,indent=2),encoding='utf-8');t.replace(p)
def duration(p):
 s=subprocess.run([FF,'-hide_banner','-i',str(p)],capture_output=True,text=True,encoding='utf-8',errors='replace').stderr
 m=re.search(r'Duration: (\d+):(\d+):([\d.]+)',s);return int(m[1])*3600+int(m[2])*60+float(m[3])
P=read(O/'plan.json');D=read(O/'delivery.json');initial=sha(O/'delivery.json');Q=read(O/'review/picture-usability.json');S=read(R/'staged-logical-versions.json');over=read(R/'candidate-overrides.json');dec=read(O/'review/decisions.json')
if D.get('userReviewRepairStatus'):raise SystemExit('用户实审返修已接管当前版本，停止旧画面修复发布入口，防止回指被否定的字卡/模糊层版本。')
assert len(Q['clips'])==5 and all(x['reviewState']=='reviewed' and x['pictureUsability'] in ['usable','usable-with-integration-condition'] for x in Q['clips'])
q={x['id']:x for x in Q['clips']}
for id,x in S.items():
 assert q[id]['file']==x['file'] and q[id]['sha256']==sha(x['file'])==x['sha256']
 proof=read(Path(q[id]['dynamicReview']['proof']));assert proof['ended'] and proof['sha256']==x['sha256']
 assert all(i['state']=='closed' for i in q[id]['issues'])
backup=R/'delivery-before-picture-repair.json'
if not backup.exists():write(backup,D)
for v in D['logicalClips']:
 id=v['id'];s=S[id];proof=read(Path(q[id]['dynamicReview']['proof']))
 if v['path']!=s['file']:v.setdefault('history',[]).append(dict(path=v['path'],receipt=v['receipt'],reason='superseded-by-picture-repair'))
 v.update(path=s['file'],receipt=str(Path(s['file']).with_suffix('.json')),sha256=s['sha256'],duration=proof['duration'],pictureUsability=q[id]['pictureUsability'],reviewState='reviewed',integrationConditions=q[id]['integrationConditions'],audioIssues=q[id]['audioIssues'],userApproved=False,review='执行者画面复核完成；声音待统一，待用户review')
 s.update(reviewState='reviewed',pictureUsability=q[id]['pictureUsability'],dynamicReview=q[id]['dynamicReview'],userApproved=False)
 write(Path(s['file']).with_suffix('.json'),s);q[id]['deliveryAdoption']='adopted'
for c in D['subclips']:
 id=c['id'];ov=over.get(id);logical=c['logicalId'];proof=q[logical]['dynamicReview']
 priorReview=dec[id].copy()
 if ov and not ov.get('reviewState','').startswith('rejected'):
  ov.update(reviewState='reviewed',finalDynamicReview=proof)
  dec[id]['pictureRepair']=ov
 if ov and not ov.get('reviewState','').startswith('rejected') and c['file']!=ov['file']:
  assert sha(ov['file'])==ov['sha256']
  ov.update(reviewState='reviewed',finalDynamicReview=proof)
  c['previousTechnical']=c['technical'];c['previousFile']=c['file'];c['file']=ov['file']
  c['technical']=dict(file=ov['file'],sha256=ov['sha256'],duration=duration(ov['file']),bytes=Path(ov['file']).stat().st_size,outputSize=[1280,720],fps=24,audioTrack=True,audioSampleRate=48000,decode='passed',sourceSegments=ov.get('sourceSegments',[]))
  dec[id]['previousReview']=priorReview
  dec[id].update(adoptPath=ov['file'],pictureRepair=ov,findings=[dict(issue='旧角色口型/道具问题已由独立画面版本修复',fix='采用本条pictureRepair的真实来源与时间，不循环补时长',state='closed',evidence=proof['proof'])])
  dec[id].pop('skipCentralVoice',None)
 c.update(visualReview='当前采用文件已在新逻辑成片完成全程静音动态复核，待用户review',actualDynamicReview=dict(played=True,assembly=logical,file=S[logical]['file'],sha256=S[logical]['sha256'],**proof),pictureUsability=q[logical]['pictureUsability'],userApproved=False)
 dec[id].update(visual=c['visualReview'],actualDynamicReview=c['actualDynamicReview'],userApproved=False)
 c['review']=dec[id]
D['tasks']=[read(p) for p in sorted((O/'tasks').glob('*.json')) if p.stem in {x['id'] for x in P['clips']+P.get('revisions',[])}]
D.update(pictureAcceptanceVersion='20261025-v2',pictureAcceptanceStatus='complete',newPostGate='closed',pictureReport=str(O/'review/picture-usability.json'),visualReview='五条当前采用逻辑成片全程静音动态复核；文件SHA与证据绑定，未代替用户审核',audioIssues=['正式音频仍待统一配音、逐字听审、音色/BGM与精确声口核对；本轮零新增TTS。','玩家画外句配NPC持续开口的画面问题已修复，不能恢复旧错误画面。'],unresolved=['统一声音制作与用户主观审核尚未完成'],userApproved=False)
Q.update(status='picture-review-complete',updatedUTC=datetime.datetime.now(datetime.timezone.utc).isoformat(),userApproved=False)
assert sha(O/'delivery.json')==initial,'Concurrent delivery update detected'
write(O/'review/decisions.json',dec);write(O/'review/picture-usability.json',Q);write(R/'candidate-overrides.json',over);write(R/'staged-logical-versions.json',S);write(O/'delivery.json',D)
print(json.dumps(dict(published=[v['id'] for v in D['logicalClips']],tasks=dict(collections.Counter(t['status'] for t in D['tasks'])),userApproved=False),ensure_ascii=False))
