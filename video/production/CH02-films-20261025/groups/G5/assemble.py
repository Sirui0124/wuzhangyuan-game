from pathlib import Path
import json,sys,subprocess,hashlib,textwrap
from PIL import Image,ImageDraw,ImageFont
OUT=Path(__file__).parent
sys.path.insert(0,str(OUT))
from run_pipeline import FF,read,save,metadata
def run(args):subprocess.run([str(FF),'-v','error','-y']+args,check=True)
def make_panel(c,n,row):
    folder=OUT/'edited'/'text-layers';folder.mkdir(parents=True,exist_ok=True)
    path=folder/f'{c["id"]}-{n:02d}.png'
    # Accurate post text, intentionally a readable letter insert, never claimed as model handwriting.
    im=Image.new('RGBA',(1280,720),(0,0,0,0));d=ImageDraw.Draw(im)
    font=ImageFont.truetype('C:/Windows/Fonts/simkai.ttf',38 if row.get('fullFrame') else 34 if not row.get('signature') else 38)
    lines=[]
    for paragraph in row['text'].split('\n'):
        while len(paragraph)>26:
            stops=[i+1 for i,ch in enumerate(paragraph[:26]) if ch in '，。；、' and i>=8]
            cut=stops[-1] if stops else min(22,len(paragraph))
            lines.append(paragraph[:cut]);paragraph=paragraph[cut:]
        lines.append(paragraph)
    if row.get('fullFrame'):
        import numpy as np
        rng=np.random.default_rng(525);noise=rng.normal(0,1.2,(720,1280,1))
        pixels=np.clip(np.array([218,207,180])[None,None,:]+noise,0,255).astype('uint8')
        im=Image.fromarray(pixels,'RGB').convert('RGBA');d=ImageDraw.Draw(im)
        d.rectangle((55,45,1225,675),outline=(92,74,47,150),width=2)
        top=(720-len(lines)*65)/2-12
        for i,line in enumerate(lines):
            bbox=d.textbbox((0,0),line,font=font);w=bbox[2]-bbox[0];x=(1280-w)/2;y=top+i*65
            d.text((x,y),line,font=font,fill=(45,37,27,255))
            if row.get('strike') and i==row.get('strikeLine',i):d.line((x,y+26,x+w,y+26),fill=(45,37,27,255),width=3)
        im.save(path);return path
    height=max(150,72+len(lines)*50);top=720-height-45
    d.rounded_rectangle((120,top,1160,675),radius=8,fill=(224,214,190,245),outline=(79,68,54,240),width=2)
    for i,line in enumerate(lines):
        bbox=d.textbbox((0,0),line,font=font);w=bbox[2]-bbox[0];x=(1280-w)/2;y=top+35+i*50
        d.text((x,y),line,font=font,fill=(39,35,28,255))
        if row.get('strike'):d.line((x,y+22,x+w,y+22),fill=(42,33,24,255),width=3)
    im.save(path);return path
