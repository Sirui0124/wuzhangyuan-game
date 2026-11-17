"""Prepare a fixed, inspectable list. Does not delete files."""
from pathlib import Path
from datetime import datetime
import json, os, hashlib
from collections import Counter

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'outputs/media-cleanup-20261104'
OUT.mkdir(exist_ok=True)
EXT={'.png','.jpg','.jpeg','.webp','.gif','.svg','.avif','.bmp','.tif','.tiff','.mp4','.mov','.webm','.mkv','.m4v','.avi'}
VIDEO={'.mp4','.mov','.webm','.mkv','.m4v','.avi'}
SKIP={'node_modules','.git','.build','.cache','library','temp','dist','build','__pycache__','.narrative-build'}
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def rel(p):return p.resolve().relative_to(ROOT).as_posix()
web=ROOT/'GameStarter/web-demo'
visual=read(web/'visual-assets.json');media=read(web/'public/video/media-manifest.json');core=read(ROOT/'source-art/core/assets.json')
keep={}
def protect(p,reason):
 p=p.resolve()
 if not p.is_relative_to(ROOT):raise ValueError(p)
 if not p.is_file():raise FileNotFoundError(p)
 keep[rel(p)]=reason
for kind in ['characters','scenes','cinematics','ui']:
 for v in visual[kind].values():protect(web/visual['sourceRoot']/v,'游戏美术绑定')
for c in media['clips']:protect(web/c['source'],'游戏接入视频')
for a in core['assets']:protect(Path(a['path']),'最终生成参考')
for prefix,reason in [('GameStarter/web-demo/public','当前网页发布资源'),('demos/yiling-rescue/public','已接入夷陵资源'),('GameStarter/assets','Cocos工程资源'),('source-art/audio','音色参考资料'),('docs/visual-direction/references','用户提供的风格参考原图')]:
 for p in (ROOT/prefix).rglob('*'):
  if p.is_file() and p.suffix.lower() in EXT:protect(p,reason)
protect(ROOT/'GameStarter/packaging/windows/resources/icon.png','当前安装图标母版')
# This independent task is actively modifying its latest input; never infer approval.
opening=ROOT/'source-art/opening-20261104'
opening_files=list(opening.glob('*.png'))
if opening_files:
 active=max(opening_files,key=lambda p:p.stat().st_mtime_ns)
 protect(active,'另一进行中任务的当前修改输入；未作为已确认终稿')
 if active.with_suffix('.prompt.txt').exists():protect(active.with_suffix('.prompt.txt'),'当前修改输入的生成提示词')

# Do not dismantle existing installers or other final document/demo deliverables.
protected_output_prefixes=['outputs/windows-release-','outputs/ppt-offline-html-','outputs/ppt-portable-','outputs/exhibition-intro-','outputs/yiling-field-demo-']
source_roots=['source-art','video','docs/art','docs/video','outputs','output','GameStarter/web-demo/public','GameStarter/packaging/windows/resources']
candidates=[];preserved=[]
seen=set()
for base in source_roots:
 for parent,dirs,files in os.walk(ROOT/base):
  dirs[:]=sorted(d for d in dirs if d not in SKIP and not (Path(parent)/d).is_symlink())
  if (Path(parent).resolve()==OUT or Path(parent).resolve()==Path(__file__).parent):dirs[:]=[];continue
  for name in files:
   p=Path(parent)/name;path=rel(p)
   if path in seen or p.is_symlink():continue
   seen.add(path)
   if p.suffix.lower() not in EXT:continue
   reason=keep.get(path)
   if not reason and any(path.startswith(s) for s in protected_output_prefixes):reason='既有安装版或独立交付文件中的媒体；不拆散成品'
   if reason:preserved.append({'path':path,'reason':reason});continue
   st=p.stat()
   candidates.append({'path':path,'bytes':st.st_size,'mtimeTicks':str(st.st_mtime_ns//100+621355968000000000),'kind':'视频' if p.suffix.lower() in VIDEO else '图片','reason':'未选入现行发布清单或最终参考的过程/历史媒体'})
   for sidecar in [p.with_suffix('.prompt.txt'),p.with_suffix(p.suffix+'.prompt.txt')]:
    if sidecar.exists() and rel(sidecar) not in keep:
     st=sidecar.stat();candidates.append({'path':rel(sidecar),'bytes':st.st_size,'mtimeTicks':str(st.st_mtime_ns//100+621355968000000000),'kind':'过程提示词','reason':'已淘汰图片的同名提示词'})
unique={c['path']:c for c in candidates};candidates=list(unique.values())
snapshot={}
for path in keep:
 p=ROOT/path
 snapshot[path]={'bytes':p.stat().st_size,'sha256':hashlib.file_digest(p.open('rb'),'sha256').hexdigest(),'reason':keep[path]}
plan={'root':str(ROOT),'createdAt':datetime.now().isoformat(),'policy':'仅回收站，不清空；保留现用素材、最终参考、进行中输入和既有独立交付成品',
 'protected':snapshot,'preservedOutsidePrimaryInventory':preserved,'files':sorted(candidates,key=lambda c:c['path']),
 'summary':{'files':len(candidates),'bytes':sum(c['bytes'] for c in candidates),'byType':dict(Counter(c['kind'] for c in candidates))}}
(OUT/'deletion-plan.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps(plan['summary'],ensure_ascii=False,indent=2))
print('Protected active image:',rel(active) if opening_files else 'none')
print('Protected originals:',len(snapshot))
