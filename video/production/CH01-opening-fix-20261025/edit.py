from pathlib import Path
import subprocess,json,hashlib,shutil,sys,av
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).parent;WORK=OUT/'edit';WORK.mkdir(exist_ok=True)
OLD=ROOT/'video/production/CH01-cinematic-20261025'
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2),encoding='utf-8')
def run(args):subprocess.run([FF,'-hide_banner','-loglevel','error','-y',*map(str,args)],check=True)
def info(p):
    with av.open(str(p)) as c:
        v=c.streams.video[0]
        return dict(frames=v.frames,width=v.width,height=v.height,fps=str(v.average_rate),videoDuration=float(v.duration*v.time_base),duration=c.duration/1000000,sha256=hashlib.sha256(p.read_bytes()).hexdigest(),bytes=p.stat().st_size)
def cut(src,a,b,name,mute=False):
    dest=WORK/name;frames=round((b-a)*24)
    args=['-ss',a,'-i',src,'-t',frames/24,'-vf','scale=1344:756:flags=lanczos,setsar=1','-r','24','-frames:v',frames,'-c:v','libx264','-threads','4','-preset','fast','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-ar','48000','-ac','2','-b:a','192k']
    if mute:args+=['-af','volume=0']
    run(args+['-movflags','+faststart',dest]);return dest
def concat(parts,dest):
    args=[]
    for p in parts:args+=['-i',p]
    filt=''.join(f'[{i}:v:0][{i}:a:0]' for i in range(len(parts)))+f'concat=n={len(parts)}:v=1:a=1[v][a]'
    run(args+['-filter_complex',filt,'-map','[v]','-map','[a]','-r','24','-c:v','libx264','-threads','4','-preset','fast','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-ar','48000','-ac','2','-b:a','192k','-movflags','+faststart',dest]);return dest
if sys.argv[1]=='edit':
    op1=OLD/'generated/OP01-16x9.mp4';op2=OLD/'generated/OP02-16x9.mp4'
    modern=ROOT/'video/current/PR01-DEF-20261024-77fc2fdd.mp4'
    # The first shot is already burning: never use OP01's ignition/stick shots.
    choices=[
        (ROOT/'video/current/PR01-A-20261024-57daca70.mp4',.05,1.3,'01-lit-flame.mp4',False),
        (ROOT/'video/current/PR01-B-bridge-20261024-lamp-continuity-7f11b341.mp4',0,2.2,'02-riders.mp4',True),
        (op1,6.2,7.2,'03-established-lamps.mp4',True),
        (op1,8,9.4,'04-report.mp4',True),
        (op1,9.4,11,'05-stride.mp4',False),
        (op1,13.1,15,'06-arrive-once.mp4',False),
    ]
    parts=[cut(src,a,b,name,mute) for src,a,b,name,mute in choices]
    base=concat(parts,WORK/'ancient-a-visual.mp4')
    offset=sum(info(p)['videoDuration'] for p in parts[:3])
    # Restore horse foley under the clean rider image, and speak the report only once at its shot.
    run(['-i',base,'-ss',2.6,'-t',2.2,'-i',op1,'-ss',5.46,'-t',1.84,'-i',op1,
         '-filter_complex',f'[1:a]adelay=1250:all=1[horse];[2:a]adelay={round(offset*1000)}:all=1[report];[0:a][horse][report]amix=inputs=3:duration=first:normalize=0[a]',
         '-map','0:v','-map','[a]','-c:v','copy','-c:a','aac','-ar','48000','-ac','2','-b:a','192k','-movflags','+faststart',WORK/'ancient-a.mp4'])
    entry=cut(op2,0,3.1,'07-curtain-extinguish.mp4')
    reaction=cut(OUT/'generated/ZL-REACTION-16x9.mp4',.5,1.9,'08-new-reaction.mp4',True)
    tail=cut(op2,5.6,6,'09-smoke.mp4',True)
    visual=concat([entry,reaction,tail],WORK/'ancient-c-visual.mp4')
    duration=info(visual)['videoDuration']
    # The old C audio already contains the only "丞相"; do not use generated narration.
    run(['-i',visual,'-i',ROOT/'video/current/PR01-C-20261024-lamp-continuity-0b6888a2.mp4',
         '-map','0:v','-map','1:a','-t',duration,'-c:v','copy','-c:a','aac','-ar','48000','-ac','2','-b:a','192k','-movflags','+faststart',WORK/'ancient-c.mp4'])
    # Exact original performance, complete 720-frame modern section, no new voices or retiming.
    old_modern=cut(modern,0,30,'10-restored-modern-30s.mp4')
    dest=OUT/'PR01-开场修订-烛光起始-原版穿越-20261025.mp4'
    concat([WORK/'ancient-a.mp4',WORK/'ancient-c.mp4',old_modern],dest)
    run(['-i',dest,'-f','null','NUL'])
    assert info(dest)['width']*9==info(dest)['height']*16
    records=[dict(name=p.name,**info(p)) for p in [WORK/'ancient-a.mp4',WORK/'ancient-c.mp4',old_modern,dest]]
    save(OUT/'edit-record.json',dict(file=str(dest.resolve()),metadata=info(dest),parts=records,
         cuts=[dict(source=str(src.resolve()),start=a,end=b,output=name) for src,a,b,name,mute in choices],
         replacement=dict(source=str((OUT/'generated/ZL-REACTION-16x9.mp4').resolve()),range=[.5,1.9],task_id=read(OUT/'tasks/ZL-REACTION.json')['task_id']),
         restoredModern=dict(source=str(modern.resolve()),sha256=info(modern)['sha256'],start=0,end=30,rate=1,frames=720,audio='原画原声，仅统一发布画幅及编码'),
         reviewState='待review',decode='passed'))
    print(json.dumps(records,ensure_ascii=False,indent=2))
elif sys.argv[1]=='integrate':
    record=read(OUT/'edit-record.json');dest=ROOT/'video/current/PR01-candle-original-modern-20261025.mp4';shutil.copy2(record['file'],dest)
    config_path=ROOT/'GameStarter/web-demo/public/cinematics.json';media_path=ROOT/'GameStarter/web-demo/public/video/media-manifest.json'
    config=read(config_path);media=read(media_path);save(OUT/'audit/cinematics-before.json',config);save(OUT/'audit/media-manifest-before.json',media)
    previous=config['opening'][0];assert len(config['opening'])==2 and 'SC03' in config['opening'][1]['src']
    clip=dict(id='PR01-candle-original-modern-20261025',src='/video/current/'+dest.name,title='烛光起始 · 原版回忆与穿越')
    config['opening'][0]=clip;media['clips']=[x for x in media['clips'] if x['url']!=previous['src']]
    inf=info(dest);media['clips'].append(dict(file='current/'+dest.name,url=clip['src'],source='../../video/current/'+dest.name,**inf,containerDuration=inf['duration'],videoCodec='h264',audioCodec='aac',fullDecodePassed=True,status='待review；用户要求删除点灯、重拍反应、恢复原现代段'))
    media['version']+=1
    assert read(config_path)==read(OUT/'audit/cinematics-before.json'),'Concurrent cinematic edit'
    assert read(media_path)==read(OUT/'audit/media-manifest-before.json'),'Concurrent media edit'
    save(config_path,config);save(media_path,media)
    save(OUT/'integration.json',dict(opening=clip,openingFile=str(dest.resolve()),previous=previous,**inf,reviewState='待review',restoredModern=record['restoredModern']))
    print('Replaced only the opening entry; fixed dialogue and SC03 bindings retained.')
