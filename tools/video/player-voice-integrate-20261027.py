"""Apply finished voice replacements without changing chapter state or story text."""
from pathlib import Path
from importlib.machinery import SourceFileLoader
import sys,json,shutil
a=SourceFileLoader('voice_audit',str(Path(__file__).with_name('player-voice-audit-20261027.py'))).load_module()
public=a.ROOT/'GameStarter/web-demo/public';status=a.read(a.OUT/'render-status.json');plan=a.read(a.OUT/'plan.json')
assert status['ready']==status['total'] and not status['pending'],status['pending']
configpath=public/'cinematics.json';mediapath=public/'video/media-manifest.json'
config=a.read(configpath);media=a.read(mediapath);baseline=a.read(a.OUT/'before/cinematics.json')
beforeclips={c['id']:c for cs in baseline.values() for c in cs}
clips={c['id']:c for cs in config.values() for c in cs};manifest={r['url']:r for r in media['clips']}
for r in status['changes']:
    old=clips[r['id']]
    if old['src']==r['current']['src']:continue
    assert old==beforeclips[r['id']],f'Concurrent clip edit detected: {r["id"]}'
    assert a.sha(r['file'])==r['sha256'] and a.sha(a.ROOT/r['oldSrc'].lstrip('/'))==r['oldSha256']
    for key in ['src','subtitles']:old[key]=r['current'][key]
    entry=manifest[r['oldSrc']]
    entry.update(file='current/'+Path(r['file']).name,url=old['src'],source='../../video/current/'+Path(r['file']).name,**{k:r[k] for k in ['duration','containerDuration','width','height','fps','frames','bytes','sha256','videoCodec']},audioCodec='aac',status='integrated-awaiting-user-voice-review',fullDecodePassed=True,voiceRepair='player-voice-repair-20261027',previousSource=r['oldSrc'],previousSha256=r['oldSha256'])
media['version']+=1
for p in [configpath,mediapath, a.ROOT/'video/subtitles/catalog.json']:
    dst=a.OUT/'before-integration'/p.name;dst.parent.mkdir(parents=True,exist_ok=True)
    if not dst.exists():shutil.copy2(p,dst)
a.save(configpath,config);a.save(mediapath,media)
assert len([c for cs in config.values() for c in cs])==len(manifest)
result=dict(changedFilms=len(status['changes']),uniqueLines=len(plan['jobs']),occurrences=len(plan['occurrences']),chapters={str(ch):sum(j['chapter']==ch for j in plan['jobs']) for ch in [1,2]},changes=status['changes'],humanListeningReview=False,userApproved=False,referenceUserApproved=True,storyAndFlowChanged=False,model='seed-audio-1.0',noVoiceRegistration=True)
a.save(a.OUT/'integration.json',result)
print(json.dumps({k:v for k,v in result.items() if k!='changes'},ensure_ascii=False))
