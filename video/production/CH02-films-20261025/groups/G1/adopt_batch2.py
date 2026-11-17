from user_repair import *
from copy import deepcopy
report=rd(O/'user-review-batch2.json');first=rd(reportpath);picture=rd(O/'review/picture-usability.json')
white={x['id']:x for x in rd(B/'reviews/user-20261025-batch2/spoken-whitelist.json')['clips']}
misread={'V04':[[0,4],[12.48,25.66],[27.9,30.17]],'V10':[[2.67,9],[31.45,52.45],[55.28,60.93],[63.56,75.13]],'V09':[[21.7,25]],'V08A':[[15.3,27.51]],'V12':[[0,3.48],[6.42,15.85],[23.78,29.9],[33.1,36.13]]}
for sid in sys.argv[1:]:
 t=rd(D/f'{sid}-batch2-timeline.json');tech=rd(D/'inspection'/f'{sid}-batch2-technical.json');assert sha(t['file'])==t['sha256']==tech['sha256'];assert tech['decode'] and not tech['blackEvents']
 old=rd(O/'assembled'/f'{sid}-assembly.json');archive=D/'batch2-old-assembly'/f'{sid}-{old["sha256"][:12]}.json'
 if not archive.exists():save(archive,old)
 a=deepcopy(old);a.update(path=t['file'],sha256=t['sha256'],duration=t['duration'],decode='passed',userReview='待重新review',userApproved=False,previousFile=old['path'],previousSha256=old['sha256'],sourceAssemblyArchive=str(archive),sourceTimeline=t['sourceTimeline'],listeningReview='未完成实际听审；ASR只定位，音色/自然度/逐字/无BGM/口型待用户复审',visualReview='本轮本地浏览器实际播放到ended，并核关键动作/关键帧；无字卡或可见方框模糊层。',audioIssues=['仅合法白名单原句发声；角色/动作/导演说明不朗读。','必要新句采用Seed-Audio1.0真实上传同角色参考；旧7条预置TTS2未采用。','工具不支持听音，ASR与接口subtitle不代表听审通过；音色、自然度、无BGM与精确口型待用户复审。'])
 a['subclips']=[];a['centralVoiceCues']=[];a['referenceVoiceCues']=[]
 for i,z in enumerate(t['sourceTimeline']):
  ident=f'{sid}-batch2-{i+1:02}';part=z.get('partFile',str(D/'batch2-parts'/f'{sid}-{i+1:02}.mp4'));assert Path(part).exists();a['subclips'].append(dict(id=ident,path=part,slotStart=z['slotRange'][0],slotEnd=z['slotRange'][1],sourcePath=z['source'],sourceSha256=z['sourceSha256'],sourceTrim=z['sourceRange'],rate=z.get('rate',1),crop=z.get('crop'),audioMode='exact-line-replacement' if z['node'] else 'source-original-or-silent-action',review=dict(actualDynamicReview=True,visualReview='新标准关键帧与浏览器ended核对',evidenceFile=str(O/'review'/('user-batch2-v12.html' if sid=='V12' else 'user-batch2-audio-candidates.html')),audioIssues=['实际听审未完成'],userApproved=False)))
  if z['node']:
   w=next(w for w in white[sid]['spokenWhitelist'] if w['node']==z['node']);cue=dict(node=z['node'],text=w['text'],speaker=w['roleControlOnly'],slotStart=z['slotRange'][0]+z['audioDelay'],slotEnd=z['slotRange'][1],sourceAudioStart=z['audioStart'],sourceAudioEnd=z['audioStart']+z['slotRange'][1]-z['slotRange'][0]-z['audioDelay'],path=z['audio'],sha256=z['audioSha256'],subclip=ident)
   cue['sourceAudioEnd']=min(cue['sourceAudioEnd'],dur(z['audio']));cue['slotEnd']=min(cue['slotEnd'],cue['slotStart']+max(0,cue['sourceAudioEnd']-cue['sourceAudioStart']))
   (a['centralVoiceCues'] if z['node'] in voice else a['referenceVoiceCues']).append(cue)
  elif z['audio']=='same source interval':
   for c in old.get('centralVoiceCues',[]):
    if c['slotStart']>=z['sourceRange'][0] and c['slotEnd']<=z['sourceRange'][1]:
     c=deepcopy(c);c['slotStart']=z['slotRange'][0]+c['slotStart']-z['sourceRange'][0];c['slotEnd']=z['slotRange'][0]+c['slotEnd']-z['sourceRange'][0];c['subclip']=ident;a['centralVoiceCues'].append(c)
 save(O/'assembled'/f'{sid}-assembly.json',a)
 x=next(x for x in report['rows'] if x['id']==sid);x.update(status='repaired-candidate-awaiting-user-listening',candidateFile=t['file'],candidateSha256=t['sha256'],newDuration=t['duration'],userApproved=False,oldApprovalNotTransferred=True,misreadIntervals=misread[sid],removedRangesReason='删元说明/乱码或不必要拖长，原正常对白/必要动作按sourceTimeline保留；ASR本身不作听审结论。',sourceTimeline=t['sourceTimeline'],technical=tech,actualPlayback=dict(ended=True,evidence=a['subclips'][0]['review']['evidenceFile']),asrLocator=str(D/'inspection'/f'{sid}-batch2-final-asr.json'))
 if sid=='V08A':x['removedRangesReason']='保留原通过版本；本次因旧纸面模糊层已需改版，提供完整合法022短候选，与15.3秒前两条玩家原句衔接；原音ASR不全不等于听审失败。'
 p=next(p for p in picture['clips'] if p['id']==sid);p.update(file=t['file'],sha256=t['sha256'],reviewState='reviewed',reviewPolicy='20261025-no-meta-no-cards-no-boxes',userApproved=False,pictureUsability='usable-with-integration-condition' if p.get('integrationConditions') else 'usable',issues=[],audioIssues=a['audioIssues'],dynamicCheck=dict(method='本轮浏览器1x到ended+动作连续与关键帧检查，声音未实际听审',actualReviewedRanges=[[0,t['duration']]],visibleEnded=True,evidenceFile=a['subclips'][0]['review']['evidenceFile']))
 s=next(s for s in first['globalPictureSweep'] if s['id']==sid);s.update(file=t['file'],sha256=t['sha256'],status='checked',textCards=False,visibleRectangleOrBlurPatch=False,evidence=a['subclips'][0]['review']['evidenceFile'],actualReviewedRange=[0,t['duration']])
 c=next((c for c in first['comments'] if c['id']==sid),None)
 if c:
  c.update(newFile=t['file'],newSha256=t['sha256'],newDuration=t['duration'],status='repaired-awaiting-user-review',unresolved=[],userApproved=False);c['repairs'].append(dict(treatment='batch2纯台词精剪与必要短动作，详见sourceTimeline',newFile=t['file'],newSha256=t['sha256'],timeline=str(D/f'{sid}-batch2-timeline.json')));c['checks'].update(technical=tech,actualPlayback=x['actualPlayback'],listeningReview='pending')
 for g in first.get('globalRepairs',[]):
  if g['id']==sid:g.update(newFile=t['file'],newSha256=t['sha256'],newDuration=t['duration'],status='repaired-awaiting-user-review',timeline=str(D/f'{sid}-batch2-timeline.json'))
picture['summary']={k:sum(x.get('pictureUsability')==k for x in picture['clips']) for k in ['usable','usable-with-integration-condition','needs-repair','pending']}
save(O/'review/picture-usability.json',picture);save(reportpath,first);save(O/'user-review-batch2.json',report);print('adopted',sys.argv[1:])
