"""Audit exact user snapshot, whitelist, time reduction and source dependencies."""
from user_review_render import *
from urllib.parse import unquote,urlsplit
ROOT=O.parents[1];D=ROOT/'reviews/user-20261025-batch2'
P=read(O/'plan.json');snapshot=read(D/'comments-and-versions.json');whitelist=read(D/'spoken-whitelist.json')
IDS=['V13','V14','V15','V16A','V16B','V16C','V17','V18','V19A','V19B','V19C','V20']
cuts={
'V13':[dict(source='V13-01..04 native audio',range='all',reason='User reported all garbled; observation is silent, fixed player WAV reused, two exact missing NPC lines replaced with Seed-Audio1.0 reference uploads')],
'V14':[dict(source='old map native audio',range='all',reason='No spoken whitelist. All workflow text/labels are neverRead; forward five-stage flow and reverse trace must stay visible')],
'V15':[dict(source='V15-02..04 native audio',range='all',reason='Document bodies are neverRead, including user-reported post10s metadata; delete audio and long document-card holds, retain three acquisition actions')],
'V16A':[dict(source='V16A-01 native audio',range='all',reason='Use exact existing player WAV only; source cards/masks removed in clean candidate')],
'V16B':[],
'V16C':[dict(source='V16C-01 native audio',range='all',reason='Use exact existing player WAV; retain canonical manager response only')],
'V17':[dict(source='V17-01 native audio',range=[0,2.25],reason='ASR located unauthorized role-prefix around1.46–2.12'),dict(source='V17-01 native audio',range=[10,12.5],reason='ASR located extra words after canonical sentence; replaced complete line with correct reference model, reduced duration')],
'V18':[dict(source='V18-02/04/06 document native audio',range='all',reason='neverRead document/control fields; no new narrator. Three exact player WAVs retained, new brief handoffs replace card holds')],
'V19A':[dict(source='V19A-01 native audio',range='all',reason='Exact existing player WAV reused; no new accusation evidence. Native operator response kept only canonical range0–10.125')],
'V19B':[dict(source='V19B-01 native audio',range='all',reason='Exact existing player WAV reused; all cards/masks removed')],
'V19C':[dict(source='V19C-02 native audio',range=[0,3.2],reason='Unauthorized beginning removed; canonical response3.2–9.416667 retained, silent lead removed too')],
'V20':[dict(source='V20-01 native audio',range='all',reason='User requested model replacement for initial garble; correct Seed-Audio1.0 reference upload used for complete C04 original sentence'),dict(source='V20-03/06 native audio',range='all',reason='Report and receipt bodies neverRead; keep true handoffs and separate exact game-body dependency'),dict(source='V20-05 native audio',range=[0,3.8],reason='Wrong prefix and duplicate first rendition removed; correct second rendition3.8–7.291667 reused'),dict(source='V20-07 native audio',range=[0,3],reason='Unauthorized prefix removed; canonical3.0–7.15 reused'),dict(source='V20-07 native audio',range=[7.15,8.5],reason='Unauthorized closing word removed'),dict(source='V20-08 native audio',range=[7.5,9.5],reason='Extra ending after canonical sentence removed; no28s+ subtitle/card carryover')]
}
def latest(id):
    paths=[p for p in (R/'candidates').glob(id+'-*.json') if read(p).get('id')==id]
    return read(max(paths,key=lambda p:p.stat().st_mtime)) if paths else None
def duration(p):
    v=cv2.VideoCapture(str(p));n=v.get(7)/v.get(5);v.release();return n
def node_spans(m,base=0,cap=None):
    out=[]
    if m.get('recipe',{}).get('audioMode')=='parts':
        t=base;contributions=[]
        for part in m['recipe']['parts']:
            sub=read(Path(part['file']).with_suffix('.json'));assert part['range']==[0,sub['videoSeconds']]
            contributions.append((sub['videoFrames']-1)/24)
        assert abs(sum(contributions)-m['videoSeconds'])<1e-6,(m['id'],sum(contributions),m['videoSeconds'])
        for part,actual in zip(m['recipe']['parts'],contributions):
            sub=read(Path(part['file']).with_suffix('.json'));out+=node_spans(sub,t,actual);t+=actual
    else:
        for n in m.get('recipe',{}).get('sourceNodes',[]):out.append(dict(node=n,range=[base,base+(m['videoSeconds'] if cap is None else cap)],sourceClip=m['id']))
    return out
