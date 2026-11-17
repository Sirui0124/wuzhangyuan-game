from user_repair import *
import math
partsdir=D/'batch2-parts';partsdir.mkdir(exist_ok=True)
def segment(a,b,node=None,delay=0,audioStart=0,reason='',source=None,rate=1,crop=None,audioPath=None,mute=False):return dict(start=a,end=b,node=node,delay=delay,audioStart=audioStart,reason=reason,source=source,rate=rate,crop=crop,audioPath=audioPath,mute=mute)
def seeded(node):
 p=D/f'{node}-seed-audio1-reference.wav'
 assert p.exists(),node
 return p
def compose(sid,source,segs):
 files=[];timeline=[];cursor=0
 for i,s in enumerate(segs):
  src=Path(s.get('source') or source);length=round((s['end']-s['start'])/s['rate']*24)/24;p=partsdir/f'{sid}-{i+1:02}.mp4'
  args=['-ss',s['start'],'-i',src]
  audio=None
  if s['node']:
   audio=Path(s['audioPath']) if s['audioPath'] else Path(voice[s['node']]['path']) if s['node'] in voice else seeded(s['node']);args+=['-i',audio]
   af=f"[1:a]atrim=start={s['audioStart']},asetpts=PTS-STARTPTS,adelay={round(s['delay']*1000)}:all=1,apad,atrim=duration={length},aresample=48000,aformat=channel_layouts=stereo[a]"
  elif s['mute']:af=f'anullsrc=r=48000:cl=stereo,atrim=duration={length}[a]'
  else:af=f'[0:a]asetpts=PTS-STARTPTS,atrim=duration={length},aresample=48000,aformat=channel_layouts=stereo[a]'
  vf=(s['crop']+',' if s['crop'] else '')+f"setpts=(PTS-STARTPTS)/{s['rate']},setsar=1"
  run(args+['-filter_complex',af+';[0:v]'+vf+'[v]','-map','[v]','-map','[a]','-t',length,'-r','24','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-movflags','+faststart',p])
  files.append(p);timeline.append(dict(source=str(src),sourceSha256=sha(src),sourceRange=[s['start'],s['end']],slotRange=[cursor,cursor+length],node=s['node'],audio=str(audio) if audio else 'digital silence' if s['mute'] else 'same source interval',audioSha256=sha(audio) if audio else None,audioStart=s['audioStart'],audioDelay=s['delay'],rate=s['rate'],crop=s['crop'],partFile=str(p),reason=s['reason']));cursor+=length
 suffix='R4' if sid=='V12' else 'R2';out=D/f'{sid}-纯台词与必要动作精剪-{suffix}.mp4'
 args=[]
 for p in files:args+=['-i',p]
 filters=[];labels=[]
 for i,s in enumerate(timeline):
  length=s['slotRange'][1]-s['slotRange'][0];filters += [f'[{i}:v]trim=duration={length},setpts=PTS-STARTPTS[v{i}]',f'[{i}:a]atrim=duration={length},asetpts=PTS-STARTPTS[a{i}]'];labels.append(f'[v{i}][a{i}]')
 filters.append(''.join(labels)+f'concat=n={len(files)}:v=1:a=1[v][a]')
 run(args+['-filter_complex',';'.join(filters),'-map','[v]','-map','[a]','-r','24','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-movflags','+faststart',out])
 q=subprocess.run([F,'-v','info','-i',str(out),'-vf','blackdetect=d=0.1:pix_th=0.10','-f','null','NUL'],capture_output=True,text=True,encoding='utf-8',errors='replace');assert q.returncode==0
 save(D/'inspection'/f'{sid}-batch2-technical.json',dict(file=str(out),sha256=sha(out),decode=True,duration=dur(out),blackEvents=[z for z in q.stderr.splitlines() if 'black_start:' in z]))
 save(D/f'{sid}-batch2-timeline.json',dict(id=sid,file=str(out),sha256=sha(out),duration=dur(out),sourceTimeline=timeline,actualListening=False,lipSyncReview='pending user actual viewing/listening; same NPC owns generated NPC lines',noFrozenPadding=True))
 r=rd(O/'user-review-batch2.json');x=next(x for x in r['rows'] if x['id']==sid);x.update(candidateFile=str(out),candidateSha256=sha(out),newDuration=dur(out),status='candidate-awaiting-real-playback',userApproved=False,oldApprovalNotTransferred=True,editTimeline=str(D/f'{sid}-batch2-timeline.json'));save(O/'user-review-batch2.json',r)
 print(sid,dur(out),'candidate ready',flush=True)

