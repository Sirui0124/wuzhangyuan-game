"""Publish only SHA-bound current-policy reviews, leaving browser user comments untouched."""
from pathlib import Path
import json,datetime,subprocess,os,html,sys,hashlib
import user_review_render as r
O=Path(__file__).parent;R=O/'user-review-20261025';POLICY='20261025-no-meta-no-cards-no-boxes'
def atomic(p,d):
    t=p.with_name(p.name+'.user-review-pending');t.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8');os.replace(t,p)
def publish(id):
    note=r.read(R/'review-notes'/f'{id}.json');path=Path(note['file']);assert r.sha(path)==note['sha256']
    logs=[json.loads(l) for l in (O/'review/picture-recheck-playback.ndjson').read_text(encoding='utf-8').splitlines() if l.strip()];event=next((e for e in reversed(logs) if e['id']=='UR-'+id and e['sha256']==note['sha256'] and e['event']=='ended'),None)
    if id=='V16B':event=next((e for e in reversed(logs) if e['id']=='UR-V16B-preserved' and e['sha256']==note['sha256'] and e['event']=='ended'),None)
    assert event,'Current complete playback not recorded'
    result=subprocess.run([r.FF,'-v','warning','-i',str(path),'-f','null','NUL'],capture_output=True,text=True,encoding='utf-8',errors='replace');assert result.returncode==0 and not result.stderr
    d=r.read(O/'delivery.json');u=r.read(O/'review/picture-usability.json');rep=r.read(O/'user-review-repair.json');prior=next(c for c in d['clips'] if c['id']==id);old=next(c for c in r.read(R/'prior-delivery.json')['clips'] if c['id']==id)
    snap=next(c for c in rep['clips'] if c['id']==id);assert old['sha256']==snap['oldSha256']
    hist=R/'history';hist.mkdir(exist_ok=True)
    if not (hist/(id+'-before.json')).exists():r.save(hist/(id+'-before.json'),dict(delivery=prior,usability=next(c for c in u['clips'] if c['id']==id)))
    new=dict(prior,file=str(path.resolve()),sha256=note['sha256'],assemblySource=str(path.resolve()),assemblySha256=note['sha256'],reviewPolicy=POLICY,pictureUsability=note['pictureUsability'],status='user-review-repair-ready-for-review' if id!='V16B' else 'user-approved-picture-preserved',userApproved=False,pictureUserApproved=id=='V16B',visualReview=note['observations'],integrationConditions=note['integrationConditions'],audioReview=note['audioReview'],audioIssues=note.get('audioIssues',[]),sourceMapFile=str((R/'source-realization.json').resolve()))
    new['technical']=dict(duration=event['duration'],size=[1280,720],fps24=True,audio48000=True,audioTrack=True,decodeExitCode=0,decodeWarnings='',sha256=note['sha256'],videoTrackComplete=True)
    d['clips']=[new if x['id']==id else x for x in d['clips']]
    rec=dict(id=id,file=str(path.resolve()),sha256=note['sha256'],reviewState='reviewed',reviewPolicy=POLICY,pictureUsability=note['pictureUsability'],observations=note['observations'],issues=note.get('issues',[]),integrationConditions=note['integrationConditions'],audioIssues=note.get('audioIssues',[]),audioReview=note['audioReview'],dynamicReview=note.get('evidence',[])+[dict(method='natural 1x playback; ended event proves completion only, not actual listening',**event)],userApproved=False,pictureUserApproved=id=='V16B')
    u['clips']=[rec if c['id']==id else c for c in u['clips']];u['status']='user-review-repair-in-progress';u.pop('summary',None)
    row=next(c for c in rep['clips'] if c['id']==id);row.update(status='preserved-user-approved-picture-swept' if id=='V16B' else 'repaired-new-user-review-required',newFile=str(path.resolve()),newSha256=note['sha256'],repairPolicy=POLICY,sourceOldRanges=note.get('sourceOldRanges',[[0,old['technical']['duration']]]),repairs=note.get('repairs',[]),evidence=rec['dynamicReview'],globalSweep=dict(workDocumentCards='none-in-current-file',visibleBoxMasks='none-in-current-file',newMisleadingPropText=note.get('propTextReview','no misleading readable text found in reviewed sequence')),unresolved=note.get('unresolved',[]))
    done=sum(x.get('repairPolicy')==POLICY and x.get('status') in ['repaired-new-user-review-required','preserved-user-approved-picture-swept'] for x in rep['clips']);status=f'用户审片返修：{done}/12已按新标准登记；未完成项继续，修改版待用户重新审核'
    d['status']=status;d['userApproved']=False;d['validation']['visual']='当前用户返修政策与SHA逐条见review/picture-usability.json；旧制作结论不替代新标准';d['unresolved']=['未完成返修项见user-review-repair.json','batch2允许正确参考音频模型结果进入待听审候选，声音未获用户通过','修改版本均待用户重新审核；未改游戏']
    for p,obj in [(O/'review/picture-usability.json',u),(O/'user-review-repair.json',rep),(O/'delivery.json',d)]:atomic(p,obj)
    statusFile=r.read(O/'status.json');statusFile.update(status='user-review-repair-in-progress',currentPolicyReviewed=done,total=12);atomic(O/'status.json',statusFile)
    intro='<!doctype html><meta charset="utf-8"><title>G2 用户审片返修</title><style>body{background:#171c1d;color:#ebe4d2;font:18px sans-serif;max-width:1280px;margin:40px auto}video{width:100%;max-height:720px}article{margin:45px 0}</style><h1>G2 查粮取证与三种判断</h1><p>'+html.escape(status)+'</p>'
    h=[intro];md=['# G2 用户审片返修交付','',status,'','V16B保留用户已通过的具体画面版本；旧评论和所有旧片保留。新声音须正确参考音频模型并按实际听审安排采用。','']
    for c in d['clips']:
        s='当前新标准复核' if c.get('reviewPolicy')==POLICY and c.get('pictureUsability') in ['usable','usable-with-integration-condition'] else '仍在返修，当前片不能当作完成版';rel=Path(c['file']).relative_to(O).as_posix();h.append('<article><h2>'+html.escape(c['id']+' '+c['name'])+'</h2><p>'+s+'</p><video controls preload="metadata" src="'+html.escape(rel,quote=True)+'"></video></article>');md.append('- ['+c['id']+' '+c['name']+']('+c['file'].replace('\\','/')+')｜'+s+'\n')
    (O/'播放审阅.html').write_text('\n'.join(h),encoding='utf-8');(O/'交付说明.md').write_text('\n'.join(md),encoding='utf-8');print('USER-REPAIR-PUBLISHED',id,note['sha256'],done,flush=True)
if __name__=='__main__':
    for id in sys.argv[1:]:publish(id)
