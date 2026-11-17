from pathlib import Path
import sys,subprocess,hashlib
OUT=Path(__file__).parent;sys.path.insert(0,str(OUT))
from run_pipeline import FF,read,save,metadata
src=OUT/'generated/V42-R2-clean-16x9.mp4';dest=OUT/'edited/sources/V42-R2-clean-master.mp4'
subprocess.run([str(FF),'-v','error','-y','-i',str(src),'-vf','scale=1280:720,setsar=1,fps=24','-r','24','-fps_mode','cfr','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p','-c:a','copy','-movflags','+faststart',str(dest)],check=True)
check=subprocess.run([str(FF),'-v','error','-i',str(dest),'-f','null','NUL'],capture_output=True);assert check.returncode==0
record=dict(id='V42-R2-clean-master',file=str(dest.resolve()),sha256=hashlib.sha256(dest.read_bytes()).hexdigest(),sourceFile=str(src.resolve()),sourceSha256=hashlib.sha256(src.read_bytes()).hexdigest(),sourceRange=[0,metadata(src)['duration']],metadata=metadata(dest),containsTextOverlay=False,containsFullFrameCard=False,hasOriginalGeneratedAudio=True,newTTS=False,decode='passed',task_id='task_568T2bKNxHqPhiPxeesGVyxHlc5awTlN',reviewState='pending master current-SHA dynamic review',actions=[dict(time=[0,6.8],action='持纸背舒展并放稳'),dict(time=[6.8,10.4],action='纸背/页缘观察'),dict(time=[10.4,14.7],action='右手提角翻页并停稳')],integrationConditions=['低斜角仅看纸背/页缘，需接在已建立旧记录语境后，不能把纸背当可读记录正文','原句继续由已有中央玩家WAV传达，不新增数值或史料事实','仅E1/E3尾声，不新增玩家脸或重生特效'],audioIssues=['原声音保留，未逐字听审；纯错词/音色/音乐/临时声口另记，不据此重拍'],userApproved=False)
save(OUT/'review/V42-clean-source-handoff.json',record)
print(record['file']);print(record['sha256']);print(record['metadata']['duration'])
