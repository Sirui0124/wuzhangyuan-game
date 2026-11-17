"""Mix central, fixed player voice over silent-listener plates; preserve ambient track."""
from pathlib import Path
import json,subprocess,re,wave
OUT=Path(__file__).resolve().parent;BASE=OUT.parents[1]
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,d):p.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8')
plan=read(OUT/'plan.json');voice=read(BASE/'voice/manifest.json')['rows'];edited=OUT/'edited';edited.mkdir(exist_ok=True)
visual=read(OUT/'review/visual-adopted.json') if (OUT/'review/visual-adopted.json').exists() else {}
adopted=read(OUT/'review/adopted.json') if (OUT/'review/adopted.json').exists() else {}
splits=read(OUT/'review/voice-splits.json') if (OUT/'review/voice-splits.json').exists() else {}
for c in plan['requests']:
    if c['audioStrategy']!='central-voice-over-environment':continue
    p=Path(visual[c['id']]['path']) if c['id'] in visual else OUT/'generated'/f"{c['id']}-16x9.mp4"
    actual_duration=visual.get(c['id'],{}).get('duration',c['duration'])
    if not p.exists() or not all(n in voice and voice[n].get('ready') for n in c['centralVoiceNodes']):continue
    if c['id'] in ['V41E-03','V41E-04'] and 'CH2-LY07-BAD3' not in splits:
        print(c['id'],'requires verified semantic split',flush=True);continue
    dest=edited/f"{c['id']}-central-voice.mp4"
    if dest.exists():continue
    args=[FF,'-v','error','-y','-i',str(p)];filters=[];tracks=[];delay=.4
    if c['id']=='V40-06':delay=6
    records=[]
    for i,n in enumerate(dict.fromkeys(c['centralVoiceNodes']),start=1):
        row=voice[n];args+=['-i',row['path']];duration=row['duration'];start=0;end=duration
        if c['id']=='V41E-03':end=splits[n]['time']
        if c['id']=='V41E-04':start=splits[n]['time']
        effective=end-start
        if delay+effective>actual_duration-.1:raise RuntimeError(c['id']+': voice does not fit without cutting; revise before mix')
        filters.append(f'[{i}:a]atrim=start={start}:end={end},asetpts=PTS-STARTPTS,adelay={int(delay*1000)}|{int(delay*1000)}[v{i}]');tracks.append(f'[v{i}]')
        records.append(dict(node=n,source=row['path'],trim=[start,end],timelineStart=delay,duration=effective))
        delay+=effective+.45
    filters.append('[0:a]volume=0.68[amb]')
    filters.append('[amb]'+''.join(tracks)+f'amix=inputs={len(tracks)+1}:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.95[a]')
    args+=['-filter_complex',';'.join(filters),'-map','0:v','-map','[a]','-c:v','copy','-c:a','aac','-ar','48000','-b:a','192k','-movflags','+faststart',str(dest)]
    subprocess.run(args,check=True)
    dec=subprocess.run([FF,'-v','error','-i',str(dest),'-f','null','NUL'],capture_output=True)
    if dec.returncode:raise RuntimeError('Mixed file decode error')
    adopted[c['id']]=dict(path=str(dest),source=str(p),trim='none',operation='central fixed voice mixed over retained environmental audio',voices=records,decode='passed',audioReview='待逐字听审；原底片不得含额外人声',visualReview='继承底片审查，待合成复查')
    save(OUT/'review/adopted.json',adopted)
    print(json.dumps(dict(id=c['id'],mixed=str(dest),voices=records),ensure_ascii=False),flush=True)
