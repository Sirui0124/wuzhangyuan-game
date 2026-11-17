import sys,json,hashlib,concurrent.futures
from pathlib import Path
sys.path.insert(0,'tools/video-history/202610')
from recheck_video_feedback_20261022 import call
root=Path.cwd();out=root/'video/production/PR01-direction-20261023/cloud';target=out/'verified-images';target.mkdir(exist_ok=True)
jobs=[]
for k in ['A','B','C','DEF']:
 v=json.loads((out/(k+'-verification.json')).read_text(encoding='utf8'))
 for i,(img,p) in enumerate(zip(v['images'],v['reference_paths']),1):jobs.append((k,i,img['src'],Path(p)))
def check(j):
 k,i,t,p=j;dest=target/f'{k}-{i}.png';call(['docs','+media-download','--token',t,'--output',dest.relative_to(root).as_posix()]);a=hashlib.sha256(p.read_bytes()).hexdigest();b=hashlib.sha256(dest.read_bytes()).hexdigest();assert a==b,(k,i);return dict(id=k,image=i,sha256=a,bytesEqual=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as ex:results=list(ex.map(check,jobs))
(out/'image-hashes.json').write_text(json.dumps(results,indent=2),encoding='utf8');print('19/19 actual document images match local files')
