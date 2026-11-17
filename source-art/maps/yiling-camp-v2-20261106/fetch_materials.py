import urllib.request,json,hashlib,os,concurrent.futures
ROOT=os.path.dirname(os.path.abspath(__file__));DEST=os.path.join(ROOT,'textures');os.makedirs(DEST,exist_ok=True)
def get(url):
    req=urllib.request.Request(url,headers={'User-Agent':'YilingBlenderArtStudy/1.0 (local asset preparation)'})
    with urllib.request.urlopen(req,timeout=90) as r:return r.read()
jobs=[]
for asset in ['aerial_grass_rock','rocky_trail','oak_wood_planks','gravelly_sand']:
    data=json.loads(get('https://api.polyhaven.com/files/'+asset))
    for slot in ['Diffuse','Rough','Displacement']:
        res='2k' if slot=='Diffuse' else '1k'
        choices=data[slot][res];fmt='jpg' if 'jpg' in choices else 'png';jobs.append((asset,slot,choices[fmt]))
asset='kloofendal_48d_partly_cloudy_puresky';data=json.loads(get('https://api.polyhaven.com/files/'+asset))
jobs.append((asset,'hdri',data['hdri']['2k']['hdr']))
def fetch(job):
    asset,slot,info=job;filename=info['url'].rsplit('/',1)[-1];path=os.path.join(DEST,filename)
    raw=open(path,'rb').read() if os.path.exists(path) else get(info['url'])
    assert hashlib.md5(raw).hexdigest()==info['md5'],filename+' checksum failed'
    if not os.path.exists(path):open(path,'wb').write(raw)
    print('Verified',filename,len(raw),flush=True)
    return {'asset':asset,'slot':slot,'file':'textures/'+filename,'url':info['url'],'md5':info['md5'],'bytes':len(raw),'license':'CC0','source':'https://polyhaven.com/a/'+asset}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:records=list(pool.map(fetch,jobs))
json.dump({'licenseSource':'https://polyhaven.com/license','assets':records},open(os.path.join(ROOT,'material-provenance.json'),'w',encoding='utf-8'),ensure_ascii=False,indent=2)
