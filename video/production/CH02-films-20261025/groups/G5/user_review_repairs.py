"""2026-10-25 user review: no cards, no local blur. Independent candidates before publish."""
from pathlib import Path
import sys,json,subprocess,hashlib,copy
import math
from PIL import Image,ImageDraw,ImageFont
OUT=Path(__file__).parent;WORK=OUT/'user-review-20261025';WORK.mkdir(exist_ok=True)
sys.path.insert(0,str(OUT))
from run_pipeline import FF,read,save,metadata
from paper_composite import interp
POLICY='20261025-no-meta-no-cards-no-boxes'

def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def reference():
    sys.path.insert(0,'C:/Users/zhousirui/Documents/ChatGPT/平行世界/tools');import image_api as api
    folder=WORK/'references/write-hand';folder.mkdir(parents=True,exist_ok=True);guard=folder/'dispatch-guard.json'
    assert not guard.exists(),'Unknown/succeeded image dispatch must never be blindly repeated'
    ref=OUT/'references/gouan-tent-desk/image-01.png'
    prompt='Photographic historical film still, 16:9. A close oblique view down across the same rough low wooden desk in the warm lamp-lit night tent from the reference. Only the adult man\'s right writing hand and its coarse grey linen cuff, a little of his left fingertips steadying one paper edge, the brush and the paper are visible. No head, face, shoulder, torso or sword. The right hand grips a slender bamboo brush naturally and the brush tip physically touches the near right blank margin of the paper. The camera is positioned opposite the writer, at a low oblique angle: the back of the writing hand hides the written area behind it, but the tip and contact point remain clearly visible. The paper has natural blank warm fibrous texture; only a tiny uneven fresh ink stroke immediately beside the bristles, never Chinese characters or symbols. Warm soft amber lamp light from the left, muted charcoal grey sleeve, ordinary skin, readable shadows, real tactile fibres. No text, numbers, titles, captions, borders, logos, collage, blur boxes or masks. Maintain the grey linen material and desk colour of the reference.'
    (folder/'prompt.txt').write_text(prompt,'utf-8');save(guard,dict(state='dispatching',model='gpt-image-2',size='2048x1152',reason='User review: existing writing close shot reveals native pseudo-text or loses brush when cropped; one necessary no-text hand reference'))
    result=api.generate_once(api.build_request(prompt,size='2048x1152',references=[str(ref)]),folder)
    save(guard,dict(state='succeeded',path=result['local_path'],sha256=result['sha256']));print(json.dumps(dict(path=result['local_path'],sha256=result['sha256']),ensure_ascii=False))

