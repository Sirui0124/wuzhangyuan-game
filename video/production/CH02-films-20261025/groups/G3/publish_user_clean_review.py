from pathlib import Path
import json,hashlib,datetime,subprocess,re
O=Path(__file__).resolve().parent;R=O/'user-review-20261025';POLICY='20261025-no-meta-no-cards-no-boxes';FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
def write(p,x):
 t=p.with_suffix(p.suffix+'.tmp');t.write_text(json.dumps(x,ensure_ascii=False,indent=2),encoding='utf-8');t.replace(p)
S=read(R/'staged-V21.json');proof=read(R/'V21-current-policy-review.json');D=read(O/'delivery.json');initial=sha(O/'delivery.json');Q=read(O/'review/picture-usability.json');U=read(O/'user-review-repair.json');dec=read(O/'review/decisions.json')
assert proof['sha256']==S['sha256']==sha(S['file']) and proof['ended'] and proof['played']==[[0,85.875]]
assert proof['reviewPolicy']==POLICY and S['decodedFrames']==2061 and S['audioPCMUnchanged']
old=next(x for x in D['logicalClips'] if x['id']=='V21');assert old['sha256']==S['previousSha256']
# Verify the actual newly exported track, independently of browser ended.
p=subprocess.run([FF,'-hide_banner','-i',S['file'],'-vf','showinfo,blackdetect=d=0.04:pix_th=0.02','-an','-fps_mode','passthrough','-f','null','NUL'],capture_output=True,text=True,encoding='utf-8',errors='replace',check=True)
ts=[float(x) for x in re.findall(r' n:\s*\d+ pts:\s*\d+ pts_time:([\d.]+)',p.stderr)];steps=[b-a for a,b in zip(ts,ts[1:])];assert len(ts)==2061 and max(abs(x-1/24) for x in steps)<.0002 and 'black_start:' not in p.stderr
coverage=dict(file=S['file'],sha256=S['sha256'],decodedFrames=2061,videoEndSeconds=85.875,frameSecondsAt24fps=85.875,firstPTS=ts[0],lastFrameStartPTS=ts[-1],uniformCFR24=True,minStep=min(steps),maxStep=max(steps),fullBlackIntervals=[],audioSampleIdentical=True,audioPCMSha256=S['audioPCMSha256'],audioPCMBytes=S['audioPCMBytes'],status='technical-coverage-passed',scope='视频轨、黑场和完整音频样本保留检查；非音频听审或用户审核')
cp=R/'V21-track-coverage.json';write(cp,coverage)
S.update(reviewState='reviewed',reviewPolicy=POLICY,coverageProof=str(cp),dynamicReview=proof,pictureUsability='usable-with-integration-condition',userApproved=False)
write(Path(S['file']).with_suffix('.json'),S);write(R/'staged-V21.json',S)
mapping=read(R/'second-letter-information-mapping.json');conditions=['玩家问句及心声从画外发出，保留当前自然听者窗口，不恢复旧持续代说。','第二封折信只交接一次；不恢复摘要卡、文字正文或纸面局部模糊层。',mapping['integrationCondition']]
old.setdefault('history',[]).append(dict(path=old['path'],sha256=old['sha256'],receipt=old['receipt'],reason='用户20261025实审否定字卡和可见纸面模糊层，本轮独立替换'))
old.update(path=S['file'],sha256=S['sha256'],receipt=str(Path(S['file']).with_suffix('.json')),duration=85.875,reviewPolicy=POLICY,policyReviewEvidence=str(R/'V21-current-policy-review.json'),pictureUsability='usable-with-integration-condition',reviewState='reviewed',integrationConditions=conditions,userReviewRepairStatus='repaired-awaiting-user-review',review='本轮新标准执行者实查完成，待用户重新审核；声音仍待统一',userApproved=False)
for rec in S['newSubclips']:
 id=rec['id'];c=next(x for x in D['subclips'] if x['id']==id);c.setdefault('history',[]).append(dict(file=c['file'],technical=c['technical'],review=c.get('review')));c['file']=rec['file'];c['technical']=dict(file=rec['file'],sha256=rec['sha256'],outputSize=[1280,720],fps=24,decodedFrames=rec['frameCount'],duration=rec['frameCount']/24,decode='passed',sourceRecipe=rec)
 previousReview=json.loads(json.dumps(dec[id],ensure_ascii=False));dec[id].setdefault('userReviewHistory',[]).append(dict(file=c['history'][-1]['file'],review=previousReview))
 dec[id].update(adoptPath=rec['file'],visual='按本轮无元文字/无字卡/无可见方框层标准实查，待用户重新审核',reviewPolicy=POLICY,findings=proof['findings'],actualDynamicReview=dict(played=True,file=S['file'],sha256=S['sha256'],playedRanges=[[0,85.875]],evidence=str(R/'V21-current-policy-review.json')),userApproved=False)
 c.update(review=dec[id],visualReview=dec[id]['visual'],actualDynamicReview=dec[id]['actualDynamicReview'],reviewPolicy=POLICY,userApproved=False)