def edit(c):
    id=c['id'];decisions=read(OUT/'review'/'decisions.json') if (OUT/'review'/'decisions.json').exists() else {}
    decision=decisions.get(id,{})
    if decision.get('visualReview') not in ('candidate-pass','candidate-pass-with-limits','review-candidate-with-issues'):return None
    source_id=decision.get('sourceId',id);src=Path(decision['sourceFile']) if decision.get('sourceFile') else OUT/'generated'/f'{source_id}-16x9.mp4'
    if not src.exists():return None
    recipe=hashlib.sha256(json.dumps(dict(decision=decision,postVoiceLines=c.get('postVoiceLines',[]),post=c.get('post',[])),ensure_ascii=False,sort_keys=True).encode()).hexdigest()[:10]
    dest=OUT/'edited'/f'{id}-final-{recipe}.mp4';dest.parent.mkdir(exist_ok=True)
    voices=read(OUT.parents[1]/'voice'/'manifest.json').get('rows',{})
    post=[voices.get(x['node'],{}) for x in c.get('postVoiceLines',[])]
    if not all(x.get('ready') and Path(x.get('path','')).is_file() for x in post):return None
    expected_duration=1+sum(x['duration'] for x in post)+.4*max(0,len(post)-1)
    source_duration=metadata(src)['duration']
    trim=decision.get('trim');trim_duration=(trim[1]-trim[0]) if trim else source_duration
    if expected_duration>trim_duration and post:raise RuntimeError(f'{id}: central voice longer than adopted visual')
    inputs=(['-ss',str(trim[0]),'-t',str(trim_duration)] if trim else [])+['-i',str(src)]
    spatial=decision.get('spatialCrop')
    crop=f'crop={spatial[2]}:{spatial[3]}:{spatial[0]}:{spatial[1]},' if spatial else ''
    filters=[f'[0:v]{crop}scale=1280:720,setsar=1[v0]'];vname='v0';index=1
    post_rows=decision.get('postOverride',c.get('post',[]))
    for n,row in enumerate(post_rows):
        panel=make_panel(c,n,row);inputs+=['-loop','1','-i',str(panel)]
        vn=f'v{n+1}';filters.append(f'[{vname}][{index}:v]overlay=0:0:enable=\'between(t,{row["start"]},{row["end"]})\'[{vn}]');vname=vn;index+=1
    voice_records=[];delay=1
    for x in post:
        inputs+=['-i',x['path']];an=f'voice{index}'
        filters.append(f'[{index}:a]aresample=48000,adelay={int(delay*1000)}:all=1[{an}]')
        voice_records.append(dict(node=x['node'],file=x['path'],start=delay,end=delay+x['duration']))
        delay+=x['duration']+.4;index+=1
    aname='0:a'
    if post:
        filters.append('[0:a]volume=0.65[bed]')
        labels=''.join(f'[voice{index-len(post)+n}]' for n in range(len(post)))
        filters.append(f'[bed]{labels}amix=inputs={1+len(post)}:duration=first:normalize=0:dropout_transition=0[aout]');aname='aout'
    args=inputs+['-filter_complex',';'.join(filters),'-map',f'[{vname}]','-map',f'[{aname}]' if post else aname,'-t',str(trim_duration),'-r','24','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-movflags','+faststart',str(dest)]
    if not dest.exists():
        pending=dest.with_name(dest.stem+'.pending.mp4');args[-1]=str(pending);run(args)
        check_pending=subprocess.run([str(FF),'-v','error','-i',str(pending),'-f','null','NUL'],capture_output=True)
        if check_pending.returncode:raise RuntimeError(f'{id}: pending decode failed')
        pending.replace(dest)
    decode=subprocess.run([str(FF),'-v','error','-i',str(dest),'-f','null','NUL'],capture_output=True)
    if decode.returncode:raise RuntimeError(f'{id}: final decode failed')
    result=dict(id=id,sourceId=source_id,source=str(src.resolve()),file=str(dest.resolve()),postVoice=voice_records,textLayers=post_rows,trim=trim,spatialCrop=spatial,reuse=decision.get('reuse'),visualReview=decision['visualReview'],visualIssues=decision.get('visualIssues',[]),audioIssues=decision.get('audioIssues',['未逐字听审']),metadata=metadata(dest),decode='passed',audioListening='未逐字听审',userReview='待review')
    save(dest.with_suffix('.json'),result);return result
