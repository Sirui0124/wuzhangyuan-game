"""Publish G4 batch2 candidates after actual motion/text/track review; listening remains pending."""
from batch2_audio import *
import av,urllib.parse
POLICY='20261025-batch2-clean-speech-and-duration';PICTURE='20261025-no-meta-no-cards-no-boxes'
assert (W/'full-playback-complete.png').exists()
old=read(W/'baseline-delivery.json');current=read(O/'delivery.json');cand=read(W/'candidates.json');audit=read(O/'user-review-batch2.json');picture=read(O/'review/picture-usability.json')
assert [(c['id'],c['file'],c['technical']['sha256']) for c in current['clips']]==[(c['id'],c['file'],c['technical']['sha256']) for c in old['clips']],'Concurrent G4 delivery change'
verified={c['id']:c for c in read(W/'track-and-picture-verification.json')['clips']}
by={c['id']:c for c in cand['clips']};parts={c['id']:c for c in cand['subclips']};prev={c['id']:c for c in old['clips']};ar={c['id']:c for c in audit['clips']};pr={c['id']:c for c in picture['clips']}
rootComments=read(B/'reviews/user-20261025-batch2/comments-and-versions.json');comments={c['id']:c for c in rootComments['rows']}
wh={c['id']:c for c in read(B/'reviews/user-20261025-batch2/spoken-whitelist.json')['clips']}
plan=read(O/'plan.json');pc={c['id']:c for c in plan['clips']};stamp=now()
asrs={}
for c in cand['clips']:
 a=read(W/'asr-new'/(c['id']+'-'+c['technical']['sha256'][:10]+'.json'));assert a['sha256']==sha(c['file']);asrs[c['id']]=a
