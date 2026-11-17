from pathlib import Path
import json,subprocess,sys
OUT=Path(__file__).resolve().parent
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
f=OUT/'review/visual-adopted.json';adopted=read(f) if f.exists() else {}
edits={
 'V41E-03':dict(vf='crop=1104:620:120:0,scale=1280:720,setsar=1',crop=[120,0,1104,620],end=5.8,reason='裁去底部人物名并去掉末尾过近低头，保留5.8秒，足以承载中央第一半旁白5.25秒及前后气口'),
 'V41L-01':dict(vf="crop=w=704:h=396:x='if(lt(t,2.4),300,600)':y=0,scale=1280:720,setsar=1",crop=[dict(until=2.4,box=[300,0,704,396]),dict(start=2.4,box=[600,0,704,396])],reason='两个原镜头分别裁为军吏近景，排除左前景人，保留8秒完整时间')
}
for id,e in edits.items():
    if len(sys.argv)>1 and id not in sys.argv[1:]:continue
    src=OUT/'generated'/f'{id}-16x9.mp4';dest=OUT/'edited'/f'{id}-crop.mp4'
    args=[FF,'-v','error','-y','-i',str(src)]
    if e.get('end'):args+=['-t',str(e['end'])]
    if id=='V41L-01':
        table=OUT/'generated/V41E-01-16x9.mp4'
        filters="[0:v]trim=0:2.1,setpts=PTS-STARTPTS,crop=704:396:300:0,scale=1280:720,setsar=1[a];[1:v]trim=8.2:9.25,setpts=PTS-STARTPTS,scale=1280:720,setsar=1[b];[0:v]trim=3.15:8,setpts=PTS-STARTPTS,crop=704:396:600:0,scale=1280:720,setsar=1[c];[a][b][c]concat=n=3:v=1:a=0[v]"
        args+=['-i',str(table),'-filter_complex',filters,'-map','[v]','-map','0:a']
    else:args+=['-vf',e['vf']]
    args+=['-c:v','libx264','-crf','18','-preset','fast','-c:a','copy','-movflags','+faststart',str(dest)]
    subprocess.run(args,check=True)
    decoded=subprocess.run([FF,'-v','error','-i',str(dest),'-f','null','NUL'],capture_output=True)
    if decoded.returncode:raise RuntimeError(id+' decode failed')
    adopted[id]=dict(path=str(dest),source=str(src),crop=e['crop'],trim=[0,e['end']] if e.get('end') else 'none',duration=e.get('end',read(OUT/'generated'/f'{id}-delivery.json')['duration']),reason=e['reason'],visualReview='待裁后动态复查',audioIssues=['未逐字听审，暂不因音频重拍'],decode='passed')
    if id=='V41L-01':adopted[id].update(cutaway=dict(source=str(OUT/'generated/V41E-01-16x9.mp4'),trim=[8.2,9.25],timeline=[2.1,3.15],purpose='同一军吏案头的中性闭合卷束特写，不导入早支线事实'),audioPreserved='原V41L-01全部8秒音轨未裁切',reason='移除2.1–3.15前景人物经过，插同场无字案头，前后人像分别裁幅，保留8秒完整时长及原音轨')
    f.write_text(json.dumps(adopted,ensure_ascii=False,indent=2),encoding='utf-8')
    subprocess.run([FF,'-v','error','-y','-i',str(dest),'-vf','fps=2,scale=384:-1,tile=4x5','-frames:v','1',str(OUT/'review'/f'{id}-edited-grid.jpg')],check=True)
    print(id,'full-length edit saved',flush=True)
