from pathlib import Path
import json,hashlib,subprocess,re
O=Path(__file__).resolve().parent;R=O/'user-review-20261025';FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
D=read(R/'delivery-before-user-review.json');old=next(x for x in D['logicalClips'] if x['id']=='V21');assert sha(old['path'])==old['sha256']
assert read(O/'tasks/V21-03-UR1.json')['status']=='succeeded';src=O/'edited/V21-03-UR1-16x9.mp4';out=R/'V21-03-folded-letter-clean.mp4';prior=next(x['file'] for x in D['subclips'] if x['id']=='V21-03')
subprocess.run([FF,'-v','error','-y','-i',str(src),'-i',prior,'-filter_complex','[0:v]fps=24,trim=end_frame=175,settb=1/24,setpts=N,setsar=1[v]','-map','[v]','-map','1:a','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p','-fps_mode','cfr','-r','24','-c:a','copy','-movflags','+faststart',str(out)],check=True)
handoff=dict(id='V21-03',file=str(out),sha256=sha(out),source=str(src),sourceSha256=sha(src),sourceTime=[0,175/24],frameCount=175,fps=24,audioSource=prior,audioSourceSha256=sha(prior),pictureLayers=[],method='独立无对白折信交接补片，空白外背朝镜头；无卡/无字幕/无局部遮罩',reviewState='pending-dynamic-review')
out.with_suffix('.json').write_text(json.dumps(handoff,ensure_ascii=False,indent=2),encoding='utf-8')
files={x['id']:x['file'] for x in D['subclips']};files['V21-03']=str(out);files['V21-10']=str(R/'V21-10-clean-source-closeup.mp4');sources=[files[i] for i in old['subclips']]
dest=O/'assembled/user-review-20261025/V21-拆穿、第二封信与合谋供述_无字卡返修V1.mp4';dest.parent.mkdir(exist_ok=True)
args=[FF,'-v','error','-y']
for s in sources:args+=['-i',s]
args+=['-i',old['path']];f=';'.join(f'[{i}:v]fps=24,settb=1/24,setpts=N[v{i}]' for i in range(len(sources)))+';'+''.join(f'[v{i}]' for i in range(len(sources)))+f'concat=n={len(sources)}:v=1:a=0,fps=24[v]'
args+=['-filter_complex_threads','1','-filter_complex',f,'-map','[v]','-map',f'{len(sources)}:a','-fps_mode','cfr','-r','24','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p','-c:a','copy','-movflags','+faststart',str(dest)];subprocess.run(args,check=True)
dec=subprocess.run([FF,'-v','error','-nostdin','-i',str(dest),'-map','0:v:0','-an','-fps_mode','passthrough','-progress','pipe:1','-nostats','-f','null','-'],capture_output=True,text=True,encoding='utf-8',errors='replace',check=True);progress=dict(x.split('=',1) for x in dec.stdout.splitlines() if '=' in x);frames=int(progress['frame']);end=int(progress['out_time_us'])/1e6;assert frames==2061 and abs(end-85.875)<.001
def pcm(p):return subprocess.run([FF,'-v','error','-i',str(p),'-map','0:a:0','-f','s16le','-acodec','pcm_s16le','-'],capture_output=True,check=True).stdout
a=pcm(old['path']);b=pcm(dest);assert a==b
rec=dict(id='V21',file=str(dest),sha256=sha(dest),previousFile=old['path'],previousSha256=old['sha256'],duration=85.875,decodedFrames=frames,videoEndSeconds=end,fps=24,decode='passed',sourceIds=old['subclips'],sourceFiles=sources,sourceHashes=[sha(p) for p in sources],audioSource=old['path'],audioPCMUnchanged=True,audioPCMSha256=hashlib.sha256(b).hexdigest(),audioPCMBytes=len(b),reviewState='pending-final-dynamic-review',userApproved=False,reviewPolicyPending='20261025-no-meta-no-cards-no-boxes',newSubclips=[handoff,read(R/'V21-10-clean-source-closeup.json')])
dest.with_suffix('.json').write_text(json.dumps(rec,ensure_ascii=False,indent=2),encoding='utf-8');(R/'staged-V21.json').write_text(json.dumps(rec,ensure_ascii=False,indent=2),encoding='utf-8');(R/'final-v21-preview.json').write_text(json.dumps([['V21-clean',dest.relative_to(O).as_posix()]],ensure_ascii=False),encoding='utf-8')
mapping=dict(node='CH2-LY07-006',text='李丰担忧父亲的安危，劝父亲与苟安停止原先的计划。',spoken=False,sourceFile=str(O.parents[4]/'content/chapters/grain/chapter-two.source.json'),presentation='准确事实留既有设计的信息层及来源映射；不烧进影片、不新增朗读、不擅自改游戏',relatedClue='LY-C11',integrationCondition='完成一次真实接信后仍须由既有信息层呈现CH2-LY07-006全文并按原设计确认读完，不能把动画播完直接当成已读或授予线索。',supportingExistingDialogueNode='CH2-LY07-010',supportingExistingDialogue='李丰劝你和李严停手。你们究竟安排了什么？')
(R/'second-letter-information-mapping.json').write_text(json.dumps(mapping,ensure_ascii=False,indent=2),encoding='utf-8')
subprocess.run([FF,'-v','error','-y','-i',str(dest),'-vf','fps=1,scale=256:144,tile=8x12','-frames:v','1',str(R/'V21-new-1fps.jpg')],check=True);print(json.dumps(dict(file=str(dest),sha256=rec['sha256'],frames=frames,end=end,audioPCMUnchanged=True),ensure_ascii=False))
