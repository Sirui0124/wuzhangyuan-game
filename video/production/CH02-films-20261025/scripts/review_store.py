"""Version-aware review records; atomic snapshots plus append-only change history."""
import json, os, threading, datetime
from pathlib import Path
from urllib.parse import quote

class ReviewStore:
 def __init__(self, root):
  self.root=Path(root); self.folder=self.root/'reviews'/'saved'; self.folder.mkdir(parents=True,exist_ok=True)
  self.path=self.folder/'review-state.json'; self.lock=threading.RLock()
  if not self.path.exists():
   records={}
   source=self.root/'reviews/user-20261025-1549/version-snapshot.json'
   if source.exists():
    for c in json.loads(source.read_text(encoding='utf-8-sig'))['clips']:
     if not(c.get('note') or c.get('observedPictureApproved')):continue
     version=quote(Path(c['file']).relative_to(self.root).as_posix())+'?v='+c['mtimeNs']
     records[c['id']]={'revision':0,'note':c.get('note',''),'approvals':{version:{'approved':True,'approvedAt':None,'source':'observed-user-page'}} if c.get('observedPictureApproved') else {},'reviewedVersions':{version:{'source':'observed-user-page','editedAt':None}}}
   self.write({'records':records})
 def read(self):
  with self.lock:return json.loads(self.path.read_text(encoding='utf-8'))
 def write(self,state):
  temp=self.path.with_suffix('.tmp')
  with temp.open('w',encoding='utf-8') as f:
   json.dump(state,f,ensure_ascii=False,indent=2);f.flush();os.fsync(f.fileno())
  os.replace(temp,self.path)
 def update(self,body):
  with self.lock:
   state=self.read(); cid=body['id']; old=state['records'].get(cid,{'revision':0,'note':'','approvals':{},'reviewedVersions':{}})
   if body['baseRevision']!=old['revision']:
    self.history({'type':'conflict-preserved','id':cid,'incoming':body,'current':old})
    return 409,{'record':old,'error':'另一页面已修改，当前输入已存入冲突备份，请刷新后核对。'}
   record={k:body[k] for k in ('note','approvals','reviewedVersions')}
   record.update(revision=old['revision']+1,savedAt=datetime.datetime.now(datetime.timezone.utc).isoformat())
   self.history({'type':'save','id':cid,'before':old,'after':record})
   state['records'][cid]=record;self.write(state)
   return 200,{'record':record}
 def history(self,event):
  with (self.folder/'review-history.jsonl').open('a',encoding='utf-8') as f:
   f.write(json.dumps(event,ensure_ascii=False)+'\n');f.flush();os.fsync(f.fileno())
