from pathlib import Path
import json,subprocess
OUT=Path(__file__).resolve().parent
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
p=OUT/'review/decisions.json';dec=json.loads(p.read_text(encoding='utf-8'))
fixes={'V21-01':dict(crop=[320,80,896,504],start=0,end=10.13,version='v2',reason='裁去左侧多余观看者身体，左移取景以保留动作中段苟安脸；无新证据取得'),
       'V21-02':dict(crop=[0,0,1088,612],start=0,end=12.25,reason='裁去右侧多余观看者侧脸与肩背，保留苟安完整反应和时长'),
       'V21-05':dict(crop=[0,40,1024,576],start=0,end=9.42,reason='裁去底部模型字幕及右上额外衣肩小血迹；保留脸和自然手势'),
       'V21-06':dict(crop=[96,0,1152,648],start=1.7,end=12.25,reason='去掉开头身份照切镜，裁去底部模型字幕；原句33字仍有10.55秒可承载'),
       'V21-08':dict(crop=[96,0,1152,648],start=0,end=11.54,reason='构图裁去模型字幕；保留全部反应及低头过程'),
       'V21-10':dict(crop=[0,0,1344,756],start=0,end=8.4,reason='保留救人与利用两句的自然表演；去掉后段8.4秒后新增的拿信靠灯动作，防止误解为烧毁证物；仍留8.4秒承载26个汉字')}
for id,f in fixes.items():
 src=OUT/'generated'/f'{id}-raw.mp4';dest=OUT/'edited'/f"{id}-visualcrop{('-'+f['version']) if f.get('version') else ''}.mp4"
 if not src.exists():continue
 if not dest.exists():
  x,y,w,h=f['crop']
  subprocess.run([FF,'-v','error','-y','-ss',str(f['start']),'-i',str(src),'-t',str(f['end']-f['start']),'-vf',f'crop={w}:{h}:{x}:{y},scale=1280:720,setsar=1','-r','24','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-movflags','+faststart',str(dest)],check=True)
 dec[id].update(visual='构图修复候选，待动态复核',audio='有额外导演词，待统一配音；不因此重拍',audioIssues=['原声含指定原句及额外导演词','未逐字听审；音色/BGM未给通过结论'],adoptPath=str(dest),crop=dict(source=str(src),**f),actualDynamicReview=False,findings=[dict(start=f['start'],end=f['end'],issue=f['reason'],fix='采用可逆构图裁剪，原片保留')])
 print(id,'visual crop prepared',flush=True)
p.write_text(json.dumps(dec,ensure_ascii=False,indent=2),encoding='utf-8')
