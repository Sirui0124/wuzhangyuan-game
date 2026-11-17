from pathlib import Path
import json,subprocess,hashlib,textwrap,re
from PIL import Image,ImageDraw,ImageFont
OUT=Path(__file__).parent
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,d):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8')
def run(a):subprocess.run([FF,'-v','error','-y',*a],check=True)
def panel(c,dec=None):
    dec=dec or {}
    D=OUT/'edited/overlays';D.mkdir(parents=True,exist_ok=True)
    files=[]
    if dec.get('knownTextPanel'):
        spec=dec['knownTextPanel'];im=Image.new('RGBA',(1280,720),(21,27,24,255));draw=ImageDraw.Draw(im)
        font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',31)
        draw.rounded_rectangle((65,125,1215,705),14,fill=(29,34,31,252),outline=(183,166,133,255),width=2)
        draw.text((110,190),spec['title'],font=font,fill=(239,231,208,255))
        for j,line in enumerate(textwrap.wrap(spec['text'],27)):
            draw.text((110,280+j*52),line,font=font,fill=(230,222,200,255))
        path=D/f'{c["id"]}-known-text.png';im.save(path)
        files.append(dict(path=path,start=spec['start'],end=spec['end']))
    if dec.get('knownReportPanel'):
        im=Image.new('RGBA',(1280,720),(21,27,24,255));draw=ImageDraw.Draw(im)
        font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',32)
        draw.rounded_rectangle((65,125,1215,705),14,fill=(29,34,31,252),outline=(183,166,133,255),width=2)
        draw.text((110,190),'缺额报告·已取得正文',font=font,fill=(239,231,208,255))
        for j,line in enumerate(['本村追加粮尚未征齐，实收不足，','无法按原数交付。']):
            draw.text((110,280+j*60),line,font=font,fill=(230,222,200,255))
        path=D/f'{c["id"]}-known-report.png';im.save(path)
        files.append(dict(path=path,start=0,end=3.95))
    if dec.get('evidencePanel'):
        im=Image.new('RGBA',(1280,720));draw=ImageDraw.Draw(im);font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',29);small=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',27)
        draw.rounded_rectangle((65,125,1215,705),14,fill=(29,34,31,252),outline=(183,166,133,255),width=2)
        draw.text((105,165),'本队签收',font=font,fill=(239,231,208,255));draw.text((685,165),'出仓交付',font=font,fill=(239,231,208,255))
        texts=['本队签收：列明批次、经手人、应交粮数和实际收到的粮数。','出仓交付：记有交给本队的实粮数；欠交的部分列在缺额栏。']
        for col,text in enumerate(texts):
            for j,line in enumerate(textwrap.wrap(text,15)):draw.text((105+col*580,225+j*45),line,font=small,fill=(230,222,200,255))
        path=D/f'{c["id"]}-comparison.png';im.save(path);files.append(dict(path=path,start=2.1,end=c['duration']))
    if c['kind']=='document':
        im=Image.new('RGBA',(1280,720));draw=ImageDraw.Draw(im)
        draw.rounded_rectangle((75,475,1205,690),14,fill=(23,27,26,235),outline=(194,180,147,200),width=2)
        font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',30)
        text=c['sourceLines'][0]['text'];lines=textwrap.wrap(text,34)
        for i,line in enumerate(lines):draw.text((105,495+i*43),line,font=font,fill=(239,231,208,255))
        path=D/f'{c["id"]}.png';im.save(path);files=[dict(path=path,start=2,end=c['duration']+dec.get('tailHold',0)-.02)]
    if c['kind']=='map':
        labels=['地方应征','实际征收','入仓','调拨发出','粮队领取']
        order=range(5) if c['part']=='forward' else range(4,-1,-1)
        for step,highlight in enumerate(order):
            im=Image.new('RGBA',(1280,720));draw=ImageDraw.Draw(im);font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',26)
            draw.rectangle((0,0,1280,720),fill=(19,24,23,235))
            draw.rounded_rectangle((65,230,1215,460),12,fill=(229,216,185,255))
            for i,label in enumerate(labels):
                x=90+i*223;draw.rounded_rectangle((x,310,x+190,380),8,fill=(68,78,69,255) if i==highlight else (203,190,159,255))
                draw.text((x+95,345),label,font=font,fill=(249,244,225,255) if i==highlight else (48,52,47,255),anchor='mm')
                if i<4:draw.text((x+205,345),'→',font=font,fill=(48,52,47,255),anchor='mm')
            path=D/f'{c["id"]}-{step}.png';im.save(path)
            # Keep generated pseudo labels hidden for the whole inspection phase.
            phaseStart=4 if c['part']=='forward' else 4.8
            phaseStep=(c['duration']-phaseStart)/5
            files.append(dict(path=path,start=phaseStart+step*phaseStep,end=phaseStart+(step+1)*phaseStep))
    return files
