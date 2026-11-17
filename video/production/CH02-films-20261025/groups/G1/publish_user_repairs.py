from user_repair import *
r=rd(reportpath);picture=rd(O/'review/picture-usability.json')
for sid in sys.argv[1:]:
 x=next((x for x in r['comments'] if x['id']==sid),None)
 if x is not None and not x.get('newFile'):
  g=next(z for z in r.get('globalRepairs',[]) if z['id']==sid)
  x.update(newFile=g['newFile'],newSha256=g['newSha256'],newDuration=g['newDuration'],oldInterval=g['oldInterval'],unresolved=g.get('details',{}).get('unresolved',[]));x['repairs'].append(g)
 if x is None:
  g=next(x for x in r.get('globalRepairs',[]) if x['id']==sid);x={**g,'userComment':'全片新标准：去可见局部模糊层/卡片','repairs':[g],'unresolved':g.get('details',{}).get('unresolved',[])}
 assert x['newFile'] and sha(x['newFile'])==x['newSha256']
 evidence=O/'review'/('user-repair-free2.html' if sid in ['V08B','V11N'] else 'user-repair-more.html' if sid in ['V02','V06','V08A','V10'] else 'user-repair-free1.html')
 baseline=D/'old-assembly'/f'{sid}-{x["oldSha256"][:12]}.json'
 old=rd(baseline) if baseline.exists() else rd(O/'assembled'/f'{sid}-assembly.json');archive=D/'old-assembly'/f'{sid}-{old["sha256"][:12]}.json'
 if not archive.exists():save(archive,old)
 new={**old,'path':x['newFile'],'sha256':x['newSha256'],'duration':x['newDuration'],'previousFile':x['oldFile'],'previousSha256':x['oldSha256'],'userReview':'待重新review','userApproved':False,'decode':'passed','userReviewRepair':{'comment':x['userComment'],'oldFile':x['oldFile'],'oldSha256':x['oldSha256'],'oldInterval':x['oldInterval'],'repairs':x['repairs']},'visualReview':'本轮用户返修：本地浏览器实际完整播放到ended，未见黑屏、文字卡或可见方框层。','audioIssues':['新预置TTS音频未采用；本条仅历史正确原声复用或按用户静音/删除。','制作核对不替代用户重新审核。']}
 # Do not leave the previous edit's clip geometry attached to a new file.
 new['sourceAssemblyArchive']=str(archive)
 new['subclips']=[dict(id=sid+'-user-repair-r1',path=x['newFile'],slotStart=0,slotEnd=x['newDuration'],sourceTrim=[0,x['newDuration']],audioMode='user-requested-repair',review=dict(evidenceFile=str(evidence),actualDynamicReview=True,visualReview='浏览器播放至ended，结合关键帧核对画面；听审未完成',userApproved=False))]
 cues=[dict(c) for c in old.get('centralVoiceCues',[])]
 if sid=='V02':
  for c in cues:
   for k in ['slotStart','slotEnd']:
    if c[k]>=4.6:c[k]+=17.83
  new['sourceTimeline']=[dict(source=x['oldFile'],sourceRange=[0,4.6],slotRange=[0,4.6]),dict(source=x['repairs'][-1]['restoredSource'],sourceRange=[0,17.83],slotRange=[4.6,22.43]),dict(source=x['oldFile'],sourceRange=[4.6,x['oldDuration']],slotRange=[22.43,x['newDuration']])]
 if sid=='V08A':
  for c in cues:
   if c['slotStart']>=15.1:
    c['slotStart']-=5.1;c['slotEnd']-=5.1
 if sid=='V06':
  v=voice['CH2-LY02-015'];cues=[dict(node=v['node'],text=v['text'],speaker=v['speaker'],centralPath=v['path'],centralSha256=v['sha256'],sourceAudioStart=0,sourceAudioEnd=v['duration'],slotStart=.3,slotEnd=.3+v['duration'])]
 for c in cues:c['subclip']=sid+'-user-repair-r1'
 new['centralVoiceCues']=cues
 new['audioIssues']+=x.get('unresolved',[])
 save(O/'assembled'/f'{sid}-assembly.json',new)
 x['status']='partially-repaired-awaiting-reference-audio' if x.get('unresolved') else 'repaired-awaiting-user-review';x.setdefault('checks',{}).update(actualPlayback={'range':[0,x['newDuration']],'ended':True,'evidence':str(evidence)},technical=rd(D/'inspection'/f'{sid}-technical.json'));x['userApproved']=False
 q=next(q for q in picture['clips'] if q['id']==sid);q.update(file=x['newFile'],sha256=x['newSha256'],reviewState='reviewed',userApproved=False)
 if q.get('pictureUsability')=='needs-repair':
  q['pictureUsability']='usable-with-integration-condition' if q.get('integrationConditions') else 'usable'
 q['priorIssues']=q.get('issues',[]);q['issues']=[]
 if not x.get('unresolved'):q['reviewPolicy']='20261025-no-meta-no-cards-no-boxes'
 q['dynamicCheck']={'method':'本轮真实浏览器完整播放与关键帧视觉检查；声音依原WAV/精确静音处理核验，未以ASR冒称逐字听审。','actualReviewedRanges':[[0,x['newDuration']]],'visibleEnded':True,'evidenceFile':str(evidence)}
 z=next(z for z in r['globalPictureSweep'] if z['id']==sid);z.update(file=x['newFile'],sha256=x['newSha256'],status='checked',textCards=False,visibleRectangleOrBlurPatch=False,evidence=str(evidence),actualReviewedRange=[0,x['newDuration']])
 for g in r.get('globalRepairs',[]):
  if g['id']==sid:g['status']=x['status'];g['checks']=x['checks']
picture['summary']={k:sum(z.get('pictureUsability')==k for z in picture['clips']) for k in ['usable','usable-with-integration-condition','needs-repair','pending']}
save(reportpath,r);save(O/'review/picture-usability.json',picture);print('Published candidates:',sys.argv[1:])
