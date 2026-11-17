from pathlib import Path
import json,hashlib,subprocess,math,sys
O=Path(__file__).resolve().parent;R=O/'user-review-batch2';E=R/'pieces';E.mkdir(exist_ok=True);A=O/'assembled/user-review-batch2';A.mkdir(exist_ok=True)
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'));sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
def save(p,x):p.write_text(json.dumps(x,ensure_ascii=False,indent=2),encoding='utf-8')
D=read(R/'delivery-before-batch2.json');FILES={c['id']:c['file'] for c in D['subclips']};V=read(O.parents[1]/'voice/manifest.json')['rows'];W={c['id']:c for c in read(O.parents[1]/'reviews/user-20261025-batch2/spoken-whitelist.json')['clips']};META={}
def raw(id):return str(O/'generated'/(id+'-raw.mp4'))
def norm(id):return str(O/'edited'/(id+'-16x9.mp4'))
def p(id,video,start,length,audio=None,astart=0,alen=None,delay=0,nodes=None,purpose='',silent=False):
 n=math.ceil(length*24-1e-7);dur=n/24;out=E/(id+'.mov');rec=dict(id=id,file=str(out),frames=n,duration=dur,videoSource=str(video),videoSha256=sha(video),videoStart=start,audioSource=str(audio) if audio else None,audioSha256=sha(audio) if audio else None,audioStart=astart,audioLength=alen if alen is not None else length,delay=delay,nodes=nodes or [],purpose=purpose,silent=silent)
 receipt=out.with_suffix('.json')
 if not out.exists() or not receipt.exists() or read(receipt).get('recipe')!=rec:
  args=[FF,'-v','error','-y','-i',str(video)];args+=['-i',str(audio)] if audio else ['-f','lavfi','-i','anullsrc=r=48000:cl=stereo']
  v=f'[0:v]trim=start={start},setpts=PTS-STARTPTS,fps=24,trim=end_frame={n},settb=1/24,setpts=N,scale=1280:720,setsar=1[v]'
  if audio and not silent:
   l=rec['audioLength'];fade=min(.008,l/10);tail=max(0,l-.012)
   af=f'atrim=start={astart}:duration={l},asetpts=PTS-STARTPTS,aresample=48000,aformat=sample_fmts=s16:channel_layouts=stereo,afade=t=in:st=0:d={fade},afade=t=out:st={tail}:d=0.012'
   if delay:af+=f',adelay={round(delay*1000)}|{round(delay*1000)}'
   af+=f',apad,atrim=end_sample={n*2000},asetpts=N/SR/TB'
  else:af=f'atrim=duration={dur},asetpts=PTS-STARTPTS,aformat=sample_fmts=s16:channel_layouts=stereo'
  args+=['-filter_complex_threads','1','-filter_complex',v+';[1:a]'+af+'[a]','-map','[v]','-map','[a]','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p','-r','24','-fps_mode','cfr','-c:a','pcm_s16le',str(out)];subprocess.run(args,check=True);save(receipt,dict(recipe=rec,sha256=sha(out)))
 META[str(out)]=rec;return str(out)
def voice(id,clip,node,length=None):
 x=V[node];assert sha(x['path'])==x['sha256'];l=length or x['duration']+.4
 return p(id,FILES[clip],0,l,x['path'],0,x['duration'],.2,[node],'复用既有准确玩家原句，非新TTS；自然听者缩至原句及短气口')
def dissolve(id,a,b,frames=5):
 # This ffmpeg build emits one fewer boundary frame after xfade+fps. Match
 # audio to those real decoded frames, rather than padding a frozen frame.
 n=META[a]['frames']+META[b]['frames']-frames-1;dur=n/24;out=E/(id+'.mov');fade=frames/24;offset=META[a]['duration']-fade
 recipe=dict(id=id,file=str(out),frames=n,duration=dur,sources=[a,b],sourceHashes=[sha(a),sha(b)],fadeFrames=frames,boundaryNormalization='按实测xfade输出少一帧同步裁短尾气口音频，不冻结补帧',nodes=META[a]['nodes']+META[b]['nodes'],purpose='保留苟安口述回忆进入/返回边界，叠化位于句间气口，不读控制说明')
 if not out.exists() or not out.with_suffix('.json').exists() or read(out.with_suffix('.json')).get('recipe')!=recipe:
  f=f'[0:v]settb=AVTB[v0];[1:v]settb=AVTB[v1];[v0][v1]xfade=transition=fade:duration={fade}:offset={offset},fps=24,trim=end_frame={n},settb=1/24,setpts=N[v];[0:a][1:a]acrossfade=d={fade},atrim=end_sample={n*2000},asetpts=N/SR/TB[a]'
  subprocess.run([FF,'-v','error','-y','-i',a,'-i',b,'-filter_complex_threads','1','-filter_complex',f,'-map','[v]','-map','[a]','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p','-r','24','-c:a','pcm_s16le',str(out)],check=True);save(out.with_suffix('.json'),dict(recipe=recipe,sha256=sha(out)))
 META[str(out)]=recipe;return str(out)
