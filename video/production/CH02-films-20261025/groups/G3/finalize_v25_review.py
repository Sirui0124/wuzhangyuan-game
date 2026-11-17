from pathlib import Path
import json,subprocess
O=Path(__file__).resolve().parent
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def write(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2),encoding='utf-8')
d=read(O/'review/decisions.json')
src=O/'edited/V25-03-16x9.mp4';out=O/'edited/V25-03-listening-trim.mp4'
if not out.exists():
 subprocess.run([FF,'-v','error','-y','-i',str(src),'-t','2.5','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p','-r','24','-c:a','aac','-ar','48000','-movflags','+faststart',str(out)],check=True)
 d['V25-03'].update(adoptPath=str(out),visual='制作自查可用，待用户review',findings=['原片0–2.5秒苟安闭口倾听、人物和夜帐稳定；约2.7秒后开始开口，裁去该无关键动作尾部。保留2.5秒供“李严知道？”及反应，不删除源对白。'],trim={'source':str(src),'start':0,'end':2.5,'reason':'闭口听者短问句，移除多余开口尾段'},audioIssues=['原声不承担正式台词；未逐字听审，待统一配音核口型'])
write(O/'review/decisions.json',d)
write(O/'review/V25-03-trim.json',dict(source=str(src),output=str(out),sourceTime=[0,2.5],sourceNode='CH2-LY09-P03',intendedLine='李严知道？',reason='保留闭口倾听并移除尾部额外开口；不新增视频请求或TTS'))
print(str(out))