def queue():
    id='V32A-06-UR1';assert not (OUT/'tasks'/f'{id}.json').exists()
    ref=read(WORK/'references/write-hand/dispatch-guard.json');assert ref['state']=='succeeded' and sha(ref['path'])==ref['sha256']
    prompt='One continuous four-second historical live-action close shot from the supplied first frame. Only the same right writing hand, grey linen cuff, left fingertips, bamboo brush, blank paper edge and rough wooden desk in soft warm night lamp light. The brush tip stays visibly in physical contact with the paper as the wrist makes a few small natural writing strokes, pauses briefly, then lifts the brush at the end. The back of the hand occludes the written area behind it; the near blank paper margin, bristles, contact and a few short irregular ink traces are visible. No legible characters, words, symbols or numbers. Preserve the hand anatomy, wrist, brush and paper without morphing. Fixed low oblique view, no face, body or new person, no cut or transition. No subtitles, cards, tables, captions, text overlays, dark boxes, local blur patches or mosaic. There is no permitted speech: no dialogue, narration, extra human voice or metadata reading. No BGM or music. Only quiet synchronized brush-on-paper and cloth movement, soft room tone.'
    save(OUT/'requests'/f'{id}.local.json',dict(model='MiniMax-H3',duration=4,resolution='768P',ratio='16:9',content=[dict(type='text',text=prompt),dict(type='image_url',image_url={'local_path':ref['path']},role='first_frame')]))
    parent=next(c for c in read(OUT/'plan.json')['clips'] if c['id']=='V32A-06');c=copy.deepcopy(parent);c.update(id=id,parentId='V32A-06',duration=4,action=prompt,post=[],generatedSpokenLines=[],postVoiceLines=[],speechWhitelist=[],status='user-review-necessary-local-repair',reviewPolicy=POLICY,visualRepairReason='Original writing shot exposes native pseudo-text; tighter text-free crop cuts bristle/contact and fails action readability. Only this four-second insert regenerated, no audio-only generation.',references=[dict(id='night-write-hand',path=ref['path'],use='唯一首帧：灰麻袖、夜灯、粗木案、手背遮写区而笔尖触纸清楚；不用可读汉字')],promptPath=str((WORK/f'{id}.md').resolve()))
    for name in ['queue-plan.json','repair-plan.json']:
        q=read(OUT/name);assert id not in [x['id'] for x in q['clips']];q['clips'].append(c);save(OUT/name,q)
    save(OUT/'post-gate.json',dict(enabled=True,allowedNewIds=[id],reason='Only one necessary four-second writing insert under user 20261025 no-cards/no-boxes review; old known and unknown jobs held',unknownNeverRepost='V32A-01'))
    text='\n'.join(['尺寸：16:9','模型：MiniMax-H3（本轮实际使用）','声音：有声音','时长：4秒','','参考图上传顺序：',f'图片1｜{ref["path"]}｜唯一首帧，锁同一灰麻袖、纸边、手背挡住写区且笔尖触纸可见、粗木案及左侧夜灯。','','视频生成 Prompt','','分镜1｜0-4秒','参考图关系：图片1负责全部构图、手与袖口、纸边、接触位置和夜间暖灯。镜头不向外揭示人脸或新空间。','画面动作：右手腕自然带笔写几个短笔触，略停，最后提笔；手背挡住墨迹区，近侧纸边留白。摄影机固定低斜角，不切镜。','声音执行（控制说明，不朗读）：无对白、无旁白、无额外人声。','唯一允许发声的原句：无（空白名单）。任何姓名、某某说、旁白、画外、编号或导演说明均不得发声。','','API实际镜头文本：',prompt,'','连续性与限制：本镜只承载交代书写动作，精确全文保留独立来源映射，不烧入影片；不承担后续划去/署名，不改变游戏状态。全片无字幕、卡、正文、表格、角色标签或制作信息；无方框模糊、矩形暗影、马赛克或遮挡补丁。','','拍摄手法参考：《1917》按实际动作耗时安排注意力及切点，仅用于本镜笔尖触纸、短停、提笔的连续动作；沿用已核验ASC访谈 https://theasc.com/article/lives-under-siege-the-goldfinch-and-1917/ ，不复制其人物或时代。','','声音要求：全片无BGM、无背景音乐、无配乐。无对白，禁止新增任何人声和元说明朗读；只保留同步笔尖擦纸、麻袖摩擦与安静帐内环境声。'])
    (WORK/f'{id}.md').write_text(text+'\n','utf-8');print('Queued exactly one four-second writing insert; no new TTS')

def transform(src,dst,start,end,fn):
    dst.parent.mkdir(parents=True,exist_ok=True)
    if dst.exists():return dst
    silent=dst.with_name(dst.stem+'.silent.mp4')
    dec=subprocess.Popen([str(FF),'-v','error','-ss',str(start),'-t',str(end-start),'-i',str(src),'-vf','scale=1280:720,fps=24','-f','rawvideo','-pix_fmt','rgb24','pipe:1'],stdout=subprocess.PIPE)
    enc=subprocess.Popen([str(FF),'-v','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s','1280x720','-r','24','-i','pipe:0','-an','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p',str(silent)],stdin=subprocess.PIPE)
    n=0
    try:
        while True:
            data=dec.stdout.read(1280*720*3)
            if len(data)!=1280*720*3:break
            enc.stdin.write(fn(Image.frombytes('RGB',(1280,720),data),start+n/24).tobytes());n+=1
    finally:enc.stdin.close();dec.stdout.close()
    assert dec.wait()==enc.wait()==0
    subprocess.run([str(FF),'-v','error','-y','-i',str(silent),'-ss',str(start),'-i',str(src),'-map','0:v','-map','1:a','-c:v','copy','-c:a','aac','-ar','48000','-ac','2','-t',str(n/24),'-movflags','+faststart',str(dst)],check=True)
    save(dst.with_suffix('.json'),dict(source=str(src),sourceSHA=sha(src),range=[start,end],processing='only geometry crop/scale, no blur, no mask, no text, no hold, no loop',sha256=sha(dst)))
    return dst