delivery=read(O/'delivery.json');usability=read(O/'review/picture-usability.json');rows=[];maprows=[]
for id in IDS:
    user=next(x for x in snapshot['rows'] if x['id']==id);url=user['video'];rel=unquote(urlsplit(url).path).lstrip('/');old=ROOT/rel
    assert old.exists(),old
    old_sha=sha(old);old_d=duration(old);cur=next(x for x in delivery['clips'] if x['id']==id)
    m=latest(id) if id!='V16B' else dict(id=id,file=cur['file'],sha256=cur['sha256'],videoSeconds=duration(Path(cur['file'])),containerSeconds=cur['technical']['duration'])
    if m is None:m=dict(id=id,file=cur['file'],sha256=cur['sha256'],videoSeconds=cur['technical']['duration'])
    w=next(x for x in whitelist['clips'] if x['id']==id)
    spans=node_spans(m);spoke=w['spokenWhitelist'];never=w['neverReadStageOrDocumentText']
    if id=='V16B':spans=[dict(node='CH2-LY07-W01',range=[0,4.75],sourceClip='V16B-01'),dict(node='CH2-LY07-W02',range=[4.75,duration(Path(m['file']))],sourceClip='V16B-02')]
    assert all(0<=x['range'][0]<=x['range'][1]<=m['videoSeconds']+1e-6 for x in spans),(id,spans,m['videoSeconds'])
    published=cur['sha256']==m['sha256'] and cur.get('reviewPolicy')=='20261025-no-meta-no-cards-no-boxes' and cur.get('pictureUsability')!='needs-repair'
    for s in spans:
        source=next((l for c in P['clips'] for l in c['sourceLines'] if l['node']==s['node']),None)
        if source is None:continue
        doc=any(c['kind']=='document' and any(l['node']==s['node'] for l in c['sourceLines']) for c in P['clips'])
        if s['node']=='CH2-LY06-015':s['range']=[s['range'][1]-.35,s['range'][1]]
        maprows.append(dict(**source,parent=id,parentFile=m['file'],parentSha256=m['sha256'],actualVideoRange=s['range'],realization='physical acquisition/observation only; exact body below is independent game information' if doc else 'canonical original speech or film process',exactBodyPreserved=source['text'],bodyReadableInFilm=False if doc else None,gamePresentationImplemented=False if doc else None,knowledgeBoundary='Do not grant document content before this acquisition and external game presentation; do not infer new answer from blank back' if doc else 'unchanged source branch/context',sourceClip=s['sourceClip']))
    unresolved=[]
    if id=='V14' and not published:unresolved.append('Five-stage forward flow plus actual backward trace still awaiting final generation/visual verification; short4s cut withdrawn')
    if not published:unresolved.append('Current candidate has not completed current-SHA visual/playback publication')
    if any(c['parent']==id and c['kind']=='document' for c in P['clips']):unresolved.append('Exact nonspoken evidence body retained in mapping; gamePresentationImplemented=false; integration owner must provide separate accurate information display')
    if id!='V16B':unresolved.append('Modified candidate needs user review; subjective listening and voice approval pending')
    rows.append(dict(id=id,userComment=user['note'],oldUserApproved=user['approved'],reviewedVersion=dict(url=url,file=str(old.resolve()),sha256=old_sha,duration=old_d),newVersion=dict(file=m['file'],sha256=m['sha256'],duration=m['videoSeconds']),durationChange=m['videoSeconds']-old_d,spokenWhitelist=spoke,neverReadStageOrDocumentText=never,misreadOrGarbledCuts=cuts[id],repairsStatus='preserved-specific-user-approved-file' if id=='V16B' else ('candidate-published-awaiting-user-review' if published else 'repair-in-progress'),newUserApproved=False,preservedOldApproval=id=='V16B' and old_sha==m['sha256'],currentShaVisualReviewed=published,actualNodeSpans=spans,unresolved=unresolved))
report=dict(group='G2',policy='20261025-batch2-clean-speech-and-duration',sourceSnapshot=str((D/'comments-and-versions.json').resolve()),audioListeningReview='pending; tools cannot hear; ASR/subtitles/playback ended are technical evidence only',newPresetTTSCalls=0,originalFilesAndCommentsPreserved=True,gameModified=False,clips=rows,videoJobs=[dict(id=p.stem,**read(p)) for p in (R/'jobs').glob('*.json') if not p.name.endswith(('.request.json','.references.json','.latest.json'))],generatedAudio=[dict(id=x['id'],sha256=x['sha256'],model=x['model'],referenceUploaded=x['referenceUploaded'],userVoiceApproved=False) for x in read(R/'audio/batch2-generated-asr.json')['rows']])
save(O/'user-review-batch2.json',report)
save(R/'source-realization.json',dict(sourceFrozen=P['sourceFrozen'],gameModified=False,gamePresentationImplemented=False,nodes=maprows,expectedUniqueNodes=33,actualUniqueNodes=len(set(x['node'] for x in maprows)),note='Source bodies preserved exactly; this is an integration contract, not implemented game UI. Pending parents may still have incomplete mappings.'))
print('BATCH2',sum(x['currentShaVisualReviewed'] for x in rows),'/',len(rows),'nodes',len(set(x['node'] for x in maprows)),flush=True)
