from pathlib import Path
import sys,copy,hashlib
OUT=Path(__file__).parent;sys.path.insert(0,str(OUT))
from run_pipeline import read,save,metadata
from adopt_final_paper_edits import pad
from assemble import assemble

if __name__=='__main__':
    before=read(OUT/'delivery.json');save(OUT/'review/before-C13-delivery.json',before)
    unchanged={x['id']:(x['file'],x['sha256']) for x in before['assembled'] if x['id']!='V32A'}
    dest=pad('V32A-07-C13-follow-clause','V32A-07-C12-follow-clause-safe',2.5,1.5)
    d=read(OUT/'review/decisions.json');dec=d['V32A-07'];dec.pop('preciseRemainingVisualIssue',None)
    dec.update(sourceId='V32A-07-R2 + C13 follow-brush local reconstruction',sourceFile=str(dest.resolve()),visualReview='candidate-pass-with-limits',visualIssues=['上方原生大伪字已通过跟随笔尖裁幅排除，不再与撤回句并列；实际横划→提笔→下方署名→笔离纸/写字手退出顺序保留','撤回句是配准于真实墨线的后期字层；先有全句后横划，未把文字卡当作动作替代','局部448×252裁幅放大并旋转18度校正，有柔化；原生署名字形不能确认准确写出苟安，只作署名动作，准确姓名由前后核阅层说明'],reuse=dict(newPaidRequest=False,paidRepairTask='task_3EvIHe3Ddwdhin1uxLFICucERTF1fWb4',sourceRange=[3.8,9.42],liveActionSeconds=5.58,temporalLoop=False,rotationDegrees=18,sourceCrop=[400,325,448,252],signatureCrop=[400,370,448,252],panTime=[5.25,5.75],exactGlyphs='postproduction composite; source text shifted9px to keep entire clause inside crop',unknownOriginalUntouched=True),dynamicReview='C12 5.58秒IAB从0到ended已动态复核，完整4fps序列已看；C13合入整V后再复看；未逐字听审')
    save(OUT/'review/decisions.json',d)
    plan=[c for c in read(OUT/'plan.json')['clips'] if c['slot']=='V32A']
    slots=assemble(plan);assert len(slots)==1
    report=read(OUT/'delivery.json');current={x['id']:(x['file'],x['sha256']) for x in report['assembled'] if x['id']!='V32A'}
    assert unchanged==current,'Other six slots must stay byte-identical and keep the same paths'
    new=next(x for x in report['assembled'] if x['id']=='V32A');m=metadata(new['file']);assert m['size']==[1280,720] and '24 fps' in m['probe'] and '48000 Hz' in m['probe']
    new['technicalReview']=dict(size=[1280,720],ratio='16:9',fps=24,audioRate=48000,decode='passed',sha256=new['sha256']);new['audioListening']='未逐字听审'
    for c in report['clips']:
        if c['id']=='V32A-07':c['decision']=copy.deepcopy(dec)
    old_issue=report['boundedVisualRemainder'][0]
    report.setdefault('resolvedVisualIssues',[]).append(dict(id='V32A-07',oldIssue=old_issue,oldFile=next(x['file'] for x in before['assembled'] if x['id']=='V32A'),resolution='C13局部跟随笔尖裁幅，排除上方大伪字；准确句配准实际横划，真实署名/离纸动作保留',newFile=new['file'],evidence=str((OUT/'review/V32A-07-C12-follow-clause-safe/sequence-index.json').resolve()),paidRequestsAdded=0))
    report['boundedVisualRemainder'][0]='V32A-07：上方大伪字并列问题已排除；仍保留局部放大柔化与原生署名字形不能确认准确汉字的限制。准确句/姓名为后期字层，不冒充模型手写。'
    report['localSingleSlotRepair']=dict(id='V32A-07-C13-follow-clause',onlyChangedSlot='V32A',otherSixSamePathsAndHashes=True,newPaidRequests=0,review='candidate-pass-with-limits',userReview='待review',audioListening='未逐字听审')
    report['assembled'].sort(key=lambda x:['V32A','V33','V34','V35','V36','V37','V42'].index(x['id']))
    save(OUT/'delivery.json',report)
    save(OUT/'review/C13-local-repair.json',dict(file=new['file'],sha256=new['sha256'],metadata=m,source=dec['reuse'],otherSixUnchanged=unchanged,visualReview='candidate-pass-with-limits',userReview='待review',audioListening='未逐字听审',dynamicReview='C12已从头至尾播放；最终整V待复看'))
    print('Only V32A replaced after decode; other six files and SHA256 unchanged',flush=True)
