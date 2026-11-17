from pathlib import Path
import json,hashlib,sys
OUT=Path(__file__).parent;sys.path.insert(0,str(OUT))
from run_pipeline import read,save

if __name__=='__main__':
    report=read(OUT/'delivery.json');clips=[]
    existing=OUT/'review/picture-usability.json'
    if sys.argv[1]=='init':
        if existing.exists():save(OUT/'review/picture-usability-prior.json',read(existing))
        for slot in report['assembled']:
            sha=hashlib.sha256(Path(slot['file']).read_bytes()).hexdigest()
            assert sha==slot['sha256'],'Current file must match delivered SHA'
            known=[]
            if slot['id']=='V35':known=[dict(type='action-direction',state='open',time=[0,6],description='倒放取卷递回须重看接触、松手、布囊与衣物方向；旧播放完成不直接当动作通过')]
            if slot['id']=='V36':known=[dict(type='readable-false-evidence',state='open',time=[0,slot['metadata']['duration']],description='精查移动纸面/宣读纸卷与观察镜头是否仍露出可读伪字；此前柔焦、裁幅与文书插入不能替代当前成片复核')]
            if slot['id']=='V42':known=[dict(type='readable-false-evidence',state='open',time=[0,slot['metadata']['duration']],description='旧卷/翻页的模型文字可能成为可读假记录；仅写不作证据不足以使有问题的画面可用')]
            if slot['id']=='V32A':known=[dict(type='crossout-and-signature',state='open',time=[47.9,57.63],description='C13的真横划与条款、下方署名及离纸重看；原生署名字形不能确认为准确苟安')]
            clips.append(dict(id=slot['id'],file=slot['file'],sha256=sha,duration=slot['metadata']['duration'],pictureUsability='needs-repair' if slot['id'] in ['V36','V42'] else None,reviewState='pending',dynamicReview=dict(method='pending current-SHA playback; old evidence may be referenced, key doubts must be rechecked',actuallyReviewedRanges=[]),issues=known,integrationConditions=[],audioIssues=slot.get('audioIssues',[]),userApproved=False))
        save(existing,dict(group='G5',schema='logical-slot-picture-usability-v1',scope='仅G5；新验收不等于用户通过，声音单列',clips=clips,unknownOriginal=dict(id='V32A-01',recordPreserved=True,repostForbidden=True),newTTS=0))
        print('Seven current SHA verified; known doubts registered before closure; none pre-labelled usable')
    elif sys.argv[1]=='sheets':
        from audit_media import sheets
        for slot in report['assembled']:
            sheets(dict(id='usability-'+slot['id']),slot['file'])
