from pathlib import Path
import json,hashlib,re
OUT=Path(__file__).parent
script=(OUT/'postproduction.py').read_text(encoding='utf-8')
used=set(re.findall(r"generated\('([^']+)'\)",script))
files=[];rejected=[]
for p in (OUT/'generated').glob('*-delivery.json'):
    row=json.loads(p.read_text(encoding='utf-8'));id=row['id']
    if id in used:continue
    row.update(selected=False,rejectionReason='非对白念白、缺句、视角/口型或人物身份不合要求；未采用，视频已清理至回收站；task和请求快照保留')
    p.write_text(json.dumps(row,ensure_ascii=False,indent=2),encoding='utf-8');rejected.append(row)
    for key in ['raw','file']:
        path=Path(row[key]).resolve();assert path.parent==(OUT/'generated').resolve()
        if path.exists():files.append(dict(path=str(path),bytes=path.stat().st_size,sha256=hashlib.sha256(path.read_bytes()).hexdigest(),kind='rejected-generation'))
final={Path(x['path']).name for x in json.loads((OUT/'edited-manifest.json').read_text(encoding='utf-8'))}
for path in (OUT/'edited').glob('*.mp4'):
    if path.name in final:continue
    assert path.resolve().parent==(OUT/'edited').resolve()
    files.append(dict(path=str(path.resolve()),bytes=path.stat().st_size,sha256=hashlib.sha256(path.read_bytes()).hexdigest(),kind='reproducible-edit-intermediate'))
data=dict(allowedDirectories=[str((OUT/'generated').resolve()),str((OUT/'edited').resolve())],usedGeneratedIds=sorted(used),rejectedIds=[r['id'] for r in rejected],files=files,bytes=sum(f['bytes'] for f in files))
(OUT/'audit/generated-cleanup-plan.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
(OUT/'audit/rejected-generations.json').write_text(json.dumps(rejected,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(dict(rejectedTasks=len(rejected),files=len(files),MiB=round(data['bytes']/1048576,2),retainedFinalFiles=len(final)),ensure_ascii=False))