def receipt():
    def edge(im,t):
        x,y=interp(t,[(2.8,[765,405]),(3.0,[770,425]),(3.4,[760,450]),(4,[775,470]),(4.7,[795,500]),(5.5,[810,510]),(6.2,[820,510])])
        return im.crop((round(x),round(y),round(x)+320,round(y)+180)).resize((1280,720),Image.Resampling.LANCZOS)
    src=OUT/'generated/V36-01-16x9.mp4';dest=WORK/'sources/V36-01-contact-unmasked.mp4'
    transform(src,dest,2.8,6.2,edge);print('Unmasked original contact/release crop rendered')

def render_parts(name,parts,audio,required_audio_end=0,audio_start=0):
    dest=WORK/'sources'/f'{name}.mp4';dest.parent.mkdir(exist_ok=True)
    inputs=[];filters=[];total=0
    for n,p in enumerate(parts):
        inputs+=['-i',str(p['file'])];a,b=p['range'];speed=p.get('speed',1);total+=(b-a)/speed
        crop=''
        if p.get('crop'):
            x,y,w,h=p['crop'];crop=f'crop={w}:{h}:{x}:{y},'
        filters.append(f'[{n}:v]trim=start={a}:end={b},setpts=(PTS-STARTPTS)/{speed},scale=1280:720,{crop}scale=1280:720,setsar=1,fps=24[v{n}]')
    assert total>=required_audio_end,f'{name}: shortened prescribed original speech'
    filters.append(''.join(f'[v{n}]' for n in range(len(parts)))+f'concat=n={len(parts)}:v=1:a=0[v]')
    inputs+=['-i',str(audio)];filters.append(f'[{len(parts)}:a]atrim=start={audio_start},asetpts=PTS-STARTPTS,apad,atrim=duration={total}[a]')
    if not dest.exists():
        pending=dest.with_name(dest.stem+'.pending.mp4')
        subprocess.run([str(FF),'-v','error','-y']+inputs+['-filter_complex',';'.join(filters),'-map','[v]','-map','[a]','-t',str(total),'-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-ar','48000','-ac','2','-movflags','+faststart',str(pending)],check=True)
        subprocess.run([str(FF),'-v','error','-i',str(pending),'-f','null','NUL'],check=True);pending.replace(dest)
    record=dict(file=str(dest.resolve()),sha256=sha(dest),parts=[{**p,'file':str(p['file'])} for p in parts],audioSource=str(audio),audioStart=audio_start,requiredAudioEnd=required_audio_end,metadata=metadata(dest),newPaidRequest=False,textOverlays=[],masks=[],blur=False,freeze=False,loop=False)
    save(dest.with_suffix('.json'),record);return record

def join_candidate(id,files,source_map):
    version=hashlib.sha256('|'.join(sha(f) for f in files).encode()).hexdigest()[:10]
    folder=WORK/'assembled';folder.mkdir(exist_ok=True);dest=folder/f'{id}-no-cards-{version}.mp4'
    playlist=folder/f'{id}.concat.txt';playlist.write_text('\n'.join("file '"+str(Path(f).resolve()).replace('\\','/').replace("'","'\\''")+"'" for f in files),'utf-8')
    if not dest.exists():
        pending=dest.with_name(dest.stem+'.pending.mp4')
        subprocess.run([str(FF),'-v','error','-y','-f','concat','-safe','0','-i',str(playlist),'-vf','fps=24,setsar=1','-r','24','-fps_mode','cfr','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-ar','48000','-ac','2','-movflags','+faststart',str(pending)],check=True)
        subprocess.run([str(FF),'-v','error','-i',str(pending),'-f','null','NUL'],check=True);pending.replace(dest)
    return dict(id=id,file=str(dest.resolve()),sha256=sha(dest),metadata=metadata(dest),sourceMap=source_map,reviewState='pending',userApproved=False,freeze=False,loop=False,textOverlays=[],visibleBlurPatches=False)

