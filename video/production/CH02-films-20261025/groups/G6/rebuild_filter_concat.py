"""Independent R3 finals: reset each stream then concat filter, never demuxer."""
from pathlib import Path
import json,subprocess,hashlib,uuid,importlib.util
OUT=Path(__file__).resolve().parent
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
spec=importlib.util.spec_from_file_location('track_integrity',OUT/'track_integrity.py');tracks=importlib.util.module_from_spec(spec);spec.loader.exec_module(tracks)
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,d):
    t=p.with_name(p.name+'.'+uuid.uuid4().hex+'.tmp');t.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8');t.replace(p)
plan=read(OUT/'plan.json');adopted=read(OUT/'review/visual-adopted.json');rows=[];reports=[]
old=read(OUT/'review/pre-pts-fix-delivery.json');byid={x['id']:x for x in old['films']}
for slot in [x for x in plan['clips'] if x['id']=='V41L']:
    parts=[c for c in plan['requests'] if c['parent']==slot['id']]
    paths=[Path(adopted[c['id']]['path']) if c['id'] in adopted else OUT/'generated'/f"{c['id']}-16x9.mp4" for c in parts]
    dest=OUT/'assembled'/f"{slot['id']}-{slot['name']}-R3.mp4";working=dest.with_name(dest.stem+'.working.mp4')
    args=[FF,'-v','error','-y']
    for p in paths:args+=['-i',str(p)]
    filters=[]
    for i in range(len(paths)):
        filters.append(f'[{i}:v:0]setpts=PTS-STARTPTS,fps=24,scale=1280:720:flags=lanczos,setsar=1,settb=1/24000,setpts=N*1000[v{i}]')
        filters.append(f'[{i}:a:0]aresample=48000,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,asetpts=PTS-STARTPTS[a{i}]')
    filters.append(''.join(f'[v{i}][a{i}]' for i in range(len(paths)))+f'concat=n={len(paths)}:v=1:a=1[v][a]')
    args+=['-filter_complex',';'.join(filters),'-map','[v]','-map','[a]','-r','24','-fps_mode','cfr','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p','-video_track_timescale','24000','-c:a','aac','-ar','48000','-ac','2','-b:a','192k','-movflags','+faststart',str(working)]
    subprocess.run(args,check=True)
    report=tracks.inspect(working);report['id']=slot['id'];reports.append(report)
    if not report['fullVideoTrack']:save(OUT/'review/tracks-rebuild-failed.json',reports);raise RuntimeError(slot['id']+' full video-track integrity failed')
    working.replace(dest);report['path']=str(dest)
    base=byid[slot['id']].copy();base.update(path=str(dest),duration=report['containerDuration'],sha256=hashlib.sha256(dest.read_bytes()).hexdigest(),decode='passed',videoTrack=report,videoTrackComplete=True,assemblyMethod='per-input setpts/fps/SAR/timebase + asetpts/aresample + concat filter; independent R3',visualReview='原画面及侧脸修复保留；R3完整帧与PTS通过，待最终动态播放')
    rows.append(base)
    save(OUT/'review/tracks-rebuild.json',reports)
    print(json.dumps(dict(id=slot['id'],videoFrames=report['videoFrames'],lastPTS=report['lastPTS'],duration=report['containerDuration'],complete=True),ensure_ascii=False),flush=True)
    # Incremental publication only of tracks that have actually passed. Others
    # remain held, so an aggregator cannot pick a container-only candidate.
    live=read(OUT/'delivery.json');live['films']=[x for x in live['films'] if x['id']!=slot['id']]+[base]
    order={v['id']:i for i,v in enumerate(plan['clips'])};live['films'].sort(key=lambda x:order[x['id']])
    live['status']='track-verified-rebuild-in-progress';live['complete']=False;save(OUT/'delivery.json',live)
save(OUT/'review/tracks-V41L-R3.json',reports)
print('V41L R3 video track decoded and continuous; other passing paths preserved',flush=True)
