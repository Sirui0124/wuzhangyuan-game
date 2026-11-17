"""Adopt independent read-only reviews; local edits only, no API calls."""
from pathlib import Path
import json,hashlib,subprocess
O=Path(__file__).resolve().parent
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
report=O.parent/'G3/review/G1-template-assist-review.json'
r=json.loads(report.read_text(encoding='utf-8-sig'))
p=O/'review/decisions.json';d=json.loads(p.read_text(encoding='utf-8-sig'))
for cid in ['L01-01','V11T-01','V11D-01','V11A-01','V11R-01']:
    x=r['clips'][cid];raw=Path(x['sourcePath'])
    assert hashlib.sha256(raw.read_bytes()).hexdigest()==x['sourceSha256'],cid
    source=O/'edited'/f'{cid}-normalized.mp4'
    result=dict(sourcePath=str(raw),sourceSha256=x['sourceSha256'],visualReview=x['visualReview'],actualDynamicReview=True,reviewedBy='G3 full1x muted playback +3fps sequence; SHA reverified by G1',reviewEvidence=str(report),findings=x['findings'],audioIssues=x['audioIssues'],sourceLines=x['sourceLines'])
    spec={'L01-01':(0,4.5,.75),'V11D-01':(0,6,.75),'V11A-01':(3.15,8,.80)}.get(cid)
    if spec:
        a,b,rate=spec;dest=O/'edited'/f'{cid}-usable-window.mp4'
        subprocess.run([FF,'-v','error','-y','-ss',str(a),'-to',str(b),'-i',str(source),'-vf',f'setpts=(PTS-STARTPTS)/{rate}','-af',f'atempo={rate}','-r','24','-c:v','libx264','-crf','18','-preset','fast','-c:a','aac','-ar','48000','-movflags','+faststart',str(dest)],check=True)
        result.update(adoptedPath=str(dest),sourceIntervals=[[a,b]],rate=rate)
        result['audioIssues']+=['有效画面已免费取窗并适度慢放；源句完整保留在策划与此条记录，临时音轨截句/语速待统一配音，不删源句。']
    else:result.update(adoptedPath=str(source),sourceIntervals=[[0,x['duration']]])
    if cid=='L01-01':result.update(loopReady=False,loopLimitation='6秒非循环倾听反应；源0–4.5秒0.75倍，无短片反复。首尾不匹配，不作为循环已完成。')
    d[cid]=result
p.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8')
