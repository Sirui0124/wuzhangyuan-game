from pathlib import Path
import json,shutil,subprocess,uuid
OUT=Path(__file__).resolve().parent
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,d):
    tmp=p.with_name(p.name+'.'+uuid.uuid4().hex+'.tmp');tmp.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8');tmp.replace(p)
adopted=read(OUT/'review/visual-adopted.json')
# Already dynamically reviewed: no identifiable foreground face, full original
# 8s audio retained, with a neutral-table bridge over the foreground crossing.
safe=OUT/'edited/V41L-01-face-safe-R2.mp4'
shutil.copy2(OUT/'edited/V41L-01-crop.mp4',safe)
old=adopted['V41L-01'];adopted['V41L-01']=dict(path=str(safe),duration=8.0,source=str(OUT/'generated/V41L-01-16x9.mp4'),trim='full 8-second original audio retained',reason='总控定位晚E4合辑24–29秒：V41L-01可识别侧鼻嘴胡子；使用独立脸部安全构图修版',segments=[dict(source='V41L-01',trim=[0,2.1],crop=[300,0,704,396]),dict(source='V41E-01',trim=[8.2,9.25],purpose='中性闭合卷束，不导入早E4事实'),dict(source='V41L-01',trim=[3.15,8],crop=[600,0,704,396])],visualReview='裁后曾实际动态播放核验，0–8秒无前景可识别脸，待新版整段连接复核',audioIssues=['完整原音轨未裁，未逐字听审'],previousAdoptedPath=old['path'])

# Apply the same face standard to the common receipt shot, protecting E3 and
# late E4 together. Preserve handing-over at the start and all original audio.
src=OUT/'generated/V39-01-16x9.mp4';table=OUT/'generated/V41E-01-16x9.mp4';dest=OUT/'edited/V39-01-face-safe-R2.mp4'
filters='[0:v]trim=0:2.4,setpts=PTS-STARTPTS,scale=1280:720,setsar=1,fps=24[a];[0:v]trim=2.4:5.1,setpts=PTS-STARTPTS,crop=848:476:450:0,scale=1280:720,setsar=1,fps=24[b];[1:v]trim=5.1:10.13,setpts=PTS-STARTPTS,scale=1280:720,setsar=1,fps=24[c];[a][b][c]concat=n=3:v=1:a=0[v]'
subprocess.run([FF,'-v','error','-y','-i',str(src),'-i',str(table),'-filter_complex',filters,'-map','[v]','-map','0:a','-c:v','libx264','-crf','18','-preset','fast','-c:a','copy','-movflags','+faststart',str(dest)],check=True)
adopted['V39-01']=dict(path=str(dest),duration=10.13,source=str(src),trim='full original audio retained',segments=[dict(source='V39-01',trim=[0,2.4]),dict(source='V39-01',trim=[2.4,5.1],crop=[450,0,848,476]),dict(source='V41E-01',trim=[5.1,10.13],purpose='中性无字案头，避免文书元文字')],visualReview='同步裁除共同收件镜头极短的左前景侧面；待动态检查',audioIssues=['原音轨完整保留，未逐字听审'])
save(OUT/'review/visual-adopted.json',adopted)
save(OUT/'assembly-versions.json',{'V39':'R2','V41L':'R2'})
print('Independent face-safe child edits saved; old films untouched')
