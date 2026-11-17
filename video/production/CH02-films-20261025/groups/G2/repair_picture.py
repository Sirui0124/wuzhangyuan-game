"""Independent local picture candidates. Does not publish delivery or call a generation API."""
from pathlib import Path
import json,copy,hashlib,subprocess,re,sys,datetime,concurrent.futures
import cv2,numpy as np
from PIL import Image,ImageDraw,ImageFont
import textwrap
import postprocess as original
from manual_document_masks import masks as manual_masks
OUT=Path(__file__).parent;FF=original.FF
ROOT=OUT/'edited/picture-review-final';ROOT.mkdir(parents=True,exist_ok=True)
CORRECT='--correct' in sys.argv
if CORRECT:ROOT=OUT/'edited/picture-review-corrected';ROOT.mkdir(parents=True,exist_ok=True)
PRESENTABLE='--presentable' in sys.argv
if PRESENTABLE:CORRECT=True;ROOT=OUT/'edited/picture-review-presentable';ROOT.mkdir(parents=True,exist_ok=True)
NPC_TAIL='--npc-tail' in sys.argv
if NPC_TAIL:CORRECT=True;PRESENTABLE=True;ROOT=OUT/'edited/picture-review-npc-tail';ROOT.mkdir(parents=True,exist_ok=True)
if '--paper-detail' in sys.argv:CORRECT=True;PRESENTABLE=True;ROOT=OUT/'edited/picture-review-paper-detail';ROOT.mkdir(parents=True,exist_ok=True)
def wrap_text(text,width):
    lines=[]
    for line in textwrap.wrap(text,width):
        if lines and line and line[0] in '，。；：？！、）》”':lines[-1]+=line[0];line=line[1:]
        if line:lines.append(line)
    return lines