if 'V04' in sys.argv:
 compose('V04',snapshot['V04']['file'],[
  segment(4,9.44,reason='保留永安/五月饮酒/江风完整原句，删0–4秒导演元说明'),
  segment(9.44,12.48,'CH2-LY02-006',.3,reason='原有玩家原句完整复用，NPC闭口'),
  segment(15.5,19.7,'CH2-LY02-007',reason='正确参考模型4秒原句替换乱码，缩短旧8秒段'),
  segment(20.48,23.68,'CH2-LY02-008',reason='复用已成功3秒正确模型样本，不重复请求'),
  segment(25.66,27.9,'CH2-LY02-009',.3,reason='完整既有玩家原句，去不必要尾段')])
if 'V10' in sys.argv:
 source=D/'V10-撤遮字层开头声音去元说明-R1.mp4'
 compose('V10',source,[
  segment(0,2.67,'CH2-LY03-004',.3,reason='玩家准确原句保留，闭口倾听'),
  segment(9,28,reason='删2.67–9秒元说明的音画；原12–28秒好声音完整保留'),
  segment(28,31.2,'CH2-LY03-011',audioStart=.5,reason='续完原27.5秒起的完整玩家句，保留12–28秒原音不覆盖'),
  segment(32,35.7,'CH2-LY03-012',reason='四句NPC只读白名单；短镜头不保长静音'),
  segment(44.1,48.3,'CH2-LY03-013',reason='正确参考音色原句'),
  segment(52.45,55,'CH2-LY03-014',.3,reason='原有玩家原句'),
  segment(55.5,58.7,'CH2-LY03-015',reason='正确参考原句；服务字幕为空但独立ASR文本吻合，实际听审pending'),
  segment(60.93,63.43,'CH2-LY03-016',.3,reason='原有玩家原句'),
  segment(65,69.7,'CH2-LY03-017',reason='正确参考原句；服务字幕为空但独立ASR文本吻合，实际听审pending')])
if 'V09' in sys.argv:
 compose('V09',snapshot['V09']['file'],[
  segment(0,4.6,reason='保留两句准确玩家原句，删除原8秒镜头多余等待'),
  segment(9.8,21.7,reason='保留跑腿/养伤/吃饭完整原声'),
  segment(25,29.7,'CH2-LY02-027',reason='删角色说明元音画21.7–25；补完整真实顾虑原句'),
  segment(29.7,36.29,reason='原无字封套取出/拿持/放榻边动作完整保留')])
if 'V08A' in sys.argv:
 source=D/'V08A-撤遮字层改真实倾听镜头-R1.mp4'
 compose('V08A',source,[segment(0,15.3,reason='两条玩家原句完整，随后短停顿为沉默，不删逻辑'),segment(17,19.8,'CH2-LY02-022',reason='完整白名单承认委屈；短候选替代原12秒无法核出完整原句段，旧通过版本保留')])
if 'V12' in sys.argv:
 compose('V12',O/'edited/V12-01-normalized.mp4',[
  segment(0,2,'CH2-LY03-021',rate=.75,reason='原未叠层0–2秒尚未露伪字；真实表情和取纸动作0.75倍，精确新原句'),
  segment(2.7,5.3,source=O/'edited/V12-UR1-normalized.mp4',mute=True,reason='放大核验发现0–2.5秒曾露细小伪字，整段弃用；从2.7秒纸背朝镜头的伸递开始，保留我的手伸入、接稳与苟安放手，不加遮罩或人声'),
  segment(0,4.5,'CH2-LY03-023',source=O/'edited/V12-UR2-point-normalized.mp4',audioPath=D/'CH2-LY03-023-保留原片正常原句.wav',reason='接稳后真实指示；保留原正常口供前半，不念动作标签'),
  segment(10.4,13.9,'CH2-LY03-023',audioStart=4.5,source=O/'edited/V12-02-normalized.mp4',crop='crop=910:512:370:0,scale=1280:720',audioPath=D/'CH2-LY03-023-保留原片正常原句.wav',reason='未叠层源只取人物面部，不露旧伪字/再交纸；原口供连续说完'),
  segment(6,9.2,'CH2-LY03-024',source=O/'edited/V12-03-normalized.mp4',crop='crop=640:360:360:24,scale=1280:720',audioPath=D/'CH2-LY03-024-保留原片正常原句.wav',reason='原本正确叮嘱原句，进一步只取面部/头部，彻底排除前臂和旧纸以免暗示取回；排除苟安叮嘱角色/动作说明'),
  segment(6.5,9.5,'CH2-LY03-025',.3,source=O/'edited/V12-UR1-normalized.mp4',reason='唯一既有完整心声；切至我仍持同一纸的不同连续区间，不循环、不让NPC代说')])