def edit(c):
    # Review decisions may trim only clean tails/heads, preserving dialogue and essential action.
    decision=read(OUT/'review/decisions.json') if (OUT/'review/decisions.json').exists() else {}
    dec=decision.get(c['id'],{})
    raw=OUT/'generated'/f'{dec.get("sourceClip",c["id"])}-raw.mp4'
    p=OUT/'edited'/f'{c["id"]}{dec.get("version","")}.mp4';p.parent.mkdir(exist_ok=True)
    if p.exists():return p
    if not raw.exists():return None
    if dec.get('reject'):return None
    start=dec.get('trimStart',0);end=dec.get('trimEnd',c['duration']);hold=dec.get('tailHold',0);dur=end-start+hold
    overlays=panel(c,dec);args=['-i',str(raw)]
    for overlay in overlays:args += ['-loop','1','-i',str(overlay['path'])]
    asrPath=OUT/'review'/c['id']/'asr.json';asr=read(asrPath) if asrPath.exists() else {}
    voice=c.get('voice') if dec.get('useAvailableVoice') or not asr.get('recognized','').strip() else None
    voice_index=1+len(overlays)
    if voice:args += ['-i',voice['path']]
    pad=f',tpad=stop_mode=clone:stop_duration={hold}' if hold else ''
    filt=[f'[0:v]trim=start={start}:end={end},setpts=PTS-STARTPTS,scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,setsar=1,fps=24{pad}[v0]']
    for i,o in enumerate(overlays):filt += [f'[v{i}][{i+1}:v]overlay=0:0:enable=\'between(t,{max(0,o["start"]-start)},{o["end"]-start})\'[v{i+1}]']
    if voice:
        offset=max(0,round(dec.get('voiceOffset',voice['offset']-start)*1000))
        volume=0 if dec.get('muteDuplicateSourceSpeech') else .8
        apad=f',apad=pad_dur={hold}' if hold else ''
        filt += [f'[0:a]atrim=start={start}:end={end},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,volume={volume}{apad}[amb]',f'[{voice_index}:a]aformat=sample_rates=48000:channel_layouts=stereo,adelay={offset}|{offset}[speech]','[amb][speech]amix=inputs=2:duration=first:normalize=0:dropout_transition=0,alimiter=limit=0.98[a]']
    else:filt+=[f'[0:a]atrim=start={start}:end={end},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo[a]']
    args+=['-filter_complex',';'.join(filt),'-map',f'[v{len(overlays)}]','-map','[a]','-t',str(dur),'-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-movflags','+faststart',str(p)]
    run(args)
    run(['-i',str(p),'-f','null','NUL'])
    save(p.with_suffix('.json'),dict(id=c['id'],source=str(raw.resolve()),trim=[start,end],tailHold=hold,voice=voice,availablePlayerVoice=c.get('voice'),overlaySource=[l for l in c['sourceLines'] if c['kind']=='document'],mapPart=c.get('part'),size=[1280,720],fps=24,sampleRate=48000,decode='passed',audioReview='未听审；音频问题不触发画面重拍',audioIssues=asr.get('recognized') if asr.get('flag')=='check_dialogue' else None,visualReview=dec.get('review','pending')))
    return p
def main():
    plan=read(OUT/'plan.json');outputs={c['id']:edit(c) for c in plan['clips']}
    deliveries=[];D=OUT/'assembled';D.mkdir(exist_ok=True)
    for parent in plan['parents']:
        ids=parent['children'];files=[outputs[i] for i in ids]
        record=dict(**parent,subclips=ids,status='incomplete',file=None)
        if all(files):
            revisions=[int(n) for f in files for n in re.findall(r'-R(\d+)',f.stem)]
            suffix=f'-R{max(revisions)}' if revisions else ''
            target=D/f'{parent["id"]}-{parent["name"]}{suffix}.mp4';concat=D/f'{parent["id"]}-concat.txt'
            concat.write_text('\n'.join("file '"+str(p.resolve()).replace('\\','/')+"'" for p in files),encoding='utf-8')
            if not target.exists():
                run(['-f','concat','-safe','0','-i',str(concat),'-c','copy','-movflags','+faststart',str(target)])
                run(['-i',str(target),'-f','null','NUL'])
            record.update(status='candidate_pending_review',file=str(target.resolve()),decode='passed',size=[1280,720],fps=24,audioHz=48000,sha256=hashlib.sha256(target.read_bytes()).hexdigest())
        deliveries.append(record)
    original=read(OUT/'assignment.json');nodes={l['node'] for v in original['clips'] for l in v['lines']};planned={l['node'] for c in plan['clips'] for l in c['sourceLines']}
    save(OUT/'delivery.json',dict(group='G2',status='制作候选待用户review',sourceSlots=12,sourceNodes=len(nodes),plannedNodeCoverageComplete=nodes==planned,coverageComplete=nodes==planned and all(outputs.values()),missingNodes=sorted(nodes-planned),clips=deliveries,subclips=[dict(id=c['id'],parent=c['parent'],sourceLines=c['sourceLines'],path=str(outputs[c['id']].resolve()) if outputs[c['id']] else None,taskState=str((OUT/'tasks'/f'{c["id"]}.json').resolve())) for c in plan['clips']],validation=dict(decode='per completed subclip and assembled file',visual='见review/decisions.json；动态播放检查与抽帧分别记录',audio='未完成主观逐字听审，TTS/ASR不代表用户通过'),unresolved=['全部影片仍需用户review','主观逐字听审未完成']))
    links=['<!doctype html><meta charset="utf-8"><title>G2 查粮候选</title><style>body{background:#171c1d;color:#ebe4d2;font:18px sans-serif;max-width:1280px;margin:40px auto}video{width:100%;max-height:720px}article{margin:45px 0}</style><h1>G2 查粮取证与三种判断</h1><p>制作候选，待用户review；互斥分支分开。文书准确文字在各自取得时点叠加，无新增朗读。</p>']
    for d in deliveries:
        if d['file']:links += [f'<article><h2>{d["id"]} {d["name"]}</h2><p>入口：{d["entry"]} / 结束：{d["next"]}</p><video controls preload="metadata" src="assembled/{Path(d["file"]).name}"></video></article>']
    (OUT/'播放审阅.html').write_text('\n'.join(links),encoding='utf-8')
    print('Assembled',sum(bool(d['file']) for d in deliveries),'of',len(deliveries),flush=True)
if __name__=='__main__':main()
