"""G4 user-review repair. New files only; historical requests/comments remain immutable."""
from pathlib import Path
from datetime import datetime,timezone,timedelta
import json,hashlib,subprocess,av,io,math,sys,os,numpy as np
from PIL import Image,ImageDraw
O=Path(__file__).resolve().parent;B=O.parents[1];U=O/'user-review-20261025';U.mkdir(exist_ok=True)
R=B/'reviews/user-20261025-1549'
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,d):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def now():return datetime.now(timezone(timedelta(hours=8))).isoformat(timespec='seconds')
def run(a):subprocess.run([FF,'-hide_banner','-loglevel','error','-y',*map(str,a)],check=True,capture_output=True)
def video(p):
 with av.open(str(p)) as c:
  v=c.streams.video[0];return dict(frames=v.frames,fps=str(v.average_rate),duration=float(v.duration*v.time_base),containerDuration=c.duration/1e6,resolution=[v.width,v.height])
def audio_packet_sha(p):
 h=hashlib.sha256()
 with av.open(str(p)) as c:
  for pkt in c.demux(audio=0):
   if pkt.size:h.update(bytes(pkt))
 return h.hexdigest()

mode=sys.argv[1] if len(sys.argv)>1 else 'prepare'
if mode=='prepare':
 d=read(O/'delivery.json');snap={x['id']:x for x in read(R/'version-snapshot.json')['clips'] if x['owner']=='G4'}
 for c in d['clips']:assert sha(Path(c['file']))==c['technical']['sha256']==snap[c['id']]['sha256']
 if not (U/'delivery-before.json').exists():save(U/'delivery-before.json',d)
 sources=[R/'返修要求.md',R/'comments.json',R/'version-snapshot.json']
 reqs={str(p):sha(p) for p in (O/'requests').glob('*.json')}
 save(U/'protected-input-identities.json',dict(userReviewInputs={str(p):sha(p) for p in sources},historicalRequests=reqs))
 clips=[]
 for c in d['clips']:
  issue=c['id']=='V26'
  clips.append(dict(id=c['id'],userComment=None,globalCorrections=read(R/'comments.json')['globalCorrections'],oldFile=c['file'],oldSha256=c['technical']['sha256'],reviewSnapshotMatches=True,oldRange=[400/24,544/24] if issue else [0,c['technical']['duration']],classification='burned-in-document-prose' if issue else 'global-scan-pending',status='confirmed-awaiting-local-recut' if issue else 'pending-scan',newFile=None,newSha256=None,visualEvidence=[],audioIssues=['仅标注待统一，未听审；本轮G4不新增TTS'],userApproved=False,observedOldPictureApproved=snap[c['id']]['observedPictureApproved']))
 save(O/'user-review-repair.json',dict(group='G4',createdAt=now(),prioritySource=str(R/'返修要求.md'),status='user-review-global-scan-and-repair-in-progress',clips=clips,userApproved=False,newAPIRequests=0,newTTSRequests=0))
 old=Path(next(c['file'] for c in d['clips'] if c['id']=='V26'));src=O/'generated/V26-04-R2-16x9.mp4';dst=U/'V26-返营交差与军情说明-用户返修无正文V3.mp4'
 # Decoded boundary inspection shows text begins at frame 400 and ends at frame 543.
 # Replace exactly 144 frames, preserving the complete original assembled audio packets.
 fc='[0:v]trim=end_frame=400,setpts=PTS-STARTPTS[a];[1:v]trim=start_frame=0:end_frame=144,setpts=PTS-STARTPTS[b];[0:v]trim=start_frame=544,setpts=PTS-STARTPTS[c];[a][b][c]concat=n=3:v=1:a=0[v]'
 if not dst.exists():run(['-i',old,'-i',src,'-filter_complex',fc,'-map','[v]','-map','0:a:0','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p','-r','24','-c:a','copy','-movflags','+faststart',dst])
 assert video(dst)['frames']==video(old)['frames']==1367
 assert audio_packet_sha(old)==audio_packet_sha(dst)
 save(U/'V26-candidate.json',dict(id='V26',oldFile=str(old),oldSha256=sha(old),file=str(dst),sha256=sha(dst),source=str(src),sourceSha256=sha(src),replacedOldFrames=[400,544],replacedOldRange=[400/24,544/24],sourceRange=[0,6],oldTechnical=video(old),newTechnical=video(dst),audioPacketSha256=audio_packet_sha(dst),audioPacketsUnchanged=True,operation='原无字纸面连续运动替换144帧，无叠字/模糊/遮罩/静帧/循环，不改音轨；原片保留',userApproved=False))
 facts=dict(node='CH2-LY09-009',originalExactText='敌方正在修整粮道、筹集军资，并恢复屯田。',source='冻结逐句源，不删改',oldRendering='纸面透视叠字（用户新标准停用）',newRendering='仅真实无字道具观察；不在影片烧正文、卡片或列表',existingDialogueAnchors=[dict(node='CH2-LY09-018',text='丞相答应这次退军了。魏军还在修路积粮，往后的风险也得想。'),dict(node='CH2-LY09-013',text='他担心休兵这段日子，魏军修田积粮，将来更难打。')],integration='精确剧情事实继续由冻结原文/既有对白及原设计游戏信息层承载，本轮仅另存来源映射；未擅自新增朗读或修改游戏。声音仍待统一处理。')
 save(U/'V26-source-fact-mapping.json',facts)
 candidates=[dict(c,file=str(dst),path=str(dst)) if c['id']=='V26' else c for c in d['clips']]
 save(U/'scan-candidates.json',dict(clips=candidates))
 # Fresh page path means old ID-only playback history cannot stand in for this review.
 h=(O/'review-assembled.html').read_text(encoding='utf-8');data=[];p=read(O/'plan.json')
 for c in candidates:data.append(dict(id=c['id'],src=Path(c['file']).relative_to(O).as_posix(),expected=' / '.join(l['text'] for x in p['clips'] if x['slot']==c['id'] for l in x['lines']),silent=c['id']=='L02'))
 a=h.index('const data=');b=h.index(';\nconst s=',a);h=h[:a]+'const data='+json.dumps(data,ensure_ascii=False)+h[b:]
 (O/'review-user-20261025-1549.html').write_text(h,encoding='utf-8')
 print(json.dumps(dict(candidate=str(dst),sha256=sha(dst),audioPacketsUnchanged=True),ensure_ascii=False))

