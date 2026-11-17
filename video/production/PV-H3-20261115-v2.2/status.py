from pathlib import Path
import json,datetime,hashlib
R=Path(__file__).resolve().parent
plan=json.loads((R/'production-plan.json').read_text('utf-8'))
rows=[]
for u in plan['units']:
 d=R/u['id'];s=json.loads((d/'state.json').read_text('utf-8-sig')) if (d/'state.json').exists() else {}
 tasks=[]
 for p in d.glob('api/**/task.json'):
  v=json.loads(p.read_text('utf-8-sig'));tid=v.get('task_id')
  if tid:tasks.append(tid)
 q=sorted(d.glob('api/**/latest-query.json'));remote=None
 if q:
  v=json.loads(q[-1].read_text('utf-8-sig'));remote=v.get('task',{}).get('status')
 rows.append({'id':u['id'],'title':u['title'],'requested_seconds':u['duration'],'status':s.get('status','prepared'),'task_ids':sorted(set(tasks)),'remote_status':remote,'has_source':(d/'source.mp4').exists(),'has_review':(d/'audio-ASR-unverified.json').exists(),'prompt_sha256':hashlib.sha256((d/'prompt.txt').read_bytes()).hexdigest()})
v={'updated_at':datetime.datetime.now().isoformat(),'version':'v2.2','units':rows,'submitted_tasks':sum(len(r['task_ids']) for r in rows),'downloaded':sum(r['has_source'] for r in rows),'requested_total_seconds':sum(u['duration'] for u in plan['units']),'user_film_review':'pending'}
(R/'task-registry.json').write_text(json.dumps(v,ensure_ascii=False,indent=2),'utf-8')
print(json.dumps({'submitted':v['submitted_tasks'],'downloaded':v['downloaded'],'total':len(rows),'states':[(r['id'],r['status'],r['remote_status']) for r in rows]},ensure_ascii=False))
