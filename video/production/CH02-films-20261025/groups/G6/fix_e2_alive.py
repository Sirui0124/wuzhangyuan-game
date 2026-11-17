from pathlib import Path
import json,subprocess,uuid
OUT=Path(__file__).resolve().parent;BASE=OUT.parents[1]
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
src=OUT/'edited/V40-02-listener-reaction.mp4';voice=BASE/'voice/CH2-E2-003.wav';dest=OUT/'edited/V38-04-alive-R2.mp4'
# Picture reuse carries no E3/E4 sound or information. This ending-only inner
# voice already exists centrally; there is no speech-synthesis request.
subprocess.run([FF,'-v','error','-y','-i',str(src),'-i',str(voice),'-filter_complex','[1:a]adelay=400,apad=whole_dur=8,atrim=0:8,asetpts=PTS-STARTPTS[a]','-map','0:v:0','-map','[a]','-t','8','-c:v','copy','-c:a','aac','-ar','48000','-ac','2','-b:a','192k','-movflags','+faststart',str(dest)],check=True)
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,d):
    t=p.with_name(p.name+'.'+uuid.uuid4().hex+'.tmp');t.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8');t.replace(p)
f=OUT/'review/visual-adopted.json';d=read(f);d['V38-04']=dict(path=str(dest),duration=8.0,trim='none',pictureSources=[dict(source=str(OUT/'edited/V41E-03-crop.mp4'),trim=[0,5.8]),dict(source=str(OUT/'generated/V41E-04-16x9.mp4'),trim=[5.1,7.3])],voiceSource=str(voice),voiceTimelineStart=.4,newTTSRequests=0,reason='E2末镜必须明确苟安仍留营，替换原末尾空铺/离帐方向；只复用同一人同伤帐无声反应，不导入早E4信息',visualReview='源反应镜头已检查人物存活、闭口且无烧字；待E2修版末帧复看',audioIssues=['采用既有中央原句心声；仍未逐字听审，不声称声音通过'])
save(f,d);v=read(OUT/'assembly-versions.json');v['V38']='R2';save(OUT/'assembly-versions.json',v)
print('E2 alive reaction and existing central inner voice saved; zero API/TTS')
