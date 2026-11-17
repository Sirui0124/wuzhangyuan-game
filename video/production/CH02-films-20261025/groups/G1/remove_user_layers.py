"""Return to unlayered source; never reveal fake document writing."""
from user_repair import *
def global_record(sid,out,oldrange,note,details):
 r=rd(reportpath);r.setdefault('globalRepairs',[]);row=dict(id=sid,requirement='20261025-no-meta-no-cards-no-boxes',oldFile=snapshot[sid]['file'],oldSha256=snapshot[sid]['sha256'],oldInterval=oldrange,newFile=str(out),newSha256=sha(out),newDuration=dur(out),status='candidate-awaiting-real-check',treatment=note,details=details,userApproved=False)
 r['globalRepairs']=[x for x in r['globalRepairs'] if x['id']!=sid]+[row];save(reportpath,r)
def v08a():
 sid='V08A';old=snapshot[sid]['file'];first=rd(O/'assembled/V08A-assembly.json')['subclips'][0]['slotEnd'];out=D/'V08A-撤遮字层改真实倾听镜头-R1.mp4';a=O/'edited/V03A-01-normalized.mp4';b=O/'edited/V09-01-normalized.mp4';v=voice['CH2-LY02-018'];part=D/'V08A-clean-listening.mp4'
 fl='[0:v]trim=end=5.75,setpts=(PTS-STARTPTS)/0.9,crop=1024:576:128:0,scale=1280:720,setsar=1[v0];[1:v]trim=end=3.25,setpts=(PTS-STARTPTS)/0.9,scale=1280:720,setsar=1[v1];[v0][v1]concat=n=2:v=1:a=0[v];[2:a]adelay=300:all=1,apad,atrim=duration=10[a]'
 run(['-i',a,'-i',b,'-i',v['path'],'-filter_complex',fl,'-map','[v]','-map','[a]','-t','10','-c:v','libx264','-crf','18','-preset','fast','-r','24','-c:a','aac','-ar','48000',part])
 fl=f'[0:v]setpts=PTS-STARTPTS[v0];[0:a]asetpts=PTS-STARTPTS[a0];[1:v]trim=start={first},setpts=PTS-STARTPTS[v1];[1:a]atrim=start={first},asetpts=PTS-STARTPTS[a1];[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]'
 run(['-i',part,'-i',old,'-filter_complex',fl,'-map','[v]','-map','[a]','-c:v','libx264','-crf','18','-preset','fast','-r','24','-c:a','aac','-ar','48000','-movflags','+faststart',out]);global_record(sid,out,[0,first],'以同人同帐两段不同连续倾听机位替代被遮字的纸面镜头；不使用静帧/循环/局部模糊，不露原伪字。完整既有原句保留，后段不动。',dict(firstOriginalDuration=first,replacementDuration=10,sources=[dict(file=str(a),sha256=sha(a),range=[0,5.75],rate=.9),dict(file=str(b),sha256=sha(b),range=[0,3.25],rate=.9)],audio=dict(file=v['path'],sha256=v['sha256'],text=v['text']),factPreservation='日期已由既定UI与同一对白提供；抄件仍在前镜已放好的案上，不在影片烧入文字证据。'));print(sid,out,dur(out),flush=True)
def v10():
 sid='V10';old=snapshot[sid]['file'];a=rd(O/'assembled/V10-assembly.json');first=a['subclips'][1]['slotEnd'];own=a['subclips'][0]['path'];face=O/'edited/V11R-01-normalized.mp4';target=first-a['subclips'][0]['slotEnd'];rate=dur(face)/target;part=D/'V10-clean-opening-picture.mp4';out=D/'V10-撤遮字层开头声音去元说明-R1.mp4'
 fl=f'[0:v]setpts=PTS-STARTPTS[v0];[1:v]setpts=(PTS-STARTPTS)/{rate},setsar=1[v1];[v0][v1]concat=n=2:v=1:a=0[v]'
 run(['-i',own,'-i',face,'-filter_complex',fl,'-map','[v]','-t',str(first),'-an','-c:v','libx264','-crf','18','-preset','fast','-r','24',part])
 fl=f'[0:v]setpts=PTS-STARTPTS[v0];[1:v]trim=start={first},setpts=PTS-STARTPTS[v1];[v0][v1]concat=n=2:v=1:a=0[v];[1:a]volume=0:enable=\'between(t,3.0,8.9)\'[a]'
 run(['-i',part,'-i',old,'-filter_complex',fl,'-map','[v]','-map','[a]','-c:v','libx264','-crf','18','-preset','fast','-r','24','-c:a','aac','-ar','48000','-movflags','+faststart',out]);global_record(sid,out,[0,first],'撤掉开头纸面遮字层，只借同人面部视觉，仍用V10自己的声音/状态。免费去3.0–8.9秒元说明；原12–28秒音轨保留，28秒后待正确参考模型声音。',dict(pictureSource=str(face),pictureSourceSha256=sha(face),visualOnlyNoBranchTransfer=True,keptPictureRange=[first,dur(old)],keptAudioRange=[12,28],unresolved=['28秒后音频尚待正确参考模型生成，未冒称修好。']));record(sid,out,[0,12],'开头错误元声音已免费静音，保留正确玩家提问和9.18秒后的原对白；12–28声音不动。28秒后必要新声音待正确参考模型。',dict(globalLayerRemoval=True,keptAudioRange=[12,28],unresolved=['28秒后缺失/脏NPC语音待参考模型，不采用隔离的预置TTS2。']));r=rd(reportpath);x=next(x for x in r['comments'] if x['id']==sid);x['unresolved']=['28秒后正确参考模型声音尚未替换。'];save(reportpath,r);print(sid,out,dur(out),flush=True)
if __name__=='__main__':
 if sys.argv[1]=='V08A':v08a()
 if sys.argv[1]=='V10':v10()
