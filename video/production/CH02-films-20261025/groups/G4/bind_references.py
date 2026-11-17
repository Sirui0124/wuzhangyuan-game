from pathlib import Path
import json,hashlib,subprocess,sys
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[1]
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2),encoding='utf-8')
p=ROOT/'references/manifest.json'
if not p.exists():sys.exit('Central manifest has not been published')
m=read(p)
print(json.dumps(dict(manifestKeys=list(m) if isinstance(m,dict) else 'array'),ensure_ascii=False))
entries=m.get('references',m.get('assets',m.get('items',[]))) if isinstance(m,dict) else m
if isinstance(entries,dict):entries=[dict(id=k,**v) for k,v in entries.items()]
refs={r['id']:r for r in entries}
mapping={'gouan':'苟安','wound_tent':'伤帐','military_clerk':'收件军吏','receipt_desk':'收件案头'}
binding={};hashes={}
for k,central in mapping.items():
    r=refs[central]
    ready=r.get('ready') is True or r.get('status') in ['ready','verified','ready_for_video'] or (m.get('ready') is True)
    if not ready:sys.exit('Central reference not ready: '+central)
    path=Path(r['path']);h=hashlib.sha256(path.read_bytes()).hexdigest()
    if h!=r['sha256']:sys.exit('Central reference sha mismatch: '+central)
    binding[k]=str(path);hashes[k]=h
save(OUT/'reference-binding.json',binding)
save(OUT/'reference-verification.json',dict(ready=True,centralManifest=str(p),hashes=hashes,centralIds=mapping))
subprocess.run([sys.executable,str(OUT/'build_plan.py')],check=True)
