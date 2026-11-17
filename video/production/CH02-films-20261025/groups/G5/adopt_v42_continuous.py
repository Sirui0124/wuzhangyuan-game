from pathlib import Path
import sys,subprocess,hashlib,copy
OUT=Path(__file__).parent;sys.path.insert(0,str(OUT))
from run_pipeline import FF,read,save,metadata

if __name__=='__main__':
    master=OUT/'edited/sources/V42-R2-clean-master.mp4';handoff=read(OUT/'review/V42-clean-source-handoff.json')
    voices=read(OUT.parents[1]/'voice/manifest.json')['rows'];timing=[('CH2-LY13-002',2.0),('CH2-LY13-003',6.2),('CH2-LY13-004',10.2)]
    dest=OUT/'assembled/V42-R2-continuous-voiced-cfr24.mp4';pending=dest.with_name(dest.stem+'.pending.mp4');inputs=['-i',str(master)];filters=['[0:a]volume=.65[bed]'];records=[]
    for i,(node,start) in enumerate(timing,1):
        row=voices[node];assert row['ready'] and start+row['duration']<=metadata(master)['duration']
        inputs+=['-i',row['path']];filters.append(f'[{i}:a]aresample=48000,adelay={int(start*1000)}:all=1[a{i}]');records.append(dict(node=node,file=row['path'],start=start,end=start+row['duration']))
    filters+=['[bed][a1][a2][a3]amix=inputs=4:duration=first:normalize=0:dropout_transition=0[a]']
    subprocess.run([str(FF),'-v','error','-y']+inputs+['-filter_complex',';'.join(filters),'-map','0:v','-map','[a]','-c:v','copy','-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-movflags','+faststart',str(pending)],check=True)
    check=subprocess.run([str(FF),'-v','error','-i',str(pending),'-f','null','NUL'],capture_output=True);assert check.returncode==0;pending.replace(dest)
    report=read(OUT/'delivery.json');before=copy.deepcopy(report);save(OUT/'review/before-V42-R2-delivery.json',before)
    old=next(x for x in report['assembled'] if x['id']=='V42');new=copy.deepcopy(old)
    sourceMap=[dict(id='V42-01',nodes=['CH2-LY13-001'],pictureRange=[0,6.8]),dict(id='V42-02',nodes=['CH2-LY13-002','CH2-LY13-003'],pictureRange=[2,10.2]),dict(id='V42-03',nodes=['CH2-LY13-004'],pictureRange=[10.2,metadata(master)['duration']])]
    for x in sourceMap:x.update(sourceId='V42-R2-clean-master shared continuous shot',file=str(master.resolve()),sourceFile=str(master.resolve()),sourceRange=[0,metadata(master)['duration']],containsTextOverlay=False,containsFullFrameCard=False,postVoice=[r for r in records if r['node'] in x['nodes']],visualReview='candidate-pass-with-limits',visualIssues=['低斜角只见纸背/页缘，没有可读原生伪字；需旧记录语境承接'],audioIssues=['已有中央WAV回配，未逐字听审；没有新增TTS'])
    new.update(file=str(dest.resolve()),sources=sourceMap,metadata=metadata(dest),sha256=hashlib.sha256(dest.read_bytes()).hexdigest(),decode='passed',visualReview='candidate-pass-with-limits',visualIssues=[dict(id='V42-R2-clean',issues=['连续15.1秒新镜替换旧三段，舒卷、持卷、翻页动作可见；无浮层、无全屏卡','镜头看纸背，记录具体含义由既定剧情和心声承接，不新增统计数值'])],continuousSource=str(master.resolve()),containsTextOverlay=False,containsFullFrameCard=False,postVoice=records,integrationConditions=handoff['integrationConditions'],audioIssues=['已有三句中央玩家WAV分别2.0/6.2/10.2秒起；未逐字听审','原生成环境音保留，若有音乐/错词等纯音频问题另处理，不据此重拍'],audioListening='未逐字听审',userReview='待review',dynamicReview='15.10秒无卡母片已动态复核，回配心声版同画面，当前文件待完整动态复核',unresolved=['声音未逐字听审；纸背视角须前文建立旧记录语境'])
    new['technicalReview']=dict(size=[1280,720],ratio='16:9',fps=24,audioRate=48000,decode='passed',sha256=new['sha256'])
    report['assembled']=[new if x['id']=='V42' else x for x in report['assembled']]
    for row in report['clips']:
        if row['slot']=='V42':row['decision']=dict(visualReview='candidate-pass-with-limits',slotContinuousOverride=str(dest.resolve()),sourceMap=sourceMap,containsTextOverlay=False,containsFullFrameCard=False,userApproved=False)
    report['boundedVisualRemainder']=[s for s in report.get('boundedVisualRemainder',[]) if not s.startswith('V42')]
    report.setdefault('resolvedVisualIssues',[]).append(dict(id='V42',oldFile=old['file'],problem='原生伪字可读',newFile=new['file'],repair='新15秒纸背低斜角连续镜，非模糊遮盖；旧片保留',newPaidRequests=1))
    save(OUT/'delivery.json',report)
    overrides=read(OUT/'review/slot-picture-overrides.json') if (OUT/'review/slot-picture-overrides.json').exists() else {}
    overrides['V42']=new;save(OUT/'review/slot-picture-overrides.json',overrides)
    handoff.update(reviewState='reviewed',pictureUsability='usable-with-integration-condition',dynamicReview=dict(method='IAB 1x from0 to15.10s + full4fps sequence, no listening claim',actuallyReviewedRanges=[[0,15.1]],evidence=str((OUT/'review/V42-R2-clean/sequence-index.json').resolve())),voicedGroupVersion=str(dest.resolve()),voiceWindows=records);save(OUT/'review/V42-clean-source-handoff.json',handoff)
    print(new['file']);print(new['sha256']);print(records)
