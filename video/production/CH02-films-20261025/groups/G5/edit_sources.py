from pathlib import Path
import sys,subprocess,json
OUT=Path(__file__).parent;sys.path.insert(0,str(OUT))
from run_pipeline import FF,read,save,metadata
def render(id,source_id,parts,reason):
    source=OUT/'generated'/f'{source_id}-16x9.mp4';dest=OUT/'edited'/'sources'/f'{id}.mp4';dest.parent.mkdir(exist_ok=True)
    n=len(parts);filters=[f'[0:v]split={n}'+''.join(f'[v{i}]' for i in range(n)),f'[0:a]asplit={n}'+''.join(f'[a{i}]' for i in range(n))]
    for i,p in enumerate(parts):
        crop=p.get('crop');croptext=f'crop={crop[2]}:{crop[3]}:{crop[0]}:{crop[1]},' if crop else ''
        filters += [f'[v{i}]trim=start={p["start"]}:end={p["end"]},setpts=PTS-STARTPTS,{croptext}scale=1280:720,setsar=1[v{i}o]',f'[a{i}]atrim=start={p["start"]}:end={p["end"]},asetpts=PTS-STARTPTS[a{i}o]']
    filters+=[''.join(f'[v{i}o][a{i}o]' for i in range(n))+f'concat=n={n}:v=1:a=1[v][a]']
    subprocess.run([str(FF),'-v','error','-y','-i',str(source),'-filter_complex',';'.join(filters),'-map','[v]','-map','[a]','-r','24','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p','-c:a','aac','-ar','48000','-ac','2','-movflags','+faststart',str(dest)],check=True)
    check=subprocess.run([str(FF),'-v','error','-i',str(dest),'-f','null','NUL'],capture_output=True)
    if check.returncode:raise RuntimeError('Decode failed')
    save(dest.with_suffix('.json'),dict(id=id,source=str(source.resolve()),sourceId=source_id,parts=parts,reason=reason,newPaidRequest=False,decode='passed',metadata=metadata(dest),audioIssues=['剪辑原声仅临时保留，未逐字听审；后续统一配音需按完整源句覆盖'],visualReview='pending dynamic review'))
    print(id,dest,flush=True)
if __name__=='__main__':
    targets={
      'V32A-listener-C1':('V32A-04-R2',[dict(start=0,end=1.8),dict(start=3.2,end=6.7,crop=[200,400,632,356]),dict(start=3.2,end=5.1)],'只用合拢嘴唇的面部与同片案头局部，不把开口段作为玩家句的听者口型；未知初始任务不重投'),
      'V34-01-C1':('V34-01',[dict(start=0,end=2.45,crop=[112,0,1120,630]),dict(start=9.72,end=10.94,crop=[112,0,1120,630]),dict(start=11.43,end=15.08,crop=[112,0,1120,630])],'去掉文字污染的特写、导演说明字幕，保留读信宽景与李严反应；声音完整性待统一阶段'),
      'V34-03-C1':('V34-03',[dict(start=0,end=5.35,crop=[112,0,1120,630]),dict(start=8.25,end=12.25,crop=[112,0,1120,630])],'去掉约5.4–8.2双李严叠影，裁去字幕，保留先回应后动笔'),
      'V34-04-C1':('V34-04',[dict(start=4.28,end=10.2),dict(start=10.2,end=12.25,crop=[600,200,744,420])],'避开信使肩背，保留李严实际写/签/提笔/递出与手接补报；准确文书字层另加')
    }
    selected=set(sys.argv[1:])
    for id,(source,parts,reason) in targets.items():
        if selected and id not in selected:continue
        if (OUT/'generated'/f'{source}-16x9.mp4').exists():render(id,source,parts,reason)
