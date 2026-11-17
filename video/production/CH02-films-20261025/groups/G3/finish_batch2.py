from pathlib import Path
import json, hashlib, subprocess, re, datetime, copy
O=Path(__file__).resolve().parent;R=O/'user-review-batch2'
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
read=lambda p:json.loads(Path(p).read_text(encoding='utf-8-sig'))
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
def save(p,x):
 p=Path(p);t=p.with_suffix(p.suffix+'.tmp');t.write_text(json.dumps(x,ensure_ascii=False,indent=2),encoding='utf-8');t.replace(p)
D=read(O/'delivery.json');U=read(O/'user-review-batch2.json');Q=read(O/'review/picture-usability.json');qm={c['id']:c for c in Q['clips']}
assert U['status']=='in-progress','Already published: do not rebuild approvals/history from the adopted versions'
snapshot=read(R/'reviewed-version-snapshot.json');oldmap={c['id']:c for c in snapshot['clips']}
changes={
'V21':'重取准确原声及既有玩家音轨；删除乱码、导演说明所在多余音画；保留一次完整折信交接和救人/利用供述。',
'V22':'约20秒控制说明连画面删除；补准确禀报承诺；保留令牌递放、邀请和粮队管事正式批准。',
'V23':'画面视频流原样复用，补回白名单既有心声；保留访村见闻、口粮动作及返回。',
'V24':'去长等待和末段元说明；保留回忆出入与完整夜谈，恢复最后风险问句。'}
old_intervals={'V21':[[9,10],[15,26],[23,85.875]],'V22':[[17.12,22.88]],'V23':[],'V24':[[66.41,68.73]],'V25':[]}
raw_intervals={'V21-02':[[0,1.42],[7.82,12.22]],'V21-05':[[0,1.22],[6.28,None]],'V21-06':[[0,.11],[6.23,None]],'V21-08':[[0,1.78],[8.22,None]],'V21-10':[[0,1.64],[7.08,None]],'V22-03':[[.82,3.38],[4.16,6.7]],'V22-05':[[3.73,7.03]],'V22-06':[[0,6.24]],'V24-06':[[2.9,4.9]]}
for row in U['clips']:
 id=row['id'];v=next(c for c in D['logicalClips'] if c['id']==id)
 row['oldProblemIntervals']=dict(periods=old_intervals[id],scope='用户粗定位与ASR辅助区间，重叠允许；不是逐字听审边界，V21的23秒后为用户报告范围')
 row['sourceProblemIntervals']={k:z for k,z in raw_intervals.items() if k.startswith(id+'-')}
 row['newUserApproved']=False
 if id=='V25':
  assert sha(v['path'])==row['oldSha256']
  row.update(reviewState='incomplete-do-not-adopt',currentFile=v['path'],currentSha256=v['sha256'],currentIsOldVersion=True,newFile=None,newSha256=None,newDuration=None,components=str(R/'V25-available-components.json'),missingSpokenNode='CH2-LY09-P02',unknownRecovery=str(R/'P02-unknown-recovery.json'),freeSourceSearch=dict(result='未找到可验证的同角色完整同句，不拼接其他语义或角色',evidence=[str(R/'P02-channel-0-asr.json'),str(R/'P02-channel-1-asr.json')],scope='原片混合及左右声道ASR，冻结63条白名单和现有合成登记；不是全部未听素材不存在此句的断言'),additionalIssue='P04提供方字幕准确，独立ASR可能多出我字，需实际听审，未采用整片')
  v['userReviewBatch2Status']='incomplete-P02-unknown-old-version-retained';v['userReviewBatch2Report']=str(O/'user-review-batch2.json');v['oldVersionUserPictureApproval']=dict(sha256=row['oldSha256'],approved=row['observedOldPictureApproval'],source=U['source'])
  continue
 c=read(R/(id+'-candidate.json'));assert sha(c['file'])==c['sha256']
 a=read(R/(id+'-candidate-asr.json'));assert a['sha256']==c['sha256'] and not a['possibleMetaMatches']
 # Decode every video frame independently of container duration/browser ended.
 run=subprocess.run([FF,'-hide_banner','-i',c['file'],'-vf','showinfo,blackdetect=d=0.04:pix_th=0.02','-an','-fps_mode','passthrough','-f','null','NUL'],capture_output=True,text=True,encoding='utf-8',errors='replace',check=True)
 (R/(id+'-decode.log')).write_text(run.stderr,encoding='utf-8')
 ts=[float(t) for t in re.findall(r'pts_time:([\d.]+)',run.stderr)]
 assert ts and (ts[0]==0 or (id=='V23' and 0<=ts[0]<1/24)),(id,ts[:1])
 steps=[b-a for a,b in zip(ts,ts[1:])];assert all(abs(t-1/24)<.00011 for t in steps),(id,min(steps),max(steps))
 end=ts[-1]+1/24;assert abs(end-c['duration'])<.002,(id,end,c['duration'])
 blacks=re.findall(r'black_start:([\d.]+) black_end:([\d.]+) black_duration:([\d.]+)',run.stderr);assert not blacks,(id,blacks)
 aud=subprocess.run([FF,'-v','error','-i',c['file'],'-vn','-ar','48000','-ac','2','-f','s16le','pipe:1'],capture_output=True,check=True).stdout
 assert abs(len(aud)/192000-c['duration'])<.05
 cov=dict(file=c['file'],sha256=c['sha256'],decodedFrames=len(ts),videoEndSeconds=end,firstPTS=ts[0],lastFrameStartPTS=ts[-1],uniformCFR24=True,minStep=min(steps),maxStep=max(steps),fullBlackIntervals=[],audioPCMBytes=len(aud),audioPCMSha256=hashlib.sha256(aud).hexdigest(),audioDecodedSeconds=len(aud)/192000,audioChangedByUserRequest=True,audioSampleIdentical=False,status='technical-coverage-passed',scope='视频实际帧/PTS、黑场和音频解码；本轮获准换声剪辑，不要求旧整片音频逐样本一致；不证明听审或声口通过')
 cp=R/(id+'-track-coverage.json');save(cp,cov)
 method='本轮IAB四片连续静音播放，回读每片played=[0,duration]及ended=true；结合完整1fps序列和来源切点；ASR仅辅助定位'
 proof=dict(id=id,file=c['file'],sha256=c['sha256'],duration=c['duration'],played=[[0,c['duration']]],ended=True,observedUTC=datetime.datetime.now(datetime.timezone.utc).isoformat(),browser='IAB tab 6 localhost8933 four-candidates-preview',reviewPolicy='20261025-no-meta-no-cards-no-boxes',speechReviewPolicy=U['reviewPolicy'],method=method,findings=[changes[id],'未新增工作正文、字卡、框、纸面模糊或短循环填时；各句角色与来源见白名单/合成配方。'],sequence=str(R/(id+'-candidate-1fps.jpg')) if id!='V23' else '画面流复制已审旧SHA，当前浏览器全片播放',coverageProof=str(cp),asrEvidence=str(R/(id+'-candidate-asr.json')),audioReview='未实际逐字听审；音色、杂音、BGM、精确声口待听审；ASR不是听审通过',userApproved=False)
 pp=R/(id+'-final-review.json');save(pp,proof)
 c.update(reviewState='picture-reviewed-audio-listening-pending',coverageProof=str(cp),speechReviewPolicy=U['reviewPolicy'],audioChangedByUserRequest=True,finalReviewProof=str(pp),decodedFrames=len(ts),videoEndSeconds=end,asrEvidence=proof['asrEvidence']);save(Path(c['file']).with_suffix('.json'),c);save(R/(id+'-candidate.json'),c)
 row.update(reviewState='repaired-awaiting-listening-and-user-review',newFile=c['file'],newSha256=c['sha256'],newDuration=c['duration'],durationDelta=c['duration']-row['oldDuration'],change=changes[id],sourceRecipes=c.get('sourceRecipes',[]),audioRestoration=c.get('audioRestoration'),finalReview=str(pp),technicalCoverage=str(cp),newAsrEvidence=proof['asrEvidence'],entryAndEndPreserved=True,noDurationPadding=True)
 v.setdefault('history',[]).append(dict(path=v['path'],receipt=v['receipt'],sha256=v['sha256'],duration=v['duration'],userPictureApproval=row['observedOldPictureApproval'],approvalSource=U['source'],reason='本轮纯台词及必要动作精剪；旧审核仅绑定此旧SHA'))
 v.update(path=c['file'],receipt=str(Path(c['file']).with_suffix('.json')),sha256=c['sha256'],duration=c['duration'],reviewState='reviewed',review='执行者画面/解码及ASR辅助检查完成；实际听审和新版本用户审核待完成',userApproved=False,speechReviewPolicy=U['reviewPolicy'],policyReviewEvidence=str(pp),audioIssues=[proof['audioReview']],userReviewBatch2Status=row['reviewState'],batch2Composition=str(R/(id+'-candidate.json')))
 q=qm[id];q.setdefault('reviewHistory',[]).append(dict(file=q['file'],sha256=q['sha256'],reason='batch2新版本不继承旧用户审批'));q.update(file=c['file'],sha256=c['sha256'],reviewState='reviewed',dynamicReview=dict(method=method,reviewedPeriodsThisPass=[[0,c['duration']]],proof=str(pp),coverageProof=str(cp)),policyReviewEvidence=str(pp),speechReviewPolicy=U['reviewPolicy'],audioIssues=v['audioIssues'],userApproved=False,independentReview=dict(state='pending-root-batch2',sha256=c['sha256']))
 for issue in q['issues']:issue['scopeNote']='历史问题及原证据保留；本轮当前版本证据见policyReviewEvidence'
