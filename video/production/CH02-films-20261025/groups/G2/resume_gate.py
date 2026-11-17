from pathlib import Path
import json,urllib.parse
OUT=Path(__file__).parent
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
assert read(OUT/'requests/resumed-transport.json')['prepared']==8
for i in range(1,9):
    id=f'V20-{i:02}';assert not (OUT/'tasks'/f'{id}.json').exists(),'No rewriting accepted/uncertain paid states'
    body=read(OUT/'requests'/f'{id}.json');refs=read(OUT/'requests'/f'{id}.references.json')
    images=[x for x in body['content'] if x['type']=='image_url'];assert len(images)==len(refs)
    for im,r in zip(images,refs):
        assert urllib.parse.urlsplit(im['image_url']['url']).hostname=='res-1.cloudinary.com'
        assert r['verification']['http_status']==200 and r['verification']['sha256']==r['sha256']
(OUT/'PAUSE_NEW_DISPATCH').unlink()
print('Coordinator recovery release applied: 8 existing planned requests ready; watcher may submit up to 6 sequentially')
