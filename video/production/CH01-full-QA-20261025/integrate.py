from pathlib import Path
import json,shutil,hashlib
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).parent
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,x):p.write_text(json.dumps(x,ensure_ascii=False,indent=2),encoding='utf-8')
repairs=read(OUT/'local-repairs.json')+read(OUT/'generated-repairs.json')
configpath=ROOT/'GameStarter/web-demo/public/cinematics.json';mediapath=ROOT/'GameStarter/web-demo/public/video/media-manifest.json'
config=read(configpath);media=read(mediapath)
beforeconfig=json.loads(json.dumps(config));beforemedia=json.loads(json.dumps(media))
save(OUT/'audit/cinematics-pre-integration.json',config);save(OUT/'audit/media-pre-integration.json',media)
published=[]
for r in repairs:
 assert hashlib.sha256(Path(r['file']).read_bytes()).hexdigest()==r['sha256']
 target=next(c for g in config.values() if isinstance(g,list) for c in g if c.get('id')==r['id'])
 assert target['src']==r['oldSrc'],r['id']
 assert hashlib.sha256((ROOT/r['oldSrc'].lstrip('/')).read_bytes()).hexdigest()==r['oldSha256']
 name='PR01-QA-20261025.mp4' if r['index']==1 else r['id']+'-QA-20261025.mp4'
 dest=ROOT/'video/current'/name;shutil.copy2(r['file'],dest);url='/video/current/'+name
 target['src']=url
 oldentry=next(x for x in media['clips'] if x['url']==r['oldSrc'])
 entry=dict(oldentry,url=url,file='current/'+name,source='../../video/current/'+name,sha256=r['sha256'],duration=r['duration'],containerDuration=r.get('containerDuration',r['duration']),frames=r['frames'],width=r['width'],height=r['height'],fps=r['fps'],bytes=r['bytes'],status='integrated-awaiting-human-review',fullDecodePassed=True)
 # Preserve the actual schema used by the owning manifest.
 for field in ['path','absolutePath']:
  if field in entry:entry[field]=str(dest.resolve())
 media['clips']=[x for x in media['clips'] if x['url']!=r['oldSrc']]
 media['clips'].append(entry)
 published.append(dict(r,src=url,publishedFile=str(dest.resolve())))
assert read(configpath)==beforeconfig and read(mediapath)==beforemedia,'Concurrent media/config changes'
media['version']=int(media.get('version',0))+1
save(configpath,config);save(mediapath,media)
save(OUT/'integration.json',dict(status='integrated-awaiting-user-review',repairs=published,unchanged=len(read(OUT/'inventory.json'))-len(repairs)))
print('Published',len(published),'repairs; stable IDs, row mappings and all other clips preserved.')
