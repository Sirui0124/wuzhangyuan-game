"""Read-only migration audit. Reports paths/categories, never credential values."""
from pathlib import Path
import csv, hashlib, json, re, subprocess, unicodedata
from collections import defaultdict
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'outputs/migration-20261018'
OUT.mkdir(parents=True, exist_ok=True)
SKIP = {'.git', 'node_modules', 'library', 'temp', '__pycache__'}
TEXT = {'.ts','.js','.mjs','.py','.json','.html','.css','.md','.txt','.yaml','.yml','.toml','.xml','.plist','.env','.example','.svg','.ps1','.cmd','.bat'}
MEDIA = {'.mp4','.mov','.webm','.wav','.mp3','.ogg','.m4a','.png','.jpg','.jpeg','.webp','.svg','.ttf','.woff2','.psd','.aep','.zip'}
rows=[]; case=defaultdict(list); hashes=defaultdict(list); findings=[]; absolute=[]; invalid=[]; links=[]
patterns = {
 'possible-api-token': re.compile(r'\b(?:sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[A-Z0-9]{16})\b'),
 'signed-url-review': re.compile(r'(?i)[?&](?:access_token|token|signature|x-amz-signature|x-goog-signature|sig)=[^\s&\"\']{12,}'),
 'jwt-review': re.compile(r'\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\b'),
 'private-key': re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'),
 'personal-email-review': re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b'),
 'personal-phone-review': re.compile(r'(?<![\w\d])1[3-9]\d{9}(?![\w\d])'),
 'credential-field-review': re.compile(r'(?i)(?:api[_-]?key|access[_-]?token|password|secret)\s*[=:]\s*[\x22\x27][^\x22\x27\n]{16,}[\x22\x27]'),
}
for p in sorted(ROOT.rglob('*')):
 rel=p.relative_to(ROOT)
 if any(x in SKIP for x in rel.parts) or rel.parts[:2]==('outputs','migration-20261018'): continue
 if p.is_symlink(): links.append(rel.as_posix()); continue
 if not p.is_file(): continue
 name=rel.as_posix(); data=p.read_bytes(); digest=hashlib.sha256(data).hexdigest(); size=len(data)
 rows.append({'path':name,'bytes':size,'sha256':digest,'media':p.suffix.lower() in MEDIA})
 hashes[(size,digest)].append(name)
 case[unicodedata.normalize('NFC',name).casefold()].append(name)
 if any(re.search(r'[<>:"|?*]|[. ]$',part) or re.match(r'^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)',part,re.I) for part in rel.parts): invalid.append(name)
 if p.suffix.lower() not in TEXT and not p.name.startswith('.env'): continue
 try: s=data.decode('utf-8')
 except UnicodeError: continue
 for i,line in enumerate(s.splitlines(),1):
  for kind,pat in patterns.items():
   if pat.search(line): findings.append({'path':name,'line':i,'category':kind})
  if re.search(r'/Users/[^/\s]+/|/Applications/|[A-Za-z]:\\',line): absolute.append({'path':name,'line':i})
# Git's own ignore evaluator: no staged changes are needed.
paths=[x['path'] for x in rows]
result=subprocess.run(['git','check-ignore','-z','--stdin'],cwd=ROOT,input='\0'.join(paths)+'\0',text=True,capture_output=True)
ignored=set(result.stdout.split('\0'))
for row in rows: row['git_candidate']=row['path'] not in ignored
for f in findings: f['git_candidate']=f['path'] not in ignored
for a in absolute: a['git_candidate']=a['path'] not in ignored
candidates=[r for r in rows if r['git_candidate']]
status=subprocess.check_output(['git','status','--short','--branch'],cwd=ROOT,text=True)
commits=subprocess.run(['git','rev-list','--all','--count'],cwd=ROOT,text=True,capture_output=True)
report={'files':len(rows),'bytes':sum(x['bytes'] for x in rows),'git_candidates':len(candidates),'candidate_bytes':sum(x['bytes'] for x in candidates),'git_history_commits':int(commits.stdout.strip() or 0),'windows_invalid_names':invalid,'case_collisions':[v for v in case.values() if len(v)>1],'relative_paths_over_200':[r['path'] for r in rows if len(r['path'])>200],'symlinks':links,'security_review':findings,'absolute_paths':absolute,'duplicate_groups':[v for (size,h),v in hashes.items() if len(v)>1 and size>0],'over_50_mib':[r for r in rows if r['bytes']>=50*2**20]}
(OUT/'audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
(OUT/'git-status.txt').write_text(status,encoding='utf-8')
with (OUT/'file-inventory.csv').open('w',encoding='utf-8-sig',newline='') as f:
 w=csv.DictWriter(f,fieldnames=['path','bytes','sha256','media','git_candidate']);w.writeheader();w.writerows(rows)
with (OUT/'asset-inventory.csv').open('w',encoding='utf-8-sig',newline='') as f:
 w=csv.DictWriter(f,fieldnames=['path','bytes','sha256','media','git_candidate']);w.writeheader();w.writerows(x for x in rows if x['media'])
print(json.dumps({k:report[k] for k in ['files','bytes','git_candidates','candidate_bytes','git_history_commits','windows_invalid_names','case_collisions','relative_paths_over_200','symlinks']},ensure_ascii=False))
print('Security findings (paths and categories only):')
print(json.dumps(findings,ensure_ascii=False,indent=2))
