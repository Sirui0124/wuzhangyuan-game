"""Assemble only within one frozen V slot; central player voice on silent takes."""
from pathlib import Path
import json,subprocess,re,hashlib,math,sys
OUT=Path(__file__).resolve().parent;BASE=OUT.parents[1]
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,x):p.parent.mkdir(exist_ok=True,parents=True);p.write_text(json.dumps(x,ensure_ascii=False,indent=2),encoding='utf-8')
def run(args):return subprocess.run([FF,'-v','error','-y']+args,check=True,capture_output=True)
def duration(p):
    r=subprocess.run([FF,'-hide_banner','-i',str(p)],capture_output=True,text=True,encoding='utf-8',errors='replace').stderr
    m=re.search(r'Duration: (\d+):(\d+):([\d.]+)',r);return int(m[1])*3600+int(m[2])*60+float(m[3])
def silence_boundary(p,target,total):
    r=subprocess.run([FF,'-hide_banner','-i',str(p),'-af','silencedetect=noise=-35dB:d=0.10','-f','null','NUL'],capture_output=True,text=True,encoding='utf-8',errors='replace').stderr
    spans=re.findall(r'silence_end: ([\d.]+) \| silence_duration: ([\d.]+)',r)
    ends=[float(a)-float(b)/2 for a,b in spans if .2<float(a)-float(b)/2<total-.2]
    near=min(ends,key=lambda x:abs(x-target)) if ends else target
    if abs(near-target)>1.5:near=target
    return near
plan=read(OUT/'plan.json');voice=read(BASE/'voice'/'manifest.json')['rows'];selected=set(sys.argv[1:]);review=read(OUT/'review'/'decisions.json') if (OUT/'review'/'decisions.json').exists() else {}
overrides=read(OUT/'slot-overrides.json') if (OUT/'slot-overrides.json').exists() else {}
additions=read(OUT/'slot-additions.json') if (OUT/'slot-additions.json').exists() else {}
repairs={c['id']:c for c in read(OUT/'repair-plan.json')['clips']} if (OUT/'repair-plan.json').exists() else {}
results=[]
for sl in plan['slots']:
    sid=sl['id']
    if selected and sid not in selected:continue
    cs=[c for c in plan['clips'] if c['slot']==sid];ready=True;files=[];cues=[];parts=[];elapsed=0
    cs += [repairs[cid] for cid in additions.get(sid,[])]
    if sid in overrides:
        ov=overrides[sid];cs=[dict(id=ov['id'],name=cs[0]['name'],sourceLines=[],audioMode='reused-native-source')]
        review[ov['id']]={**ov,'adoptedPath':ov['path']}
    # Find repeated central node splits once. Exact original samples are retained.
    occurrence={}
    for c in cs:
        for x in c['sourceLines']:
            if x['speaker'].startswith('我'):occurrence.setdefault(x['node'],[]).append((c['id'],x))
    voice_parts={}
    for node,occ in occurrence.items():
        row=voice[node];total=row['duration'];prev=0;chars=0
        for j,(cid,x) in enumerate(occ):
            chars+=len(x['text']);end=total if j==len(occ)-1 else silence_boundary(row['path'],total*chars/len(row['text']),total)
            voice_parts[(cid,node)]=(prev,end);prev=end
    for c in cs:
        cid=c['id'];d=review.get(cid,{});p=Path(d.get('adoptedPath',OUT/'edited'/f'{cid}-normalized.mp4'))
        if not p.exists():ready=False;break
        trim=d.get('trim');actual=duration(p)
        if trim:
            cropped=OUT/'edited'/f'{cid}-review-trim.mp4'
            if not cropped.exists():run(['-ss',str(trim[0]),'-to',str(trim[1]),'-i',str(p),'-c:v','libx264','-crf','18','-preset','fast','-c:a','aac','-ar','48000','-movflags','+faststart',str(cropped)])
            p=cropped;actual=duration(p)
        # Add fixed player voice only here; NPC native source audio is untouched.
        player=[] if c['audioMode']=='mixed-picture-audio-pending' else [x for x in c['sourceLines'] if x['speaker'].startswith('我')]
        if player:
            args=['-i',str(p)];filters=['[0:a]volume=0[env]'];tracks=['[env]'];onset=3.0 if cid=='V02-05' else .30
            for j,x in enumerate(player):
                row=voice[x['node']];a,b=voice_parts[(cid,x['node'])];length=b-a
                if onset+length>actual-.10:raise RuntimeError(f'Voice does not fit {cid}: {onset+length}>{actual}')
                args+=['-i',row['path']];filters.append(f'[{j+1}:a]atrim=start={a}:end={b},asetpts=PTS-STARTPTS,aresample=48000,adelay={round(onset*1000)}:all=1[v{j}]');tracks.append(f'[v{j}]')
                cues.append(dict(node=x['node'],speaker=x['speaker'],text=x['text'],centralPath=row['path'],centralSha256=row['sha256'],sourceAudioStart=a,sourceAudioEnd=b,slotStart=elapsed+onset,slotEnd=elapsed+onset+length,subclip=cid));onset+=length+.22
            filters.append(''.join(tracks)+f'amix=inputs={len(tracks)}:duration=first:normalize=0:dropout_transition=0[a]')
            dest=OUT/'edited'/f'{cid}-voiced.mp4';args+=['-filter_complex',';'.join(filters),'-map','0:v','-map','[a]','-c:v','copy','-c:a','aac','-b:a','192k','-ar','48000','-movflags','+faststart',str(dest)];run(args);p=dest
        files.append(p);parts.append(dict(id=cid,path=str(p),slotStart=elapsed,slotEnd=elapsed+actual,sourceTrim=trim or [0,actual],audioMode=c['audioMode'],review=d or {'status':'pending'}));elapsed+=actual
    if not ready:continue
    folder=OUT/'assembled';folder.mkdir(exist_ok=True);name=next(c['name'] for c in cs);target=folder/f'{sid}-{name}.mp4';listing=folder/f'{sid}.concat.txt'
    listing.write_text(''.join("file '"+p.as_posix().replace("'","'\\''")+"'\n" for p in files),encoding='utf-8')
    run(['-f','concat','-safe','0','-i',str(listing),'-c','copy','-movflags','+faststart',str(target)])
    run(['-i',str(target),'-f','null','NUL'])
    result=dict(id=sid,name=name,path=str(target),duration=duration(target),size=[1280,720],fps=24,audioRate=48000,entry=sl['entry'],next=sl['next'],endEvent=sl['endEvent'],subclips=parts,centralVoiceCues=cues,sha256=hashlib.sha256(target.read_bytes()).hexdigest(),decode='passed',userReview='待review',listeningReview='未完成逐字听审',visualReview='见review/decisions.json；未审项保留pending')
    result['audioIssues']=['未完成逐字听审；NPC原声的错词、音色或音乐仅标记，不触发重拍。']+(['玩家纯画面段已复用中央既有音轨；生成原音轨静音以避免制作说明/额外人声混入，环境声待统一配音阶段恢复。'] if cues else [])
    if any(c['audioMode']=='mixed-picture-audio-pending' for c in cs):result['audioIssues'].append('混合对白段当前保留生成原音，玩家画外原句完整列于plan和分镜；暂不混入以免覆盖NPC，留统一配音阶段。')
    save(folder/f'{sid}-assembly.json',result);results.append(result);print(json.dumps(dict(id=sid,duration=result['duration'],file=str(target)),ensure_ascii=False),flush=True)
save(OUT/'assembly-index.json',results)