U['status']='partial-complete-P02-unknown';U['actualChanges']=changes;U['audioRequests']=dict(newRequests=5,succeeded=4,unknownNoRepost=1,model='seed-audio-1.0',sameRoleReferenceUploaded=True,referenceSha256='891a8095fbc76835b7c8b9824224789a1493a198d6b2adeef68a1b53b36d060e',oldWrongPresetSamplesUsed=False)
U['unresolved']=['V25的CH2-LY09-P02请求结果未知，不重投；未找到可验证完整同句；保留旧片，七段可用部件未拼成缺句新版。','四条新版仍待实际听审与用户审核；V25 P04 ASR疑似多我字也待听审。'];save(O/'user-review-batch2.json',U)
for c in D['subclips']:
 if c['logicalId'] in changes:c['batch2SourceStatus']='historical-source-only-use-allowed-intervals';c['currentComposition']=str(R/(c['logicalId']+'-candidate.json'))
D.update(userReviewBatch2Status=U['status'],userReviewBatch2Report=str(O/'user-review-batch2.json'),pictureAcceptanceStatus='four-batch2-candidates-visual-reviewed-V25-old-retained',unresolved=U['unresolved'],audioIssues=U['unresolved'],audioReview='本轮按授权修音剪辑；ASR辅助完成，实际听审/音色/杂音/BGM/精确声口待完成')
save(O/'review/picture-usability.json',Q);save(O/'delivery.json',D)
print(json.dumps(dict(status=U['status'],updated=[(x['id'],x['newDuration'],x['newSha256']) for x in U['clips'] if x['newFile']],V25='old-retained-no-incomplete-replacement'),ensure_ascii=False))
