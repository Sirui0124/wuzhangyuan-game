from pathlib import Path
import json,subprocess,hashlib,shutil,sys
import av
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).parent;EDIT=OUT/'edited';EDIT.mkdir(exist_ok=True)
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
INV=json.loads((OUT/'inventory.json').read_text(encoding='utf-8'));OLD={x['index']:ROOT/x['src'].lstrip('/') for x in INV}
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,x):p.write_text(json.dumps(x,ensure_ascii=False,indent=2),encoding='utf-8')
def run(args):subprocess.run([FF,'-v','error','-y','-threads','4',*map(str,args)],check=True)
def generated(id):return OUT/'generated'/(id+('-R3' if id=='QA-GUARD-LISTEN' else '-R2')+'-16x9.mp4')
def cut(src,name,start,end,crop=None):
 dst=EDIT/name
 vf=(f'crop={crop},' if crop else '')+'scale=1344:756:flags=lanczos,setsar=1'
 run(['-ss',start,'-i',src,'-t',end-start,'-vf',vf,'-r',24,'-c:v','libx264','-threads',4,'-crf',18,'-preset','fast','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar',48000,'-ac',2,'-movflags','+faststart',dst])
 return dst
def attach_audio(visual,audiosource,name,audiostart,duration,delay=0,audioLimit=None):
 dst=EDIT/name
 run(['-i',visual,'-ss',audiostart,'-i',audiosource,'-filter_complex',f'[1:a]atrim=duration={duration-delay if audioLimit is None else audioLimit},asetpts=PTS-STARTPTS,adelay={round(delay*1000)}:all=1,apad[a]','-map','0:v','-map','[a]','-t',duration,'-vf','scale=1344:756:flags=lanczos,setsar=1','-r',24,'-c:v','libx264','-threads',4,'-crf',18,'-preset','fast','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar',48000,'-ac',2,'-movflags','+faststart',dst])
 return dst
def concat(parts,name):
 dst=EDIT/name;args=[]
 for p in parts:args+=['-i',p]
 filt=''.join(f'[{i}:v][{i}:a]' for i in range(len(parts)))+f'concat=n={len(parts)}:v=1:a=1[v][a]'
 run(args+['-filter_complex',filt,'-map','[v]','-map','[a]','-r',24,'-c:v','libx264','-threads',4,'-crf',18,'-preset','fast','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar',48000,'-ac',2,'-movflags','+faststart',dst]);return dst
def metadata(p):
 con=av.open(str(p));v=con.streams.video[0];data=dict(duration=float(v.duration*v.time_base),containerDuration=con.duration/1e6,frames=v.frames,width=v.width,height=v.height,fps=str(v.average_rate),bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest());con.close()
 run(['-i',p,'-f','null','NUL'])
 return data
results=[]
def result(index,path,why):
 results.append(dict(index=index,id=INV[index-1]['id'],oldSrc=INV[index-1]['src'],oldSha256=INV[index-1]['metadata']['sha256'],file=str(path.resolve()),reason=why,reviewState='待review',**metadata(path)))
if sys.argv[1]=='local':
 # The later curtain shot performs the reach and pull once. Remove the earlier held reach.
 a=cut(OLD[1],'opening-a.mp4',0,7.5);b=cut(OLD[1],'opening-b.mp4',226/24,1066/24)
 result(1,concat([a,b],'PR01-curtain-tight-QA.mp4'),'删去赴帐末段重复伸手停留，直接接实际掀帘；保留已燃烛光和完整原版30秒时光倒流。')
 result(11,cut(OLD[11],'C1T08-death-QA.mp4',0,141/24),'死亡心声结束后保持黑屏，删除末尾提前露出的重生画面。')
 a=cut(OLD[25],'report-a.mp4',0,152/24);b=cut(OLD[25],'report-b.mp4',181/24,300/24)
 result(25,concat([a,b],'C1T18-report-QA.mp4'),'删除6.333—7.542秒突兀的空营黑夜插帧，保留姜维问话及魏延报明军情演出。')
 save(OUT/'local-repairs.json',results)
