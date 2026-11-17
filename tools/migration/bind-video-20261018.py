from pathlib import Path
import json, shutil, re
root=Path(__file__).resolve().parents[2]
pub=root/'GameStarter/web-demo/public'
history=root/'video/review/history/20261018-before-integration'
for rel in ['cinematics.json','video/media-manifest.json','ending-video.json']:
    target=history/Path(rel).name
    if not target.exists(): shutil.copy2(pub/rel,target)
config=json.loads((pub/'cinematics.json').read_text(encoding='utf8'))
def clip(id,file,title): return dict(id=id,src='/video/current/'+file,title=title)
config['sacrifice']=[clip('EN02B-A','EN02B-A-accountability-20261018.mp4','次日问责 · 收矛')]
config['safe'][1]=clip('EN03-EN04','EN03-EN04-ending-20261018.mp4','战机与姜维回应')
ending=json.loads((pub/'ending-video.json').read_text(encoding='utf8'))
ending['id']='EN03-EN04';ending['src']=config['safe'][1]['src'];ending['title']='战机与姜维回应'
(pub/'ending-video.json').write_text(json.dumps(ending,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
config['chapterPreview']=[clip('LI02A','LI02A-granary-20261018.mp4','粮仓听说苟安受罚 · 章节制作中')]
config['reviewOnly']=[clip('PR01A','PR01A-phone-20261018.mp4','手机揭示 · 待 PR01B 整合')]
(pub/'cinematics.json').write_text(json.dumps(config,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
manifest=json.loads((pub/'video/media-manifest.json').read_text(encoding='utf8'))
urls={x['src'] for group in config.values() for x in group}
manifest['clips']=[c for c in manifest['clips'] if c['url'] in urls]
records=json.loads((root/'video/review/20261018-integration/edit-list.json').read_text(encoding='utf8'))
for r in records:
    log=(root/f"video/review/20261018-integration/{r['id']}-decode.log").read_text(encoding='utf8')
    h,m,s=re.search(r'Duration: (\d+):(\d+):([\d.]+)',log).groups()
    duration=int(h)*3600+int(m)*60+float(s)
    r['sourceOut']='end-of-source';r['outputIn']=0;r['outputOutApproxSeconds']=duration
    r['event']={'EN02B-A':'tutorial.execution.question → black death UI → continue-teaching','EN03-EN04':'safe, after EN01 only','LI02A':'chapterPreview; no chapter gameplay','PR01A':'reviewOnly; not yet opening'}[r['id']]
    r['blackdetect']=[line for line in log.splitlines() if 'black_start' in line]
    r['subjectiveAudioReview']=False
    url='/'+r['target']
    manifest['clips']=[c for c in manifest['clips'] if c['url']!=url]
    manifest['clips'].append(dict(file=r['target'].removeprefix('video/'),url=url,source='../../'+r['target'],duration=duration,containerDuration=duration,width=1280,height=720,fps='24/1',videoCodec='h264',bytes=r['bytes'],sha256=r['sha256'],status='review-only' if r['id']=='PR01A' else 'current-integrated'))
manifest['version']=4
(pub/'video/media-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
(root/'video/review/20261018-integration/edit-list.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print('Bound 7 media assets; incomplete opening remains explicit fallback.')
