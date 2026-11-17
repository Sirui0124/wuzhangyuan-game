from pathlib import Path
import subprocess,json,hashlib,math,concurrent.futures
import numpy as np

R=Path(__file__).resolve().parent; E=R/'edit';E.mkdir(exist_ok=True)
FF=Path(r'D:/AI视频/VJ-1106/motion-runtime/node_modules/ffmpeg-static/ffmpeg.exe')
FP=FF.parent.parent/'ffprobe-static/bin/win32/x64/ffprobe.exe'
SR=48000
PLAN=json.loads((R/'production-plan.json').read_text('utf-8'))
OV={'A01':('light_match',.25),'B01':('focus_bridge',.25),'D01':('dark_occlusion',.25),'TITLE':('lamp_to_black',.25)}
if (R/'edit-selection.json').exists():
    selection=json.loads((R/'edit-selection.json').read_text('utf-8'))
    source_units={u['id']:u for u in PLAN['units']}
    PLAN['units']=[dict(source_units[s['id']],**s) for s in selection['shots']]
    OV={s['id']:(s['kind'],s['duration']) for s in selection['transitions']}

def run(a,timeout=240,**kw):
    p=subprocess.run(list(map(str,a)),capture_output=True,timeout=timeout,**kw)
    if p.returncode:raise RuntimeError(p.stderr.decode('utf-8','replace')[-4000:])
    return p
def probe(p):return json.loads(run([FP,'-v','error','-show_streams','-show_format','-of','json',p]).stdout)
def source_summary(u):
    p=Path(u.get('source_path',R/u['id']/'source.mp4'));m=probe(p);v=next(s for s in m['streams'] if s['codec_type']=='video')
    return dict(source=str(p),sha256=hashlib.sha256(p.read_bytes()).hexdigest(),width=v['width'],height=v['height'],fps=v['avg_frame_rate'],duration=float(m['format']['duration']),pre_crop=u.get('pre_crop'),reused_existing=bool(u.get('source_path')))
def load(p):return np.frombuffer(run([FF,'-v','error','-i',p,'-vn','-ar',SR,'-ac','2','-f','f32le','pipe:1']).stdout,'<f4').reshape(-1,2).copy()
def rms(x):return max(1e-8,float(np.sqrt(np.mean(x*x))))
def norm(x,db):return x*10**(db/20)/rms(x)
def bandpass(x,low,high):
    f=np.fft.rfftfreq(len(x),1/SR)
    w=(1/(1+(low/np.maximum(f,1))**6))*(1/(1+(f/high)**6));w[0]=0
    return np.fft.irfft(np.fft.rfft(x,axis=0)*w[:,None],n=len(x),axis=0).astype(np.float32)
def save(p,obj):p.write_text(json.dumps(obj,ensure_ascii=False,indent=2),'utf-8')

def audio(u):
    sid=u['id'];d=R/sid;dur=u['edit_duration'];n=round(dur*SR)
    src=Path(u.get('audio_source_path',u.get('source_path',d/'source.mp4')))
    meta=probe(src);has=any(s['codec_type']=='audio' for s in meta['streams'])
    ast=json.loads((d/'audio-events-unverified.json').read_text('utf-8')) if (d/'audio-events-unverified.json').exists() else None
    asr=json.loads((d/'audio-small-unverified.json').read_text('utf-8')) if (d/'audio-small-unverified.json').exists() else None
    if u.get('audio_source_path'):
        ast=json.loads(src.with_suffix('.events.json').read_text('utf-8')) if src.with_suffix('.events.json').exists() else None
        asr=json.loads(src.with_suffix('.asr.json').read_text('utf-8')) if src.with_suffix('.asr.json').exists() else None
    reasons=[]
    if u.get('exclude_native_audio'):reasons.append('所选旧H3替代片原声含音乐风险，整轨排除')
    if not has:reasons.append('原片无音轨')
    if not ast:reasons.append('未完成机器音频事件筛查')
    if not asr:reasons.append('未完成ASR辅助筛查')
    if asr and asr.get('segments'):reasons.append('ASR检测到疑似人声，保守排除整条原声')
    if ast:
        for w in ast['windows']:
            if w['music']>=.05:reasons.append('音乐事件分值>=0.05')
            if any(v['label'] in ('Speech','Singing','Chant','Choir','Narration, monologue') and v['p']>=.08 for v in w['top']):reasons.append('人声事件风险')
    if not reasons:
        x=load(src)[round((u.get('audio_in',0) if u.get('audio_source_path') else u.get('source_in',0))*SR):][:n]
        x=np.pad(x,((0,max(0,n-len(x))),(0,0)))[:n]
        # Preserve quiet native sound without lifting its noise into an effect.
        gain=min(10**(5/20),10**(-28/20)/rms(x));x*=gain
        origin=str(src)+'；本镜新生成原声的选定区间，机器筛查未触发排除阈值，未据此宣称听审通过'
    else:
        rng=np.random.default_rng(sum(map(ord,sid))+20261117)
        if sid.startswith('A'):
            p=R.parent/'PV-H3-20261115-v2.1/sound/Rain-public-domain.ogg';raw=load(p)
            # Distinct contiguous ranges of the existing long rain recording.
            start=(sum(map(ord,sid))*977) % max(1,len(raw)-n);x=raw[start:start+n]
            x=np.pad(x,((0,max(0,n-len(x))),(0,0)))[:n];x=norm(x,-31)
            origin=str(p)+'；ジダネ Rain.ogg，Public domain / PD-self，既有干净雨声'
        else:
            raw=rng.normal(size=(n,2)).astype(np.float32)
            x=bandpass(raw,90,1500 if sid.startswith('B') else 850)
            t=np.arange(n)/SR; env=.8+.14*np.sin(t*.53)+.06*np.sin(t*.19+.7)
            x=norm(x*env[:,None],-36 if sid.startswith('B') else -39)
            origin='本地非音调随机噪声经带通与缓慢风量包络生成的风声；无振荡器、音符或节拍，不伪称现场录音'
    if len(x):
        t=np.arange(len(x))/SR;env=np.minimum(np.clip(t/.04,0,1),np.clip((dur-t)/.05,0,1));x*=env[:,None]
    return x,dict(id=sid,selected_source=origin,excluded_native_reasons=sorted(set(reasons)),human_listening='not claimed',added_bgm=False)

