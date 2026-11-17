from pathlib import Path
import sys,subprocess,hashlib
OUT=Path(__file__).parent;sys.path.insert(0,str(OUT))
from run_pipeline import FF,read,save,metadata
from assemble import assemble

if __name__=='__main__':
    raw=OUT/'edited/sources/V36-04-C3-clean-clerk.mp4';dest=OUT/'edited/sources/V36-04-C4-clean-clerk.mp4'
    subprocess.run([str(FF),'-v','error','-y','-i',str(raw),'-ss','4.5','-i',str(OUT/'generated/V36-04-16x9.mp4'),'-map','0:v','-map','1:a','-c:v','copy','-af','apad','-t',str(metadata(raw)['duration']),'-c:a','aac','-ar','48000','-ac','2','-movflags','+faststart',str(dest)],check=True)
    record=read(raw.with_suffix('.json'));record.update(id='V36-04-C4-clean-clerk',audioSourceRange=[4.5,12.25],audioFullRequiredSentenceRetained=True,file=str(dest.resolve()),sha256=hashlib.sha256(dest.read_bytes()).hexdigest(),containsTextOverlay=False,containsFullFrameCard=False);save(dest.with_suffix('.json'),record)
    d=read(OUT/'review/decisions.json')
    for id,name in [('V36-03','V36-03-C3-clean-clerk'),('V36-04','V36-04-C4-clean-clerk')]:
        dec=d[id];dec.pop('spatialCrop',None);dec.pop('trim',None)
        dec.update(sourceId=name,sourceFile=str((OUT/'edited/sources'/f'{name}.mp4').resolve()),postOverride=[],visualReview='candidate-pass-with-limits',visualIssues=['同场同一军吏连续近景，案上原生文字全部裁出；无后期文字浮层、无全屏卡','同场观察素材有明确复用，不循环；完整原句音轨时窗保留，临时声口不同步单列音频'],dynamicReview='新清理版待当前SHA动态复核')
    save(OUT/'review/decisions.json',d)
    before=read(OUT/'delivery.json');save(OUT/'review/before-clerk-clean-delivery.json',before)
    assemble([c for c in read(OUT/'plan.json')['clips'] if c['slot']=='V36'])
    report=read(OUT/'delivery.json');report['assembled'].sort(key=lambda x:['V32A','V33','V34','V35','V36','V37','V42'].index(x['id']));save(OUT/'delivery.json',report)
    manifest=[]
    for id,name in [('V36-03','V36-03-C3-clean-clerk'),('V36-04','V36-04-C4-clean-clerk')]:
        file=OUT/'edited/sources'/f'{name}.mp4';recipe=read(file.with_suffix('.json'))
        manifest.append(dict(id=id,file=str(file.resolve()),sha256=hashlib.sha256(file.read_bytes()).hexdigest(),duration=metadata(file)['duration'],sourceParts=recipe['parts'],audioSource=recipe['audioSource'],audioSourceRange=recipe.get('audioSourceRange','original full line'),containsTextOverlay=False,containsFullFrameCard=False,reviewState='pending-current-SHA-motion-review',userApproved=False))
    save(OUT/'review/clean-source-handoff.json',dict(group='G5',clips=manifest))
    print('Clean clerk sources exported with original required audio; V36 only updated',flush=True)
