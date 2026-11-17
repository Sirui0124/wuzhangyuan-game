from pathlib import Path
import json,subprocess,hashlib,re,sys,shutil
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).parent;PUB=OUT/'edited';PUB.mkdir(exist_ok=True)
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2),encoding='utf-8')
def run(args):subprocess.run([FF,'-v','error','-y',*map(str,args)],check=True)
def generated(id):return OUT/'generated'/(id+'-16x9.mp4')
def original(glob):return next((ROOT/'video/raw').glob(glob))
def encode(src,dest,start=0,end=None,crop=None,mute=False):
    vf=(f'crop={crop[2]}:{crop[3]}:{crop[0]}:{crop[1]},' if crop else '')+'scale=1344:756:flags=lanczos,setsar=1'
    args=['-ss',start,'-i',src]
    if end is not None:args+=['-t',end-start]
    args+=['-vf',vf,'-r','24','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p']
    args+=['-an'] if mute else ['-c:a','aac','-b:a','192k','-ar','48000']
    run(args+['-movflags','+faststart',dest]);return dest
def concat(parts,dest):
    # Filter concat handles silent/voiced source variants consistently.
    args=[]
    for p in parts:args+=['-i',p]
    filt=''.join(f'[{i}:v:0][{i}:a:0]' for i in range(len(parts)))+f'concat=n={len(parts)}:v=1:a=1[v][a]'
    run(args+['-filter_complex',filt,'-map','[v]','-map','[a]','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-movflags','+faststart',dest]);return dest
def voice(src,dest,lines,duration,crop=None,tempo=1):
    args=['-i',src]
    for id,offset in lines:args+=['-i',OUT/'voice'/(id+'.wav')]
    # Low-level room tone is an unpitched background, never music or a replacement for speech.
    args+=['-f','lavfi','-i',f'anoisesrc=color=brown:amplitude=0.002:sample_rate=48000:duration={duration}']
    filt=[];tracks=[]
    for n,(_,offset) in enumerate(lines,1):
        label=f'a{n}';filt.append(f'[{n}:a]atempo={tempo},adelay={int(offset*1000)}:all=1[{label}]');tracks.append(f'[{label}]')
    tracks.append(f'[{len(lines)+1}:a]');filt.append(''.join(tracks)+f'amix=inputs={len(tracks)}:duration=longest:normalize=0[a]')
    vf=(f'crop={crop[2]}:{crop[3]}:{crop[0]}:{crop[1]},' if crop else '')+'scale=1344:756:flags=lanczos,setsar=1'
    run(args+['-filter_complex',';'.join(filt),'-map','0:v:0','-map','[a]','-vf',vf,'-t',duration,'-r','24','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-movflags','+faststart',dest]);return dest
def metadata(p):
    s=subprocess.run([FF,'-hide_banner','-i',str(p)],capture_output=True,text=True,encoding='utf-8',errors='replace').stderr
    t=re.search(r'Duration: (\d+):(\d+):([\d.]+)',s);w,h=map(int,re.search(r'Video:.*? (\d{3,5})x(\d{3,5})',s).groups())
    return dict(duration=int(t[1])*3600+int(t[2])*60+float(t[3]),width=w,height=h,sha256=hashlib.sha256(p.read_bytes()).hexdigest(),bytes=p.stat().st_size)
def assert_decode(p):
    r=subprocess.run([FF,'-v','error','-i',str(p),'-f','null','NUL'],capture_output=True);assert r.returncode==0,(p,r.stderr[:300])

