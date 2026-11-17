from pathlib import Path
import json,uuid,subprocess
OUT=Path(__file__).resolve().parent
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,d):
    t=p.with_name(p.name+'.'+uuid.uuid4().hex+'.tmp');t.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8');t.replace(p)
ad=read(OUT/'review/visual-adopted.json');versions=read(OUT/'assembly-versions.json')
for key,src,start,end,version in [('V41E-04','V41E-04-16x9.mp4',5.1,9.42,'R2'),('V41L-04','V41L-04-R2-16x9.mp4',0,9.8,'R4')]:
    source=OUT/'generated'/src;dest=OUT/'edited'/f'{key}-silent-reaction-{version}.mp4'
    subprocess.run([FF,'-v','error','-y','-ss',str(start),'-i',str(source),'-t',str(end-start),'-vf','setpts=PTS-STARTPTS,fps=24,scale=1280:720,setsar=1','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p','-c:a','aac','-ar','48000','-ac','2','-b:a','192k','-movflags','+faststart',str(dest)],check=True)
    ad[key]=dict(path=str(dest),source=str(source),trim=[start,end],duration=end-start,reason='旁白/心声时段只留无发声口型反应或无人物脸的闭卷动作；删除明显NPC发声画面',visualReview='待当前新SHA动态检查',audioIssues=['临时原音轨裁切保留，声音待统一；无新增TTS；完整中央旁白长度可容纳'])
    versions[key.split('-')[0]]=version
save(OUT/'review/visual-adopted.json',ad);save(OUT/'assembly-versions.json',versions)
print('Local narration-mouth trims saved; no API/TTS')