def build():
    base=read(WORK/'baseline-delivery.json');slots={s['id']:s for s in base['assembled']}
    catalog=read(WORK/'candidates.json') if (WORK/'candidates.json').exists() else {'clips':[]}
    candidates={x['id']:x for x in catalog['clips']}
    for id in ['V33','V37','V42']:
        s=slots[id];candidates[id]=dict(id=id,file=s['file'],sha256=s['sha256'],metadata=s['metadata'],unchanged=True,reviewState='pending-new-policy-scan',userApproved=False)
    s=slots['V34'];old=s['sources'][-1];r=render_parts('V34-04-no-title',[dict(file=old['source'],range=[0,7.85])],old['file'])
    candidates['V34']=join_candidate('V34',[x['file'] for x in s['sources'][:-1]]+[r['file']],dict(retained=[x['id'] for x in s['sources']],changedChild='V34-04',titleRemoved=True,sourceRange=[0,7.85],actualActions='write, lift brush, take packet, extend packet, recipient edge grip'))
    s=slots['V35'];clean=OUT/'edited/sources/V35-R2-C1-paper-actions.mp4'
    candidates['V35']=join_candidate('V35',[s['sources'][0]['file'],str(clean)],dict(retained=[x['id'] for x in s['sources']],continuousPaperRange=[0,8],replyRange=[0,2.65],twoAttachmentsRange=[2.65,8],allReadingCardsRemoved=True,holdsRemoved=True,actualActions='return packet complete, open reply, two independent sheets contact desk and fingers release'))
    s=slots['V36'];old=s['sources'][0];voice_end=max(v['end'] for v in old['postVoice'])
    r=render_parts('V36-01-no-mask-no-list-v2',[dict(file=OUT/'generated/V36-01-16x9.mp4',range=[0,1.1],crop=[300,0,600,338],speed=.8),dict(file=OUT/'generated/V36-02-16x9.mp4',range=[0,1.3],crop=[200,0,896,504],speed=.9),dict(file=WORK/'sources/V36-01-contact-unmasked.mp4',range=[.2,3.4])],old['file'],required_audio_end=voice_end-1,audio_start=1)
    candidates['V36']=join_candidate('V36',[r['file']]+[x['file'] for x in s['sources'][1:]],dict(retained=[x['id'] for x in s['sources']],changedChild='V36-01',rawFaceRange=[0,1.1],extraClosedClerkSource='V36-02 0–1.3',rawContactReleaseRange=[3,6.2],oldBlurRemoved=True,materialsCardRemoved=True,oldAudioSource=old['file'],audioShift=-1,requiredOriginalVoiceEnd=voice_end-1,actualActions='real packet contact/settle/release; later original return-order handoff retained'))
    newwrite=OUT/'generated/V32A-06-UR1-16x9.mp4'
    if newwrite.exists():
        s=slots['V32A'];native=OUT/'edited/sources/V32A-07-C8-follow-brush.mp4'
        night=OUT/'generated/V32A-04-R2-16x9.mp4'
        response=render_parts('V32A-02-night-no-paper-face',[dict(file=night,range=[0,1.8],crop=[200,0,896,504]),dict(file=night,range=[3.2,4.25],crop=[200,0,896,504])],s['sources'][1]['file'],required_audio_end=2.8)
        consent=render_parts('V32A-05-night-no-paper-face',[dict(file=night,range=[0,1.8],crop=[200,0,896,504],speed=.95),dict(file=night,range=[1.5,5.5],crop=[190,381,602,339],speed=.95),dict(file=night,range=[3.2,5.1],crop=[200,0,896,504],speed=.95)],s['sources'][4]['file'],required_audio_end=8.09)
        prefix=[s['sources'][0]['file'],response['file'],s['sources'][2]['file'],s['sources'][3]['file'],consent['file']]
        candidates['V32A']=join_candidate('V32A',prefix+[str(newwrite),str(native)],dict(retained=[x['id'] for x in s['sources']],changedChildren=['V32A-02','V32A-05','V32A-06','V32A-07'],nightResponseSource=response['file'],nightConsentSource=consent['file'],responseOriginalAudio=s['sources'][1]['file'],consentOriginalAudio=s['sources'][4]['file'],writingSource=str(newwrite.resolve()),crossAndSignNativeSource=str(native.resolve()),cardsRemoved=True,onPaperSyntheticClauseRemoved=True,holdsRemoved=True,actualActions='same-character night responses and plain desk replace brief daytime paper-face exposures; new natural writing, native horizontal stroke, lower writing, brush lift',speechWhitelist=[]))
    order=['V32A','V33','V34','V35','V36','V37','V42'];catalog['clips']=[candidates[x] for x in order if x in candidates];save(WORK/'candidates.json',catalog)
    plan=read(OUT/'plan.json')['clips'];mapping=[]
    for c in plan:
        mapping.append(dict(id=c['id'],slot=c['slot'],nodes=c['nodes'],sourceLines=c['sourceLines'],generatedSpokenLines=c.get('generatedSpokenLines',[]),postVoiceLines=c.get('postVoiceLines',[]),removedBurnedText=c.get('post',[]),presentation='Original spoken lines retained; precise document facts stored in this separate source map for existing game information layer. No game/source-sheet edits, no text burned into video, no added narration.'))
    save(WORK/'source-facts-map.json',dict(reviewPolicy=POLICY,scope='G5 only; source facts preserved, video typography removed',clips=mapping,userApproved=False))
    rows=[]
    for id in order:
        old=slots[id];offset=0;layers=[]
        for c in old.get('sources',[]):
            for layer in c.get('textLayers',[]):layers.append(dict(child=c['id'],kind='burned-work-document-card',oldRange=[round(offset+layer['start'],3),min(old['metadata']['duration'],round(offset+layer['end'],3))],text=layer['text']))
            offset+=c.get('metadata',{}).get('duration',0)
        if id=='V36':layers.insert(0,dict(child='V36-01',kind='visible-local-blur',oldRange=[0,4.8]))
        if id=='V32A':layers.append(dict(child='V32A-07',kind='synthetic-on-paper-phrase/ink-processing',oldRange=[50.5,55.4]))
        rows.append(dict(id=id,userSpecificComment=None,globalCorrections=['no work-document text/cards/lists/production metadata','no visible blur/shadow boxes or mosaic','new generation uses speech whitelist only and no BGM'],old=dict(file=old['file'],sha256=old['sha256'],duration=old['metadata']['duration']),oldIssues=layers,classification='picture-global-correction' if layers else 'picture-policy-scan-unchanged',processing=candidates.get(id,{}).get('sourceMap','preserve current file pending new-policy scan'),candidate=candidates.get(id),reviewState='pending',actualReviewEvidence=[],unresolved=['Current-SHA new-policy motion review pending'],audio=dict(action='preserve existing original audio; this group has no individually authorized TTS replacement',newTTS=0,listening='未逐字听审',metaReadingVerified=False,bgmVerifiedAbsent=False),userApproved=False))
    save(OUT/'user-review-repair.json',dict(group='G5',reviewPolicy=POLICY,status='repair-in-progress',inputReview='reviews/user-20261025-1549',commentsPreserved=True,baselineSHAValidated=all(sha(s['file'])==s['sha256'] for s in base['assembled']),newVideoTask='V32A-06-UR1',clips=rows,unknownOriginal=dict(id='V32A-01',repostForbidden=True),newTTS=0))
    print('Independent candidates:',[(x['id'],x['metadata']['duration']) for x in catalog['clips']])