def make_opening():
    # Tighten the generated 15-second source and eliminate its repeated approach shot.
    a_segments=[(.5,2.2),(2.4,4.95),(5,6),(8,9.4),(9.4,11),(13.1,15)]
    parts=[]
    for i,(a,b) in enumerate(a_segments):parts.append(encode(generated('OP01'),PUB/f'op1-{i}.mp4',a,b))
    a=concat(parts,PUB/'op1-visual.mp4');ad=metadata(a)['duration']
    # Strip the model's extra off-script narration, move the actual report to its speaker's shot.
    run(['-i',a,'-ss',5.46,'-t',1.84,'-i',generated('OP01'),'-filter_complex',"[0:a]volume=0:enable='between(t,4.2,6.7)'[bed];[1:a]adelay=5010:all=1[report];[bed][report]amix=inputs=2:duration=first:normalize=0[a]",'-map','0:v','-map','[a]','-c:v','copy','-c:a','aac','-b:a','192k','-ar','48000','-movflags','+faststart',PUB/'op1.mp4'])
    # Never retain the generated close-up in which the extinguished lamp accidentally lights again.
    bparts=[encode(generated('OP02'),PUB/'op2-a.mp4',0,4.45),encode(generated('OP02'),PUB/'op2-b.mp4',5.6,6)]
    b=concat(bparts,PUB/'op2-visual.mp4');bd=metadata(b)['duration']
    old_c=ROOT/'video/current/PR01-C-20261024-lamp-continuity-0b6888a2.mp4'
    run(['-i',b,'-i',old_c,'-map','0:v','-map','1:a','-t',bd,'-c:v','copy','-c:a','aac','-b:a','192k','-ar','48000','-movflags','+faststart',PUB/'op2.mp4'])
    # The existing corrected phone reveal contains the exact extinguished lamp; reuse only this bridge.
    phone=ROOT/'video/current/PR01-DEF-20261024-77fc2fdd.mp4'
    cparts=[encode(phone,PUB/'op3-phone.mp4',0,3.5),encode(generated('OP03'),PUB/'op3-code.mp4',3.9,7.5),encode(generated('OP03'),PUB/'op3-ai.mp4',7.7,10.35),encode(generated('OP03'),PUB/'op3-web.mp4',10.4,12)]
    c=concat(cparts,PUB/'op3-visual.mp4');cd=metadata(c)['duration']
    voice(c,PUB/'op3.mp4',[('M01',1.1),('M02',3.65),('M03',7.25)],cd)
    d=encode(generated('OP04'),PUB/'op4-visual.mp4',0,10.3)
    voice(d,PUB/'op4.mp4',[('M04',.1),('M05',3.55),('M06',6.9)],metadata(d)['duration'],tempo=1.08)
    return concat([PUB/'op1.mp4',PUB/'op2.mp4',PUB/'op3.mp4',PUB/'op4.mp4'],PUB/'PR01-完整开场-20261025.mp4')

def make_dialogues():
    # Use close-ups to remove the model's unwanted over-the-shoulder visitor from the two listening shots.
    voice(generated('G10QR2'),PUB/'G10Q.mp4',[('D07',.5)],4,crop=(560,24,768,432))
    # The retake occludes the guard behind an invented visitor. Use the actual closed general's tent instead.
    jt=encode(ROOT/'video/current/C1T10-10-cut-09a64768-20261023.mp4',PUB/'G14Q-base.mp4',0,4,crop=(0,0,736,414))
    voice(jt,PUB/'G14Q.mp4',[('J03',.3)],4)
    door=original('1023*/C1T20_*.mp4')
    # Intercut the closed tent during my questions; only the real guard's answers show speaking lips.
    q1=encode(door,PUB/'guard-q1-base.mp4',.2,2.9)
    voice(q1,PUB/'guard-q1.mp4',[('D01',.1)],2.7)
    a1=encode(generated('G09AR2'),PUB/'guard-a1.mp4',7.38,10.7,crop=(480,20,864,486))
    q2=encode(door,PUB/'guard-q2-base.mp4',.4,3.9)
    voice(q2,PUB/'guard-q2.mp4',[('D03',.1)],3.5)
    a2=encode(generated('G09A'),PUB/'guard-a2.mp4',13.55,14.98)
    a3=encode(generated('G09BR2'),PUB/'guard-a3.mp4',3.8,10.08)
    concat([PUB/'guard-q1.mp4',a1,PUB/'guard-q2.mp4',a2,a3],PUB/'G09.mp4')
    # Existing Jiangwei has the established face and correct perspective; keep it as an explicit provisional reuse.
    encode(original('1023*/C1T15_*.mp4'),PUB/'G15.mp4',0,30)
    # Restore the two missing narration sentences over the existing continuous night-to-day shot.
    voice(door,PUB/'G20.mp4',[('B-03',.6),('B-04',7.65)],12)
    # The no-gate-clue branch has its own actual words, never an invented report that the gate is safe.
    vb=encode(ROOT/'video/current/C1T06-06-cut-24bf7823-20261023.mp4',PUB/'variant-base.mp4',0,7)
    voice(vb,PUB/'variant-speech.mp4',[('A42-variant',.1)],7)
    va=encode(generated('G06B2R2'),PUB/'variant-answer.mp4',2.9,5.2)
    end=encode(door,PUB/'variant-ending-base.mp4',.3,3.3);voice(end,PUB/'variant-ending.mp4',[('A-45',.15)],3)
    concat([PUB/'variant-speech.mp4',va,PUB/'variant-ending.mp4'],PUB/'G06-variant.mp4')

