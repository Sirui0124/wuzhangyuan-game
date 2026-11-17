"""Free reordering/reframing retains credential ownership; no generation/TTS."""
from pathlib import Path
import subprocess,json,hashlib
O=Path(__file__).resolve().parent;F='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
def run(a):subprocess.run([F,'-v','error','-y']+a,check=True)
raw=O/'generated/V12-03-raw.mp4';paper=O/'edited/V12-03-document-softened.mp4'
face=O/'edited/V12-03-face-warning.mp4';hold=O/'edited/V12-03-held-credential.mp4';tmp=O/'edited/V12-03-reordered-video.mp4';dest=O/'edited/V12-03-reordered.mp4'
# The longer face window preserves all temporary source audio as well as source text.
rate=(12.25-6.333333)/(12.25-3.7)
run(['-ss','6.333333','-to','12.25','-i',str(raw),'-an','-vf',f'crop=704:396:384:48,scale=1280:720,setsar=1,setpts=(PTS-STARTPTS)/{rate}','-r','24','-c:v','libx264','-crf','18','-preset','fast',str(face)])
run(['-ss','0.8','-to','4.5','-i',str(paper),'-an','-c:v','libx264','-crf','18','-preset','fast',str(hold)])
listing=O/'edited/V12-03-reordered.concat.txt';listing.write_text("file '"+face.as_posix()+"'\nfile '"+hold.as_posix()+"'\n",encoding='utf-8')
run(['-f','concat','-safe','0','-i',str(listing),'-c','copy',str(tmp)])
run(['-i',str(tmp),'-i',str(O/'edited/V12-03-normalized.mp4'),'-map','0:v','-map','1:a','-c','copy','-movflags','+faststart',str(dest)])
run(['-i',str(dest),'-f','null','NUL'])
report=dict(id='V12-03',path=str(dest),sourcePath=str(raw),sourceSha256=hashlib.sha256(raw.read_bytes()).hexdigest(),sourceIntervals=[[6.333333,12.25],[.8,4.5]],faceRate=rate,paperRate=1,originalAudio='All12.25s retained temporarily; final NPC/player order and source exact text remain pending unified audio',excludedAction='5.2–6.2取回凭据；最终镜头凭据在玩家手里',crop=[384,48,704,396],decode='passed')
(O/'review/V12-03-reordered-edit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
run(['-i',str(dest),'-vf','fps=2,scale=320:-1,tile=4x7:padding=2:margin=2','-frames:v','1',str(O/'review/V12-03-reordered-check.jpg')])
print(json.dumps(report,ensure_ascii=False))
