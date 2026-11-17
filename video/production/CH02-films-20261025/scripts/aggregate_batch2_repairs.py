"""Track current versions against batch-two work, without inventing acceptance."""
from pathlib import Path
import json,hashlib,datetime,collections
ROOT=Path(__file__).resolve().parents[1]
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
index=read(ROOT/'deliveries/当前候选索引.json')['slots']
snapshot={x['id']:x for x in read(ROOT/'reviews/user-20261025-batch2/comments-and-versions.json')['rows']}
rows=[]
for group in ('G1','G2','G3','G4','G5','G6'):
 path=ROOT/'groups'/group/'user-review-batch2.json'
 report=read(path) if path.exists() else {}
 raw=report.get('clips',report.get('rows',report.get('films',[])))
 if isinstance(raw,dict):raw=[dict(v,id=k) for k,v in raw.items()]
 byid={x['id']:x for x in raw if isinstance(x,dict) and x.get('id')}
 for slot in [x for x in index if x['owner']==group]:
  cid=slot['id'];owner=byid.get(cid);file=Path(slot['file']) if slot.get('file') else None
  sha=hashlib.file_digest(file.open('rb'),'sha256').hexdigest() if file and file.exists() else None
  declared=(owner or {}).get('candidateSha256') or (owner or {}).get('newSha256') or (owner or {}).get('newSHA') or (owner or {}).get('sha256') or (owner or {}).get('newVersion',{}).get('sha256')
  rows.append({'id':cid,'owner':group,'name':slot['name'],'file':str(file) if file else None,'sha256':sha,
   'userComment':snapshot[cid]['note'],'userReviewedVersion':snapshot[cid]['video'],
   'batch2Report':str(path) if path.exists() else None,'ownerStatus':(owner or {}).get('status',(owner or {}).get('reviewState',(owner or {}).get('repairsStatus',report.get('status')))),
   'ownerReportMatchesCurrentSha':bool(sha and declared==sha),
   'oldDuration':(owner or {}).get('oldDuration',(owner or {}).get('productionBaseline',{}).get('duration',(owner or {}).get('reviewedVersion',{}).get('duration'))),'newDuration':(owner or {}).get('newDuration',(owner or {}).get('newVersion',{}).get('duration')),
   'listeningReview':(owner or {}).get('listeningReview',(owner or {}).get('audio',{}).get('status',report.get('audioListening',report.get('audioListeningReview','not evidenced')))),
   'rootAcceptance':'pending','userApprovalInferred':False})
counts={'total':len(rows),'comments':sum(bool(x['userComment']) for x in rows),'hasCurrentShaAudit':sum(x['ownerReportMatchesCurrentSha'] for x in rows)}
out={'updatedAt':datetime.datetime.now().astimezone().isoformat(),'scope':'Batch-two production progress only; no listening or user approval inferred','counts':counts,'clips':rows}
dest=ROOT/'audit/batch2';dest.mkdir(exist_ok=True)
tmp=dest/'current.json.tmp';tmp.write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8');tmp.replace(dest/'current.json')
print(json.dumps(counts,ensure_ascii=False))
