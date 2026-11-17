"""Add central voice, retain original environment and assemble each logical slot."""
from pathlib import Path
import json,subprocess,hashlib,re,sys,math
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[1]
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,v):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(v,ensure_ascii=False,indent=2),encoding='utf-8')
def run(args):subprocess.run([FF,'-v','error','-y',*map(str,args)],check=True,capture_output=True)
def probe(p):
    s=subprocess.run([FF,'-hide_banner','-i',str(p)],capture_output=True,text=True,encoding='utf-8',errors='replace').stderr
    t=re.search(r'Duration: (\d+):(\d+):([\d.]+)',s);w,h=map(int,re.search(r'Video:.*? (\d{3,5})x(\d{3,5})',s).groups())
    fps=re.search(r'(\d+(?:\.\d+)?) fps',s);hz=re.search(r'Audio:.*?(\d{4,6}) Hz',s)
    return dict(duration=int(t[1])*3600+int(t[2])*60+float(t[3]),width=w,height=h,audioTrack='Audio:' in s,fps=float(fps[1]) if fps else None,sampleRate=int(hz[1]) if hz else None,sha256=hashlib.sha256(p.read_bytes()).hexdigest(),bytes=p.stat().st_size)
def verify(p):
    r=subprocess.run([FF,'-v','error','-i',str(p),'-f','null','NUL'],capture_output=True)
    if r.returncode:raise RuntimeError('Decode failed: '+p.name)
    return probe(p)
plan=read(OUT/'plan.json');voice=read(ROOT/'voice/manifest.json').get('rows',{})
selection=read(OUT/'review/selection.json') if (OUT/'review/selection.json').exists() else {}
mode=sys.argv[1] if len(sys.argv)>1 else 'all'
records=[]
for c in plan['clips']:
    cid=c['id'];sel=selection.get(cid,{})
    if sel.get('hold'):continue
    src=Path(sel.get('source',OUT/'generated'/f'{cid}-16x9.mp4'))
    if not src.exists():continue
    dst=OUT/'edited'/f'{cid}.mp4';rec=dst.with_suffix('.json');dst.parent.mkdir(exist_ok=True)
    start=sel.get('start',0);end=sel.get('end',probe(src)['duration']);speed=sel.get('speed',1);duration=(end-start)/speed
    wav=None
    if c.get('audioOverlay'):
        row=voice.get(c['sourceNodes'][0],{})
        if not row.get('ready'):continue
        wav=Path(row['path'])
        if row['duration']+.7>duration:raise RuntimeError(cid+': central voice does not fit')
        sourceId=src.stem.replace('-16x9','')
        audio_evidence=OUT/'review'/sourceId/'asr.json'
        audio_segments=read(audio_evidence).get('segments',[]) if audio_evidence.exists() else []
        if any(s.get('text','').strip() and s['end']>start and s['start']<end for s in audio_segments):
            # Preserve the picture and annotate contaminated audio; no extra TTS/video calls.
            wav=None
    overlay=Path(sel['overlayPng']) if sel.get('overlayPng') else None
    generationKey=hashlib.sha256(json.dumps(dict(pipeline=3,source=str(src),size=src.stat().st_size,start=start,end=end,speed=speed,crop=sel.get('crop'),wav=str(wav),overlaySha=hashlib.sha256(overlay.read_bytes()).hexdigest() if overlay else None),sort_keys=True).encode()).hexdigest()
    if not rec.exists() or read(rec).get('generationKey')!=generationKey:
        args=['-i',src]
        if wav:
            args+=['-i',wav,'-filter_complex',f'[0:a]atrim=start={start}:end={end},asetpts=PTS-STARTPTS,atempo={speed},volume=0.65[bed];[1:a]adelay=400:all=1[voice];[bed][voice]amix=inputs=2:duration=first:normalize=0[a]','-map','0:v:0','-map','[a]']
        else:args+=['-map','0:v:0','-map','0:a:0','-af',f'atrim=start={start}:end={end},asetpts=PTS-STARTPTS,atempo={speed}']
        crop=sel.get('crop')
        vf=f'trim=start={start}:end={end},setpts=(PTS-STARTPTS)/{speed}'+(f',crop={crop[2]}:{crop[3]}:{crop[0]}:{crop[1]},scale=1280:720,setsar=1' if crop else '')
        args+=['-vf',vf,'-t',duration,'-r','24','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-movflags','+faststart',dst]
        run(args)
        if overlay:
            base=dst.with_name(dst.stem+'-pre-overlay.mp4');dst.replace(base)
            run(['-i',base,'-loop','1','-i',overlay,'-filter_complex','[0:v][1:v]overlay=0:0:format=auto[v]','-map','[v]','-map','0:a:0','-t',duration,'-r','24','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p','-c:a','copy','-movflags','+faststart',dst])
        save(rec,dict(id=cid,slot=c['slot'],generationKey=generationKey,source=str(src),trim=dict(start=start,end=end),speed=speed,crop=crop,textOverlay=str(overlay) if overlay else None,centralVoice=str(wav) if wav else None,voiceOffset=.4 if wav else None,environment='保留原片环境声；ASR范围内未检出额外词的玩家环境片混入既有中央音轨，仍待听审；未新增合成',technical=verify(dst),visualReview=sel.get('review','待动态审查'),audioIssues=['未听审，不能宣称声音通过']+sel.get('audioIssues',[])+(['玩家环境片ASR检出疑似额外人声，保留现音轨并标注，未混双重人声；统一配音阶段处理'] if c.get('audioOverlay') and not wav else [])))
        print(json.dumps(dict(id=cid,status='edited'),ensure_ascii=False),flush=True)
    records.append(read(rec))
