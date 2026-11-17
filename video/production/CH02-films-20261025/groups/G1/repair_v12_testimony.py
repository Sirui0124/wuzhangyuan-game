"""Keep pointing action, remove duplicate handoff; reuse visual only."""
from pathlib import Path
import subprocess,json,hashlib
O=Path(__file__).resolve().parent;F='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
def run(a):subprocess.run([F,'-v','error','-y']+a,check=True)
src=O/'edited/V12-02-document-softened.mp4';face=O/'edited/V11R-01-normalized.mp4';part=O/'edited/V12-02-pointing.mp4';tmp=O/'edited/V12-02-reordered-video.mp4';dest=O/'edited/V12-02-reordered.mp4'
run(['-ss','3.25','-to','8.25','-i',str(src),'-an','-c:v','libx264','-crf','18','-preset','fast',str(part)])
listing=O/'edited/V12-02-reordered.concat.txt';listing.write_text("file '"+part.as_posix()+"'\nfile '"+face.as_posix()+"'\n",encoding='utf-8')
run(['-f','concat','-safe','0','-i',str(listing),'-an','-c:v','copy',str(tmp)])
run(['-i',str(tmp),'-i',str(O/'edited/V12-02-normalized.mp4'),'-map','0:v','-map','1:a','-c','copy','-movflags','+faststart',str(dest)])
run(['-i',str(dest),'-f','null','NUL'])
report=dict(id='V12-02',path=str(dest),sourcePath=str(O/'generated/V12-02-raw.mp4'),sourceIntervals=[[3.25,8.25]],reusedVisualOnly=dict(path=str(face),sha256=hashlib.sha256(face.read_bytes()).hexdigest(),interval=[0,9.417],noBranchTransfer=True),sourceAudio='V12-02 complete original14.38s; no V11R dialogue or branch imported',treatment='pointing and withdrawal5sec +9.417sec same-person close-up; no paper retrieval or repeated handoff',decode='passed')
(O/'review/V12-02-reordered-edit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
run(['-i',str(dest),'-vf','fps=2,scale=320:-1,tile=4x8:padding=2:margin=2','-frames:v','1',str(O/'review/V12-02-reordered-check.jpg')])
print(json.dumps(report,ensure_ascii=False))
