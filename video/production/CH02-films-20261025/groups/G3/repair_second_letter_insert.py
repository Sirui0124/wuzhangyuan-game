from pathlib import Path
import json,subprocess,hashlib
O=Path(__file__).resolve().parent;E=O/'edited/picture-usability-v3';R=O/'review/picture-repair'
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
src=O/'edited/V21-03-16x9.mp4';panel=O/'edited/second-letter-summary-fullframe.png';dst=E/'V21-03-summary-after-handoff.mp4';start=2.8
if not dst.exists():subprocess.run([FF,'-v','error','-y','-i',str(src),'-i',str(panel),'-filter_complex',f"[0:v][1:v]overlay=0:0:enable='gte(t,{start})'[v]",'-map','[v]','-map','0:a?','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p','-c:a','copy','-movflags','+faststart',str(dst)],check=True)
r=dict(id='V21-03',file=str(dst),sha256=hashlib.sha256(dst.read_bytes()).hexdigest(),sourceSegments=[dict(file=str(src),sha256=hashlib.sha256(src.read_bytes()).hexdigest(),sourceTime=[0,2.8],purpose='完整递出、托住、松手后才切摘要')],overlay=dict(start=2.8,file=str(panel),text='李丰担忧父亲的安危，劝父亲与苟安停止原先的计划。',kind='准确摘要插镜，非假造原信全文'),reviewState='pending-final-dynamic-review',fullSourceLinesPreserved=True,noLoop=True,noFrozenMouth=True,audioIssues=['原片额外声音留统一清理；准确摘要不新增朗读，无新增TTS。'])
dst.with_suffix('.json').write_text(json.dumps(r,ensure_ascii=False,indent=2),encoding='utf-8');over=read(R/'candidate-overrides.json');over['V21-03']=r;(R/'candidate-overrides.json').write_text(json.dumps(over,ensure_ascii=False,indent=2),encoding='utf-8');print(str(dst))