def assemble(plan):
    slots=[]
    for slot in dict.fromkeys(c['slot'] for c in plan):
        override_file=OUT/'review/slot-picture-overrides.json'
        overrides=read(override_file) if override_file.exists() else {}
        if slot in overrides and Path(overrides[slot]['file']).exists():
            slots.append(overrides[slot]);continue
        subset=[c for c in plan if c['slot']==slot];edited=[]
        for c in subset:
            r=edit(c)
            if r:edited.append(r)
        if len(edited)!=len(subset):continue
        directory=OUT/'assembled';directory.mkdir(exist_ok=True)
        playlist=directory/f'{slot}.concat.txt';playlist.write_text('\n'.join("file '"+x['file'].replace('\\','/').replace("'","'\\''")+"'" for x in edited),encoding='utf-8')
        version=hashlib.sha256('|'.join(x['file'] for x in edited).encode()).hexdigest()[:10]
        target=directory/f'{slot}-{version}-cfr24.mp4'
        if not target.exists():
            pending=target.with_name(target.stem+'.pending.mp4')
            run(['-f','concat','-safe','0','-i',str(playlist),'-vf','fps=24,setsar=1','-r','24','-fps_mode','cfr','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-movflags','+faststart',str(pending)])
            check_pending=subprocess.run([str(FF),'-v','error','-i',str(pending),'-f','null','NUL'],capture_output=True)
            if check_pending.returncode:raise RuntimeError(f'{slot}: pending decode failed')
            pending.replace(target)
        check=subprocess.run([str(FF),'-v','error','-i',str(target),'-f','null','NUL'],capture_output=True)
        issues=[dict(id=x['id'],issues=x['visualIssues']) for x in edited if x['visualIssues']]
        known=[x['id'] for x in edited if x['visualReview']=='review-candidate-with-issues']
        slots.append(dict(id=slot,file=str(target.resolve()),children=[x['id'] for x in subset],sources=edited,nodes=[n for c in subset for n in c['nodes']],metadata=metadata(target),decode='passed' if not check.returncode else 'failed',sha256=hashlib.sha256(target.read_bytes()).hexdigest(),entry=subset[0]['entry'],next=subset[-1]['next'],visualReview='review-candidate-with-issues' if known else 'candidate-pass-with-limits',visualIssues=issues,userReview='待review',audioIssues=['未逐字听审，留待统一配音','原声可能有错词、额外人声或音乐，不能据技术检查声称通过'],dynamicReview='详见review/decisions.json中逐片实际范围',unresolved=['未逐字听审；不因此阻塞画面交付']+(['关键画面尚有明确遗留：'+','.join(known)] if known else [])))
        # Publish only completed/decode-checked slots; retain all old paths as history.
        existing=read(OUT/'delivery.json') if (OUT/'delivery.json').exists() else {}
        prior=[x for x in existing.get('assembled',[]) if x['id']!=slot]
        existing.update(group='G5',assembled=prior+[slots[-1]],reviewStatus='待review',incremental=True)
        save(OUT/'delivery.json',existing)
        print(slot,'assembled',str(target),flush=True)
    return slots
if __name__=='__main__':
    plan=read(OUT/'plan.json')['clips'];slots=assemble(plan)
    decisions=read(OUT/'review'/'decisions.json') if (OUT/'review'/'decisions.json').exists() else {}
    rows=[]
    for c in plan:
        task=OUT/'tasks'/f'{c["id"]}.json';state=read(task) if task.exists() else {}
        rows.append(dict(id=c['id'],slot=c['slot'],nodes=c['nodes'],task_id=state.get('task_id'),task_status=state.get('status','unsubmitted'),raw=str((OUT/'generated'/f'{c["id"]}-raw.mp4').resolve()) if (OUT/'generated'/f'{c["id"]}-raw.mp4').exists() else None,decision=decisions.get(c['id'],{'visualReview':'pending'})))
    delivered=[n for x in slots for n in x['nodes']];expected=[n for c in plan for n in c['nodes']]
    report=dict(group='G5',title='共同补救与归途',sourceSlots=7,plannedRequests=len(plan),assembled=slots,sourceCoverage={'planned':expected,'delivered':delivered,'missing':[n for n in expected if n not in delivered]},clips=rows,unassembled=[s for s in dict.fromkeys(c['slot'] for c in plan) if s not in [x['id'] for x in slots]],scope='仅制作候选，不改游戏、在线表或其他组',reviewStatus='待review',audioPolicy='按用户最新纠正：音频问题独立记录，不因纯音频重拍；未新增TTS')
    save(OUT/'delivery.json',report)