speakerV26=[('CH2-LY09-006','我','画外，苟安闭口听',[.34,4.5]),('CH2-LY09-008','军吏','画内军吏本人',[9.66,13.2]),('CH2-LY09-010','我','画外问句，镜头只看案头不让军吏代说',[15.12,18.32]),('CH2-LY09-011','军吏','画内军吏本人',[19.28,24.06]),('CH2-LY09-012','军吏','画内军吏本人',[24.06,28.98]),('CH2-LY09-013','军吏','画内军吏本人',[28.98,35.5]),('CH2-LY09-014','军吏','画内军吏本人',[36.26,45.32])]
observations={
'V26':'核收闭合卷束动作保留，演出不发声；无对白纸面观察压短；恢复我画外问句，后面军情解释均由案后军吏画内说。无屏幕角色标签、字卡或方框。',
'V27':'仅清除开头入帐32帧的乱声，原视频包完全一致，后面用户认为还好的对白/演出保留。',
'V28A':'我画外及苟安原答句完整，收紧两句交接处的无动作等待；保留答句内自然思考停顿。',
'V28B':'我画外及苟安原答句完整，收紧句前句后空等；未改变责任与下场原句。',
'V28C':'我保密承诺与苟安原答句完整；收紧空等，未增加接受最终补救动作。',
'V29':'建立镜头额外杂句随冗长演出删除，四句军吏渠道/追责/重罚处死/撤案限制完整，恢复合法我心声；NPC没有对心声作口型或反应。',
'V30':'苟安完整问句保留，仅收紧开头无动作等待；继续接原UI-O2。',
'L02':'无固定发声白名单，ASR无词；原文件保持确认本次原话后听者单播及末帧等待判定条件，不造固定话。',
'V31T':'真实短回应完整，删句前空等，不改T分支条件/后续选择。',
'V31D':'ASR未检出额外元字段，原句/开头等待已合理，原文件保留；听审pending。',
'V31R':'ASR未检出额外元字段，原质疑句完整、合理节奏，原文件保留；听审pending。',
'V31A':'完整原答句保留，仅删句前无动作等待，不冒作最终方案已实施。',
'V31N':'完整中性答句保留，仅删句前空等，不新增承诺。',
'V32R':'完整拒绝原句及句间犹疑保留，仅删句前空等，不提前押解/逃跑/死亡。'}
for cid,c in by.items():
 v=verified[cid];assert sha(c['file'])==c['technical']['sha256']==v['sha256'];assert sha(prev[cid]['file'])==prev[cid]['technical']['sha256']
 assert v['actualUniform24fps'] and not v['fullBlackSuspects'] and v['containerTail']<1/24+1e-6
 url=urllib.parse.urlsplit(comments[cid]['video']);reviewed=B/urllib.parse.unquote(url.path).lstrip('/');assert reviewed.resolve()==Path(prev[cid]['file']).resolve()
 reviewedMtime=urllib.parse.parse_qs(url.query).get('v',[None])[0];assert reviewedMtime==str(reviewed.stat().st_mtime_ns)
 row=ar[cid];row.update(status='free-repair-and-text-technical-review-complete-listening-pending' if c.get('batch2Changed') else 'audited-retained-listening-pending',newFile=c['file'],newSha256=c['technical']['sha256'],newDuration=c['technical']['duration'],durationChangeSeconds=round(c['technical']['duration']-prev[cid]['technical']['duration'],6),changed=c.get('batch2Changed',False),operation=c.get('batch2Operation'),observations=observations[cid],reviewPolicy=POLICY,pictureReviewPolicy=PICTURE,sourceVersionFromUserDOM=dict(file=str(reviewed),sha256=prev[cid]['technical']['sha256'],mtimeNs=reviewedMtime,note=comments[cid]['note'],approved=comments[cid]['approved']),spokenWhitelist=wh[cid]['spokenWhitelist'],neverReadStageOrDocumentText=wh[cid]['neverReadStageOrDocumentText'],newAsrEvidence=str(W/'asr-new'/(cid+'-'+c['technical']['sha256'][:10]+'.json')),newAsrSegments=asrs[cid]['segments'],motionEvidence=str(W/'full-playback-complete.png'),pictureTemporalEvidence=v['timeline'],trackVerification=str(W/'track-and-picture-verification.json'),listeningReview='pending: tools cannot hear audio; ASR only locates words. No timbre/pronunciation/BGM/lip-sync listening approval claimed.',userApproved=False,originalUserApprovalNotInherited=True,checkedAt=stamp)
 row['partRepairs']=[p for p in cand['subclips'] if p['slot']==cid]
 if cid=='V26':
  row['speakerOwnershipReview']=[dict(node=n,speaker=s,voicePosition=vp,newAsrApproxRange=rr,text=next(x['text'] for x in wh[cid]['spokenWhitelist'] if x['node']==n)) for n,s,vp,rr in speakerV26]
  row['speakerClarification']='开头及问句是我画外；军吏在案后画内说缺额、军情及丞相解释；收卷与纸面演出不朗读，不添加角色屏幕标签。'
  row['sourceFactMapping']=str(O/'user-review-20261025/V26-source-fact-mapping.json')
 if cid=='V27':row['openingRepair']=dict(oldSourceRange=[0,32/24],videoPacketsUnchanged=v['videoPacketsUnchanged'],first1p3SecondsAudioPeak=v['openingFirst1p3SecondsPeak'],sourceAsrCoarseRange=[0,1.96],realNextUtteranceBeginsAtNewAsr=1.84,reason='只清纯演出乱声，不按ASR粗区间裁入真实丞相答应原句')
 if cid=='V29':row['legalInnerThoughtPreserved']=dict(node='CH2-LY10-007',text='李严做过什么，苟安做过什么，都得如实交代。',speaker='我（心声）',newAsrRange=[47.6,52.02],method='复用原中央76条纯文本玩家原音；不是新增旁白，也不删合法心声')
 row['unresolved']=['实际音色、发音、BGM与最终声口听感仍待真实听审/用户审核；ASR同音/繁简不能自动判成念错。']
 u=pr[cid]
 if c.get('batch2Changed'):
  u.setdefault('versionHistory',[]).append(dict(file=u['file'],sha256=u['sha256'],observations=u.get('observations'),supersededBecause=POLICY))
 u.update(file=c['file'],sha256=c['technical']['sha256'],reviewPolicy=PICTURE,batch2ReviewPolicy=POLICY,reviewState='complete',userApproved=False,observations=observations[cid],audioReview='合法原句/归属/冗余区间已做来源与ASR文字核对并免费修复；实际听审pending，不是声音通过。',batch2Report=str(O/'user-review-batch2.json'))
 u.setdefault('dynamicChecks',[]).append(dict(method='第二批完整原速画面播放+每0.5秒时序检查；未听审',file=c['file'],sha256=c['technical']['sha256'],reviewedRanges=[[0,v['containerDuration']]],evidence=str(W/'full-playback-complete.png'),timeline=v['timeline'],policy=POLICY))
 u['audioIssues']=row['unresolved']
 for key in ['clips','slots']:
  existing=next(x for x in current[key] if x['id']==cid);oldCondition=existing.get('integrationConditions',[])
  existing.update(c);existing.update(reviewPolicy=PICTURE,batch2ReviewPolicy=POLICY,userApproved=False,sha256=c['technical']['sha256'],integrationConditions=oldCondition,userReviewBatch2=str(O/'user-review-batch2.json'),userReviewRepair=str(O/'user-review-batch2.json'),previousUserReviewRepair=str(O/'user-review-repair.json'),audioIssues=row['unresolved'],audioReview='text/source/duration repair candidate; actual listening pending')
  existing['technical']['fps']=24
  existing['visualReview']=dict(status='第二批画面与边界制作复查完成，用户待review',report=str(O/'review/picture-usability.json'),sha256=c['technical']['sha256'],reviewPolicy=PICTURE)
