from pathlib import Path
import json,hashlib,datetime
O=Path(__file__).resolve().parent;B=O.parents[1];R=O/'user-review-20261025';read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
review=B/'reviews/user-20261025-1549';snapshot=read(review/'version-snapshot.json');comments=read(review/'comments.json');D=read(O/'delivery.json')
rows=[]
for s in snapshot['clips']:
 if s['owner']!='G3':continue
 assert sha(s['file'])==s['sha256'];old=next(x for x in D['logicalClips'] if x['id']==s['id'])
 rows.append(dict(id=s['id'],userComment=s['note'],observedUserPictureApproved=s['observedPictureApproved'],applicableGlobalCorrections=comments['globalCorrections'],oldFile=s['file'],oldSha256=s['sha256'],oldReviewedRange=[0,old['duration']],classification=['document-card','local-blur-mask'] if s['id']=='V21' else ['global-clean-picture-scan'],issues=[dict(id='remove-summary-and-paper-masks',oldPeriods=[[20.166667,26.958333],[74.041667,81.458333]],state='repair-in-progress',repairPlan='递信撤卡/撤局部失焦，补拍素白外背闭合折信交接；尾段回未叠层源取干净近景。')] if s['id']=='V21' else [],reviewState='repair-in-progress' if s['id']=='V21' else 'scan-in-progress',scanEvidence=str(R/(s['id']+'-old-1fps.jpg')),newFile=None,newSha256=None,audio=dict(userDirectComments=[],action='本组未获新增TTS授权；本轮只登记既有临时音频/元说明风险，不扩为全组配音',newTTS=0,audioApproved=False,verbatimListeningCompleted=False),userApproved=False))
report=dict(group='G3',reviewRound='user-20261025-1549',reviewPolicy='20261025-no-meta-no-cards-no-boxes',status='in-progress',sourceComments=str(review/'comments.json'),sourceCommentsSha256=sha(review/'comments.json'),sourceSnapshot=str(review/'version-snapshot.json'),sourceSnapshotSha256=sha(review/'version-snapshot.json'),userCommentsPreserved=True,clips=rows,unresolved=['V21新折信交接生成及独立新片检查未完成','正式声音与用户审核另行处理'])
(O/'user-review-repair.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
D['userReviewRepairStatus']='in-progress';D['productionPictureClosure']='superseded-by-user-20261025-1549';D['pictureAcceptanceStatus']='user-review-repair-in-progress';D['userReviewRepairReport']=str(O/'user-review-repair.json');D['unresolved']=['用户实审新标准返修进行中，不沿用此前整组完成状态','正式声音与用户审核待后续']
(O/'delivery.json').write_text(json.dumps(D,ensure_ascii=False,indent=2),encoding='utf-8')
Q=read(O/'review/picture-usability.json');Q['status']='user-review-repair-in-progress';Q['productionPictureClosure']='superseded-by-user-20261025-1549'
v=next(x for x in Q['clips'] if x['id']=='V21');v['pictureUsability']='needs-repair';v['reviewState']='user-global-correction-repair-in-progress';v['reviewPolicyPending']='20261025-no-meta-no-cards-no-boxes'
(O/'review/picture-usability.json').write_text(json.dumps(Q,ensure_ascii=False,indent=2),encoding='utf-8');print('User round registered; prior group closure withdrawn, comments and all old films preserved.')
