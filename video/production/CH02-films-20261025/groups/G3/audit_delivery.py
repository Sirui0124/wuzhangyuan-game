from pathlib import Path
import json,hashlib,collections
O=Path(__file__).resolve().parent
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
P=read(O/'plan.json');D=read(O/'delivery.json');R=read(O/'review/decisions.json');Q=read(O/'review/picture-usability.json');q={x['id']:x for x in Q['clips']}
issues=[];files=[]
for c in P['clips']+P.get('revisions',[]):
 if not (O/'prompts'/f"{c['id']}.md").exists():issues.append('missing prompt '+c['id'])
for c in D['sourceCoverage']:
 if not c['scriptMappingExact']:issues.append('source mismatch '+c['id'])
 if c['missingSubclips']:issues.append('missing clips '+str(c['missingSubclips']))
for v in D['logicalClips']:
 if v['status']!='candidate':issues.append('incomplete '+v['id']);continue
 p=Path(v['path']);r=read(Path(v['receipt']))
 if not p.exists() or r.get('decode')!='passed':issues.append('file or decode '+v['id']);continue
 h=hashlib.sha256(p.read_bytes()).hexdigest();review=q[v['id']];proof=read(Path(review['dynamicReview']['proof']))
 if h!=v.get('sha256') or h!=review['sha256'] or h!=proof['sha256'] or h!=r['sha256']:issues.append('SHA mismatch '+v['id'])
 if not proof['ended'] or proof['played'][0][0]!=0 or abs(proof['played'][-1][-1]-proof['duration'])>.01:issues.append('incomplete dynamic playback '+v['id'])
 if review['reviewState']!='reviewed' or review['pictureUsability']=='needs-repair' or any(x['state']!='closed' for x in review['issues']):issues.append('picture unresolved '+v['id'])
 if v.get('userApproved') or review.get('userApproved'):issues.append('unearned user approval '+v['id'])
 if r.get('coverageProof'):
  cov=read(Path(r['coverageProof']))
  authorized_audio_edit=r.get('speechReviewPolicy')=='20261025-batch2-clean-speech-and-duration' and r.get('audioChangedByUserRequest') and cov.get('audioChangedByUserRequest')
  if cov['sha256']!=h or cov['status']!='technical-coverage-passed' or (not authorized_audio_edit and not cov.get('audioSampleIdentical')) or abs(cov['videoEndSeconds']-proof['duration'])>.05 or abs(cov['decodedFrames']/24-proof['duration'])>.05:issues.append('video track coverage or audio preservation mismatch '+v['id'])
  if authorized_audio_edit:
   asr=read(Path(r['asrEvidence']))
   if asr['sha256']!=h or asr['possibleMetaMatches'] or not r.get('spokenWhitelist'):issues.append('batch2 ASR evidence or whitelist mismatch '+v['id'])
   if abs(cov['audioDecodedSeconds']-proof['duration'])>.05:issues.append('batch2 audio coverage mismatch '+v['id'])
 for source,expected in zip(r['sourceFiles'],r['sourceHashes']):
  if hashlib.sha256(Path(source).read_bytes()).hexdigest()!=expected:issues.append('assembly source changed '+v['id'])
 files.append(dict(id=v['id'],path=str(p),sha256=h,bytes=p.stat().st_size,decode=r['decode'],dynamicReviewed=True,pictureUsability=review['pictureUsability'],integrationConditions=review['integrationConditions']))
for c in D['subclips']:
 if c['file']!=R[c['id']].get('adoptPath',c['file']):issues.append('subclip adoption mismatch '+c['id'])
 if c.get('previousFile') and (c['technical']['file']!=c['file'] or hashlib.sha256(Path(c['file']).read_bytes()).hexdigest()!=c['technical']['sha256']):issues.append('subclip technical mismatch '+c['id'])
states=collections.Counter(t['status'] for t in D['tasks'])
report=dict(group='G3',status=D['status'],batch2Status=D.get('userReviewBatch2Status'),unresolved=D.get('unresolved',[]),plannedSourceSubclips=len(P['clips']),revisions=len(P.get('revisions',[])),taskCounts=dict(states),sourceMappingExact=all(c['scriptMappingExact'] for c in D['sourceCoverage']),missingSubclips=[i for c in D['sourceCoverage'] for i in c['missingSubclips']],candidateFiles=files,issues=issues,audio='未逐字听审；实际音色、杂音、BGM及口型核对待完成；issues为空仅为技术/文件一致性，无关P02已完成或听审通过',userApproval='新版本待用户review；旧通过仅绑定旧SHA')
(O/'review/delivery-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2))