expectedSpoken=sum(1 for c in plan['clips'] if not c['silent'])
assert len(by)==14 and sum(len(wh[cid]['spokenWhitelist']) for cid in by)==expectedSpoken
oldSeconds=sum(c['technical']['duration'] for c in old['clips']);newSeconds=sum(c['technical']['duration'] for c in by.values())
audit.update(status='free-local-repairs-and-text-picture-track-checks-complete-listening-pending',completedAt=stamp,summary=dict(total=14,changed=11,retained=3,oldSeconds=oldSeconds,newSeconds=newSeconds,shortenedSeconds=oldSeconds-newSeconds,spokenUtterancesPreserved=expectedSpoken,restoredExistingPlayerLines=['CH2-LY09-010','CH2-LY10-007'],newTTSRequests=0,newVideoAPIRequests=0,quarantinedWrongTTS2Adopted=False,userApproved=0),unresolved=['全14条实际听审仍pending，包括音色、发音、BGM和最终声口听感；ASR/技术完成不能替代声音通过。','L02仍须确认原话后单播并末帧等判定；游戏内接入未改/未验证。'],noNewSynthesisReason='必要缺句均可复用根明确允许的中央76条原玩家纯文本WAV，军吏/苟安其它合法句有现存原声；不为ASR同音差异或未听过的音色猜测付费重投。',noLongSilenceOrFreezePadding='只在32帧入帐、4.167秒真实收卷及1.083秒军吏建立等无对白必要演出清声；删去无动作空等，没有用长静音/循环/静帧补回旧时长。')
current.update(updated=stamp,status='G4第二批免费音频/时长返修已完成，14条文字/画面/视频轨核对完成，实际听审pending、用户待review',userApproved=False,userReviewBatch2=str(O/'user-review-batch2.json'),previousUserReviewRepair=str(O/'user-review-repair.json'),userReviewRepair=str(O/'user-review-batch2.json'),audioReview='已纠正白名单外杂句并恢复合法原句候选；仅来源/ASR文字/技术核对，实际听审pending',unresolved=audit['unresolved'])
current['subclips']=[dict(parts.get(x['id'],x),technical=parts[x['id']]['technical']) if x['id'] in parts else x for x in current['subclips']]
current['visualReview'].update(actualPlaybackEvidence=str(W/'full-playback-complete.png'),batch2Report=str(O/'user-review-batch2.json'),assembledSlotsPlayed=14)
picture.update(updated=stamp,batch2Report=str(O/'user-review-batch2.json'),stage='第二批14条已核纯台词/归属/时长；免费修复后画面可用性复核完成，实际声音听审pending，用户未通过')
for p,d in [(O/'user-review-batch2.json',audit),(O/'review/picture-usability.json',picture),(O/'delivery.json',current)]:save(p,d)
status=read(O/'status.json');status.update(updated=stamp,stage=current['status'],userReviewBatch2=str(O/'user-review-batch2.json'),batch2Summary=audit['summary'],userApproved=False);save(O/'status.json',status)
lines=['# G4 第二批用户审片返修交付','',f'更新：{stamp}。14段完成纯台词、角色归属、冗余时长、画面与视频轨检查；实际声音听审pending，用户未通过。','',f'[逐条第二批返修报告]({(O/"user-review-batch2.json").as_posix()})','',f'总时长 {oldSeconds:.2f} 秒 → {newSeconds:.2f} 秒；11段调整，3段保留；无新视频生成/TTS。','', '| 槽位 | 旧时长 | 新时长 | 当前文件 |','|---|---:|---:|---|']
for cid,c in by.items():lines.append(f'| {cid} | {prev[cid]["technical"]["duration"]:.2f}秒 | {c["technical"]["duration"]:.2f}秒 | [{Path(c["file"]).name}]({Path(c["file"]).as_posix()}) |')
lines+=['','V26：开头和问句是我画外；案后军吏画内说明；收卷与纸面演出不朗读。V27：只清开头1.333秒演出乱声，后面原句/画面保留。V29合法我心声已恢复，未当元说明删除。','','L02无固定原句，确认本次原话后单播，末帧等待判定/回应，不自动循环/推进；本轮未改游戏。','','旧片、用户原评论及原版通过记录均保留；新版不继承旧通过。音色/发音/配乐/声口需实际听审。']
(O/'交付索引.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
print(json.dumps(audit['summary'],ensure_ascii=False))