def normalize(u):
    sid=u['id'];src=Path(u.get('source_path',R/sid/'source.mp4'));out=E/f'{sid}.mp4';dur=u['edit_duration'];idx=next(i for i,x in enumerate(PLAN['units']) if x['id']==sid)
    prev_transition=OV.get(sid,('',0))[0] in ('light_match','focus_bridge');next_sid=PLAN['units'][idx+1]['id'] if idx+1<len(PLAN['units']) else 'TITLE'
    filt=u.get('pre_crop','')+'scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,setsar=1,fps=24,setpts=PTS-STARTPTS'
    clauses=[]
    weights=[]
    if prev_transition:
        clauses.append('lt(t,0.25)');weights.append('(1-min(1,max(0,T/0.25)))')
    if OV.get(next_sid,('',0))[0] in ('light_match','focus_bridge'):
        clauses.append(f'gt(t,{dur-.25})');weights.append(f'min(1,max(0,(T-{dur-.25})/0.25))')
    if clauses:
        enable='+'.join(clauses);w=weights[0] if len(weights)==1 else 'max('+','.join(weights)+')'
        filt+=f",split[sharp][soft];[soft]gblur=sigma=8:steps=2:enable='{enable}'[blurred];[sharp][blurred]blend=all_expr='A*(1-({w}))+B*({w})':enable='{enable}'"
    run([FF,'-y','-v','error','-ss',u.get('source_in',0),'-i',src,'-t',dur,'-an','-vf',filt,'-frames:v',round(dur*24),'-c:v','libx264','-threads','2','-preset','fast','-crf','18','-pix_fmt','yuv420p',out])
    return out

def concat(files,out):
    ls=out.with_suffix('.concat.txt');ls.write_text('\n'.join("file '"+p.as_posix()+"'" for p in files),'utf-8')
    run([FF,'-y','-v','error','-f','concat','-safe','0','-i',ls,'-c','copy',out]);return out

