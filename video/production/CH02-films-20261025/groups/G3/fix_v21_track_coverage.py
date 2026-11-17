from pathlib import Path
import subprocess,json,hashlib,re
O=Path(__file__).resolve().parent;R=O/'review/picture-repair';E=O/'edited/picture-usability-v5';E.mkdir(exist_ok=True)
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
P=read(O/'plan.json');D=read(O/'delivery.json');S=read(R/'staged-logical-versions.json');ov=read(R/'candidate-overrides.json');reuse={x['id']:x for x in read(R/'shared-listener-reuse.json')};old=next(x for x in D['logicalClips'] if x['id']=='V21')['path']
for id,source,a,frames in [('V21-07',reuse['G1-L01']['snapshot'],1,63),('V21-11',reuse['G4-L02']['snapshot'],2,106)]:
 n=frames/24;voice=ov[id]['existingCentralVoice'];assert voice['duration']+.4<n
 out=E/(id+'-natural-cfr24.mp4')
 subprocess.run([FF,'-v','error','-y','-ss',str(a),'-i',source,'-i',voice['path'],'-filter_complex',f'[0:v]trim=duration={n},setpts=PTS-STARTPTS,fps=24[v];[1:a]adelay=400|400,apad,atrim=duration={n}[a]','-map','[v]','-map','[a]','-frames:v',str(frames),'-fps_mode','cfr','-r','24','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p','-c:a','aac','-ar','48000','-movflags','+faststart',str(out)],check=True)
 previous=dict(ov[id]);ov[id]=dict(id=id,file=str(out),sha256=sha(out),estimatedDuration=n,sourceSegments=[dict(file=source,sha256=sha(source),sourceTime=[a,a+n],playbackRate=1)],existingCentralVoice=voice,previousCandidate=previous,reviewState='pending-final-dynamic-review',fullSourceLinesPreserved=True,noLoop=True,noFrozenMouth=True,noAdditionalSlowdown=True,repairReason='替换旧输出端-t截短的慢放片段；共享素材1x自然前向完整帧，统一CFR24，保留原玩家中央音轨。')
files={x['id']:x['file'] for x in D['subclips']};files.update({i:x['file'] for i,x in ov.items() if not x.get('reviewState','').startswith('rejected')});ids=next(x for x in P['logicalClips'] if x['id']=='V21')['subclips'];sources=[files[i] for i in ids]
out=O/'assembled/V21-拆穿、第二封信与合谋供述_画面修复V4.mp4';args=[FF,'-v','error','-y']
for p in sources:args+=['-i',p]
args+=['-i',old];f=';'.join(f'[{i}:v]fps=24,settb=1/24,setpts=N[v{i}]' for i in range(len(sources)))+';'+''.join(f'[v{i}]' for i in range(len(sources)))+f'concat=n={len(sources)}:v=1:a=0,fps=24[v]'
args+=['-filter_complex_threads','1','-filter_complex',f,'-map','[v]','-map',f'{len(sources)}:a','-fps_mode','cfr','-r','24','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p','-c:a','copy','-movflags','+faststart',str(out)]
subprocess.run(args,check=True)
result=subprocess.run([FF,'-v','error','-nostdin','-i',str(out),'-map','0:v:0','-an','-fps_mode','passthrough','-progress','pipe:1','-nostats','-f','null','-'],capture_output=True,text=True,encoding='utf-8',errors='replace',check=True)
progress=dict(line.split('=',1) for line in result.stdout.splitlines() if '=' in line);frames=int(progress['frame']);end=int(progress['out_time_us'])/1e6;assert frames==2061 and abs(end-85.875)<.05,(frames,end)
# Decode original and new audio into PCM: complete samples must be identical.
def audio_pcm(p):return subprocess.run([FF,'-v','error','-i',str(p),'-map','0:a:0','-f','s16le','-acodec','pcm_s16le','-'],capture_output=True,check=True).stdout
before=audio_pcm(old);after=audio_pcm(out);assert before==after,'Whole existing audio must be preserved sample-for-sample'
coverage=dict(file=str(out),sha256=sha(out),decodedFrames=frames,videoEndSeconds=end,frameSecondsAt24fps=frames/24,expectedAudioContainerSeconds=85.863667,audioPCMBytes=len(after),audioPCMHash=hashlib.sha256(after).hexdigest(),oldAudioPCMHash=hashlib.sha256(before).hexdigest(),audioSampleIdentical=True,status='technical-coverage-passed',method='独立视频解码progress/帧数/末PTS＋完整解码PCM逐样本一致，非视觉审核')
(R/'V21-v4-track-coverage.json').write_text(json.dumps(coverage,ensure_ascii=False,indent=2),encoding='utf-8')
rec=dict(S['V21']);rec.update(file=str(out),sha256=sha(out),sourceFiles=sources,sourceHashes=[sha(p) for p in sources],previousFile=old,reviewState='pending-final-dynamic-review',coverageProof=str(R/'V21-v4-track-coverage.json'),assemblyMethod='concat filter using decoded frame index, CFR24; retain previous full audio unchanged',audioSourceFile=old,audioSourceSha256=sha(old));out.with_suffix('.json').write_text(json.dumps(rec,ensure_ascii=False,indent=2),encoding='utf-8');S['V21']=rec
for name,x in [('candidate-overrides.json',ov),('staged-logical-versions.json',S),('staged-preview-V21-v4.json',[['V21-V4',out.relative_to(O).as_posix()]])]: (R/name).write_text(json.dumps(x,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(coverage,ensure_ascii=False))
