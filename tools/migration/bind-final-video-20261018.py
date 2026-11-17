from pathlib import Path
import json,shutil,hashlib
R=Path(__file__).resolve().parents[2];P=R/'GameStarter/web-demo/public';E=R/'video/review/20261018-integration'
history=R/'video/review/history/20261018-before-final-edit';history.mkdir(parents=True,exist_ok=True)
for name in ['cinematics.json','video/media-manifest.json','video-review.html']:
    dst=history/Path(name).name
    if not dst.exists():shutil.copy2(P/name,dst)
config=json.loads((P/'cinematics.json').read_text(encoding='utf8'))
config['opening'][0]=dict(id='PR01',src='/video/current/PR01-opening-complete-20261018.mp4',title='借寿 · 手机揭示 · 时代遗憾 · 原片许愿')
config['chapterPreview']=[dict(id='LI01',src='/video/current/LI01-cliff-rescue-20261018.mp4',title='运粮 · 崖外救人'),*config['chapterPreview']]
config['chapterPreview']=list({x['id']:x for x in config['chapterPreview']}.values())
config['reviewOnly']=[]
(P/'cinematics.json').write_text(json.dumps(config,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
manifest=json.loads((P/'video/media-manifest.json').read_text(encoding='utf8'))
urls={x['src'] for group in config.values() for x in group}
manifest['clips']=[x for x in manifest['clips'] if x['url'] in urls]
for row in json.loads((E/'final-edit-list.json').read_text(encoding='utf8')):
    url='/'+row['target'];manifest['clips']=[x for x in manifest['clips'] if x['url']!=url]
    manifest['clips'].append(dict(file=row['target'].removeprefix('video/'),url=url,source='../../'+row['target'],duration=row['duration'],containerDuration=row['duration'],width=1280,height=720,fps='24/1',videoCodec='h264',bytes=row['bytes'],sha256=row['sha256'],status='current-integrated; subjective-audio-review-pending'))
manifest['version']=5
(P/'video/media-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
p=P/'video-review.html';s=p.read_text(encoding='utf8')
start=s.index('<p>未完成：');end=s.index('</p>',start)+4
s=s[:start]+'<p>完整新开篇与崖外救人已整合。LI01 仅源片 2.250—3.500 秒为 2×，救援和对白保持正常速度。LI02B 待字节 API 配置/生成，尾界证据不足暂保留原片，未正式接入。EN02B-B 已取消。全片主观听审仍待完成。</p>'+s[end:]
s=s.replace('现行开篇（新整合未齐）','完整开篇 → 醒来守营')
p.write_text(s,encoding='utf8')
print('Final opening and LI01 bound; no rejected footage or duplicate ending.')