elif sys.argv[1] in ['generated','other']:
 # Same closed-mouth listener under mutually exclusive player reports, followed by the same real guard answer.
 if sys.argv[1]=='generated':
  # R3 also invents speech/subtitles after 2.5 seconds. Only accept its verified first 2.25 seconds.
  # Tighten the crop to exclude the invented shoulder at the far right, then cut to the actual closed tent.
  head=EDIT/'guard-listen-head.mp4'
  run(['-i',generated('QA-GUARD-LISTEN'),'-t',2.25,'-vf','crop=896:504:0:0,scale=1344:756:flags=lanczos,setsar=1','-r',24,'-c:v','libx264','-threads',4,'-crf',18,'-preset','fast','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar',48000,'-ac',2,head])
  known_door=cut(OLD[3],'guard-known-door.mp4',2.5,8.25)
  unknown_door=cut(OLD[3],'guard-unknown-door.mp4',2.5,7.25)
  listener=concat([head,known_door],'guard-known-visual.mp4')
  known=attach_audio(listener,OLD[9],'guard-known-listen.mp4',5.15,8,.4)
  unknown_visual=concat([head,unknown_door],'guard-unknown-visual.mp4')
  unknown=attach_audio(unknown_visual,OLD[31],'guard-unknown-listen.mp4',0,7,audioLimit=6.75)
  # The existing answer clip has the correct headwrap/beard and performs only A-44.
  answer=cut(ROOT/'video/production/CH01-cinematic-20261025/generated/G06B2R2-16x9.mp4','guard-answer.mp4',2.96,5.2,crop='1008:567:168:0')
  ending=cut(OLD[31],'guard-ending.mp4',9.333333,12.333333)
  result(9,concat([known,answer,ending],'C1T06-guard-known-QA.mp4'),'甲的年轻无巾版本替换为统一的中年黑巾短须身份；我的原军情在画外说，甲闭口听，保留营门未破。')
  result(31,concat([unknown,answer,ending],'C1T06-guard-unknown-QA.mp4'),'未问营门分支也统一甲的身份；保留本分支原声，不新增营门未破。')
 # Replace the exact frozen section but retain all original words and timings.
 a=cut(OLD[8],'wei-before-listen.mp4',0,126/24)
 v=cut(generated('QA-WEI-LISTEN'),'wei-listen-visual.mp4',0,3.5)
 b=attach_audio(v,OLD[8],'wei-listen-vo.mp4',126/24,3.5)
 door=cut(OLD[30],'wei-forbidden-door-visual.mp4',.5,1.125)
 door=attach_audio(door,OLD[8],'wei-forbidden-door-vo.mp4',210/24,15/24)
 c=cut(OLD[8],'wei-after-listen.mp4',225/24,716/24)
 result(8,concat([a,b,door,c],'C1T05-live-listen-QA.mp4'),'5.25—9.375秒4.125秒定格换成3.5秒真实闭口倾听与0.625秒禁令所指闭帘；避开新源片尾部开口动作，原台词时间保持。')
 # Use only the accepted road-walking portion. The generated tail approaches a different tent and is rejected.
 a=cut(OLD[20],'order-ack.mp4',0,282/24)
 road=cut(generated('QA-WEI-EXIT'),'order-road-only.mp4',.75,3.75)
 door=cut(OLD[30],'order-closed-door.mp4',.5,3.125)
 visual=concat([road,door],'order-exit-visual.mp4')
 b=attach_audio(visual,OLD[20],'order-road-exit.mp4',282/24,5.625)
 result(20,concat([a,b],'C1T19-road-exit-QA.mp4'),'魏延接令后沿营道离开执行命令，删除入帐镜头；原心声保留画外。')
 a=cut(OLD[30],'dawn-before.mp4',0,8)
 b=attach_audio(generated('QA-HAND-RELAX'),OLD[30],'dawn-hand-relax.mp4',8,4)
 result(30,concat([a,b],'C1T20-hand-relax-QA.mp4'),'B-04说手慢慢松开时，画面真实放松握矛手指，保留原叙述。')
 save(OUT/('generated-repairs.json' if sys.argv[1]=='generated' else 'other-repairs.json'),results)
else:raise ValueError(sys.argv[1])
print(json.dumps([{k:v for k,v in x.items() if k in ['index','id','duration','file']} for x in results],ensure_ascii=False,indent=2))
