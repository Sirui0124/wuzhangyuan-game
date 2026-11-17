from pathlib import Path
import json,subprocess,hashlib
O=Path(__file__).resolve().parent;R=O/'user-review-20261025';FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
src=O/'generated/V21-10-raw.mp4';old=O/'edited/V21-10-visualcrop.mp4';out=R/'V21-10-clean-source-closeup.mp4'
# Dynamic clean framing only: no local blur, mask, overlay, patch, or letter card.
vf="setpts=PTS-STARTPTS,crop=1344:756:0:0,scale=1280:720,crop=768:432:300:'if(lt(t,4),24,min(70,24+(t-4)*11.5))',scale=1280:720,setsar=1,fps=24,trim=end_frame=202,setpts=N/24/TB"
subprocess.run([FF,'-v','error','-y','-i',str(src),'-i',str(old),'-filter_complex',f'[0:v]{vf}[v]','-map','[v]','-map','1:a','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p','-r','24','-fps_mode','cfr','-c:a','copy','-movflags','+faststart',str(out)],check=True)
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
rec=dict(id='V21-10',file=str(out),sha256=sha(out),source=str(src),sourceSha256=sha(src),sourceTime=[0,8.416667],filter=vf,frameCount=202,fps=24,sourceAudio=str(old),sourceAudioSha256=sha(old),method='回未叠层原片随表演取干净近景，纸面在构图外；不强切嘴/下颌，不加遮罩、模糊或字卡',reviewState='pending-dynamic-review',fullExistingAudioPreserved=True)
out.with_suffix('.json').write_text(json.dumps(rec,ensure_ascii=False,indent=2),encoding='utf-8');subprocess.run([FF,'-v','error','-y','-i',str(out),'-vf','fps=4,scale=320:180,tile=5x7','-frames:v','1',str(R/'V21-10-clean-source-sequence.jpg')],check=True)
print(json.dumps(rec,ensure_ascii=False))
