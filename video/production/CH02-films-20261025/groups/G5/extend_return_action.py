from pathlib import Path
import sys,subprocess,hashlib
OUT=Path(__file__).parent;sys.path.insert(0,str(OUT))
from run_pipeline import FF,save,metadata
src=OUT/'generated/V33-01-16x9.mp4';dest=OUT/'edited/sources/V35-01-C2-return-complete.mp4'
subprocess.run([str(FF),'-v','error','-y','-t','8.2','-i',str(src),'-filter_complex','[0:v]reverse,setpts=PTS-STARTPTS[v]','-map','[v]','-map','0:a','-t','8.2','-r','24','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-ar','48000','-ac','2','-movflags','+faststart',str(dest)],check=True)
save(dest.with_suffix('.json'),dict(id='V35-01-C2-return-complete',source=str(src.resolve()),sourceRange=[0,8.2],operation='reverse video only; retain forward source audio temporarily',reason='补回原片0–2.2秒反向尾端，让信使完全松手、卷在我手中并退开，不能只靠接触瞬间声称交接完成',sha256=hashlib.sha256(dest.read_bytes()).hexdigest(),metadata=metadata(dest),newPaidRequest=False,containsTextOverlay=False,containsFullFrameCard=False,audioIssues=['临时前向原声未逐字听审；动作方向复核独立于音轨']))
print('Full release/draw-back candidate created; not selected before motion review')
