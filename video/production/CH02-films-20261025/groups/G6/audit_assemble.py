from pathlib import Path
import json,subprocess,io,re,hashlib,time,shutil,uuid,importlib.util
from PIL import Image,ImageDraw
OUT=Path(__file__).resolve().parent
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
spec=importlib.util.spec_from_file_location('track_integrity',OUT/'track_integrity.py');trackcheck=importlib.util.module_from_spec(spec);spec.loader.exec_module(trackcheck)
def save(p,d):
    tmp=p.with_name(p.name+'.'+uuid.uuid4().hex+'.tmp');tmp.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8');tmp.replace(p)
def frame(p,t):
    r=subprocess.run([FF,'-v','error','-ss',str(t),'-i',str(p),'-frames:v','1','-vf','scale=480:-1','-f','image2pipe','-vcodec','png','pipe:1'],capture_output=True,check=True)
    return Image.open(io.BytesIO(r.stdout)).convert('RGB')
plan=read(OUT/'plan.json');assembly=[]
for c in plan['requests']+plan.get('retries',[]):
    p=OUT/'generated'/f"{c['id']}-delivery.json"
    if not p.exists():continue
    d=read(p);path=Path(d['file']);times=[round(min(d['duration']-.15,.2+i*1.5),2) for i in range(max(1,int(d['duration']/1.5)))]
    existing=OUT/'review'/f"{c['id']}-contact.jpg"
    if existing.exists() and existing.stat().st_mtime>=path.stat().st_mtime:continue
    sheet=Image.new('RGB',(1440,((len(times)+2)//3)*296),'#141414');draw=ImageDraw.Draw(sheet)
    for i,t in enumerate(times):
        im=frame(path,t);im.thumbnail((480,270));x=(i%3)*480;y=(i//3)*296;sheet.paste(im,(x,y));draw.text((x+5,y+274),f"{c['id']} {t:.2f}s",fill='white')
    sheet.save(OUT/'review'/f"{c['id']}-contact.jpg")
    save(OUT/'review'/f"{c['id']}-technical.json",dict(id=c['id'],duration=d['duration'],size=d['outputSize'],audio=d['audio'],decode=d['decode'],sampleTimes=times,visualReview='抽帧仅辅助；动态审片另记',audioReview='未逐字听审'))

for v in plan['clips']:
    parts=[c for c in plan['requests'] if c['parent']==v['id']]
    adopted=read(OUT/'review'/'visual-adopted.json') if (OUT/'review'/'visual-adopted.json').exists() else {}
    if (OUT/'review'/'adopted.json').exists():adopted.update(read(OUT/'review'/'adopted.json'))
    paths=[Path(adopted[c['id']]['path']) if c['id'] in adopted else OUT/'generated'/f"{c['id']}-16x9.mp4" for c in parts]
    if not all(p.is_file() for p in paths):continue
    listing=OUT/'assembled'/f"{v['id']}-concat.txt"
    listing.write_text('\n'.join("file '"+str(p.resolve()).replace('\\','/').replace("'","'\\''")+"'" for p in paths),encoding='utf-8')
    versions=read(OUT/'assembly-versions.json') if (OUT/'assembly-versions.json').exists() else {}
    suffix='-'+versions[v['id']] if v['id'] in versions else ''
    dest=OUT/'assembled'/f"{v['id']}-{v['name']}{suffix}.mp4"
    signature=hashlib.sha256('|'.join(str(p)+str(p.stat().st_mtime_ns) for p in paths).encode()).hexdigest()
    sigpath=dest.with_suffix('.sources.json')
    if not dest.exists() or not sigpath.exists() or read(sigpath).get('signature')!=signature:
        working=dest.with_name(dest.stem+'.working.mp4')
        args=[FF,'-v','error','-y']
        for part in paths:args+=['-i',str(part)]
        filters=[]
        for i in range(len(paths)):
            filters.append(f'[{i}:v:0]setpts=PTS-STARTPTS,fps=24,scale=1280:720,setsar=1,settb=1/24000,setpts=N*1000[v{i}]')
            filters.append(f'[{i}:a:0]aresample=48000,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,asetpts=PTS-STARTPTS[a{i}]')
        filters.append(''.join(f'[v{i}][a{i}]' for i in range(len(paths)))+f'concat=n={len(paths)}:v=1:a=1[v][a]')
        args+=['-filter_complex',';'.join(filters),'-map','[v]','-map','[a]','-r','24','-fps_mode','cfr','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p','-video_track_timescale','24000','-c:a','aac','-ar','48000','-ac','2','-b:a','192k','-movflags','+faststart',str(working)]
        subprocess.run(args,check=True)
        video_track=trackcheck.inspect(working)
        if not video_track['fullVideoTrack']:raise RuntimeError(v['id']+' incomplete decoded video track')
        if dest.exists():
            history=OUT/'assembled/history';history.mkdir(exist_ok=True)
            shutil.copy2(dest,history/(dest.stem+'-'+str(time.time_ns())+dest.suffix))
        working.replace(dest);video_track['path']=str(dest)
        save(sigpath,dict(signature=signature,paths=[str(p) for p in paths],videoTrack=video_track))
    dec=subprocess.run([FF,'-v','error','-i',str(dest),'-f','null','NUL'],capture_output=True)
    meta=subprocess.run([FF,'-hide_banner','-i',str(dest)],capture_output=True,text=True,encoding='utf-8',errors='replace').stderr
    dur=re.search(r'Duration: (\d+):(\d+):([\d.]+)',meta)
    assembly.append(dict(id=v['id'],name=v['name'],path=str(dest),subclips=[c['id'] for c in parts],entry=v['entry'],next=v['next'],endEvent=v['endEvent'],duration=int(dur[1])*3600+int(dur[2])*60+float(dur[3]),size=[1280,720],fps=24,audioSampleRate=48000,decode='passed' if not dec.returncode else 'failed',sha256=hashlib.sha256(dest.read_bytes()).hexdigest(),adopted=[adopted.get(c['id'],dict(path=str(p),trim='none')) for c,p in zip(parts,paths)],audioReview='未逐字听审',userReview='待review'))
states={c['id']:read(OUT/'tasks'/f"{c['id']}.json").get('status') if (OUT/'tasks'/f"{c['id']}.json").exists() else 'not_submitted' for c in plan['requests']}
save(OUT/'delivery.json',dict(group='G6',status='assembled-candidates' if len(assembly)==len(plan['clips']) else 'partial',sourceSlots=[v['id'] for v in plan['clips']],sourceCoverage='exact in plan; actual speech not fully verified',requests=states,films=assembly,unresolved=['未逐字听审，不能声称对白与声音已通过','动态画面审查见review；抽帧不代表动态通过'],userApproval=False))
html='<!doctype html><meta charset="utf-8"><title>G6结局制作候选</title><style>body{font:18px system-ui;background:#161a1c;color:#eee;max-width:1100px;margin:auto}video{width:100%;max-height:650px}article{margin:35px 0}small{color:#adb6ba}</style><h1>G6结局制作候选｜待review</h1><p>互斥结局独立播放；制作检查不等于用户通过。声音尚未完成逐字听审。</p>'
for a in assembly:
    html+=f'<article><h2>{a["id"]} {a["name"]}</h2><small>{a["entry"]} → {a["endEvent"]}</small><video controls preload="metadata" src="assembled/{Path(a["path"]).name}"></video></article>'
(OUT/'播放审阅.html').write_text(html,encoding='utf-8')
print(json.dumps(dict(assembled=len(assembly),total=len(plan['clips'])),ensure_ascii=False))
