"""Check output hashes, unchanged picture, dialogue scope and phonetic locator evidence."""
from pathlib import Path
from importlib.machinery import SourceFileLoader
import difflib,json,subprocess
import numpy as np
from pypinyin import lazy_pinyin
a=SourceFileLoader('voice_audit',str(Path(__file__).with_name('player-voice-audit-20261027.py'))).load_module()
plan=a.read(a.OUT/'plan.json');integration=a.read(a.OUT/'integration.json');films=[];checks=[]
def stereo(p):
    b=subprocess.check_output([str(a.FF),'-v','error','-nostdin','-i',str(p),'-vn','-ac','2','-ar','48000','-f','f32le','pipe:1'])
    return np.frombuffer(b,dtype='<f4').reshape(-1,2)
for r in integration['changes']:
    original=a.ROOT/r['oldSrc'].lstrip('/');assert a.sha(original)==r['oldSha256'];assert a.sha(r['file'])==r['sha256']
    old=stereo(original);new=stereo(r['file']);n=min(len(old),len(new));keep=np.ones(n,dtype=bool)
    for h in r['replacements']:
        lo=max(0,round((h['window'][0]-.08)*48000));hi=min(n,round((h['window'][1]+.08)*48000));keep[lo:hi]=False
    active=keep&(np.max(np.abs(old[:n]),axis=1)>.01)
    corr=None;snr=None
    if active.sum()>4800:
        x=old[:n][active].astype(np.float64);y=new[:n][active].astype(np.float64)
        corr=float(np.corrcoef(x.ravel(),y.ravel())[0,1]);snr=float(10*np.log10(np.mean(x*x)/max(np.mean((x-y)**2),1e-20)))
        assert corr>.985,(r['id'],corr,snr)
    films.append(dict(id=r['id'],originalSha256Unchanged=True,newSha256Verified=True,videoPacketsIdentical=r['videoPacketsIdentical'],masterOutsideWindowsIdentical=r['masterOutsideReplacementWindowsUnchanged'],outsideActiveAudioCorrelation=corr,outsideActiveAudioSnrDb=snr,fullDecodePassed=r['fullDecodePassed']))
for j in plan['jobs']:
    s=a.read(a.OUT/'generated'/(j['id']+'-state.json'));assert s['status']=='succeeded' and s['referenceUploaded'] and s['model']=='seed-audio-1.0' and s['noPresetSpeaker']
    c=a.read(a.OUT/'checks'/(j['id']+'.json'));assert c['sha256']==s['sha256'] and c['providerTextMatches']
    c['phoneticSimilarity']=difflib.SequenceMatcher(None,''.join(lazy_pinyin(a.norm(c['expected']))),''.join(lazy_pinyin(a.norm(c['recognized'])))).ratio();c['needsTextReview']=c['phoneticSimilarity']<.9
    a.save(a.OUT/'checks'/(j['id']+'.json'),c);checks.append(c)
result=dict(passed=True,films=len(films),uniqueLines=len(checks),occurrences=len(plan['occurrences']),model='seed-audio-1.0',allReferencesUserApproved=True,providerTextMatches=len(checks),independentAsrChecked=len(checks),phoneticReviewRequired=[c['id'] for c in checks if c['needsTextReview']],pictureChecks=films,humanListeningReview=False,userApproved=False,notes=['ASR and pinyin are auxiliary text locators, not human listening or voice-identity approval.','The approved original reference voices remain separate from the unapproved new generated takes.'])
a.save(a.OUT/'checks.json',dict(checked=len(checks),total=len(checks),pending=[],failed=[],review=[c for c in checks if c['needsTextReview']],results=checks,humanListeningReview=False))
a.save(a.OUT/'verification.json',result)
print(json.dumps({k:v for k,v in result.items() if k not in ['pictureChecks','notes']},ensure_ascii=False))