if mode=='extract':
 for c in read(U/'scan-candidates.json')['clips']:
  p=Path(c['file']);dur=video(p)['duration'];targets=list(range(0,math.ceil(dur*2),1));frames={int(t/2*24):t/2 for t in targets if t/2<dur};frames[max(0,round(dur*24)-1)]=max(0,dur-1/24)
  sheet=Image.new('RGB',(1280,166*((len(frames)+4)//5)),'#202020');draw=ImageDraw.Draw(sheet);i=0
  with av.open(str(p)) as cont:
   for n,f in enumerate(cont.decode(video=0)):
    if n in frames:
     x=i%5*256;y=i//5*166;sheet.paste(f.to_image().resize((256,144)),(x,y));draw.text((x+3,y+146),f'{c["id"]} {n/24:.3f}s',fill='white');i+=1
  folder=U/'scan';folder.mkdir(exist_ok=True);sheet.save(folder/(c['id']+'.jpg'))
  print(c['id'],i,flush=True)

if mode=='templates':
 plan=read(O/'plan.json');folder=U/'new-request-templates';folder.mkdir(exist_ok=True)
 listen=B/'references/source-frames/gouan-talk.png'
 desk=read(O/'requests/V26-04-R2.local.json')['content'][1:]
 clerk=read(O/'requests/V26-08-R2.local.json')['content'][1:]
 rows=[]
 for c in plan['clips']:
  whitelist=[] if c['silent'] or c['audioOverlay'] else [l['text'] for l in c['lines']]
  if c['id']=='V26-02':visual='Single continuous first-person view at this exact receiving desk. The same clerk gently checks the closed tied bamboo bundle, without opening any pages or adding any item. Only his hands perform that small check.';refs=clerk
  elif c['id'] in ['V26-04','V26-05','V29-02','V29-07']:visual='Single continuous first-person observation of this exact wooden desk. Only the unmarked paper and ordinary desk objects remain in view. Gentle natural camera motion. No hands or new objects enter.';refs=desk
  elif c['refset']=='clerk':visual='Single continuous first-person eye-level shot of the same seated receiving clerk at the supplied desk, preserving identity, clothes and setting. Hands remain resting. No exchange, signing, writing or new object.';refs=clerk
  else:
   visual='Single continuous first-person shot of Gou An resting on his rope bed exactly as in the supplied frame, same identity, clothing, pose and light. Quiet breathing and natural eyes only. Arms stay resting, no object or other person enters.'
   refs=[dict(type='image_url',role='first_frame',image_url=dict(local_path=str(listen)))]
  visual+=' No player face, body, reflection or over-the-shoulder view. No captions, writing, titles, labels, cards, lists, tables, screen text, blur patches, masks, mosaic or overlays. Real paper props must stay unmarked or seen obliquely out of focus through natural photography; do not add postproduction panels.'
  if whitelist:
   utter='\n'.join('Allowed utterance '+str(i+1)+': '+json.dumps(t,ensure_ascii=False) for i,t in enumerate(whitelist))
   audio=f'SPOKEN DIALOGUE WHITELIST. Voice identity is the one on-screen adult male; calm natural Mandarin. Speak only the exact quoted utterance, beginning after 0.4 seconds and finishing by {c["duration"]-0.5:g} seconds. Only this visible man owns its lip movement.\n'+utter+'\nAll labels, identities, speaker names outside the quoted utterance, narration tags, timestamps and instructions are control information and must never be spoken. Add no words and no voice-over. No other voice.'
  else:audio='SPOKEN DIALOGUE WHITELIST IS EMPTY. No dialogue, no narration, no extra human voice, no muttering or reading. Any visible man listens with lips gently closed. Quiet breathing or a natural blink is allowed, but no sustained speaking mouth shapes.'
  audio+=' No BGM, no background music, no score, no singing or musical rhythm. Only soft location ambience and action-synchronous natural sound.'
  body=dict(model='MiniMax-H3',duration=c['duration'],resolution='768P',ratio='16:9',content=[dict(type='text',text=visual+'\n\n'+audio)]+refs)
  save(folder/(c['id']+'.local.json'),body)
  rows.append(dict(id=c['id'],sourceNodes=c['sourceNodes'],requestTemplate=str(folder/(c['id']+'.local.json')),spokenWhitelist=[dict(text=t,voiceIdentity='on-screen adult male',voicePosition='on-screen',start=.4,end=c['duration']-.5) for t in whitelist],existingPlayerVoiceOnly=c['audioOverlay'],fixedVoiceForbidden=c['slot']=='L02',sourceTextNotSubmittedAsSpeech=[l for l in c['lines']] if not whitelist else [],state='unsubmitted-template-not-a-paid-request'))
 save(folder/'manifest.json',dict(group='G4',createdAt=now(),scope='future unsubmitted request templates only; never overwrite historical submitted request',clips=rows,newAPIRequests=0,newTTSRequests=0,submitPolicy=dict(durationAtMost=15,minPollSecondsPerID=120,unknownPOSTNeverResubmit=True,maxLocalRevisionVariants=2)))
 print('New whitelist templates',len(rows),'no submissions')

if mode=='integrity':
 rows=[]
 for c in read(U/'scan-candidates.json')['clips']:
  p=Path(c['file']);count=0;first=None;last=None;lastdur=None;prev=None;deltas=[];black=[]
  with av.open(str(p)) as cont:
   v=cont.streams.video[0];v.thread_type='AUTO';meta=video(p)
   for n,f in enumerate(cont.decode(v)):
    count+=1;t=float(f.pts*f.time_base);dur=float(f.duration*f.time_base) if f.duration else 1/24
    if first is None:first=t
    if prev is not None:deltas.append(t-prev)
    prev=t;last=t;lastdur=dur
    y=np.frombuffer(f.planes[0],dtype=np.uint8).reshape(f.height,f.planes[0].line_size)[:,:f.width][::16,::16]
    if y.mean()<18 and y.std()<2:black.append(n)
  assert count and all(abs(x-1/24)<1e-6 for x in deltas)
  assert meta['containerDuration']-(last+lastdur)<1/24+1e-6
  rows.append(dict(id=c['id'],file=str(p),sha256=sha(p),actualDecodedFrames=count,firstPts=first,lastPts=last,videoEnd=last+lastdur,containerDuration=meta['containerDuration'],containerTail=max(0,meta['containerDuration']-last-lastdur),allPts24fps=True,fullBlackFrameSuspects=black,blackScreenCheck='每帧亮度平面16像素步长采样，mean<18且std<2标疑似全黑；与原速复播/视觉时序检查合用，不能替代审片',decodeCompleted=True))
  print(c['id'],count,'black',len(black),flush=True)
 save(U/'track-integrity.json',dict(createdAt=now(),clips=rows,visualMeaningNotAutomaticallyApproved=True))

if mode=='publish':
 assert (U/'full-playback-complete.png').exists(),'Wait for actual native full queue completion'
 integrity={x['id']:x for x in read(U/'track-integrity.json')['clips']}
 old=read(U/'delivery-before.json');current=read(O/'delivery.json')
 assert [(c['id'],c['file'],c['technical']['sha256']) for c in old['clips']]==[(c['id'],c['file'],c['technical']['sha256']) for c in current['clips']], 'Concurrent G4 delivery change'
 protected=read(U/'protected-input-identities.json')
 for group in protected.values():
  for p,h in group.items():assert sha(Path(p))==h,'Protected original changed: '+p
 templates=read(U/'new-request-templates/manifest.json')
 assert len(templates['clips'])==37
 for row in templates['clips']:
  body=read(Path(row['requestTemplate']));assert 4<=body['duration']<=15
  assert body['content'][0]['type']=='text' and 'WHITELIST' in body['content'][0]['text'] and 'No BGM' in body['content'][0]['text']
  for ref in body['content'][1:]:assert Path(ref['image_url']['local_path']).exists()
 candidate=read(U/'V26-candidate.json');assert candidate['audioPacketsUnchanged'] and audio_packet_sha(Path(candidate['file']))==audio_packet_sha(Path(candidate['oldFile']))
 policy='20261025-no-meta-no-cards-no-boxes';stamp=now()
 notes={
 'V26':'16.666667–22.666667秒纸面准确正文叠层已退回同场原始无字纸面连续镜头。其余收卷/军吏交谈/案头无工作文档正文、字幕列表、方框模糊或暗影补丁；仅保留自然光影、真实道具和原有裁幅。',
 'V27':'掀帐帘、苟安听者与答句逐段检查，未见文字卡、屏幕标签、字幕列表或方框遮罩；原净片保留。',
 'V28A':'听者和苟安答句均为原场景人物，未见文字/列表/矩形模糊暗影；原净片保留。',
 'V28B':'人物与营帐背景、后景人员经过均无文字卡或补丁；无字幕列表/方框模糊，原净片保留。',
 'V28C':'玩家承诺的闭口听者及NPC答句无屏幕文字/流程说明/方框遮罩；原净片保留。',
 'V29':'军吏及无字案头观察段检查，纸面保持无字道具，不出现精确正文、伪造字卡、字幕列表或方框模糊补丁；原净片保留。',
 'V30':'苟安提问的全片未见烧录文字、字幕列表或局部方框遮罩；原净片保留。',
 'L02':'闭口听者全片无任何固定对白文字、说明卡或方框遮罩；文件保留。仍仅确认本次原话后单播，等待判定末帧保留，不造固定话。',
 'V31T':'单人短回应全片无文字卡、字幕列表或局部方框模糊/暗影；原净片保留。',
 'V31D':'单人短回应全片无文字卡、字幕列表或局部方框模糊/暗影；原净片保留。',
 'V31R':'单人短回应全片无文字卡、字幕列表或局部方框模糊/暗影；原净片保留。',
 'V31A':'单人短回应全片无文字卡、字幕列表或局部方框模糊/暗影；原净片保留。',
 'V31N':'单人短回应全片无文字卡、字幕列表或局部方框模糊/暗影；原净片保留。',
 'V32R':'拒绝短回应全片无文字卡、字幕列表或局部方框模糊/暗影；原净片保留。'}
 repair=read(O/'user-review-repair.json');usability=read(O/'review/picture-usability.json');umap={x['id']:x for x in usability['clips']}
 for row in repair['clips']:
  cid=row['id'];info=integrity[cid];assert not info['fullBlackFrameSuspects']
  file=Path(info['file']);h=sha(file);assert h==info['sha256']
  row.update(status='repaired-and-rechecked' if cid=='V26' else 'scanned-clean-retained',classification='burned-in-document-prose-removed' if cid=='V26' else 'no-new-policy-visual-defect-found',newFile=str(file),newSha256=h,changed=cid=='V26',reviewPolicy=policy,checkedAt=stamp,checkedRange=[0,info['containerDuration']],observations=notes[cid],unresolvedVisualIssues=[],audioReview='未听审，未新增TTS；G4本轮只记录声音问题，不能宣称元说明误读/BGM/逐字声音已通过',userApproved=False)
  row['visualEvidence']=[dict(method='本轮独立历史页原速从头完整播放，与每0.5秒全程时序帧人工检查合用',range=[0,info['containerDuration']],file=str(file),sha256=h,playbackEvidence=str(U/'full-playback-complete.png'),temporalEvidence=str(U/'scan'/f'{cid}.jpg')),dict(method='真实完整解码/每帧PTS及全黑帧辅助检查',file=str(U/'track-integrity.json'))]
  if cid=='V26':row.update(operation=candidate['operation'],oldFrames=[400,544],sourceRange=[0,6],sourceFile=candidate['source'],sourceSha256=candidate['sourceSha256'],audioPacketsUnchanged=True,audioPacketSha256=candidate['audioPacketSha256'],sourceFactMapping=str(U/'V26-source-fact-mapping.json'),boundaryEvidence=str(U/'V26-old-document-boundaries.jpg'))
  u=umap[cid]
  if cid=='V26':
   u.setdefault('versionHistory',[]).append(dict(file=u['file'],sha256=u['sha256'],observations=u.get('observations'),supersededBecause='用户2026-10-25新标准否定准确正文烧入影片'))
   u.update(file=str(file),sha256=h,previousFile=candidate['oldFile'],previousSha256=candidate['oldSha256'],additionalEvidence=[str(U/'V26-source-fact-mapping.json')])
  u.update(reviewPolicy=policy,reviewState='complete',userApproved=False,observations=notes[cid],policyCheckedAt=stamp)
  u.setdefault('dynamicChecks',[]).append(dict(method='用户实审新标准复核：完整原速播放 + 每0.5秒时序人工检查；声音未通过',file=str(file),sha256=h,reviewedRanges=[[0,info['containerDuration']]],evidence=str(U/'full-playback-complete.png'),timeline=str(U/'scan'/f'{cid}.jpg'),reviewPolicy=policy))
  for key in ['clips','slots']:
   c=next(x for x in current[key] if x['id']==cid)
   if cid=='V26':
    c.update(file=str(file),path=str(file),sha256=h,previousFile=candidate['oldFile'],previousSha256=candidate['oldSha256'])
    c['technical'].update(sha256=h,bytes=file.stat().st_size,duration=round(info['containerDuration'],2),actualDecodedFrames=info['actualDecodedFrames'],lastPts=info['lastPts'],videoEnd=info['videoEnd'])
   c.update(reviewPolicy=policy,userApproved=False,userReviewRepair=str(O/'user-review-repair.json'))
   c['visualReview']=dict(status='本轮新标准制作实查完成，待用户review',report=str(O/'review/picture-usability.json'),reviewPolicy=policy,sha256=h)
 repair.update(status='new-policy-picture-review-complete-audio-pending-user-review',completedAt=stamp,reviewPolicy=policy,summary=dict(scanned=14,locallyRepaired=1,cleanRetained=13,unresolvedVisual=0,userApproved=0,newAPIRequests=0,newTTSRequests=0),requestTemplates=str(U/'new-request-templates/manifest.json'),historicalRequestsUnchanged=True,userCommentsAndSnapshotUnchanged=True,unresolved=['本组原声未完成逐字/元说明/BGM听审，声音留后续统一，不虚称通过。','L02接入条件须保持确认本次原话后单播及末帧等待判定，本轮未改游戏。'])
 usability.update(updated=stamp,stage='用户2026-10-25新标准14槽画面复核完成：V26回源无正文，13净片保留；声音待统一，用户未通过')
 current.update(status='G4用户2026-10-25新标准画面扫查完成；V26回源重剪，13净片保留；声音待统一，用户待review',updated=stamp,userApproved=False,userReviewRepair=str(O/'user-review-repair.json'))
 current['visualReview'].update(reviewPolicy=policy,pictureUsabilityReport=str(O/'review/picture-usability.json'),actualPlaybackEvidence=str(U/'full-playback-complete.png'),assembledSlotsPlayed=14)
 current.setdefault('pictureUsability',{})['reviewPolicy']=policy
 sub=read(U/'V26-04.json')
 current['subclips']=[sub if c['id']=='V26-04' else c for c in current['subclips']]
 # All three outputs are prepared before publishing; each identity-bearing JSON replacement is atomic.
 for p,d in [(O/'user-review-repair.json',repair),(O/'review/picture-usability.json',usability),(O/'delivery.json',current)]:
  tmp=p.with_name(p.name+'.tmp');save(tmp,d);os.replace(tmp,p)
 status=read(O/'status.json');status.update(stage=current['status'],reviewPolicy=policy,userReviewRepair=str(O/'user-review-repair.json'),userApproved=False,updated=stamp);save(O/'status.json',status)
 selection=read(O/'review/selection.json');selection['V26-04'].update(source=candidate['source'],start=0,end=6,speed=1,review='用户新标准停用准确正文叠字。采用原无字纸面连续视频，不再调用旧叠字素材；原音轨以整片AAC包原样保留。',textOverlay=False,adoptedAssemblyVersion=candidate['file']);save(O/'review/selection.json',selection)
 index=['# G4 用户实审新标准返修交付','',f'更新：{stamp}。14段已按{policy}完成本轮画面制作实查；用户待review，声音待统一。','',f'[返修与逐片扫描报告]({(O/"user-review-repair.json").as_posix()})','', '| 槽位 | 本轮处理 | 当前文件 |','|---|---|---|']
 for c in current['clips']:index.append(f'| {c["id"]} | {"回源连续镜头撤正文，原音轨保留" if c["id"]=="V26" else "新标准净片扫描后保留"} | [{Path(c["file"]).name}]({Path(c["file"]).as_posix()}) |')
 index+=['','V26替换原版16.666667–22.666667秒的144帧；精确事实另存来源映射，未改剧本或游戏。旧片、用户原评论和原通过状态均保留。','','L02仍在确认本次原话后单播，结束保持真实末帧等待判定/回应，不自动循环或推进；没有固定玩家台词。','','新增API请求0，新增TTS0；37份未来请求模板已按纯对白白名单更新，历史已提交请求未改。']
 (O/'交付索引.md').write_text('\n'.join(index)+'\n',encoding='utf-8')
 print(json.dumps(repair['summary'],ensure_ascii=False))
