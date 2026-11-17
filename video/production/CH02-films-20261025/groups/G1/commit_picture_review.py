from pathlib import Path
import json,hashlib,sys,time
O=Path(__file__).resolve().parent
def rd(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def atomic(p,x):
    t=p.with_suffix(p.suffix+'.pending');t.write_text(json.dumps(x,ensure_ascii=False,indent=2),encoding='utf-8');t.replace(p)
report=rd(O/'review/picture-usability.json');index={x['id']:x for x in report['clips']}
conditions={'V05':['只有管事允许之后才可接看记录；精确日期通过后接UI-DATE提供，不采信画面模糊字形。'], 'V08A':['文书精确日期由UI-DATE及既定对白提供，禁止据画面字形新增线索。'], 'V09':['停在闭信平放、手离开后；下一步由UI-FIRST-LETTER展示真实正文，不提前重复取信。'], 'V12':['结尾领取凭据的物权保持在我；不依据生成纸张字形新增村名或批次。','CH2-LY03-025心声仅在最后持纸近景32.4–36.13秒播放；不得提前到NPC面部警告阶段，NPC不回应心声。']}
conditions['L01']=['仅在玩家确认本次原话后的播放／等待判定阶段单次播放，动态内容仅使用CH2-LY03-018.confirmedText；正在自由输入的界面不播放。','播放结束保持真实末帧，不自动循环、倒放或推进剧情；取得判定／回应后才进入对应V11。']
batch={x:1 for x in ['V02','V03B','V04','V05','V08A','V08B']};batch.update({x:2 for x in ['V09','V10','V12','L01','V11D','V11A']});batch.update({x:3 for x in ['V01','V03A','V06','V07','V11T','V11R']});batch['V11N']=4
for sid in sys.argv[1:]:
    pending=O/'assembled/picture-v2'/f'{sid}-assembly.pending.json';isnew=pending.exists()
    a=rd(pending if isnew else O/'assembled'/f'{sid}-assembly.json');f=Path(a['path']);sha=hashlib.sha256(f.read_bytes()).hexdigest();assert sha==a['sha256']
    if isnew:
        for z in a['subclips']:z['review'].update(visualReview='picture pass reviewed usable',actualDynamicReview=True,method=f'本轮本地picture-audit-batch{batch[sid]}.html完整静音实际播放到ended；逐阶段角色归属复核',checkedRange=[0,a['duration']])
        a['visualReview']='本轮最终SHA完整动态播放复核；技术解码不替代画面审查。'
        atomic(O/'assembled'/f'{sid}-assembly.json',a)
    r=index[sid];old=r['sha256'];r.update(file=str(f),sha256=sha,reviewState='reviewed',pictureUsability='usable-with-integration-condition' if sid in conditions or sid=='L01' or sid.startswith('V11') else 'usable',userApproved=False)
    r['dynamicCheck']=dict(method=f'本轮本地浏览器审片页picture-audit-batch{batch[sid]}.html，静音实际1x播放至可见ended；重看关键动作/角色归属；同SHA源证据保留在priorEvidence。',actualReviewedRanges=[[0,a['duration']]],evidenceFile=str(O/'review'/f'picture-audit-batch{batch[sid]}.html'),visibleEnded=True,sourceSha256=sha,priorEvidence=r['dynamicCheck'].get('priorEvidence'))
    for issue in r['issues']:issue['state']='closed-by-picture-v2' if isnew else 'closed-with-condition' if sid in conditions or sid=='L01' else 'rechecked-closed'
    if isnew:r['repairs'].append(dict(version=2,previousFile=a['previousFile'],previousSha256=a['previousSha256'],file=str(f),sha256=sha,treatment='已存在闭口倾听画面承载我的原音轨，NPC自己的阶段另接原片；不新增TTS/API。' if sid!='V05' else '我的请求移到营地观察画外；管事只承担允许，之后才看记录。',verification=dict(method='最终整段实际动态播放至ended',range=[0,a['duration']])))
    r['integrationConditions']=conditions.get(sid,r.get('integrationConditions',[]))
    if sid.startswith('V11'):r['integrationConditions']=['仅在对应有效O1判定命中本模板时播放，五种回应互斥；结束只接V12，不导入其他模板对白或判定。']
    r['audioIssues']=a.get('audioIssues',[])
    if sid in ['V02','V03B','V04','V05','V08A','V08B','V09','V10']:r['integrationConditions']+=['本版本已含对应我的既有WAV，不要在游戏外层重复播放同句。']
report['updatedUtc']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime());report['summary']={k:sum(x.get('pictureUsability')==k and x['reviewState']=='reviewed' for x in report['clips']) for k in ['usable','usable-with-integration-condition','needs-repair']};report['summary']['pending']=sum(x['reviewState']=='pending' for x in report['clips']);atomic(O/'review/picture-usability.json',report);print(report['summary'])
