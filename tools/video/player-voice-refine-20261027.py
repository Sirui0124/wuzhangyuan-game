"""Catch recordings whose edit joins shift a few milliseconds inside one line."""
from pathlib import Path
from importlib.machinery import SourceFileLoader
import numpy as np
a=SourceFileLoader('voice_audit',str(Path(__file__).with_name('player-voice-audit-20261027.py'))).load_module()
audit=a.read(a.OUT/'audit.json');templates={r['id']:r for r in audit['templates']};added=[]
for f in audit['results']:
    if not f['unmatchedTextCandidates']:continue
    x=a.pcm(f['file'])
    for c in f['unmatchedTextCandidates']:
        r=templates[c['id']];y=a.pcm(r['file']);lo,hi=a.active(y)
        if hi-lo<a.RATE*.9:continue
        anchors=[]
        for st in np.linspace(lo,hi-int(.6*a.RATE),3,dtype=int):
            score,ix=a.correlate(x,y[st:st+int(.6*a.RATE)])
            anchors.append(dict(score=score,offset=(ix-st)/a.RATE))
        good=[h for h in anchors if h['score']>.85]
        if len(good)>=2 and max(h['offset'] for h in good)-min(h['offset'] for h in good)<.08:
            start=float(np.median([h['offset'] for h in good]))
            hit=dict(**r,correlation=min(h['score'] for h in good),insertAt=round(start,4),speechStart=start+lo/a.RATE,speechEnd=start+hi/a.RATE,segmentedEvidence=anchors)
            f['presetMatches'].append(hit);added.append(dict(film=f['id'],line=r['id'],anchors=anchors))
    a.save(a.OUT/'audit'/f'{f["id"]}.json',f)
audit['presetOccurrences']=sum(len(f['presetMatches']) for f in audit['results']);audit['affectedFilms']=sum(bool(f['presetMatches']) for f in audit['results']);audit['refinement']=added
a.save(a.OUT/'audit.json',audit);print(added)