if mode=='edit':sys.exit(0)
slots=[]
for s in plan['slots']:
    if any(selection.get(cid,{}).get('hold') for cid in s['clipIds']):continue
    parts=[OUT/'edited'/f'{cid}.mp4' for cid in s['clipIds']]
    if not all(p.exists() for p in parts):continue
    suffix=selection.get(s['clipIds'][0],{}).get('assemblySuffix','')
    dest=OUT/'assembled'/f"{s['id']}-{s['name']}{('-'+suffix) if suffix else ''}.mp4";dest.parent.mkdir(exist_ok=True)
    listing=OUT/'assembled'/f"{s['id']}.concat.txt"
    listing.write_text('\n'.join("file '"+p.as_posix().replace("'","'\\''")+"'" for p in parts),encoding='utf-8')
    if not dest.exists() or dest.stat().st_mtime<max(p.stat().st_mtime for p in parts):run(['-f','concat','-safe','0','-i',listing,'-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p','-r','24','-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-movflags','+faststart',dest])
    slots.append(dict(id=s['id'],name=s['name'],file=str(dest),path=str(dest),clipIds=s['clipIds'],entry=s['entry'],next=s['next'],endEvent=s['endEvent'],technical=verify(dest),visualReview=dict(status='制作自查候选；待拼接后动态复核',evidence='review/visual-audio-review.json'),audioIssues=['未听审；ASR仅辅助；音频异常留统一配音阶段处理'],status='制作候选，待用户review'))
task_states=[]
for p in (OUT/'tasks').glob('*.json'):
    if '.request' in p.stem or '.latest' in p.stem:continue
    st=read(p);task_states.append(dict(id=p.stem,task_id=st.get('task_id'),status=st.get('status'),error=st.get('error')))
save(OUT/'delivery.json',dict(group='G4',status='全部逻辑槽位候选已拼接，待用户review' if len(slots)==len(plan['slots']) else '增量制作候选，未完成全部槽位',sourceCoverage=dict(expectedSlots=len(plan['slots']),assembledSlots=len(slots),expectedSourceNodes=sum(len(c['sourceNodes']) for c in plan['clips']),requestCount=len(plan['clips'])),clips=slots,slots=slots,subclips=records,tasks=task_states,missingSlots=[s['id'] for s in plan['slots'] if s['id'] not in {x['id'] for x in slots}],submissionPaused=(OUT/'pause-submissions.json').exists(),unresolved=['未完成逐字原声听审，ASR仅辅助；不能宣称声音或无BGM已通过','首批乱码/越肩问题须替换或重拍，未合格的V26整段不进入本增量索引','尚须逐片动态画面检查，详见review记录；制作自查不等于用户审核']))
print(json.dumps(dict(edited=len(records),assembled=len(slots)),ensure_ascii=False))