PLAN=json.loads((OUT/'plan.json').read_text(encoding='utf-8-sig'));OLD=json.loads((OUT/'delivery.json').read_text(encoding='utf-8-sig'));DEC=json.loads((OUT/'review/decisions.json').read_text(encoding='utf-8-sig'))
cv2.setNumThreads(2)
def read(p):return json.loads(Path(p).read_text(encoding='utf-8-sig'))
def save(p,d):Path(p).write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8')
def run(a):subprocess.run([FF,'-v','error','-y',*a],check=True)
def raw(id):return OUT/'generated'/f'{id}-raw.mp4'
def digest(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def probe(p):
    text=subprocess.run([FF,'-hide_banner','-i',str(p)],capture_output=True,text=True,encoding='utf-8',errors='replace').stderr
    m=re.search(r'Duration: (\d+):(\d+):([\d.]+)',text)
    return dict(duration=int(m[1])*3600+int(m[2])*60+float(m[3]),sha256=digest(p),resolution=[1280,720],fps=24,audioHz=48000)
def concat_parts(id,parts):
    target=ROOT/f'{id}-replacement-source.mp4'
    if target.exists():return target
    files=[]
    for index,(source,start,end) in enumerate(parts):
        p=ROOT/f'{id}-part-{index}.mp4'
        if not p.exists():run(['-i',str(source),'-vf',f'trim=start={start}:end={end},setpts=PTS-STARTPTS,scale=1280:720,setsar=1,fps=24','-af',f'atrim=start={start}:end={end},asetpts=PTS-STARTPTS','-t',str(end-start),'-c:v','libx264','-preset','fast','-crf','18','-threads','2','-c:a','aac','-ar','48000',str(p)])
        files.append(p)
    listing=ROOT/f'{id}-parts.txt';listing.write_text('\n'.join("file '"+str(p.resolve()).replace('\\','/')+"'" for p in files),encoding='utf-8')
    run(['-f','concat','-safe','0','-i',str(listing),'-c','copy',str(target)]);return target
def source_config(c):
    id=c['id'];d=copy.deepcopy(DEC.get(id,{}));src=raw(d.get('sourceClip',id));provenance=[]
    if id=='V13-02':
        d.update(trimStart=0,trimEnd=3.3,tailHold=0,useAvailableVoice=True,voiceOffset=.4,muteDuplicateSourceSpeech=True)
        provenance=[dict(path=str(src.resolve()),sha256=digest(src),usedRange=[0,3.3],context='保留原纸凭据落案及退手，去3.5秒起变木牍异常；原玩家音轨2.597秒加0.4秒入声及0.3秒句尾均保留，不定格、不循环')]
    if id=='V16B-01':
        r=next(r for r in read(OUT/'review/reuse-candidates/sources.json') if r['id']=='L01' and r['group']=='G1')
        src=Path(r['reviewCopy']);d.update(trimStart=0,trimEnd=4.8,tailHold=0,useAvailableVoice=True,voiceOffset=.4,muteDuplicateSourceSpeech=True)
        provenance=[dict(**r,usedRange=[0,4.8],context='同一灰衣苟安、伤帐木榻、半趴闭口听者，无新状态')]
    if id=='V16C-01':
        src=raw('V15-03');d.update(trimStart=0,trimEnd=8,tailHold=0,useAvailableVoice=True,voiceOffset=.4,muteDuplicateSourceSpeech=True)
        provenance=[dict(path=str(src.resolve()),sha256=digest(src),usedRange=[0,8],knownSourceNodes=['CH2-LY04-D01','CH2-LY04-D02'],context='已经取得的签收与交付重新核看；不展示新认罪书')]
    if id=='V18-05':
        src=raw('V18-04');d.update(trimStart=3,trimEnd=9.58,tailHold=0,useAvailableVoice=True,voiceOffset=.4,muteDuplicateSourceSpeech=True)
        provenance=[dict(path=str(src.resolve()),sha256=digest(src),usedRange=[3,9.58],knownSourceNodes=['CH2-LY04-D05'],context='只回看刚取得的地方实收账，不提前展示D06应征及欠交')]
    if id=='V19A-01':
        parts=[(raw('V19A-01'),0,3.4),(raw('V19B-01'),0,6)]
        src=concat_parts(id,parts);d.update(trimStart=0,trimEnd=9.4,tailHold=0,useAvailableVoice=True,voiceOffset=.4,muteDuplicateSourceSpeech=True)
        provenance=[dict(path=str(p.resolve()),sha256=digest(p),usedRange=[a,b],knownSourceNodes=['CH2-LY04-D06'],context='仅复用既有账页核看动作，无NPC讲话、无其他分支选择结果') for p,a,b in parts]
    if id=='V19B-01':
        parts=[(raw('V19B-01'),0,6),(raw('V19C-01'),0,4)]
        src=concat_parts(id,parts);d.update(trimStart=0,trimEnd=10,tailHold=0,useAvailableVoice=True,voiceOffset=.4,muteDuplicateSourceSpeech=True)
        provenance=[dict(path=str(p.resolve()),sha256=digest(p),usedRange=[a,b],knownSourceNodes=['CH2-LY04-D04','CH2-LY04-D05','CH2-LY04-D06'],context='核看并归拢已取得账页；不携带其他分支声音或新事实') for p,a,b in parts]
    if CORRECT and id in ['V16A-01','V16C-01']:d['evidencePanel']=True
    if CORRECT and id in ['V19A-01','V19B-01','V18-05']:
        knownId='V18-04' if id=='V18-05' else 'V18-06';l=next(c for c in PLAN['clips'] if c['id']==knownId)['sourceLines'][0]
        # Source times are converted by edit; reused trim for V18-05 starts at raw3.
        d['knownTextPanel']=dict(title='已取得账页·回看',text=l['text'],sourceNode=l['node'],start=d.get('trimStart',0)+1.2,end=d.get('trimStart',0)+c['duration']+1)
    if PRESENTABLE and id=='V18-06':d.update(trimStart=7,trimEnd=10,tailHold=7)
    if (NPC_TAIL or '--paper-detail' in sys.argv) and c['kind']=='dialogue' and not c['sourceLines'][0]['speaker'].startswith('我') and 'trimEnd' not in d:
        cap=cv2.VideoCapture(str(src));d['trimEnd']=cap.get(cv2.CAP_PROP_FRAME_COUNT)/cap.get(cv2.CAP_PROP_FPS);cap.release()
    if NPC_TAIL and id=='V20-08':d['audioEnd']=7.3
    return src,d,provenance
def zones(id):
    # [start,end,yMin,yMax,Smax]. Faces and speaking roles are not hidden with blur.
    z={
      'V13-01':[[0,20,0,720,180]],'V13-02':[[0,20,0,720,180]],
      'V13-03':[[0,1.8,420,720,180],[1.8,20,100,720,180]],
      'V13-04':[[0,20,120,720,180]],'V14-01':[[1.25,4,50,720,180]],
      'V15-01':[[0,20,100,720,180]],'V15-02':[[0,20,0,720,180]],
      'V15-03':[[0,20,120,720,180]],'V15-04':[[0,20,50,720,110]],
      'V16A-01':[[0,1.8,450,720,110],[1.8,20,100,720,110]],
      'V16C-01':[[0,20,120,720,180]],'V16C-02':[[0,2.1,400,720,110]],
      'V17-01':[[0,2.3,450,720,110],[2.3,20,30,720,180]],
      'V18-01':[[0,20,80,720,180]],'V18-02':[[0,20,30,720,110]],
      'V18-03':[[0,2.5,350,720,180],[2.5,5.4,600,720,110],[5.4,20,100,720,110]],
      'V18-04':[[0,20,80,720,180]],'V18-05':[[0,20,80,720,180]],
      'V18-06':[[7,20,0,720,110]],'V19A-01':[[0,20,0,720,110]],
      'V19A-02':[[0,20,250,720,110]],'V19B-01':[[0,20,0,720,110]],
      'V19C-01':[[0,20,100,720,110]],'V19C-02':[[0,20,300,720,180]],
      'V20-01':[[0,4.5,50,720,180],[4.5,20,500,720,110]],
      'V20-02':[[0,1.4,480,720,110],[1.4,20,80,720,110]],
      'V20-03':[[0,20,0,720,110]],'V20-04':[[0,3.2,0,720,110],[3.2,20,550,720,110]],
      'V20-05':[[3.95,20,550,720,110]],'V20-06':[[0,20,0,720,180]],
      'V20-07':[[0,4.25,200,720,110]],'V20-08':[[0,3.3,300,720,180]]
    };return z.get(id,[])
def defocus_source(id,source):
    specs=zones(id)
    if not specs:return source
    if NPC_TAIL:
        folders=['picture-review-corrected','picture-review-presentable','picture-review-final'] if id=='V13-03' else ['picture-review-presentable','picture-review-final']
        for folder in folders:
            cached=OUT/'edited'/folder/f'{id}-document-plane-softened.mp4'
            if cached.exists():return cached
    cached=OUT/'edited/picture-review-final'/f'{id}-document-plane-softened.mp4'
    if CORRECT and not PRESENTABLE and id!='V13-03' and cached.exists():return cached
    target=ROOT/f'{id}-document-plane-softened.mp4'
    if target.exists():
        try:
            if probe(target)['duration']>0:return target
        except Exception:target.rename(target.with_name(target.stem+'-incomplete-'+str(int(datetime.datetime.now().timestamp()))+'.mp4'))
    cap=cv2.VideoCapture(str(source));fps=cap.get(cv2.CAP_PROP_FPS)
    proc=subprocess.Popen([FF,'-v','error','-y','-f','rawvideo','-vcodec','rawvideo','-pix_fmt','bgr24','-s','1280x720','-r',str(fps),'-i','pipe:0','-i',str(source),'-map','0:v','-map','1:a','-c:v','libx264','-preset','fast','-crf','18','-threads','2','-c:a','aac','-ar','48000','-shortest',str(target)],stdin=subprocess.PIPE)
    n=0
    try:
      while True:
        ok,frame=cap.read()
        if not ok:break
        frame=cv2.resize(frame,(1280,720));t=n/fps
        active=[z for z in specs if z[0]<=t<z[1]]
        if PRESENTABLE:
            limits={'V15-02':[0,2],'V15-03':[0,2],'V15-04':[0,2],'V16A-01':[0,2.1],'V16C-01':[0,2.1],'V16C-02':[0,2.1],'V18-02':[0,2],'V18-04':[0,2],'V18-05':[3,4.2],'V18-06':[7,9.8],'V19A-01':[0,1.2],'V19B-01':[0,1.2],'V20-03':[0,2],'V20-05':[0,0],'V20-06':[0,2],'V20-07':[0,4.25],'V20-08':[2.7,3.3]}
            lo,hi=limits.get(id,[0,100]);active=active if lo<=t<hi else []
        if active:
            small=cv2.resize(frame,(640,360),interpolation=cv2.INTER_AREA)
            mask=np.zeros((360,640),np.uint8);hsv=cv2.cvtColor(small,cv2.COLOR_BGR2HSV)
            for polygon in manual_masks(id,t):
                points=np.array([[x*640/448,y*360/252] for x,y in polygon],np.int32)
                cv2.fillPoly(mask,[points],255)
            if PRESENTABLE:
                colour=np.zeros_like(mask)
                for a,b,y0,y1,smax in active:
                    region=cv2.inRange(hsv,np.array([8,8,110]),np.array([40,smax,255]));region=cv2.bitwise_and(region,mask)
                    region=cv2.morphologyEx(region,cv2.MORPH_CLOSE,np.ones((15,15),np.uint8))
                    contours,_=cv2.findContours(region,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
                    for contour in contours:
                        if cv2.contourArea(contour)>150:cv2.drawContours(colour,[contour],-1,255,-1)
                mask=cv2.bitwise_and(cv2.dilate(colour,np.ones((5,5),np.uint8)),mask)
                skin=cv2.inRange(cv2.cvtColor(small,cv2.COLOR_BGR2YCrCb),np.array([0,150,70]),np.array([255,185,135]));skin[hsv[:,:,0]>=18]=0
                mask[cv2.dilate(skin,np.ones((3,3),np.uint8))>0]=0
            alpha=cv2.resize(cv2.GaussianBlur(mask,(0,0),2),(1280,720),interpolation=cv2.INTER_LINEAR).astype(np.float32)[...,None]/255
            blur=cv2.resize(cv2.GaussianBlur(small,(0,0),7),(1280,720),interpolation=cv2.INTER_LINEAR)
            frame=(frame*(1-alpha)+blur*alpha).astype(np.uint8)
        proc.stdin.write(frame.tobytes());n+=1
    finally:cap.release();proc.stdin.close()
    if proc.wait()!=0:raise RuntimeError('source processing failed '+id)
    return target
def edit(c):
    id=c['id'];target=ROOT/(id+'.mp4');meta=target.with_suffix('.json')
    if target.exists() and meta.exists():return read(meta)
    if id=='V16B-02' and not CORRECT:
        old=next(r for r in OLD['subclips'] if r['id']==id);return dict(id=id,file=old['path'],unchanged=True,**probe(old['path']))
    source,d,provenance=source_config(c);clean=defocus_source(id,source)
    start=d.get('trimStart',0);end=d.get('trimEnd',c['duration']);hold=d.get('tailHold',0);duration=end-start+hold
    overlays=original.panel(c,d);layers=[]
    for i,o in enumerate(overlays):
        im=Image.open(o['path']).convert('RGBA')
        if CORRECT and c['kind']=='document':
            im=Image.new('RGBA',(1280,720),(26,31,28,255));draw=ImageDraw.Draw(im);font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',38)
            lines=wrap_text(c['sourceLines'][0]['text'],25);y=(720-len(lines)*64)//2
            for line in lines:draw.text((155,y),line,font=font,fill=(239,231,208,255));y+=64
            if id=='V18-06':o=dict(o,start=start+(2.8 if PRESENTABLE else 1))
        if PRESENTABLE and d.get('knownTextPanel'):
            spec=d['knownTextPanel'];im=Image.new('RGBA',(1280,720),(21,27,24,255));draw=ImageDraw.Draw(im);font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',34)
            draw.text((130,185),spec['title'],font=font,fill=(239,231,208,255))
            for j,line in enumerate(wrap_text(spec['text'],27)):draw.text((130,285+j*56),line,font=font,fill=(239,231,208,255))
        if PRESENTABLE and d.get('evidencePanel'):
            im=Image.new('RGBA',(1280,720),(21,27,24,255));draw=ImageDraw.Draw(im);font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',32)
            texts=['本队签收：列明批次、经手人、应交粮数和实际收到的粮数。','出仓交付：记有交给本队的实粮数；欠交的部分列在缺额栏。']
            for col,text in enumerate(texts):
                for j,line in enumerate(wrap_text(text,15)):draw.text((105+col*580,260+j*52),line,font=font,fill=(239,231,208,255))
        if c['kind']=='map' or d.get('evidencePanel'):
            bg=Image.new('RGBA',im.size,(21,27,24,255));bg.alpha_composite(im);im=bg
        layerEnd=o['end']-start
        if d.get('evidencePanel'):layerEnd=max(layerEnd,duration)
        p=ROOT/f'{id}-overlay-{i}.png';im.save(p);layers.append(dict(path=p,start=max(0,o['start']-start),end=layerEnd))
    args=['-i',str(clean)]
    for o in layers:args+=['-loop','1','-i',str(o['path'])]
    a=OUT/'review'/id/'asr.json';asr=read(a) if a.exists() else {}
    voice=c.get('voice') if d.get('useAvailableVoice') or not asr.get('recognized','').strip() else None
    voiceIndex=1+len(layers)
    if voice:args+=['-i',voice['path']]
    pad=f',tpad=stop_mode=clone:stop_duration={hold}' if hold else ''
    filt=[f'[0:v]trim=start={start}:end={end},setpts=PTS-STARTPTS,scale=1280:720,setsar=1,fps=24{pad}[v0]']
    for i,o in enumerate(layers):filt.append(f'[v{i}][{i+1}:v]overlay=0:0:enable=\'between(t,{o["start"]},{o["end"]})\'[v{i+1}]')
    if voice:
        offset=round(max(0,d.get('voiceOffset',voice['offset']-start))*1000);volume=0 if d.get('muteDuplicateSourceSpeech') else .8
        filt += [f'[0:a]atrim=start={start}:end={d.get("audioEnd",end)},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,volume={volume},apad=pad_dur={hold}[amb]',f'[{voiceIndex}:a]aformat=sample_rates=48000:channel_layouts=stereo,adelay={offset}|{offset}[speech]','[amb][speech]amix=inputs=2:duration=first:normalize=0:dropout_transition=0,alimiter=limit=0.98[a]']
    else:filt += [f'[0:a]atrim=start={start}:end={d.get("audioEnd",end)},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,apad=pad_dur={hold}[a]']
    args += ['-filter_complex',';'.join(filt),'-map',f'[v{len(layers)}]','-map','[a]','-t',str(duration),'-c:v','libx264','-preset','fast','-crf','18','-threads','2','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-movflags','+faststart',str(target)]
    run(args)
    result=dict(id=id,file=str(target.resolve()),source=str(source.resolve()),sourceSha256=digest(source),pictureChanges=dict(documentDefocusZones=zones(id),manualMasksSource=str((OUT/'manual_document_masks.py').resolve()),manualMasksSha256=digest(OUT/'manual_document_masks.py'),fullFrameExistingEvidence=bool(d.get('evidencePanel') or d.get('knownTextPanel') or d.get('knownReportPanel')),trim=[start,end],tailHold=hold,sourceReuse=provenance),sourceLines=c['sourceLines'],voiceReused=voice,audioReview='未听审、未新增TTS',**probe(target));save(meta,result)
    print('Edited',id,result['duration'],flush=True);return result
def assemble(results):
    byid={c['id']:c for c in results};D=OUT/'assembled/picture-review-final';D.mkdir(exist_ok=True);rows=[]
    for parent in PLAN['parents']:
        sources=[byid[id] for id in parent['children']];identity=hashlib.sha256(('cfr-v2'+''.join(c['sha256'] for c in sources)).encode()).hexdigest()[:10];p=D/(parent['id']+'-'+identity+'.mp4');listing=D/(parent['id']+'-'+identity+'-concat.txt')
        listing.write_text('\n'.join("file '"+str(Path(c['file']).resolve()).replace('\\','/')+"'" for c in sources),encoding='utf-8')
        if not p.exists():run(['-fflags','+genpts','-f','concat','-safe','0','-i',str(listing),'-vf','fps=24,setsar=1','-fps_mode','cfr','-r','24','-af','aresample=async=1:first_pts=0','-c:v','libx264','-preset','fast','-crf','18','-threads','2','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-movflags','+faststart',str(p)])
        check=subprocess.run([FF,'-v','warning','-i',str(p),'-f','null','NUL'],capture_output=True,text=True,encoding='utf-8',errors='replace');assert check.returncode==0 and not check.stderr,(parent['id'],check.stderr)
        rows.append(dict(**parent,file=str(p.resolve()),childrenFiles=sources,technical=dict(decodeExitCode=0,decodeWarnings='',**probe(p)),**probe(p)))
        print('Assembled',parent['id'],rows[-1]['duration'],flush=True)
    save(OUT/'review/picture-repair-candidates.json',dict(version='picture-review-final',userApproved=False,status='pending-visual-review',clips=rows,subclips=results))
if __name__=='__main__':
    selected=[x for x in sys.argv[1:] if x not in ['--correct','--presentable','--npc-tail','--paper-detail']]
    if selected:
        for c in PLAN['clips']:
            if c['id'] in selected:edit(c)
    else:
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(edit,PLAN['clips']))
        assemble(results)