q=next(x for x in Q['clips'] if x['id']=='V21');q.setdefault('reviewHistory',[]).append(dict(file=q['file'],sha256=q['sha256'],reviewPolicy=q.get('reviewPolicy'),reason='本轮用户标准否定旧字卡/局部失焦'))
q.update(file=S['file'],sha256=S['sha256'],pictureUsability='usable-with-integration-condition',reviewState='reviewed',reviewPolicy=POLICY,reviewPolicyScope=proof['reviewPolicyScope'],policyReviewEvidence=str(R/'V21-current-policy-review.json'),dynamicReview=dict(method=proof['method'],reviewedPeriodsThisPass=[[0,85.875]],proof=str(R/'V21-current-policy-review.json'),coverageProof=str(cp)),integrationConditions=conditions,independentReview=dict(state='pending-root-this-round',sha256=S['sha256']),userApproved=False)
q.pop('reviewPolicyPending',None);q['previousPolicyIssues']=q['issues'];q['issues']=[dict(id='user-20261025-remove-cards-and-boxes',state='closed',oldFile=S['previousFile'],oldSha256=S['previousSha256'],oldPeriods=[[20.166667,26.958333],[74.041667,81.458333]],repair='撤掉摘要卡及纸面失焦；采用素白外背折信真实交接和原片干净近景，无新增遮挡层。',newFile=S['file'],newSha256=S['sha256'],evidence=str(R/'V21-current-policy-review.json'))]
Q['priorIndependentReview']=Q.get('independentReview');Q.update(status='picture-review-complete-for-current-policy',reviewPolicy=POLICY,productionPictureClosure='completed-for-policy-awaiting-user',independentReview=dict(state='pending-root-this-round',scope='仅当前新标准聚合，历史接受不自动迁移到新版'),userApproved=False)
u=next(x for x in U['clips'] if x['id']=='V21');u.update(newFile=S['file'],newSha256=S['sha256'],reviewState='repaired-awaiting-user-review',reviewPolicy=POLICY,newReviewedRange=[[0,85.875]],actualCheckEvidence=str(R/'V21-current-policy-review.json'),technicalEvidence=str(cp),action='原片干净近景重剪＋单次8秒局部折信补拍；撤卡撤纸面失焦，未改既有完整音频',findings=proof['findings'],informationMapping=str(R/'second-letter-information-mapping.json'),integrationConditions=conditions,userApproved=False)
for issue in u['issues']:issue.update(state='closed',newFile=S['file'],newSha256=S['sha256'],evidence=str(R/'V21-current-policy-review.json'))
U.update(status='picture-repair-complete',scope='本轮G3画面修复、逐片新标准扫查和声音问题登记；非正式声音或用户审核通过',completedUTC=datetime.datetime.now(datetime.timezone.utc).isoformat(),unresolved=['正式音频与逐字听审仍待后续，G3本轮零新增TTS且完整既有音频保留','V21新版待用户重新审核；未迁移浏览器通过标记','第二封信精确信息由已设计信息层承载，游戏接入须按来源映射核实；本轮未改游戏'],userApproved=False)
for c in D['sourceCoverage']:
 if c['id']=='V21':c['presentationOverrides']=[mapping]
prior=D.get('independentReview',{}).get('V21');D.setdefault('independentReview',{})['V21']=dict(state='pending-root-this-round',file=S['file'],sha256=S['sha256'],previousAcceptance=prior)
D.update(userReviewRepairStatus='picture-repair-complete',reviewPolicy=POLICY,pictureAcceptanceStatus='complete-for-current-policy',productionPictureClosure='completed-for-policy-awaiting-user',userApproved=False,unresolved=U['unresolved'],newPostGate='closed')
D['tasks']=[read(p) for p in sorted((O/'tasks').glob('*.json')) if p.stem in {x['id'] for x in read(O/'plan.json')['clips']+read(O/'plan.json').get('revisions',[])}]
assert all(x.get('reviewPolicy')==POLICY for x in Q['clips']);assert sha(O/'delivery.json')==initial
write(O/'review/decisions.json',dec);write(O/'review/picture-usability.json',Q);write(O/'user-review-repair.json',U);write(O/'delivery.json',D)
print(json.dumps(dict(published=S['file'],sha256=S['sha256'],policy=POLICY,userApproved=False),ensure_ascii=False))
