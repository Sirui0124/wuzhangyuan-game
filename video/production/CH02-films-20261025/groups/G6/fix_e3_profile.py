from pathlib import Path
import json,subprocess,uuid
OUT=Path(__file__).resolve().parent
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
src=OUT/'generated/V40-05-16x9.mp4'
portrait=OUT/'generated/V40-04-R2-16x9.mp4'
dest=OUT/'edited/V40-05-face-safe-R2.mp4'
filters='[1:v]trim=0:3,setpts=PTS-STARTPTS,fps=24,scale=1280:720,setsar=1[a];[0:v]trim=3:9.42,setpts=PTS-STARTPTS,crop=1024:576:320:0,fps=24,scale=1280:720,setsar=1[b];[a][b]concat=n=2:v=1:a=0[v]'
subprocess.run([FF,'-v','error','-y','-i',str(src),'-i',str(portrait),'-filter_complex',filters,'-map','[v]','-map','0:a:0','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p','-c:a','copy','-movflags','+faststart',str(dest)],check=True)
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,d):
    t=p.with_name(p.name+'.'+uuid.uuid4().hex+'.tmp');t.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8');t.replace(p)
p=OUT/'review/visual-adopted.json';d=read(p)
d['V40-05']=dict(path=str(dest),source=str(src),duration=9.42,trim='full original audio retained',segments=[dict(source=str(portrait),trim=[0,3],purpose='同一军吏正面，移除开头前景面部轮廓'),dict(source=str(src),trim=[3,9.42],crop=[320,0,1024,576],purpose='保留军吏回案动作，移除左前景可识别鼻嘴胡子')],visualReview='本地裁切修复，待修版动态回看',audioIssues=['原临时音轨完整保留，未逐字听审，待统一声音'])
save(p,d);p=OUT/'assembly-versions.json';d=read(p);d['V40']='R2';save(p,d)
print('E3 local profile removal saved; no API or TTS requests')
