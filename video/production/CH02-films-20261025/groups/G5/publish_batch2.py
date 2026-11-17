"""Atomic current pointers for G5's separately reviewed batch2 files."""
from pathlib import Path
import copy,json,os,datetime,urllib.parse
from batch2_audio import OUT,WORK,POLICY,read,sha,save,metadata

PICTURE='20261025-no-meta-no-cards-no-boxes'
NOW=datetime.datetime.now().astimezone().isoformat()
ROOT=OUT.parent.parent

def main():
 base=read(WORK/'baseline-delivery.json');slots={s['id']:s for s in base['assembled']}
 cs=read(WORK/'candidates.json')['clips'];tech={c['id']:c for c in read(WORK/'technical-checks.json')['clips']}
 wl={c['id']:c for c in read(WORK/'spoken-whitelist.json')['clips']}
 user={c['id']:c for c in read(ROOT/'reviews/user-20261025-batch2/comments-and-versions.json')['rows']}
 oldpic=read(WORK/'baseline-picture-usability.json')
 childnodes={c['id']:c['nodes'] for c in read(OUT/'plan.json')['clips']}
 motion=read(WORK/'motion-six.json')
 # Last candidate was actually played after its necessary reading action was restored.
 assert next(c['sha256'] for c in cs if c['id']=='V34')=='12881e6c1073f2952c587f39cb3cc9a790a0e9c12d5ce9a80a658fc35bf8cd88'
 motion['clips'].insert(2,dict(id='V34',sha256=next(c['sha256'] for c in cs if c['id']=='V34'),range=[0,25.75],completed=True,evidence='IAB ended log observed with 25.75/25.75 and current SHA'))
 motion.update(policy=POLICY,checkedAt=NOW,userApproved=False,audioListening=False,method='Current-SHA 1x muted playback from zero to ended; native-frame-zero 1fps full-range sheets inspected; 4fps critical contact/release sequences inspected. This is not actual audio listening or continuous frame-by-frame watching.')
 save(WORK/'review-motion.json',motion)
 suspect={
 'V32A':[(6.72,7.58,'冤妃你：疑似角色说明残音，第一句改用完整既有独立WAV'),(9.88,12.96,'角色/镜头说明误读'),(25.33,28.55,'灰麻衣/动作类说明误读'),(32.29,33.17,'逻辑/回答类说明误读')],
 'V33':[(.27,3.13,'收件镜头/动作说明误读'),(6.79,9.45,'动作/镜头说明误读')],
 'V34':[(0,4.2,'编号/只由本场NPC说话并做口型等元说明'),(10.12,14.4,'唯一开口等控制说明'),(28.21,29.55,'角色/动作说明'),(31.55,34.39,'错误复述与额外乱码；保留前半“粮情如实报”和后半“我愿受责”'),(37.61,42.75,'原本无台词的实际补报动作说明误读')],
 'V35':[(.27,8.25,'错误复用V33传信整段原声；此场白名单为空，所有人声必须清除')],
 'V36':[(9.21,10.71,'先收齐才谈核实：来自plan.action，不能作为对白'),(22.11,23.55,'宣读裁处动作说明误读'),(50.37,53.43,'退军令/传令动作说明疑似误读，白名单为空，整段清人声')],
 'V37':[], 'V42':[]}
 reasons={
 'V32A':'连同多余镜头删除角色/口型/镜头说明误读；五句白名单原话全部保留，两句玩家对白用既有独立WAV；书写、横划、下方署写、提笔保留。',
 'V33':'清除传信原句前后的工作说明人声，缩短走近前与收袋后尾段；实际交接/松手/收入袋动作保留。',
 'V34':'保留先读信动作，删除误读编号/角色/唯一开口等冗余音画；同一李严原声两处片段拼回完整“粮情如实报，我愿受责”；无台词写签递件段清除误读人声。',
 'V35':'清除上一轮错误沿用V33的传信人声，因本场无合法台词；缩短收件前与松手后冗余，保留完整取件/接触/松手及8秒展开回信/两附件落桌。',
 'V36':'删除“先收齐才谈核实”等动作说明误读和因此拖长的镜头；保留玩家登记请求与军吏四句责任裁处；退军令实际交接保留且不念演出说明。',
 'V37':'当前SHA自查只定位到三句合法原话/心声；保留原文件、空车、快乐搭手与撤军动作，没有因是心声而删除。',
 'V42':'当前SHA自查只定位到三句合法心声；保留干净纸背/翻页原文件，没有把心声当元说明删除。'}
 conditions={
 'V32A':['夜帐同一苟安与交代语境；回应段使用既有夜帐源，NPC口型与对白实际听审仍待完成。','动作段的原生墨迹不证明精确条款或署名字形；原事实保留独立来源映射，由既有游戏信息承接。'],
 'V33':['必须保留玩家递出→传信人抓稳→玩家松手→信收入袋的完整关系；不要把卷上短墨迹当准确事实证明。'],
 'V34':['先读信→质疑→撤回计划→愿受责→书写签署→递件次序保留；原生短笔迹不是准确姓名证明。','“粮情如实报/我愿受责”来自同一李严原声两个时间窗，拼接流畅性、语气及口型待听审。'],
 'V35':['无台词；取件、双方接触、传信人完全松手后，才能接展开回信及两张独立附件落桌。','收件必要动态段约5.29秒清除了全部旧人声；此时长由实际动作决定，没有为保旧片长添加静帧/循环。'],
 'V36':['实际材料接触/松手、收齐、核实、两人分别担责与回令交接均保留；没有自动结案或改变分支。','末段无台词，清除的是演出说明人声；真实回令递交保留。'],
 'V37':['保持原定E1分支，普通粮兵/空车/南撤及快乐搭手；不能作为其他结局结果。'],
 'V42':['只用于原定E1/E3旧记录语境；纸背不提供人口/粮数精确证明。']}
 delivery=copy.deepcopy(base);newslots=[];picrows=[];rows=[]
 for c in cs:
  id=c['id'];old=slots[id]
  assert sha(c['file'])==c['sha256']==tech[id]['sha256']
  assert tech[id]['decode']=='passed' and not tech[id]['blackDetection']
  assert any(m['id']==id and m['sha256']==c['sha256'] and m['completed'] for m in motion['clips'])
  asrpath=WORK/'final-asr'/(id+'-'+c['sha256'][:10]+'.json');ar=read(asrpath);assert ar['sha256']==c['sha256']
  index=WORK/'review'/(id+'-'+c['sha256'][:10])/'sequence-index.json';ix=read(index);assert ix['sha256']==c['sha256']
  ix.update(visualReview='actually-inspected-current-SHA-full-range',reviewPolicy=PICTURE,speechReviewPolicy=POLICY,checkedAt=NOW);save(index,ix)
  ev=[str((WORK/'review-motion.json').resolve()),str(index.resolve()),str(asrpath.resolve()),str((WORK/'technical-checks.json').resolve())]
  critical=WORK/'critical'/(id+'-'+c['sha256'][:10])/'index.json'
  if critical.exists():
   k=read(critical);k['actualInspection']='actually-inspected-contact-and-release-complete';save(critical,k);ev.append(str(critical.resolve()))
  url=user[id]['video'];rel=urllib.parse.unquote(url.split('?',1)[0].lstrip('/'));userfile=ROOT/rel
  reviewed=dict(browserVideo=url,file=str(userfile.resolve()),sha256=sha(userfile),duration=metadata(userfile)['duration'],approved=user[id]['approved'],note=user[id]['note'],reviewedByUserInStory=False)
  assert not reviewed['approved'] # G5 is after V28A, not reviewed/approved by user yet.
  dyn=dict(method=motion['method'],sha256=c['sha256'],actuallyReviewedRanges=[[0,c['metadata']['duration']]],evidence=ev)
  audio=dict(status='corrected-by-edit-pending-listening' if not c.get('unchanged') else 'ASR-audited-existing-audio-pending-listening',textAudit='ASR定位只见白名单原句及同音识别差异；ASR不能保证逐字正确、说话人、口型、音色或无BGM。',actualListeningCompleted=False,speakerListeningVerified=False,timbreApproved=False,bgmVerifiedAbsent=False,newAudioRequests=0,newTTS=0,wrongPresetTTS2Adopted=False,source='既有同角色NPC原声及已有玩家独立WAV；未把旧7条错误preset TTS2用于本组')
  row=dict(id=id,reviewPolicy=PICTURE,speechReviewPolicy=POLICY,userComment=user[id]['note'],userReviewedVersion=reviewed,productionBaseline=dict(file=old['file'],sha256=old['sha256'],duration=old['metadata']['duration']),spokenWhitelist=wl[id]['spokenWhitelist'],neverReadStageOrDocumentText=wl[id]['neverReadStageOrDocumentText'],misreadIntervals=[dict(start=a,end=b,reason=why,source='baseline current-SHA ASR auxiliary; not human listening proof') for a,b,why in suspect[id]],newFile=c['file'],newSHA=c['sha256'],newDuration=c['metadata']['duration'],durationChange=round(c['metadata']['duration']-old['metadata']['duration'],2),action=reasons[id],editDecisionList=c['parts'],pictureEvidence=ev,entry=wl[id]['entry'],next=wl[id]['next'],endEvent=wl[id]['endEvent'],keyActionsAndBoundaries=conditions[id],audio=audio,userApproved=False,audioApproved=False,gameIntegrated=False,unresolved=['实际逐字听审、切口听感、说话人/音色、口型与无BGM审核仍待完成。'])
  rows.append(row)
  slot=copy.deepcopy(old)
  if not c.get('unchanged'):
   slot['historicalSources']=slot.pop('sources');src=[]
   for childindex,child in enumerate(slot['historicalSources']):
    ca,cb=child.get('timelineRange',[0,0]);ranges=[]
    if childindex==len(slot['historicalSources'])-1:cb=max(cb,old['metadata']['duration'])
    for part in c['parts']:
     a,b=part['range'];start=max(a,ca);end=min(b,cb)
     if end>start:ranges.append([round(part['timelineRange'][0]+start-a,6),round(part['timelineRange'][0]+end-a,6)])
    src.append(dict(id=child['id'],nodes=childnodes[child['id']],file=c['file'],sha256=c['sha256'],sharedAssembledParent=True,sourceRangesAreParentTimeline=True,pictureRanges=ranges,sourceRange=ranges[0] if len(ranges)==1 else None,adoptedDuration=sum(b-a for a,b in ranges),boundaryPrecision='Old source manifest rounded to hundredths; exact source cuts are frame24 EDL. Max old-boundary metadata rounding about0.02s.',textLayers=[],containsTextOverlay=False,containsFullFrameCard=False,historicalSourceFile=child['file'],currentSourceAuthority=str((WORK/'edit-recipes.json').resolve())))
   slot['sources']=src
  elif id=='V42':
   for child in slot['sources']:
    if child.get('pictureRange'):child['timelineRange']=child['pictureRange'];child['adoptedDuration']=child['pictureRange'][1]-child['pictureRange'][0]
  for child in slot['sources']:child['nodes']=childnodes[child['id']]
  slot.update(file=c['file'],sha256=c['sha256'],metadata=c['metadata'],decode='passed',reviewPolicy=PICTURE,speechReviewPolicy=POLICY,visualReview='usable-with-integration-condition',pictureUsability='usable-with-integration-condition',reviewState='reviewed',visualIssues=[],pictureIssues=[dict(state='closed-in-current-candidate',description=reasons[id])],integrationConditions=conditions[id],dynamicReview=dyn,currentAudioAudit=audio,audioIssues=row['unresolved'],userReview='待review',userApproved=False,audioApproved=False,gameIntegrated=False,unresolved=[],editDecisionList=str((WORK/'edit-recipes.json').resolve()))
  newslots.append(slot)
  prior=next(x for x in oldpic['clips'] if x['id']==id);hist=copy.deepcopy(prior);hist.pop('history',None)
  picrows.append(dict(id=id,file=c['file'],sha256=c['sha256'],duration=c['metadata']['duration'],reviewPolicy=PICTURE,speechReviewPolicy=POLICY,reviewState='reviewed',pictureUsability='usable-with-integration-condition',dynamicReview=dyn,issues=slot['pictureIssues'],integrationConditions=conditions[id],audioIssues=row['unresolved'],audioAudit=audio,userApproved=False,audioApproved=False,gameIntegrated=False,history=prior.get('history',[])+[hist]))
 assert [n for s in newslots for n in s['nodes']]==base['sourceCoverage']['delivered']
 report=dict(group='G5',policy=POLICY,reviewPolicy=PICTURE,status='five-edited-two-preserved-awaiting-listening-and-user-review',completedAt=NOW,sourceUserReview='reviews/user-20261025-batch2/comments-and-versions.json',sourcePolicy='reviews/user-20261025-batch2/repair-policy.json',sourceWhitelist='reviews/user-20261025-batch2/spoken-whitelist.json',userReviewedThrough='V27',G5UserReviewed=False,sourceFacts=str((OUT/'user-review-20261025/source-facts-map.json').resolve()),nodeCount=35,childCount=27,legalSpokenLines=21,clips=rows,newAudioRequests=0,newVideoRequests=0,newReferenceUploads=0,newTTS=0,unknownOriginal=dict(id='V32A-01',neverRepost=True),oldWrongPresetTTS2Adopted=False,userApproved=False,audioApproved=False,gameIntegrated=False,unresolved=['七条均待实际听审：逐字发音、说话人/音色、拼接流畅、口型及BGM不能由ASR/技术检查判定。'],handoffToENDINGS=dict(sourceFiles=['V36-02-final-30f94a3f01.mp4','V36-06-final-53ddf10e06.mp4'],notified=True,replaceEntireE1=False,protectHappyEndingAndFinalInnerVoice=True))
 delivery.update(assembled=newslots,reviewPolicy=PICTURE,speechReviewPolicy=POLICY,phase='batch2-audio-corrected-by-edit-awaiting-listening',completedAt=NOW,userReview='待review',audioListening='未逐字听审',audioApproved=False,userApproved=False,gameIntegrated=False,newTTS=0,batch2Audit=str((OUT/'user-review-batch2.json').resolve()),dynamicReview=dict(authority=str((WORK/'review-motion.json').resolve())),reviewStatus='五条已剪误读音画，两条保留；声音仍待听审，未接入游戏',audioPolicy='本轮复用既有准确原句与独立玩家WAV，无新增音频请求。若后续确需补句，只用Seed-Audio1.0真实上传对应角色参考。',dialogueDurationAudit=str((OUT/'user-review-batch2.json').resolve()))
 delivery['resolvedVisualIssues']={c['id']:reasons[c['id']] for c in cs}
 paid=delivery['paidSubmissionAccounting'];paid['previousUserReviewRound']=paid.get('thisReviewRound');paid['thisReviewRound']=dict(policy=POLICY,newAudioRequests=0,newVideoRequests=0,newReferenceUploads=0,newTTS=0)
 for c in delivery['clips']:
  s=next(s for s in newslots if s['id']==c['slot']);c['currentSlotReview']=dict(file=s['file'],sha256=s['sha256'],reviewPolicy=PICTURE,speechReviewPolicy=POLICY,reviewState='reviewed',pictureUsability=s['pictureUsability'],authority='review/picture-usability.json and user-review-batch2.json; old source decisions are historical',userApproved=False);c['adoptedSource']=next(x for x in s['sources'] if x['id']==c['id'])
 pic={**oldpic,'clips':picrows,'reviewPolicy':PICTURE,'speechReviewPolicy':POLICY,'checkedAt':NOW,'userApproved':False,'audioApproved':False}
 outputs=[(OUT/'delivery.json',delivery),(OUT/'user-review-batch2.json',report),(OUT/'review/picture-usability.json',pic),(OUT/'review/slot-picture-overrides.json',{s['id']:s for s in newslots}),(OUT/'review/final-picture-closure.json',dict(group='G5',reviewPolicy=PICTURE,speechReviewPolicy=POLICY,logicalSlots=7,frozenNodes=35,currentFilesVerified=True,pictureStates={s['id']:s['pictureUsability'] for s in newslots},batch2Audit=str((OUT/'user-review-batch2.json').resolve()),audioListening='未逐字听审',newTTS=0,userApproved=False,audioApproved=False,gameIntegrated=False,completedAt=NOW))]
 pending=[]
 for path,value in outputs:
  backup=WORK/('before-batch2-'+path.name)
  if path.exists() and not backup.exists():backup.write_bytes(path.read_bytes())
  temp=path.with_name(path.name+'.pending');temp.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n','utf-8');pending.append((temp,path))
 for temp,path in pending:os.replace(temp,path)
 save(OUT/'review/root-handoff-notice.json',dict(reviewPolicy=PICTURE,speechReviewPolicy=POLICY,deliveryReady=True,rootIntegrationAcknowledged=False,notificationDelivered=False,authoritativeFiles=['delivery.json','user-review-batch2.json','review/picture-usability.json'],completedAt=NOW))
 lines=['# G5 第二批音画返修','',f'更新：{NOW}','','五条剪去误读与因此冗长的音画，两条保留。所有原对白及必要心声保留在21句白名单中，27子段/35节点与剧情分支未删。仍待用户review和实际听审。','','|片段|上轮制作版→本轮|实际处理|新片|','|---|---:|---|---|']
 for c in cs:lines.append(f'|{c["id"]}|{slots[c["id"]]["metadata"]["duration"]:.2f}→{c["metadata"]["duration"]:.2f}秒|{reasons[c["id"]]}|[播放]({Path(c["file"]).as_posix()})|')
 lines+=['','本轮没有新增视频/音频请求或费用，复用已有同角色原声与玩家独立WAV。未知V32A-01没有重投，旧7条错误preset TTS2没有采用。若后续需要补缺句，按当前授权使用Seed-Audio1.0并实际上传对应角色参考。','','验证：当前SHA全片1fps辅助图实际复看、七条1倍静音播放至片尾，递件/接触/松手/回令关键窗口另看4fps；五条新文件解码与黑帧检查通过。最终ASR仅定位到合法原句及同音差异，V35未检出人声。ASR与字幕均不证明逐字发音正确、说话人/音色、口型、拼接听感或无BGM；这些仍待实际听审。','','V34保留先读信及实际书写签署递件，V35保留真正收件与两附件放稳；无对白的必要动态画面清除了误读底音，没有用静帧、循环或延长静音保旧时长。精确文书内容仍保留原独立来源映射，不重新烧入影片。','','[逐条白名单、误读区间、旧新SHA与边界登记]('+str((OUT/'user-review-batch2.json').resolve().as_posix())+') ｜ [实际EDL]('+str((WORK/'edit-recipes.json').resolve().as_posix())+') ｜ [当前SHA播放记录]('+str((WORK/'review-motion.json').resolve().as_posix())+')','']
 md='\n'.join(lines);(WORK/'返修说明.md').write_text(md,'utf-8');(OUT/'制作自查与交付.md').write_text(md,'utf-8')
 html=(WORK/'review.html').read_text('utf-8')
 for c in cs:
  rel=os.path.relpath(c['file'],WORK).replace('\\','/');new=os.path.relpath(c['file'],OUT).replace('\\','/');html=html.replace('"src": "'+rel+'"','"src": "'+new+'"')
 (OUT/'合片审阅.html').write_text(html,'utf-8')
 print(json.dumps(dict(clips=[dict(id=c['id'],duration=c['metadata']['duration'],sha256=c['sha256']) for c in cs],newRequests=0,audioApproved=False,userApproved=False),ensure_ascii=False,indent=2))

if __name__=='__main__':main()