if sys.argv[1] in ['edit','dialogues']:
    opening=make_opening() if sys.argv[1]=='edit' else PUB/'PR01-完整开场-20261025.mp4';make_dialogues()
    final=[opening]+[PUB/(id+'.mp4') for id in ['G09','G10Q','G14Q','G15','G20','G06-variant']]
    result=[]
    for p in final:assert_decode(p);result.append(dict(path=str(p.resolve()),**metadata(p)))
    save(OUT/'edited-manifest.json',result);print(json.dumps(result,ensure_ascii=False,indent=2))
elif sys.argv[1]=='integrate':
    before=read(ROOT/'GameStarter/web-demo/public/cinematics.json');save(OUT/'audit/cinematics-before.json',before)
    def publish(file,id,title,rows=None,**kw):
        src=PUB/file;name=id+'-20261025.mp4';dest=ROOT/'video/current'/name;shutil.copy2(src,dest)
        return dict(id=id,src='/video/current/'+name,title=title,**({'rows':rows} if rows else {}),**kw)
    op=publish('PR01-完整开场-20261025.mp4','PR01-cinematic-20261025','灯与急报 · 错过与许愿')
    sc03=next(x for x in before['opening'] if 'SC03' in x['src']);before['opening']=[op,sc03]
    additions=[publish('G09.mp4','C1FIX09','向甲问禁令与责任',['D01','D02','D03','D04','D05','D06']),
       publish('G10Q.mp4','C1FIX10Q','问今夜当值',['D07'],afterPlayback='advance'),
       publish('G14Q.mp4','C1FIX14Q','请亲兵通传',['J03'],afterPlayback='advance'),
       publish('G15.mp4','C1FIX15','姜维接报担责与亲兵同行',['J09','J09A','J10','J10A','J10B','J11','J13']),
       publish('G20.mp4','C1FIX20','天亮，没有人来收矛',['B-03','B-04'],afterPlayback='advance')]
    script={r['id']:r for r in read(ROOT/'content/chapters/wuzhang/chapter-one.script.json')['rows']}
    additions.append(publish('G06-variant.mp4','C1FIX06B','未询问营门的转呈',['A-42','A-43','A-44','A-45'],firstLineText=script['A-42']['text'].replace('营门未破。','')))
    ids={x['id'] for x in additions};before['chapterDialogue']=[x for x in before['chapterDialogue'] if x['id'] not in ids]+additions
    save(ROOT/'GameStarter/web-demo/public/cinematics.json',before)
    mpath=ROOT/'GameStarter/web-demo/public/video/media-manifest.json';media=read(mpath);save(OUT/'audit/media-manifest-before.json',media)
    urls={x['src'] for group in before.values() if isinstance(group,list) for x in group if isinstance(x,dict) and x.get('src')}
    kept=[x for x in media['clips'] if x['url'] in urls]
    for c in [op]+additions:
        p=ROOT/c['src'].lstrip('/');info=metadata(p)
        kept.append(dict(file='current/'+p.name,url=c['src'],source='../../video/current/'+p.name,**info,containerDuration=info['duration'],fps='24/1',videoCodec='h264',audioCodec='aac',fullDecodePassed=True,status='待review；20261025固定演出补齐，声音与人物效果待人工确认'))
    media['clips']=kept;media['version']+=1;save(mpath,media)
    save(OUT/'integration.json',dict(openingFile=str((ROOT/op['src'].lstrip('/')).resolve()),opening=op,dialogue=additions,reviewState='待review',limitations=['姜维授权沿用原片，报明/报告一词需结合原声review；没有把ASR当作演员读错的证明','问乙用闭口倾听近景，请通传用将军帐外镜头补我之画外音；不是错误口型换字幕','旧存档停在片中时仍显示原文，避免重演事实；新游戏覆盖全部固定有声行']))
    print('Integrated opening plus 6 fixed-film groups; existing rules and dynamic AI remain intact.')
