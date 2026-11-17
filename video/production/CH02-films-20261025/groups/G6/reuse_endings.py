"""Reassess ending footage under the human's third-person authorization.

Replace corrupted document visuals with a neutral shot of the same clerk's
closed, unlettered materials. Preserve complete dialogue time/audio.
"""
from pathlib import Path
import json,subprocess
OUT=Path(__file__).resolve().parent
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
f=OUT/'review/visual-adopted.json';adopted=read(f)
table=OUT/'generated/V41E-01-16x9.mp4'
configs={
 'V38-02':dict(filters="[0:v]trim=0:1,setpts=PTS-STARTPTS,crop=1024:576:160:0,scale=1280:720,setsar=1,fps=24[a];[0:v]trim=2.4:5.42,setpts=PTS-STARTPTS,crop=1024:576:160:0,scale=1280:720,setsar=1,fps=24[b];[1:v]trim=4.7:10.1,setpts=PTS-STARTPTS,scale=1280:720,setsar=1,fps=24[c];[a][b][c]concat=n=3:v=1:a=0[v]",segments=[dict(source='V38-02',trim=[0,1],crop=[160,0,1024,576]),dict(source='V38-02',trim=[2.4,5.42],crop=[160,0,1024,576]),dict(source='V41E-01',trim=[4.7,10.1],purpose='同一军吏无字闭合卷束，替代元文字纸面')]),
 'V39-01':dict(filters="[0:v]trim=0:5.1,setpts=PTS-STARTPTS,scale=1280:720,setsar=1,fps=24[a];[1:v]trim=5.1:10.13,setpts=PTS-STARTPTS,scale=1280:720,setsar=1,fps=24[b];[a][b]concat=n=2:v=1:a=0[v]",segments=[dict(source='V39-01',trim=[0,5.1]),dict(source='V41E-01',trim=[5.1,10.13],purpose='同场无字案头，不导入早E4事实')]),
 'V39-02':dict(filters="[0:v]trim=0:4,setpts=PTS-STARTPTS,scale=1280:720,setsar=1,fps=24[a];[1:v]trim=4.7:10.12,setpts=PTS-STARTPTS,scale=1280:720,setsar=1,fps=24[b];[a][b]concat=n=2:v=1:a=0[v]",segments=[dict(source='V39-02',trim=[0,4]),dict(source='V41E-01',trim=[4.7,10.12],purpose='替换背景搬粮袋及额外离场人物，不删原音轨')])
}
for id,c in configs.items():
    src=OUT/'generated'/f'{id}-16x9.mp4';dest=OUT/'edited'/f'{id}-ending-reuse.mp4'
    subprocess.run([FF,'-v','error','-y','-i',str(src),'-i',str(table),'-filter_complex',c['filters'],'-map','[v]','-map','0:a','-c:v','libx264','-crf','18','-preset','fast','-c:a','copy','-movflags','+faststart',str(dest)],check=True)
    duration=read(OUT/'generated'/f'{id}-delivery.json')['duration']
    adopted[id]=dict(path=str(dest),source=str(src),segments=c['segments'],duration=duration,trim='不裁原始完整音轨',audioPreserved='complete original audio retained',visualReview='结局视角新授权下复用，元文字/搬粮动作以同场中性案头替换，待动态复查',audioIssues=['原声未逐字听审，错词/音色/音乐仅标记，最终统一配音'],scope='结局专用，不改变普通交谈第一视角')
    f.write_text(json.dumps(adopted,ensure_ascii=False,indent=2),encoding='utf-8')
    print(id,'reused full-duration with neutral table cutaway',flush=True)

id='V40-03';dest=OUT/'edited'/f'{id}-closed-scroll.mp4'
subprocess.run([FF,'-v','error','-y','-ss','4.7','-to','10.13','-i',str(table),'-vf','scale=1280:720,setsar=1','-r','24','-c:v','libx264','-crf','18','-preset','fast','-c:a','aac','-ar','48000','-movflags','+faststart',str(dest)],check=True)
adopted[id]=dict(path=str(dest),source=str(table),trim=[4.7,10.13],duration=5.43,purpose='同一军吏将闭合素卷放平，承载正式处置传来的纯演出；不展示伪造官文或字迹',visualReview='以同场无字卷束动作替换错误文书，待动态复查',audioIssues=['本节点纯演出不朗读说明，现环境音未听审'])
f.write_text(json.dumps(adopted,ensure_ascii=False,indent=2),encoding='utf-8')
print(id,'neutral closed-scroll replacement saved',flush=True)

# The player's line must not visually turn into Gou An speaking it. Reuse
# neutral closed-mouth reactions from the same man/tent, while retaining all
# eight seconds of the current temporary source audio for later replacement.
id='V40-02';dest=OUT/'edited'/f'{id}-listener-reaction.mp4';src=OUT/'generated'/f'{id}-16x9.mp4'
quiet=OUT/'edited/V41E-03-crop.mp4';react=OUT/'generated/V41E-04-16x9.mp4'
filters='[1:v]trim=0:5.8,setpts=PTS-STARTPTS,scale=1280:720,setsar=1,fps=24[a];[2:v]trim=5.1:7.3,setpts=PTS-STARTPTS,scale=1280:720,setsar=1,fps=24[b];[a][b]concat=n=2:v=1:a=0[v]'
subprocess.run([FF,'-v','error','-y','-i',str(src),'-i',str(quiet),'-i',str(react),'-filter_complex',filters,'-map','[v]','-map','0:a','-c:v','libx264','-crf','18','-preset','fast','-c:a','copy','-movflags','+faststart',str(dest)],check=True)
adopted[id]=dict(path=str(dest),source=str(src),duration=8.0,trim='原8秒音轨未裁',segments=[dict(source=str(quiet),trim=[0,5.8]),dict(source=str(react),trim=[5.1,7.3])],purpose='同一苟安卧榻闭口听者反应；不导入早E4对白/事件，匹配前片V40-01-R2伤帐问话',visualReview='静口反应替换原代说画面，待动态复查',audioIssues=['原临时音轨仍待统一；指定我的原句中央wav已备、3.80秒可完整容纳'])
f.write_text(json.dumps(adopted,ensure_ascii=False,indent=2),encoding='utf-8')
print(id,'neutral listening reaction saved',flush=True)