def assemble(id,parts):
 old=next(x for x in D['logicalClips'] if x['id']==id);n=sum(META[p]['frames'] for p in parts);out=A/(id+'-'+old['name']+'_纯台词精剪V1.mp4');args=[FF,'-v','error','-y']
 for s in parts:args+=['-i',s]
 f=';'.join(f'[{i}:v]settb=1/24,setpts=N[v{i}];[{i}:a]atrim=end_sample={META[s]["frames"]*2000},asetpts=N/SR/TB[a{i}]' for i,s in enumerate(parts))+';'+''.join(f'[v{i}][a{i}]' for i in range(len(parts)))+f'concat=n={len(parts)}:v=1:a=1[v][a]'
 args+=['-filter_complex_threads','1','-filter_complex',f,'-map','[v]','-map','[a]','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p','-r','24','-fps_mode','cfr','-c:a','aac','-ar','48000','-ac','2','-b:a','192k','-movflags','+faststart',str(out)];subprocess.run(args,check=True)
 result=subprocess.run([FF,'-v','error','-i',str(out),'-map','0:v:0','-an','-fps_mode','passthrough','-progress','pipe:1','-nostats','-f','null','-'],capture_output=True,text=True,check=True);pr=dict(l.split('=',1) for l in result.stdout.splitlines() if '=' in l);assert int(pr['frame'])==n,(id,n,pr['frame'])
 rec=dict(id=id,file=str(out),sha256=sha(out),duration=n/24,decodedFrames=n,videoEndSeconds=int(pr['out_time_us'])/1e6,decode='passed',fps=24,sourceFiles=parts,sourceHashes=[sha(s) for s in parts],sourceRecipes=[META[s] for s in parts],oldFile=old['path'],oldSha256=old['sha256'],oldDuration=old['duration'],spokenWhitelist=W[id]['spokenWhitelist'],neverReadStageOrDocumentText=W[id]['neverReadStageOrDocumentText'],reviewState='pending-final-review',listeningReview='pending; no audio-capable tool',userApproved=False)
 save(out.with_suffix('.json'),rec);save(R/(id+'-candidate.json'),rec);save(R/(id+'-candidate-preview.json'),[[id,out.relative_to(O).as_posix()]])
 subprocess.run([FF,'-v','error','-y','-i',str(out),'-vf','fps=1,scale=256:144,tile=8x12','-frames:v','1',str(R/(id+'-candidate-1fps.jpg'))],check=True);print(json.dumps(dict(id=id,oldDuration=old['duration'],duration=n/24,sha256=rec['sha256']),ensure_ascii=False),flush=True)
