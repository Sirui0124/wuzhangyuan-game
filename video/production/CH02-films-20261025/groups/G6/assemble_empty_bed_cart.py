from pathlib import Path
import json,subprocess
OUT=Path(__file__).resolve().parent
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
a=OUT/'generated/V40-06-16x9.mp4';b=OUT/'generated/V40-06-R2-16x9.mp4';dest=OUT/'edited/V40-06-empty-bed-and-cart.mp4'
filters='[0:v]trim=0:6.25,setpts=PTS-STARTPTS,scale=1280:720,setsar=1,fps=24[v0];[0:a]atrim=0:6.25,asetpts=PTS-STARTPTS,aresample=48000,afade=t=out:st=6.18:d=0.07[a0];[1:v]trim=0:8,setpts=PTS-STARTPTS,scale=1280:720,setsar=1,fps=24[v1];[1:a]atrim=0:8,asetpts=PTS-STARTPTS,aresample=48000,afade=t=in:st=0:d=0.07[a1];[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]'
subprocess.run([FF,'-v','error','-y','-i',str(a),'-i',str(b),'-filter_complex',filters,'-map','[v]','-map','[a]','-c:v','libx264','-crf','18','-preset','fast','-c:a','aac','-ar','48000','-b:a','192k','-movflags','+faststart',str(dest)],check=True)
f=OUT/'review/visual-adopted.json';d=json.loads(f.read_text(encoding='utf-8'));d['V40-06']=dict(path=str(dest),duration=14.25,segments=[dict(source=str(a),trim=[0,6.25],purpose='保留空铺，不进入后半错误满粮车或人物'),dict(source=str(b),trim=[0,8],purpose='R2裸木底板空粮车从帐外经过')],visualReview='R2已动态播放及2fps抽帧，无粮袋/人物/烧字，空床与车体稳定；待组合片动态复查',audioIssues=['三句中央心声已备，暂未混入；原环境音未逐字听审'],sourceTask='V40-06-R2')
f.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8');print('V40-06 combined 14.25s; wrong loaded cart excluded')
