"""User-comment repairs anchored to immutable 15:49 source SHA. G1 only."""
from pathlib import Path
import json,subprocess,hashlib,time,re,sys
O=Path(__file__).resolve().parent;B=O.parents[1];S=B/'reviews/user-20261025-1549';D=O/'user-review-20261025';D.mkdir(exist_ok=True)
F='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
def rd(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,x):
 p.parent.mkdir(parents=True,exist_ok=True);t=p.with_suffix(p.suffix+'.pending');t.write_text(json.dumps(x,ensure_ascii=False,indent=2),encoding='utf-8');t.replace(p)
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def run(a):return subprocess.run([F,'-v','error','-y']+list(map(str,a)),check=True,capture_output=True)
def dur(p):
 s=subprocess.run([F,'-hide_banner','-i',str(p)],capture_output=True,text=True,encoding='utf-8',errors='replace').stderr;m=re.search(r'Duration: (\d+):(\d+):([\d.]+)',s);return int(m[1])*3600+int(m[2])*60+float(m[3])
snapshot={x['id']:x for x in rd(S/'version-snapshot.json')['clips'] if x['owner']=='G1'};comments=rd(S/'comments.json');voice=rd(B/'voice/manifest.json')['rows'];reportpath=O/'user-review-repair.json'
def init():
 if reportpath.exists():return
 rows=[]
 for sid,x in snapshot.items():
  assert sha(x['file'])==x['sha256']
  if sid in comments['notes']:rows.append(dict(id=sid,userComment=comments['notes'][sid],oldFile=x['file'],oldSha256=x['sha256'],oldDuration=dur(x['file']),oldInterval=None,status='pending',classification='picture' if sid in ['V02','V03A'] else 'audio-and-video-delete' if sid=='V08B' else 'audio',repairs=[],newFile=None,newSha256=None,checks={},unresolved=[],previousPictureUserApproved=x['observedPictureApproved'],userApproved=False))
 save(reportpath,dict(group='G1',status='in-progress-user-review-repair',sourceComments=str(S/'comments.json'),versionSnapshot=str(S/'version-snapshot.json'),comments=rows,globalPictureSweep=[dict(id=sid,file=x['file'],sha256=x['sha256'],status='pending',observedPictureApproved=x['observedPictureApproved'],textCards=None,visibleRectangleOrBlurPatch=None) for sid,x in snapshot.items()],notes=['用户意见优先于此前可用结论。','不修改原评论/原片，不改中央76音轨。','新版本重新审核，旧画面通过不直接移到新SHA。']))
def record(sid,file,interval,treatment,extra=None):
 r=rd(reportpath);x=next(x for x in r['comments'] if x['id']==sid);x.update(oldInterval=interval,status='candidate-awaiting-real-check',newFile=str(file),newSha256=sha(file),newDuration=dur(file));x['repairs'].append(dict(treatment=treatment,oldRange=interval,newFile=str(file),newSha256=x['newSha256'],**(extra or {})));save(reportpath,r)
def simple():
 init()
 # User specifically requests B's picture with A's exact existing original line.
 out=D/'V03A-按B画面配A原句-R1.mp4';v=voice['CH2-LY02-003'];length=dur(snapshot['V03B']['file'])
 run(['-i',snapshot['V03B']['file'],'-i',v['path'],'-filter_complex',f'[1:a]adelay=300:all=1,apad,atrim=duration={length}[a]','-map','0:v','-map','[a]','-c:v','copy','-c:a','aac','-ar','48000','-movflags','+faststart',out]);record('V03A',out,[0,dur(snapshot['V03A']['file'])],'按用户指定复用B画面，完整A既有原句0.3秒起；无B原声，无新TTS。',dict(pictureSource=snapshot['V03B']['file'],pictureSourceSha256=snapshot['V03B']['sha256'],audioSource=v['path'],audioSha256=v['sha256'],text=v['text']))
 for sid,af,interval,note in [('V07',"volume=0:enable='lt(t,3)'",[0,3],'前3秒只静音，视频码流与其他声音保持。'),('L01','volume=0',[0,dur(snapshot['L01']['file'])],'动态听者无固定台词；清除全部乱声/非授权人声，不伪造TTS文本。')]:
  out=D/f'{sid}-用户指定静音-R1.mp4';run(['-i',snapshot[sid]['file'],'-c:v','copy','-af',af,'-c:a','aac','-ar','48000','-movflags','+faststart',out]);record(sid,out,interval,note)
 print('V03A,V07,L01 candidates ready',flush=True)
