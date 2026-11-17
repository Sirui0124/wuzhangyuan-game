from pathlib import Path
import json,hashlib,subprocess,urllib.request,re
R=Path(__file__).resolve().parent
source=R/'references/S21.png';sha=hashlib.sha256(source.read_bytes()).hexdigest();cache=R/'references'/sha;jpg=cache/'upload.jpg';digest=hashlib.sha256(jpg.read_bytes()).hexdigest()
sample=json.loads(next((R/'references').glob('*/reference-record.json')).read_text('utf-8'))
url=re.sub(r'/upload/.*','/upload/parallel-world/minimax-reference/'+digest+'.jpg',sample['url'])
p=subprocess.run(['curl.exe','--ssl-no-revoke','--fail','--location','--connect-timeout','15','--max-time','50','--retry','2','--retry-all-errors','--silent','--show-error',url],capture_output=True,timeout=160)
if p.returncode:print(p.stderr.decode('utf-8','replace'));raise SystemExit(p.returncode)
assert hashlib.sha256(p.stdout).hexdigest()==digest
record={'url':url,'sha256':digest,'original_path':str(source),'original_sha256':sha,'local_file':str(jpg),'verified_by':'recovered deterministic public_id and byte SHA256','bytes':len(p.stdout)}
(cache/'reference-record.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),'utf-8');print('S21 recovered reference verified')
