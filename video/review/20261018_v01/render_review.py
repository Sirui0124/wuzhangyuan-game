from pathlib import Path
import subprocess,json,math,hashlib,sys
B=Path(__file__).resolve().parents[3];O=Path(__file__).parent;E=O/'evidence';FILES=json.loads((E/'sources-map.json').read_text());FILES.update({'PREFIX':'video/pending/SC01-prefix-PENDING-weiyan-20261016.mp4','OLDEN03':'video/current/ending-legacy-fallback.mp4'})
# Every interval is [in,out) in original seconds; speech is preserved throughout retained intervals.
def seg(src,a,b,rate,reason):return {'sourceId':src,'source':FILES[src],'in':a,'outExclusive':b,'speed':rate,'reason':reason}
plans=[
 {'id':'PR01','file':'PR01-prologue-27s-review.mp4','purpose':'序章独立插槽；不与SC01或粮运强合并','status':'review-awaiting-human-audio','segments':[seg('PR01',0,27,1,'保留完整27秒叙述和唯一时光倒流愿望；仅去编码尾部，无剧情剪除')],'removed':[{'sourceId':'PR01','in':27,'outExclusive':27.071995,'reason':'编码尾部，语音26.48秒前结束'}]},
 {'id':'LI01','file':'LI01-grain-road-rescue-review.mp4','purpose':'粮运章节进入/救人演出独立插槽；不跨玩家后续交互','status':'review-awaiting-human-audio','segments':[seg('LI01',0,6,1.5,'山路队伍建立略长，完整保留但加快'),seg('LI01',6,14.5,1.125,'保留回到粮运时期的全部主角旁白'),seg('LI01',14.5,24.5,1.25,'保留滑倒、伸手、抓紧、拉起的完整救援动作'),seg('LI01',24.5,721/24,1.1,'保留苟安两句救人对白，轻微加速保音高')],'removed':[]},
 {'id':'LI02','file':'LI02A-LI02B-visit-complete-review.mp4','purpose':'粮仓打听后连续走入伤帐；若未来插入玩家选项则应拆开，不可跨过选项','status':'review-awaiting-human-audio','segments':[seg('LI02A',0,481/24,1.125,'完整保留问讯、迟粮十日、杖责八十、问去向、指帐及转向伤帐'),seg('LI02B',0,4.5,1.5,'完整保留进入伤帐和靠近，适度提速'),seg('LI02B',4.5,12,1.125,'保留看清脸、认出恩人及原来你就是苟安全句'),seg('LI02B',12,14,1.5,'保留认人后反应，压缩无对白尾部')],'removed':[{'sourceId':'LI02B','in':14,'outExclusive':15.071995,'reason':'认人对白结束后的重复静止尾部；对白已于11.4秒前结束'}]},
 {'id':'SC01','file':'SC01-lamps-weiyan-complete-review.mp4','purpose':'借寿→军情→魏延入帐→主灯熄灭完整段，之后可接现有SC03；不跨玩家交互','status':'review-awaiting-human-audio','segments':[seg('PREFIX',0,14.25,1.125,'保留前轮已认可营帐、点灯、持剑前半全部内容，适度加快'),seg('SC01B',0,6.125,1.25,'完整保留战场、奔马、回营'),seg('SC01B',6.125,241/24,1.125,'完整保留教训/军情紧急声段，待人工听审首词'),seg('SC01B',241/24,427/24,1.25,'完整保留战场交替、守军陪同趋帐'),seg('SC01B',427/24,616/24,1.125,'完整保留揭帘、闯帐、灯被吹灭关键因果'),seg('SC01B',616/24,721/24,1.125,'保留诸葛亮反应、魏延反打和灯灭收尾')],'removed':[]},
 {'id':'EN04','file':'EN04-jiangwei-response-review.mp4','purpose':'姜维两句→主角画外回应，独立结尾下半','status':'review-awaiting-human-audio','segments':[seg('EN04',0,6,1.5,'回望军帐及转身完整保留，缩短铺垫'),seg('EN04',6,19.5,1.125,'姜维两句指定对白完整保留，保音高加速'),seg('EN04',21.75,25.5,1.125,'保留画外哎那我有办法及姜维闭口听取反应')],'removed':[{'sourceId':'EN04','in':19.5,'outExclusive':21.75,'reason':'两位角色发言之间重复无对白停顿；下一声段约22.35秒起，预留0.6秒'}, {'sourceId':'EN04','in':25.5,'outExclusive':30.048005,'reason':'主角回应后长尾重复反应；28秒后姜维无对白张嘴会误导角色归属'}]}
]
# Reusable same performance; old EN03's boundary is confirmed in the original edit manifest.
plans.append({'id':'EN03EN04','file':'EN03-EN04-ending-complete-review.mp4','purpose':'接现有EN01后的完整后续结尾；旧EN03完整16秒+本轮新EN04','status':'review-awaiting-human-audio','segments':[seg('OLDEN03',3.375,16,1,'旧EN03开头七日期满主灯未灭与现有EN01重复，删0–3.375秒；完整保留北伐停滞、半月后病重、再次借寿旁白')]+[dict(x) for x in plans[-1]['segments']],'removed':list(plans[-1]['removed'])+[{'sourceId':'OLDEN03','in':0,'outExclusive':3.375,'reason':'接现有EN01使用，首句七日期满主灯未灭为已播放的重复信息；不删后续北伐停滞/半月/再借寿'}]})
manifest=[]
for p in plans:
 if len(sys.argv)>1 and p['id']!=sys.argv[1]:
  prior=json.loads((E/'edit-manifest.json').read_text());manifest.append(next(x for x in prior if x['id']==p['id']));continue
 temp=E/'working'/(p['id']+'-working.mp4');temp.parent.mkdir(exist_ok=True);inputs=[];filters=[];labels=[];pos=0
 for i,s in enumerate(p['segments']):
  a=s['in'];b=s['outExclusive'];r=s['speed'];frames=math.ceil((b-a)/r*24-1e-8);dur=frames/24;inputs+=['-i',str(B/s['source'])];s.update({'outputIn':pos,'outputOut':pos+dur,'outputFrames':frames,'outputDuration':dur});pos+=dur
  filters += [f'[{i}:v:0]trim=start={a}:end={b},setpts=(PTS-STARTPTS)/{r},fps=24,tpad=stop_mode=clone:stop_duration=0.1,trim=end_frame={frames},setpts=PTS-STARTPTS,setsar=1[v{i}]',f'[{i}:a:0]atrim=start={a}:end={b},asetpts=PTS-STARTPTS,aresample=48000,atempo={r},apad,atrim=duration={dur},afade=t=in:d=0.015,afade=t=out:st={dur-0.015}:d=0.015[a{i}]'];labels.append(f'[v{i}][a{i}]')
 filters.append(''.join(labels)+f'concat=n={len(labels)}:v=1:a=1[v][a]')
 cmd=['ffmpeg','-hide_banner','-loglevel','error','-y']+inputs+['-filter_complex',';'.join(filters),'-map','[v]','-map','[a]','-map_metadata','0','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-movflags','+faststart',str(temp)]
 
 if not temp.exists():subprocess.run(cmd,check=True)
 measure=subprocess.run(['ffmpeg','-hide_banner','-i',str(temp),'-vn','-af','loudnorm=I=-18:TP=-1.5:LRA=11:print_format=json','-f','null','-'],capture_output=True,text=True,check=True).stderr;start=measure.rfind('{');loud=json.JSONDecoder().raw_decode(measure[start:])[0];(E/(p['id']+'-loudness-input.json')).write_text(json.dumps(loud,indent=2))
 af=f"loudnorm=I=-18:TP=-1.5:LRA=11:measured_I={loud['input_i']}:measured_TP={loud['input_tp']}:measured_LRA={loud['input_lra']}:measured_thresh={loud['input_thresh']}:offset={loud['target_offset']}:linear=true"
 final=O/p['file'];subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(temp),'-map','0:v:0','-map','0:a:0','-map_metadata','0','-c:v','copy','-af',af,'-c:a','aac','-b:a','192k','-ar','48000','-t',str(pos),'-movflags','+faststart',str(final)],check=True)
 p.update({'nominalDuration':pos,'sha256':hashlib.sha256(final.read_bytes()).hexdigest(),'bytes':final.stat().st_size,'audioProcessing':'atempo (pitch-preserving); original source ambience; 15ms short fades; measured two-pass loudnorm -18 LUFS / -1.5 dBTP; no TTS/replacement voices'});manifest.append(p)
 # Working encodes are retained as intermediate evidence; not delivery candidates.
 (E/'edit-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2));print(p['id'],p['file'],pos,p['bytes'],flush=True)