def cuts():
 sid='V11N';out=D/'V11N-只静音误读姓名-R1.mp4'
 run(['-i',snapshot[sid]['file'],'-c:v','copy','-af',"volume=0:enable='between(t,1.76,2.395)'",'-c:a','aac','-ar','48000','-movflags','+faststart',out]);record(sid,out,[1.76,2.395],'仅静音约2秒误读姓名；保留后续先看/先看看及其余音画。',dict(locator=str(D/'inspection/V11N-asr.json'),locatorLimit='ASR字级时间仅辅助定位，不冒称逐字听审'))
 sid='V08B';out=D/'V08B-脏段音画一并删除-R1.mp4';a=101/24;b=241/24
 fl=f'[0:v]trim=start=0:end={a},setpts=PTS-STARTPTS[v0];[0:a]atrim=start=0:end={a},asetpts=PTS-STARTPTS[a0];[0:v]trim=start={b},setpts=PTS-STARTPTS[v1];[0:a]atrim=start={b},asetpts=PTS-STARTPTS[a1];[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]'
 run(['-i',snapshot[sid]['file'],'-filter_complex',fl,'-map','[v]','-map','[a]','-c:v','libx264','-crf','18','-preset','fast','-r','24','-c:a','aac','-ar','48000','-movflags','+faststart',out]);record(sid,out,[a,b],'按用户删除脏声音及同段画面；由约5–10秒微调为完整去掉等来/我画外…不容易段，不裁掉前面两句正常安慰。',dict(requestedRange=[5,10],sourceKeptRanges=[[0,a],[b,dur(snapshot[sid]['file'])]],locator=str(D/'inspection/V08B-asr.json')))
 print('V11N and V08B cut candidates ready',flush=True)
def restore_camp():
 sid='V02';out=D/'V02-恢复营外士兵完整沟通-R1.mp4';old=snapshot[sid]['file'];camp=Path('C:/Users/zhousirui/Documents/ChatGPT/逆转五丈原/video/current/LI02A-granary-20261018.mp4');a=4.6
 fl=f'[0:v]trim=end={a},setpts=PTS-STARTPTS[v0];[0:a]atrim=end={a},asetpts=PTS-STARTPTS[a0];[1:v]scale=1280:720,setsar=1,setpts=PTS-STARTPTS[v1];[1:a]aresample=48000,asetpts=PTS-STARTPTS[a1];[0:v]trim=start={a},setpts=PTS-STARTPTS[v2];[0:a]atrim=start={a},asetpts=PTS-STARTPTS[a2];[v0][a0][v1][a1][v2][a2]concat=n=3:v=1:a=1[v][a]'
 run(['-i',old,'-i',camp,'-filter_complex',fl,'-map','[v]','-map','[a]','-c:v','libx264','-crf','18','-preset','fast','-r','24','-c:a','aac','-ar','48000','-movflags','+faststart',out]);record(sid,out,[4.6,4.6],'按用户恢复旧版LI02A营外士兵完整沟通：引入第四次北伐后接原声交流，再接既有心声/入帐/认人，不用单薄空营道代替交流。',dict(restoredSource=str(camp),restoredSourceSha256=sha(camp),restoredSourceRange=[0,dur(camp)],insertedAt=4.6,restoredDialogue='这批粮才送到／迟了十日／督粮的苟安已被丞相杖责八十／苟安？他在哪儿？／那边帐里养伤',oldRestKept=True))
 print('V02 restored camp candidate ready',flush=True)
if __name__=='__main__':
 init()
 if len(sys.argv)>1 and sys.argv[1]=='simple':simple()
 if len(sys.argv)>1 and sys.argv[1]=='cuts':cuts()
 if len(sys.argv)>1 and sys.argv[1]=='restore-camp':restore_camp()
