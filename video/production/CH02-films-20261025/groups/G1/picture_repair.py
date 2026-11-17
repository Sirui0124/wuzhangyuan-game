"""Local picture ownership repair. No API/TTS, immutable previous movies."""
from pathlib import Path
import json,subprocess,hashlib,math,sys,re,copy
O=Path(__file__).resolve().parent;B=O.parents[1]
F='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
P=O/'edited/picture-v2';P.mkdir(exist_ok=True)
def rd(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def wr(p,x):p.parent.mkdir(exist_ok=True,parents=True);p.write_text(json.dumps(x,ensure_ascii=False,indent=2),encoding='utf-8')
def run(a):subprocess.run([F,'-v','error','-y']+a,check=True)
def dur(p):
    s=subprocess.run([F,'-hide_banner','-i',str(p)],capture_output=True,text=True,encoding='utf-8',errors='replace').stderr;m=re.search(r'Duration: (\d+):(\d+):([\d.]+)',s);return int(m[1])*3600+int(m[2])*60+float(m[3])
voice=rd(B/'voice/manifest.json')['rows'];plan=rd(O/'plan.json');byid={x['id']:x for x in plan['clips']}
closed=O/'edited/L01-01-usable-window.mp4'
def listener(cid,lines,duration):
    dest=P/f'{cid}-listener.mp4';args=['-i',str(closed)];fs=[];on=.3;cues=[]
    for i,x in enumerate(lines):
        v=voice[x['node']];assert on+v['duration']<duration+.02
        args+=['-i',v['path']];fs.append(f'[{i+1}:a]adelay={round(on*1000)}:all=1[v{i}]');cues.append(dict(node=x['node'],speaker=x['speaker'],text=x['text'],centralPath=v['path'],centralSha256=v['sha256'],slotStart=on,slotEnd=on+v['duration']));on+=v['duration']+.22
    fs.append(''.join(f'[v{i}]' for i in range(len(lines)))+f'amix=inputs={len(lines)}:normalize=0:duration=longest,apad,atrim=duration={duration}[a]')
    vf=f'tpad=stop_mode=clone:stop_duration={max(0,duration-6)+.1},trim=duration={duration},setpts=PTS-STARTPTS'
    run(args+['-filter_complex',';'.join(fs),'-vf',vf,'-map','0:v','-map','[a]','-c:v','libx264','-crf','18','-preset','fast','-r','24','-pix_fmt','yuv420p','-c:a','aac','-ar','48000','-movflags','+faststart',str(dest)])
    return dict(id=cid,path=str(dest),duration=duration,centralVoiceCues=cues,sourcePath=str(closed),sourceSha256=hashlib.sha256(closed.read_bytes()).hexdigest(),method='verified closed-mouth source plays once then last frame holds; original player WAV only; no NPC mouth/voice in player phase')
def cut(src,cid,a,b):
    p=P/f'{cid}.mp4';run(['-ss',str(a),'-to',str(b),'-i',str(src),'-c:v','libx264','-crf','18','-preset','fast','-r','24','-c:a','aac','-ar','48000',str(p)]);return dict(id=cid,path=str(p),duration=dur(p),sourcePath=str(src),sourceIntervals=[[a,b]],sourceSha256=hashlib.sha256(Path(src).read_bytes()).hexdigest(),centralVoiceCues=[])
def mixed(c,source):
    npc=[x for x in c['sourceLines'] if not x['speaker'].startswith('我') and x['speaker']!='演出' and any('\u4e00'<=z<='\u9fff' for z in x['text'])];total=sum(len(x['text']) for x in npc);n=dur(source);used=0;parts=[];player=[]
    def flush():
        nonlocal player
        if player:
            length=.6+sum(voice[x['node']]['duration']+.22 for x in player);parts.append(listener(c['id']+f'-player{len(parts)}',player,math.ceil(length*24)/24));player=[]
    for x in c['sourceLines']:
        if x['speaker'].startswith('我'):player.append(x);continue
        flush()
        if x in npc:
            end=n if x is npc[-1] else n*(used+len(x['text']))/total
            start=n*used/total;parts.append(cut(source,c['id']+f'-npc{len(parts)}',round(start*24)/24,round(end*24)/24));used+=len(x['text'])
    flush();return parts
def assemble(sid,parts):
    old=rd(O/'assembled'/f'{sid}-assembly.json');archive=O/'archive/picture-pass-v1'/f'{sid}-assembly.json'
    if not archive.exists():wr(archive,old)
    folder=O/'assembled/picture-v2';folder.mkdir(exist_ok=True);out=folder/f'{sid}-{old["name"]}_画面修正V2.mp4';listing=P/f'{sid}.concat.txt'
    listing.write_text(''.join("file '"+Path(x['path']).as_posix()+"'\n" for x in parts),encoding='utf-8')
    run(['-f','concat','-safe','0','-i',str(listing),'-c:v','libx264','-crf','18','-preset','fast','-r','24','-c:a','aac','-ar','48000','-movflags','+faststart',str(out)])
    if sid=='V02':
        # This custom slot's six existing WAVs were mixed at slot level, not in parts.
        mux=out.with_name(out.stem+'-mux.mp4');run(['-i',str(out),'-i',old['path'],'-map','0:v','-map','1:a','-c','copy','-movflags','+faststart',str(mux)]);mux.replace(out)
    run(['-i',str(out),'-f','null','NUL']);elapsed=0;cues=[];sub=[]
    for x in parts:
        dt=dur(x['path']);z=copy.deepcopy(x);z.update(slotStart=elapsed,slotEnd=elapsed+dt);z['review']=dict(visualReview='pending final dynamic check',actualDynamicReview=False,sourcePath=x.get('sourcePath'),sourceSha256=x.get('sourceSha256'),findings=x.get('method','source phase preserved'),audioIssues=['NPC临时音轨逐字/音色/BGM未审；我的阶段仅原玩家音轨和闭口倾听画面。'])
        for q in x.get('centralVoiceCues',[]):cues.append({**q,'slotStart':q['slotStart']+elapsed,'slotEnd':q['slotEnd']+elapsed})
        sub.append(z);elapsed+=dt
    a={**old,'path':str(out),'duration':dur(out),'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'subclips':sub,'centralVoiceCues':cues,'previousFile':old['path'],'previousSha256':old['sha256'],'visualReview':'pending final dynamic review','decode':'passed','pictureRevision':2,'audioIssues':['既有玩家音轨按角色独立排时，无新TTS。NPC原音保留；错词、音色、BGM或声口不同步仅列音频问题。']}
    if sid=='V02':a['centralVoiceCues']=old['centralVoiceCues']
    wr(folder/f'{sid}-assembly.pending.json',a);return a
def expand():
    replace={'V02-question','V03B-01','V04-02','V04-05','V09-01'}
    mixed_ids={'V08A-02','V08B-01','V10-01','V10-03','V10-04','V10-05'}
    outputs=[]
    for sid in ['V02','V03B','V04','V08A','V08B','V09','V10']:
        if len(sys.argv)>2 and sid not in sys.argv[2:]:continue
        old=rd(O/'assembled'/f'{sid}-assembly.json');parts=[]
        for x in old['subclips']:
            cid=x['id']
            if cid in replace:
                length=dur(x['path']);parts.append(listener(cid,byid['V02-06' if cid=='V02-question' else cid]['sourceLines'],length))
            elif cid in mixed_ids:parts+=mixed(byid[cid],x['path'])
            else:
                cues=[{**q,'slotStart':q['slotStart']-x['slotStart'],'slotEnd':q['slotEnd']-x['slotStart']} for q in old.get('centralVoiceCues',[]) if x['slotStart']<=q['slotStart']<x['slotEnd']]
                parts.append({**x,'duration':dur(x['path']),'centralVoiceCues':cues})
        a=assemble(sid,parts);outputs.append(dict(id=sid,path=a['path'],duration=a['duration']));print(sid,a['duration'],flush=True)
    wr(P/'expanded-candidates.json',outputs)
if __name__=='__main__':
    if sys.argv[1]=='pilot':
        a=rd(O/'assembled/V03B-assembly.json');x=listener('V03B-01',byid['V03B-01']['sourceLines'],6.59);wr(P/'V03B-pilot.json',x);print(x['path'])
    elif sys.argv[1]=='expand':expand()
