from pathlib import Path
import subprocess,json,hashlib,copy
R=Path(__file__).resolve().parent;P=R.parent/'PV-regrets-20261117-v2'
FF=Path(r'D:/AI视频/VJ-1106/motion-runtime/node_modules/ffmpeg-static/ffmpeg.exe')
FP=FF.parent.parent/'ffprobe-static/bin/win32/x64/ffprobe.exe'
SRC=P/'三国遗憾-PV-v2-电影转场版.mp4'
OUT=R/'三国遗憾-PV-v3-去篝火重复版.mp4'
def run(args,**kw):
    p=subprocess.run(list(map(str,args)),capture_output=True,timeout=300,**kw)
    if p.returncode:raise RuntimeError(p.stderr.decode('utf-8','replace')[-4000:])
    return p
def save(name,obj):(R/name).write_text(json.dumps(obj,ensure_ascii=False,indent=2),'utf-8')

# Rebuild the opening from independent normalized clips. This avoids carrying
# the rejected campfire's frames from the old transition into the new one.
graph="""[0:v]settb=AVTB,setpts=PTS-STARTPTS[h];
[1:v]settb=AVTB,setpts=PTS-STARTPTS,split[sharp][soft];
[soft]gblur=sigma=8:steps=2:enable='lt(t,0.25)'[blurred];
[sharp][blurred]blend=all_expr='A*min(1,max(0,T/0.25))+B*(1-min(1,max(0,T/0.25)))':enable='lt(t,0.25)'[valley];
[h][valley]xfade=transition=custom:duration=0.25:offset=1.25:expr='if(gte(P,0.5),A,B)'[head];
[2:v]trim=start=17.5:end=69.5,setpts=PTS-STARTPTS,setsar=1[tail];
[head][tail]concat=n=2:v=1:a=0,format=yuv420p[v];
[4:a]atrim=duration=1.5,asetpts=PTS-STARTPTS,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[breath];
[3:a]atrim=start=6.25:end=14.25,asetpts=PTS-STARTPTS,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[rain];
[breath][rain]acrossfade=d=0.25:c1=tri:c2=tri[headsound];
[2:a]atrim=start=17.5:end=69.5,asetpts=PTS-STARTPTS,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[tailsound];
[headsound][tailsound]concat=n=2:v=0:a=1[a]""".replace('\n','')
(R/'filtergraph.txt').write_text(graph,'utf-8')
run([FF,'-y','-v','error','-i',P/'edit/H01.mp4','-i',P/'edit/A01.mp4','-i',SRC,'-i',P/'edit/mix.wav','-i',P/'H01/opening-audio.wav','-filter_complex_threads','1','-filter_complex',graph,'-map','[v]','-map','[a]','-t','61.25','-r','24','-frames:v','1470','-c:v','libx264','-threads','3','-preset','fast','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags','+faststart',OUT])
run([FF,'-v','error','-i',OUT,'-f','null','-'])
meta=json.loads(run([FP,'-v','error','-show_streams','-show_format','-of','json',OUT]).stdout)
v=next(s for s in meta['streams'] if s['codec_type']=='video');a=next(s for s in meta['streams'] if s['codec_type']=='audio')
assert int(v['nb_frames'])==1470
assert abs(float(v['duration'])-61.25)<.01
assert abs(float(a['duration'])-61.25)<.05
old=json.loads((P/'edit-timeline.json').read_text('utf-8'));new=[]
for shot in old['shots']:
    if shot['id'] in ('A04','A02'):continue
    s=copy.deepcopy(shot)
    if s['id']=='A01':
        s.update(timeline_in=1.25,timeline_out=9.25,transition_in=['focus_match',.25])
    elif s['id']!='H01':
        s['timeline_in']-=8.25;s['timeline_out']-=8.25
    new.append(s)
save('edit-timeline.json',dict(version='v3',date='2026-11-17',duration=61.25,output=[1280,720,24],shots=new,title=dict(timeline_in=56.25,timeline_out=61.25),removed=[dict(id='A04',old_interval=[1.25,6.25],reason='用户指出篝火假，删除整条集中燃烧木架镜头'),dict(id='A02',old_interval=[14.25,17.5],reason='用户指出约15秒重复，删除再次返回燃烧木头的近景')],source_version='v2',new_api_submissions=0,speed=1,user_review='待review'))
save('用户反馈与修订.json',dict(date='2026-11-17',source_version='v2',user_original='第二幕的篝火有点假，而且15s左右重复出现了两次。',interpretation='删除假篝火A04及重复回火的A02，使雨中谷地直接接诸葛亮反应。',source_sha256=hashlib.sha256(SRC.read_bytes()).hexdigest(),new_api_submissions=0,old_files_preserved=True,user_review='待review'))
save('technical.json',dict(file=str(OUT),sha256=hashlib.sha256(OUT.read_bytes()).hexdigest(),full_decode='pass',duration=61.25,frames=1470,metadata=meta,user_review='待review'))
for name,start,dur,fps,layout in [('opening-review.jpg',0,12,2,'4x6'),('new-valley-reaction-seam.jpg',8.75,1,12,'4x3')]:
    run([FF,'-y','-v','error','-ss',start,'-i',OUT,'-t',dur,'-vf',f'fps={fps},scale=320:180,tile={layout}','-frames:v','1','-update','1',R/name])
print(json.dumps(dict(file=str(OUT),duration=61.25,frames=1470,new_api_submissions=0),ensure_ascii=False))
