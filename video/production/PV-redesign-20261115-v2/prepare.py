from pathlib import Path
import json, shutil, hashlib

ROOT=Path(__file__).resolve().parent
OLD=ROOT.parent/'PV-H3-20261115-v1'
ART=ROOT.parent/'PV-opening-20261114'
GEN=Path(r'C:/Users/zhousirui/.codex/generated_images/01a1d983-5ada-7a93-b3bc-b154ad9ffdfe')
def save(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2),'utf-8')
(ROOT/'references').mkdir(parents=True,exist_ok=True)
refs={
 'R01':('exec-6c29ce29-58e1-419f-8109-c03ee906d7c3.png','R01-山河火线-v2.png'),
 'R02':('exec-5a88b5f4-197a-4fc8-9770-3b4eef611f16.png','R02-人去马还行-v2.png'),
 'R03':('exec-5d373c67-5f46-4ba3-a8a5-5d7f7936d556.png','R03-马谡诸葛亮同场-v2.png')}
records=[]
for k,(src,dst) in refs.items():
 p=ROOT/'references'/dst
 if not p.exists():shutil.copy2(GEN/src,p)
 records.append({'id':k,'path':str(p),'source':str(GEN/src),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'status':'待review','purpose':{'R01':'开场构图；H3单一参考候选','R02':'中箭后结果镜头，非准确续帧','R03':'同场空间及双人身份基准，非独立反打'}[k]})
save(ROOT/'image-records.json',records)
def old(i):return OLD/i/'source.mp4'
# id,title,duration,visual type, source,start,end,audio source,audio start,notes
rows=[
 ('V01','山河先于人',4,'still','R01',0,4,old('G05'),0,'新图静态占位；拟横移揭示江岸纵深，火线而非满屏火海。'),
 ('V02','奔向火线',5,'video',old('G02'),2,7,old('G02'),2,'旧14秒骑行缩至5秒，保留一段完整路势。'),
 ('V03','梦中托付',6,'video',old('G03'),0,6,old('G03'),0,'当前只作画面/原生声音参考；新稿拟保持脸、掌同框，去自动推掌。'),
 ('V04','接住私印',3,'video',old('G04'),0,3,old('G04'),0,'托付与救人的手形成回扣。'),
 ('V05','进入败营',2,'video',old('G06'),0,2,old('G06'),0,'从手转到伤兵；不重复开场大全景。'),
 ('V06','两将仍想救驾',5,'video',old('G07'),0,5,old('G07'),0,'冯习左张南右；保留告急与转向。新空间镜待生成。'),
 ('V07','前后路被断',2,'video',old('G08'),0,2,old('G08'),0,'旧素材仅占敌兵压近；新版先在同一母镜建立前后两路。'),
 ('V08','汉将不降',7,'video',old('G10'),0,7,old('G10'),0,'去原生黑边；台词仍需实听核字，不拿旧稿当转录。'),
 ('V09','孤骑回望',2,'video',old('G11'),0,2,old('G11'),0,'仅采用尚未中箭的回望段。'),
 ('V10','一箭使动作中断',1,'still','R02',0,1,old('G11'),2,'静态结果图代替待重拍命中过程；本预演不展示旧版怪箭。'),
 ('V11','空鞍离去',3,'still','R02',0,3,old('G11B'),1,'静态占位；不采用旧两段坠马拼接。'),
 ('V12','旗布的裂口',3,'video',old('G12'),0,3,old('G12'),0,'由空鞍的空缺切旗布裂口。'),
 ('V13','火被雨夺走',4,'video',old('G13'),0,4,old('G13'),0,'雨中谷地建立，旧原片火势反弹问题记录，拟换新动作。'),
 ('V14','湿木余烬',2,'video',old('G14'),0,2,old('G14'),0,'压低火舌，保留雨和嘶声。'),
 ('V15','仰望不语',3,'video',old('G15'),0,3,old('G15'),0,'旧张嘴片段仅作占位，新版闭口一次抬眼。'),
 ('V16','尚握着刀',4,'video',old('G16'),0,4,old('G16'),0,'人位于左，地平线军列承压。'),
 ('V17','刀比人更久',3,'video',old('G17'),0,3,old('G17'),0,'完整落刀，不截断接地与红缨落下。'),
 ('V18','同场相望',4,'still','R03',0,4,old('G18'),0,'静态双人母镜；建立左下马谡、右上诸葛亮，不再用错误军官反打。'),
 ('V19','抬眼与垂眼',3,'still','R03',0,3,old('G19'),0,'静态占位；新镜从母镜同侧机位分解近景，不翻转图片。'),
 ('V20','迟到的羽扇',3,'still','R03',0,3,old('G21'),0,'静态占位；新视频需真实举扇遮住眉眼，不能用静图冒充完成。'),
 ('V21','另一个未竟之夜',7,'video',old('G22'),0,7,old('G22'),0,'黑袍白襟区分年代；现原片手落地图，保留实际动作而不谎称悬停。'),
 ('V22','灯灭一息',3,'video',old('G23'),1,4,old('G23'),1,'采用真正熄灭区间。'),
 ('V23','暗中先听见活人',0.5,'black','',0,.5,None,0,'短黑不是故障，拟用伤兵呼吸提前进入。'),
 ('V24','回到能够救的人',8,'video',OLD/'G24-25-v2/source.mp4',0,8,OLD/'G24-25-v2/source.mp4',0,'保留连续第一视角和两手抓住我前臂的实际动作。'),
 ('V25','逆转五丈原',4.5,'title','',0,4.5,None,0,'准确五字片名；救人尾声收束，无说明卡。'),
]
timeline=[];t=0
for i,title,dur,kind,source,a,b,asrc,astart,note in rows:
 if kind=='still':source=next(r['path'] for r in records if r['id']==source)
 row={'id':i,'title':title,'duration':dur,'in':t,'out':round(t+dur,4),'kind':kind,'source':str(source),'source_in':a,'source_out':b,'audio_source':str(asrc) if asrc else None,'audio_source_in':astart,'note':note,'status':'待review'}
 if i=='V08':row['crop']='992:558:176:104'
 timeline.append(row);t=round(t+dur,4)
assert t==92, t
save(ROOT/'storyboard.json',{'version':'v2','duration':t,'status':'待review','stage':'剧本医生与分镜预演；未提交新H3任务','static_placeholder_seconds':18,'shots':timeline})
save(ROOT/'review-status.json',{'user_feedback':['保留背景音并匹配','第一幕丑、缺少设计感','中箭奇怪','整体重设计，更有意境和大片感','马谡与诸葛亮对应不上'],'version':'v2','prompt_status':'待review','video_status':'待更新','new_h3_submissions':0,'old_version_preserved':str(OLD),'unknown_G09_not_retried':True})
print(json.dumps({'duration':t,'shots':len(timeline),'static_seconds':sum(s['duration'] for s in timeline if s['kind']=='still')},ensure_ascii=False))
