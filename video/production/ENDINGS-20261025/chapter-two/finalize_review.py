"""Record the exact scope of the compilation review; does not approve the film."""
import hashlib
import json
from pathlib import Path

R=Path(__file__).resolve().parent
if (R/'assembly-policy.json').exists():
    raise RuntimeError('Edited revision active: legacy source-duration-preservation audit is inapplicable. Use revision-v2 delivery records and revised audit.')
d=json.loads((R/'delivery.json').read_text(encoding='utf-8'))
assert d['complete'] and len(d['films'])==6, 'Do not finalize while an ending is held.'
records=[]
owners={}
for group in ['G5','G6']:
    manifest=R.parents[1]/'CH02-films-20261025/groups'/group/'delivery.json'
    owner=json.loads(manifest.read_text(encoding='utf-8'))
    for source in owner.get('films',owner.get('assembled',[])):
        owners[source['id']]=source
for row in d['films']:
    film=Path(row['path'])
    assert film.is_file() and hashlib.sha256(film.read_bytes()).hexdigest()==row['sha256']
    assert row['decode']=='passed'
    assert row['videoCoverage']['passed']
    assert abs(row['duration']-row['sourceDuration'])<0.6
    assert row['executesGameState'] is False
    elapsed=0
    for source in row['sources']:
        assert abs(source['start']-elapsed)<0.01
        elapsed=source['end']
        assert Path(source['path']).is_file()
        assert hashlib.sha256(Path(source['path']).read_bytes()).hexdigest()==source['sha256']
        latest=owners[source['slot']]
        assert source['sha256']==latest['sha256']
        assert Path(source['path']).resolve()==Path(latest.get('path') or latest['file']).resolve()
    records.append({'id':row['id'],'sha256':row['sha256'],'sourceSlots':row['slots'],'ownerManifestMatches':True,'method':'总览抽帧检查；多段合辑另看切点前后0.25秒；继承原组逐段自查范围','decode':'passed','sourceDurationPreserved':True,'fullMotionReview':False,'audioListening':False,'userApproved':False,'gameIntegrated':False})
page=(R/'审片.html').read_text(encoding='utf-8')
assert page.count('<video ')==6 and '固定路线审片合辑' in page and '部分心声、旁白尚待混入' in page
(R/'review/合辑检查.json').write_text(json.dumps({'scope':'六个固定路线审片合辑；不代表整章63段已全部完成','records':records},ensure_ascii=False,indent=2),encoding='utf-8')
print('Six candidate films, six playable page entries, all source hashes and durations verified.')
