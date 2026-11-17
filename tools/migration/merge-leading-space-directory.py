from pathlib import Path
import os,hashlib,json,shutil,stat
target=Path(__file__).resolve().parents[2]
source=target.parent/(' '+target.name)
assert target.name=='逆转五丈原' and source.name==' 逆转五丈原' and target.resolve()!=source.resolve()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
rows=[];dirs=[];links=[]
for here,subdirs,files in os.walk(source,followlinks=False):
    for name in subdirs[:]:
        p=Path(here)/name
        if p.lstat().st_file_attributes & stat.FILE_ATTRIBUTE_REPARSE_POINT:
            links.append(str(p));subdirs.remove(name)
        else:dirs.append(p.relative_to(source).as_posix())
    for name in files:
        p=Path(here)/name;rel=p.relative_to(source)
        if p.lstat().st_file_attributes & stat.FILE_ATTRIBUTE_REPARSE_POINT:
            links.append(str(p));continue
        digest=sha(p);dest=target/rel;action='identical-existing'
        if dest.exists() and (not dest.is_file() or sha(dest)!=digest):
            dest=target/'video/review/history/leading-space-conflicts'/rel;action='conflict-preserved'
        elif not dest.exists():action='copied'
        dest.parent.mkdir(parents=True,exist_ok=True)
        if not dest.exists():shutil.copy2(p,dest)
        assert dest.is_file() and sha(dest)==digest
        rows.append(dict(source=str(p),relative=rel.as_posix(),destination=str(dest),sha256=digest,bytes=p.stat().st_size,action=action))
report=dict(source=str(source),target=str(target),directories=dirs,links=links,files=rows,verified=not links,fileCount=len(rows),conflicts=sum(r['action']=='conflict-preserved' for r in rows),recycleStatus='not attempted')
(target/'docs/migration/LEADING-SPACE-MERGE-20261018.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps(report,ensure_ascii=False))