def main():
    units=PLAN['units'];assert all((R/u['id']/'source.mp4').exists() for u in units)
    (E/'title.txt').write_text('逆转五丈原','utf-8')
    vf="drawtext=fontfile='C\\:/Windows/Fonts/simkai.ttf':textfile='title.txt':fontcolor=0xDDD8D0:fontsize=82:x=(w-tw)/2:y=(h-th)/2:alpha='if(lt(t,0.45),t/0.45,if(lt(t,4.3),1,max(0,(5-t)/0.7)))'"
    title=E/'TITLE.mp4'
    run([FF,'-y','-v','error','-f','lavfi','-i','color=c=black:s=1280x720:r=24:d=5','-vf',vf,'-an','-c:v','libx264','-threads','2','-preset','fast','-crf','18','-pix_fmt','yuv420p',title],cwd=E)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:files=list(pool.map(normalize,units))
    rows=[];end=0;groups=[];cur=[];current_len=0
    for u,p in zip(units,files):
        overlap=OV.get(u['id'],('',0))[1]
        start=end-overlap;end=start+u['edit_duration']
        rows.append(dict(id=u['id'],source=str(u.get('source_path',R/u['id']/'source.mp4')),source_in=u.get('source_in',0),source_out=u.get('source_in',0)+u['edit_duration'],timeline_in=start,timeline_out=end,speed=1,pre_crop=u.get('pre_crop'),selection_reason=u.get('selection_reason'),transition_in=OV.get(u['id'],('hard_cut',0))))
        if u['id'] in OV and cur:
            groups.append((concat(cur,E/f'group{len(groups)}.mp4'),current_len));cur=[];current_len=0
        cur.append(p);current_len+=u['edit_duration']
    if cur:groups.append((concat(cur,E/f'group{len(groups)}.mp4'),current_len))
    groups.append((title,5))
    # H01 | A01..A03 | B01..C03 | D01..D02 | title.
    assert len(groups)==5
    merged=groups[0][0];length=groups[0][1];seams=[]
    for i,(p,dur) in enumerate(groups[1:],1):
        trans='custom' if i<=2 else 'fadeblack';dest=E/f'merged-{i}.mp4';offset=length-.25
        expr=":expr='if(gte(P,0.5),A,B)'" if i<=2 else ''
        run([FF,'-y','-v','error','-i',merged,'-i',p,'-filter_complex_threads','1','-filter_complex',f'[0:v]settb=AVTB,setpts=PTS-STARTPTS[a];[1:v]settb=AVTB,setpts=PTS-STARTPTS[b];[a][b]xfade=transition={trans}:duration=0.25:offset={offset}{expr},format=yuv420p[v]','-map','[v]','-an','-c:v','libx264','-threads','3','-preset','fast','-crf','18',dest],timeout=600)
        seams.append(dict(at=offset,transition=trans,duration=.25));merged=dest;length+=dur-.25
    mix=np.zeros((round(length*SR),2),np.float32);provenance=[]
    for u,row in zip(units,rows):
        x,prov=audio(u);start=round(row['timeline_in']*SR);count=min(len(x),len(mix)-start)
        # At the three scene overlaps, only sound with a causal source in each scene remains.
        if row['id'] in OV and count:
            x[:min(count,round(.25*SR))]*=np.linspace(0,1,min(count,round(.25*SR)))[:,None]
        mix[start:start+count]+=x[:count];provenance.append(prov)
    # One non-tonal contact at the implied cut from released hand to grounded blade.
    cut=next(r['timeline_in'] for r in rows if r['id']=='B02');rng=np.random.default_rng(876)
    n=round(.13*SR);t=np.arange(n)/SR;hit=rng.normal(size=(n,2))*np.exp(-t[:,None]*35)
    hit=norm(bandpass(hit,120,2300),-25)
    start=round(cut*SR);mix[start:start+n]+=hit
    # Let the last environmental breath/tail finish into the title only when native is retained.
    peak=max(1e-8,float(np.max(np.abs(mix))));mix*=min(1,.78/peak)
    wav=E/'mix.wav';run([FF,'-y','-v','error','-f','f32le','-ar',SR,'-ac','2','-i','pipe:0','-c:a','pcm_s24le',wav],input=mix.astype('<f4').tobytes())
    out=R/'三国遗憾-PV-v2-电影转场版.mp4'
    run([FF,'-y','-v','error','-i',merged,'-i',wav,'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','192k','-t',length,'-movflags','+faststart',out])
    run([FF,'-v','error','-i',out,'-f','null','-'],timeout=240)
    m=probe(out);v=next(s for s in m['streams'] if s['codec_type']=='video');a=next(s for s in m['streams'] if s['codec_type']=='audio')
    assert int(v['nb_frames'])==round(length*24),(v['nb_frames'],length)
    assert abs(float(a['duration'])-length)<.05
    save(R/'edit-timeline.json',dict(duration=length,output=[1280,720,24],shots=rows,seams=seams,title=dict(timeline_in=length-5,timeline_out=length),no_repeated_footage=True,no_speed_change=True,user_review='待review'))
    save(R/'audio-provenance.json',dict(added_bgm=False,new_dialogue=False,native_screening_only=True,human_listening='not claimed',shots=provenance,blade_contact='本地带通短噪声冲击，0.13秒单次落泥接触，无音调',note='机器筛查不等于全片听审；有风险整条原声排除，不用音乐分离残留冒充无BGM'))
    save(R/'final-technical.json',dict(file=str(out),duration=length,frames=int(v['nb_frames']),full_decode='pass',native_sources={u['id']:source_summary(u) for u in units},output_metadata=m,sha256=hashlib.sha256(out.read_bytes()).hexdigest(),user_review='待review'))
    run([FF,'-y','-v','error','-i',out,'-vf','fps=1/3,scale=320:180,tile=5x5','-frames:v','1','-update','1',R/'final-contact.jpg'])
    for i,s in enumerate(seams):
        run([FF,'-y','-v','error','-ss',max(0,s['at']-.25),'-i',out,'-t','0.75','-vf','fps=16,scale=320:180,tile=4x3','-frames:v','1','-update','1',R/f'seam-{i+1}.jpg'])
    print(json.dumps(dict(file=str(out),seconds=length,frames=int(v['nb_frames'])),ensure_ascii=False))

if __name__=='__main__':main()