selected=set(sys.argv[1:] or ['V21','V22','V23','V24'])
if 'V21' in selected:
 parts=[voice('21-01','V21-01','CH2-LY07-E02'),p('21-02',FILES['V21-02'],.42,5.9583333333,raw('V21-02'),1.42,5.9583333333,nodes=['CH2-LY07-004'],purpose='弃用旧约9–10秒问题轨，从原片完整纯台词段重新取声；删前后元说明音画'),p('21-03',norm('V21-03-UR1'),2.05,4.6,raw('V21-03-UR1'),2.05,4.6,purpose='只留真实折信递接松手收近，删空榻等待和无关原声，白名单无人声'),voice('21-04','V21-04','CH2-LY07-010'),p('21-05',FILES['V21-05'],2.58,3.7,raw('V21-05'),2.58,3.7,nodes=['CH2-LY07-011'],purpose='仅合法缺粮/退军原句，删除两端导演说明和因此拖长画面'),p('21-06',FILES['V21-06'],0,5.08,raw('V21-06'),1.15,5.08,nodes=['CH2-LY07-012'],purpose='恢复完整李严肯担责任原句，去原错误控制语句；不恢复开头身份照'),voice('21-07','V21-07','CH2-LY07-013'),p('21-08',FILES['V21-08'],2.7,5.32,raw('V21-08'),2.7,5.32,nodes=['CH2-LY07-014'],purpose='保留完整利用动机，剪掉控制字段和多余反应'),voice('21-09','V21-09','CH2-LY07-016'),p('21-10',FILES['V21-10'],1.98,5.10,raw('V21-10'),1.98,5.10,nodes=['CH2-LY07-017','CH2-LY07-018'],purpose='只留真实救人/后来欺骗两句，不回退可读纸面或局部遮罩'),voice('21-11','V21-11','CH2-LY07-024')]
 assemble('V21',parts)
if 'V22' in selected:
 seed=read(R/'audio/CH2-LY05-006-state.json');assert seed['status']=='succeeded' and seed['model']=='seed-audio-1.0'
 parts=[voice('22-01','V22-01','CH2-LY05-002'),p('22-02',FILES['V22-02'],1.7,8.4,raw('V22-02'),1.7,8.4,nodes=['CH2-LY05-003','CH2-LY05-005'],purpose='保留真实木令牌递放和拿着，不把动作剪成仅一句考试'),p('22-03-promise',FILES['V22-03'],0,3.5,seed['file'],0,3.5,nodes=['CH2-LY05-006'],purpose='缺失准确承诺使用对应苟安参考Seed-Audio1.0补齐，短镜头不保留旧元说明'),p('22-03-visit',FILES['V22-03'],7.12,2.25,raw('V22-03'),7.12,2.25,nodes=['CH2-LY05-007'],purpose='原约20秒控制说明所在音画区间3.5–7.12整体删除，只留合法访村邀请'),voice('22-04','V22-04','CH2-LY05-008'),p('22-05',FILES['V22-05'],7.03,4.49,raw('V22-05'),7.03,4.49,nodes=['CH2-LY05-009'],purpose='去掉苟安/本请求唯一等被误读字段，仅保留令牌接待及核料'),p('22-06',norm('V22-06'),6.24,5.74,raw('V22-06'),6.24,5.74,nodes=['CH2-LY05-010'],purpose='去元字段及多余营外占位，只留粮队管事完整正式批准，令牌与许可分开')]
 assemble('V22',parts)
if 'V23' in selected:
 # Existing legal inner voice was absent from old ASR. Keep all necessary grain
 # action and the actual return, overlay only the exact existing inner sentence.
 old=next(x for x in D['logicalClips'] if x['id']=='V23');x=V['CH2-LY06-012'];out=A/'V23-获准访村的连续见闻_补合法心声V1.mp4';assert sha(x['path'])==x['sha256']
 f='[0:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,volume=0.16[bed];[1:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,adelay=6500|6500[voice];[bed][voice]amix=inputs=2:duration=first:normalize=0[a]'
 subprocess.run([FF,'-v','error','-y','-i',old['path'],'-i',x['path'],'-filter_complex',f,'-map','0:v:0','-map','[a]','-c:v','copy','-c:a','aac','-ar','48000','-ac','2','-b:a','192k','-t',str(old['duration']),'-movflags','+faststart',str(out)],check=True)
 rec=dict(id='V23',file=str(out),sha256=sha(out),duration=old['duration'],oldFile=old['path'],oldSha256=old['sha256'],oldDuration=old['duration'],videoStreamCopied=True,decode='passed',sourceFiles=[old['path']],sourceHashes=[sha(old['path'])],spokenWhitelist=W['V23']['spokenWhitelist'],neverReadStageOrDocumentText=W['V23']['neverReadStageOrDocumentText'],audioRestoration=dict(node='CH2-LY06-012',file=x['path'],sha256=x['sha256'],delay=6.5,backgroundGain=.16,existingAudio=True,newTTS=False),reviewState='pending-final-review',listeningReview='pending; no audio-capable tool',userApproved=False)
 save(out.with_suffix('.json'),rec);save(R/'V23-candidate.json',rec);save(R/'V23-candidate-preview.json',[['V23',out.relative_to(O).as_posix()]]);print(json.dumps(dict(id='V23',duration=old['duration'],sha256=rec['sha256']),ensure_ascii=False),flush=True)
