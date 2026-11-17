"""Fetch CC0 production assets; verify every file and record provenance."""
import concurrent.futures,hashlib,json,os,time,urllib.request
ROOT=os.path.dirname(os.path.abspath(__file__))
HEADERS={'User-Agent':'YilingBlenderArtStudy/1.0 (local asset preparation)'}
def read(url):
    for retry in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url,headers=HEADERS),timeout=90) as r:return r.read()
        except Exception:
            if retry==2:raise
            time.sleep(2)
def get_asset(asset,kind):
    info=json.loads(read('https://api.polyhaven.com/files/'+asset));items=[]
    if kind=='model':
        f=info['blend']['1k']['blend'];items.append((f'assets/{asset}/{asset}_1k.blend',f))
        items.extend((f'assets/{asset}/{name}',item) for name,item in f.get('include',{}).items())
    else:
        for slot in ['Diffuse','Rough','Normal','Displacement']:
            if slot not in info:continue
            res='2k' if slot in ['Diffuse','Normal'] else '1k'
            formats=info[slot].get(res,{});fmt=next((v for v in ['jpg','png','exr'] if v in formats),None)
            if fmt:
                f=formats[fmt];items.append(('textures/'+f['url'].rsplit('/',1)[-1],f))
    results=[]
    for relative,item in items:
        path=os.path.join(ROOT,relative);os.makedirs(os.path.dirname(path),exist_ok=True)
        raw=open(path,'rb').read() if os.path.exists(path) else read(item['url'])
        assert hashlib.md5(raw).hexdigest()==item['md5'],relative
        if not os.path.exists(path):open(path,'wb').write(raw)
        results.append({'file':relative,'url':item['url'],'md5':item['md5'],'bytes':len(raw)})
    print('Verified',asset,len(results),'files',flush=True)
    return {'asset':asset,'source':'https://polyhaven.com/a/'+asset,'license':'CC0','files':results}
jobs=[(a,'model') for a in ['tree_small_02','rock_face_01','rock_moss_set_01','grass_medium_02','fern_02','dry_branches_medium_01','dead_tree_trunk']]
jobs += [(a,'texture') for a in ['forest_ground_04','brown_mud_dry','bark_brown_02','rocky_terrain_02']]
with concurrent.futures.ThreadPoolExecutor(4) as pool:
    records=list(pool.map(lambda p:get_asset(*p),jobs))
json.dump({'licenseSource':'https://polyhaven.com/license','assets':records},open(os.path.join(ROOT,'asset-provenance.json'),'w',encoding='utf-8'),indent=2)
