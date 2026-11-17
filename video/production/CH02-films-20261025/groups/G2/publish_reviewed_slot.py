"""Publish only explicitly reviewed candidate identities; preserve all prior deliverables."""
from pathlib import Path
import json,sys,datetime,copy,re,subprocess,html,os
import repair_picture as r
O=Path(__file__).parent
def atomic(path,data):
    tmp=path.with_name(path.name+'.pending');tmp.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8');os.replace(tmp,path)
def publish(id):
    note=r.read(O/'review/reviewed-slot-notes'/f'{id}.json');c=next(c for c in r.read(O/'review/picture-repair-candidates.json')['clips'] if c['id']==id)
    assert c['sha256']==note['sha256']==r.digest(c['file'])
    assert note['reviewState']=='reviewed' and note['pictureUsability'] in ['usable','usable-with-integration-condition']
    playback=[json.loads(l) for l in (O/'review/picture-recheck-playback.ndjson').read_text(encoding='utf-8').splitlines() if l.strip()]
    ended=[p for p in playback if p['id']=='NEW-'+id and p['sha256']==c['sha256'] and p['event']=='ended'];assert ended,'full natural playback required'
    info=subprocess.run([r.FF,'-hide_banner','-i',c['file']],capture_output=True,text=True,encoding='utf-8',errors='replace').stderr
    assert re.search(r'Video:.*1280x720.*24 fps',info) and re.search(r'Audio:.*48000 Hz',info),info
    decode=subprocess.run([r.FF,'-v','warning','-i',c['file'],'-f','null','NUL'],capture_output=True,text=True,encoding='utf-8',errors='replace');assert decode.returncode==0 and not decode.stderr
    d=r.read(O/'delivery.json');u=r.read(O/'review/picture-usability.json');prior=next(x for x in d['clips'] if x['id']==id)
    history=O/'review/delivery-history';history.mkdir(exist_ok=True);stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    r.save(history/f'{id}-{stamp}.json',dict(delivery=prior,usability=next(x for x in u['clips'] if x['id']==id)))
    new=copy.deepcopy(prior);new.update(file=c['file'],sha256=c['sha256'],assemblySource=c['file'],assemblySha256=c['sha256'],status='picture_reviewed_audio_pending',userApproved=False,pictureUsability=note['pictureUsability'],visualReview=note['observations'],audioIssues=note['audioIssues'],audioReview='未逐字听审；未新增TTS',integrationConditions=note['integrationConditions'])
    new['technical']=dict(duration=c['duration'],size=[1280,720],fps24=True,audio48000=True,audioTrack=True,decodeExitCode=0,decodeWarnings='',sha256=c['sha256'])
    d['clips']=[new if x['id']==id else x for x in d['clips']]
    for child in c['childrenFiles']:
        for index,old in enumerate(d['subclips']):
            if old['id']==child['id']:d['subclips'][index]=dict(child,path=child['file'],audioReview='未逐字听审；旧原片ASR仅历史定位，不代表当前复用轨')
    record=dict(note,file=c['file'],userApproved=False,dynamicReview=note.get('dynamicReview',[])+[dict(method='1x muted natural playback; ended log only proves playback completion',**ended[-1])],technical=new['technical'])
    u['clips']=[record if x['id']==id else x for x in u['clips']];u['updatedUtc']=datetime.datetime.now(datetime.timezone.utc).isoformat()
    done=sum(x.get('reviewState')=='reviewed' and x.get('pictureUsability') in ['usable','usable-with-integration-condition'] for x in u['clips'])
    d['status']=f'画面可用性复核 {done}/12；音频待统一处理；未获用户通过';d['validation']['visual']='逐片实际文件与SHA见review/picture-usability.json';d['visualReview']='以当前SHA对应的picture-usability.json为准；历史制作自查不代替当前复核'
    d['unresolved']=['音频未逐字听审、未做统一正式配音','画面复核未完成项及接入条件见review/picture-usability.json','用户未审核通过']
    atomic(O/'review/picture-usability.json',u);atomic(O/'delivery.json',d)
    s=['<!doctype html><meta charset="utf-8"><title>G2 查粮画面复核</title><style>body{background:#171c1d;color:#ebe4d2;font:18px sans-serif;max-width:1280px;margin:40px auto}video{width:100%;max-height:720px}article{margin:45px 0}</style><h1>G2 查粮取证与三种判断</h1><p>'+html.escape(d['status'])+'</p>']
    md=['# G2 查粮取证与三种判断交付','',d['status'],'','35条原计划请求及任务ID保留，33个源节点、12个逻辑段。互斥分支独立；画面制作复核不代替用户通过。', '','音频未逐字听审，未新增TTS。具体画面问题、修复证据和接入条件见 [画面可用性记录]('+str((O/'review/picture-usability.json').resolve()).replace('\\','/')+')。','']
    for x in d['clips']:
        a=next(a for a in u['clips'] if a['id']==x['id']);state=a.get('pictureUsability') or 'pending';rel=Path(x['file']).relative_to(O).as_posix()
        s.append('<article><h2>'+html.escape(x['id']+' '+x['name'])+'</h2><p>'+html.escape(state+'；'+str(x['technical']['duration'])+'秒')+'</p><video controls preload="metadata" src="'+html.escape(rel,quote=True)+'"></video></article>')
        md.append('- ['+x['id']+' '+x['name']+']('+x['file'].replace('\\','/')+')｜'+str(x['technical']['duration'])+'秒；'+state+'；音频待统一处理。\n')
    (O/'播放审阅.html').write_text('\n'.join(s),encoding='utf-8');(O/'交付说明.md').write_text('\n'.join(md),encoding='utf-8')
    print('PUBLISHED',id,c['sha256'],f'{done}/12',flush=True)
if __name__=='__main__':
    for id in sys.argv[1:]:publish(id)