if 'V24' in selected:
 a=p('24-01',FILES['V24-01'],4.65,4.75,raw('V24-01'),4.65,4.75,nodes=['CH2-LY08-001'],purpose='保留那夜口述引入，删重复长等待')
 b=p('24-02',FILES['V24-02'],2.5,10.65,raw('V24-02'),2.5,10.65,nodes=['CH2-LY08-003','CH2-LY08-004'],purpose='保留完整李严原句，去空白前后等待')
 entry=dissolve('24-entry',a,b)
 c=p('24-03',FILES['V24-03'],0,12.5,raw('V24-03-R2'),.4,12.5,nodes=['CH2-LY08-005','CH2-LY08-006','CH2-LY08-007'],purpose='苟安回忆画外完整三句，李严自然听者不代说，保留合法停顿')
 d=p('24-04',FILES['V24-04'],1.85,11.30,raw('V24-04'),1.85,11.30,nodes=['CH2-LY08-008','CH2-LY08-009'],purpose='保留认错/赌前损失合法两句及自然停顿')
 e=p('24-05',FILES['V24-05'],1.98,11.47,raw('V24-05'),1.98,11.47,nodes=['CH2-LY08-010','CH2-LY08-011'],purpose='保留责任替换因果，不读角色/演出字段')
 f=p('24-06',FILES['V24-06'],0,7.01,raw('V24-06'),4.85,7.01,nodes=['CH2-LY08-012'],purpose='去头部元说明，恢复被旧8秒片截断的完整风险问句；李严闭口听')
 g=p('24-return',str(O/'edited/V24-return-reaction.mp4'),0,1.25,None,purpose='真实回当前伤帐的短反应，无新增对白；非保长占位',silent=True)
 exit=dissolve('24-exit',f,g)
 assemble('V24',[entry,c,d,e,exit])
if 'V25' in selected:
 s4=read(R/'audio/CH2-LY09-P04-state.json');s5=read(R/'audio/V25-05-clean-lines-state.json');s8=read(R/'audio/V25-08-clean-lines-state.json');assert all(x['status']=='succeeded' for x in [s4,s5,s8])
 available=[p('25-01',FILES['V25-01'],2.30,6.8,raw('V25-01'),2.30,6.8,nodes=['CH2-LY09-P01'],purpose='保留完整条件式计划引入，去开始无用等待'),voice('25-03','V25-03','CH2-LY09-P03'),p('25-04',FILES['V25-04'],.2,4.5,s4['file'],0,4.5,nodes=['CH2-LY09-P04'],purpose='必要补句已生成，ASR可能多我字，待实际听审；不在缺P02时采用整片'),p('25-05',FILES['V25-05'],2.8,7.4,s5['file'],1.65,7.35,nodes=['CH2-LY09-P05','CH2-LY09-001'],purpose='只保留尚未实施和救人动机两句，删除生成前置等待'),voice('25-06','V25-06','CH2-LY09-002'),voice('25-07','V25-07','CH2-LY09-003'),p('25-08',FILES['V25-08'],2,6.25,s8['file'],0,6,nodes=['CH2-LY09-004','CH2-LY09-005'],purpose='保留无把握与后方承受风险两句，不改变尚未实行计划边界')]
 save(R/'V25-available-components.json',dict(id='V25',status='incomplete-do-not-adopt',missingNode='CH2-LY09-P02',unknownState=str(R/'audio/CH2-LY09-P02-state.json'),components=[dict(file=s,sha256=sha(s),**{k:v for k,v in META[s].items() if k!='file'}) for s in available],oldCurrentFile=next(x['path'] for x in D['logicalClips'] if x['id']=='V25'),oldApprovalBoundToOldVersion=True,asrCaveat='P04 provider字幕准确，独立ASR首词为我知道；未听审，不称原句已通过',wholeNewV25Adopted=False))
 print('V25 non-gap components staged only; no incomplete whole-film publication.',flush=True)
save(R/'piece-recipes.json',META)
