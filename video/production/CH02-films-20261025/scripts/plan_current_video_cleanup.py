"""Inventory obsolete video exports; no deletion. Preserve live edit dependencies."""
from pathlib import Path
import json, re, urllib.parse, hashlib, collections, datetime
from functools import lru_cache
ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT.parents[2]
END=ROOT.parent/'ENDINGS-20261025/chapter-two'
OUT=ROOT/'audit/current-library-cleanup'
OUT.mkdir(exist_ok=True)
EXT={'.mp4','.mov','.mkv','.webm','.avi'}
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
files={str(p.resolve()).lower():p.resolve() for base in (ROOT,END) for p in base.rglob('*') if p.is_file() and p.suffix.lower() in EXT}
byname=collections.defaultdict(set)
for k,p in files.items():byname[p.name.lower()].add(k)
@lru_cache(maxsize=100000)
def resolve(s,context):
 if not isinstance(s,str) or len(s)>4000:return set()
 s=urllib.parse.unquote(s.split('?')[0]).replace('\\','/').strip()
 if not any(s.lower().endswith(e) for e in EXT):return set()
 if s.startswith(('http:','https:')):return set()
 candidates=[Path(s),context.parent/s,ROOT/s.lstrip('/'),WORK/s.lstrip('/'),END/s.lstrip('/')]
 group=next((x for x in context.parents if x.name in ('G1','G2','G3','G4','G5','G6')),None)
 if group:candidates.append(group/s)
 found={str(p.resolve()).lower() for p in candidates if str(p.resolve()).lower() in files}
 if not found and '/' not in s:found=set(byname.get(s.lower(),set()))
 return found
SKIP={'reviewedversion','userreviewedversion','productionbaseline','originalbrowsercomments','previous','history','historical','baseline','oldcurrentfile'}
def skipped(k):return k.lower() in SKIP or k.lower().startswith(('old','previous','historical','reviewedfile','reviewedsha'))
def refs(obj,context):
 if isinstance(obj,str):return resolve(obj,context)
 if isinstance(obj,list):return set().union(*(refs(x,context) for x in obj)) if obj else set()
 if isinstance(obj,dict):return set().union(*(refs(v,context) for k,v in obj.items() if not skipped(k))) if obj else set()
 return set()
graph=collections.defaultdict(set)
OUTPUT={'file','path','newfile','candidatefile','output','outputfile','newpath'}
def records(obj,context):
 if isinstance(obj,dict):
  own=set().union(*(resolve(v,context) for k,v in obj.items() if k.lower() in OUTPUT and isinstance(v,str)))
  if own:
   deps=refs(obj,context)
   for f in own:graph[f].update(deps-{f})
  for k,v in obj.items():
   if not skipped(k):records(v,context)
 elif isinstance(obj,list):
  for v in obj:records(v,context)
for base in (ROOT,END):
 for p in base.rglob('*.json'):
  if OUT in p.parents or any(x in p.parts for x in ('requests','tasks','transport-cache')) or p.stat().st_size>8000000:continue
  try:records(read(p),p)
  except (ValueError,OSError):pass
protected={};current=[]
def keep(keys,why):
 for k in keys:protected.setdefault(k,set()).add(why)
index=read(ROOT/'deliveries/当前候选索引.json')
for x in index['slots']:
 p=Path(x['file']).resolve();k=str(p).lower();assert k in files
 current.append(dict(id=x['id'],group=x['owner'],name=x['name'],file=str(p)))
 keep({k},'current logical film')
ed=read(END/'delivery.json')
for x in ed['films']+ed.get('epilogues',[]):
 p=Path(x['path']).resolve();k=str(p).lower();assert k in files
 current.append(dict(id=x['id'],group='ENDINGS',name=x.get('title',x['id']),file=str(p)))
 keep({k},'current ending film')
# These are original capture/generation masters, not obsolete finished versions.
for k,p in files.items():
 if any(x in p.parts for x in ('generated','raw','references','parts','pieces')):keep({k},'source master or editable component')
 if p.name.upper().startswith(('V25','25-')) and 'G3' in p.parts:keep({k},'V25 unresolved repair retained')
 if '最新成片' in p.parts:keep({k},'organized current library')
seeds=[END/'delivery.json']
for n in range(1,7):
 g=ROOT/'groups'/f'G{n}'
 seeds += [g/'delivery.json',g/'user-review-batch2.json']
 seeds += list((g/'user-review-batch2').glob('*edl*.json'))
 seeds += list((g/'user-review-batch2').glob('*recipes*.json'))
seeds += [ROOT/'groups/G2/user-review-20261025/protected-current-media.json',ROOT/'groups/G5/user-review-batch2/edit-recipes.json',ROOT/'groups/G6/user-review-batch2/final-edl-and-sources.json']
for p in seeds:
 if p.exists():keep(refs(read(p),p),'active delivery/recipe dependency')
# Preserve explicit references in game deployment manifests (when any).
for base in [WORK/'GameStarter/web-demo/public',WORK/'content']:
 if base.exists():
  for p in base.rglob('*.json'):
   if p.stat().st_size<3000000:
    try:keep(refs(read(p),p),'game/content reference')
    except (ValueError,OSError):pass
queue=list(protected)
while queue:
 k=queue.pop()
 for d in graph.get(k,()):
  if d not in protected:keep({d},'transitive editable source');queue.append(d)

# G2 owner supplied an exact recursive current-recipe closure; historical
# experiment manifests must not keep every obsolete trial output alive.
g2manifest=ROOT/'groups/G2/user-review-20261025/protected-current-media.json'
g2exact=refs(read(g2manifest),g2manifest)
for k in list(protected):
 if 'G2' in files[k].parts and k not in g2exact:
  protected[k] -= {'active delivery/recipe dependency','transitive editable source'}
  if not protected[k]:del protected[k]
keep(g2exact,'G2 owner verified current recipe closure')
deletes=[]
for k,p in sorted(files.items()):
 if k in protected:continue
 # Only outputs and edits inside this chapter's explicitly named production roots.
 eligible=(any(x in p.parts for x in ('assembled','edited','candidates','films','archive','user-review-20261025','user-review-batch2','revision-v2','repairs')))
 if not eligible:keep({k},'unclassified; retain conservatively');continue
 stat=p.stat()
 with p.open('rb') as f:sha=hashlib.file_digest(f,'sha256').hexdigest()
 deletes.append(dict(path=str(p),bytes=stat.st_size,mtimeNs=str(stat.st_mtime_ns),sha256=sha,reason='superseded export/edit; absent from current published films and live source closure'))
out=dict(createdAt=datetime.datetime.now().astimezone().isoformat(),roots=[str(ROOT),str(END)],scope='Only obsolete video outputs; preserve raw masters, active sources, audio, all comments/approval/history metadata, V25 unresolved repair',current=current,protected=[dict(path=str(files[k]),reasons=sorted(v)) for k,v in sorted(protected.items())],delete=deletes)
(OUT/'deletion-plan.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'videos':len(files),'current':len(current),'protected':len(protected),'delete':len(deletes),'deleteGB':round(sum(x['bytes'] for x in deletes)/1024**3,3),'deleteByGroup':dict(collections.Counter(next((x for x in Path(r['path']).parts if re.fullmatch('G[1-6]',x)),'ENDINGS') for r in deletes))},ensure_ascii=False))