def audit():
    font=ImageFont.truetype('C:/Windows/Fonts/simhei.ttf',18)
    for c in read(WORK/'candidates.json')['clips']:
        folder=WORK/'review'/(c['id']+'-'+c['sha256'][:10]);frames=folder/'frames';frames.mkdir(parents=True,exist_ok=True)
        if not (frames/'000001.jpg').exists():subprocess.run([str(FF),'-v','error','-i',c['file'],'-vf',"select='not(mod(n,24))',scale=384:216",'-fps_mode','vfr','-q:v','3',str(frames/'%06d.jpg')],check=True)
        files=sorted(frames.glob('*.jpg'));paths=[]
        for first in range(0,len(files),20):
            dest=folder/f'sequence-{first//20+1:02d}.jpg';sheet=Image.new('RGB',(1536,1205),'#171717');draw=ImageDraw.Draw(sheet)
            for n,f in enumerate(files[first:first+20]):
                x=n%4*384;y=n//4*241;sheet.paste(Image.open(f),(x,y));draw.text((x+5,y+217),f'{c["id"]} {first+n:.2f}s',font=font,fill='white')
            sheet.save(dest,quality=88);paths.append(str(dest.resolve()))
        save(folder/'sequence-index.json',dict(id=c['id'],file=c['file'],sha256=c['sha256'],sampling='every 24th native CFR24 frame from frame zero, 1fps full-range auxiliary; critical actions checked separately at4fps',sheets=paths,visualReview='pending actual inspection',audioListening='未逐字听审'))
        print(c['id'],paths)

if __name__=='__main__':globals()[sys.argv[1]]()
