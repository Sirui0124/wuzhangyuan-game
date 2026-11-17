from pathlib import Path
import json,hashlib,datetime
O=Path(__file__).resolve().parent;R=O/'user-review-20261025';POLICY='20261025-no-meta-no-cards-no-boxes'
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
def write(p,x):
 t=p.with_suffix(p.suffix+'.tmp');t.write_text(json.dumps(x,ensure_ascii=False,indent=2),encoding='utf-8');t.replace(p)
D=read(O/'delivery.json');Q=read(O/'review/picture-usability.json');U=read(O/'user-review-repair.json')
dur={'V22':48.525333,'V23':17.417,'V24':73.457683,'V25':75.152}
findings={'V22':['日间伤帐对白、木令牌递放与粮队管事批准按原顺序呈现，无工作文档字卡、字幕列表、方框模糊或暗影补丁。','人物原片近景及下沿道具未构成可读文书正文；令牌不冒充正式出营许可。'], 'V23':['村中收粮手部、粮袋与夜间回帐均为实景动作；无工作文字、字卡、字幕列表或可见补丁。','同一收粮动作不重复完成，无新增朗读或剧情事实。'], 'V24':['夜帐引入、书房口述回忆、回夜帐边界保留；空案与自然景深不构成文档文字或矩形遮罩。','未发现烧入说明卡、字幕列表、制作信息；李严只在自己发言时开口，回忆不是玩家亲见。'], 'V25':['夜帐计划对白及前臂/灯火观察镜均无说明卡、字幕列表、制作文字或可见方框补丁。','保持未实施计划，未出现赴魏、散谣或召军已执行的文字/行动；玩家问句的自然听者窗口保留。']}
for id,t in dur.items():
 v=next(x for x in D['logicalClips'] if x['id']==id);h=hashlib.sha256(Path(v['path']).read_bytes()).hexdigest();assert h==v['sha256']
 proof=dict(id=id,file=v['path'],sha256=h,duration=t,played=[[0,t]],ended=True,reviewPolicy=POLICY,reviewPolicyScope='本轮制作画面及生成字段分离规则；不包含未完成的逐字听审/配音通过',method='本轮浏览器从0静音播放至终点并回读完整played范围，结合全范围1fps普查、关键画面与原后期来源核对；非逐字听审',findings=findings[id],sequence=str(R/(id+'-old-1fps.jpg')),observedUTC=datetime.datetime.now(datetime.timezone.utc).isoformat(),audioReview='按G3授权范围仅登记；既有临时声音、元字段误读/BGM风险与逐字听审待后续，无新增TTS。',userApproved=False)
 p=R/(id+'-current-policy-review.json');write(p,proof)
 q=next(x for x in Q['clips'] if x['id']==id);q.update(reviewPolicy=POLICY,reviewPolicyScope=proof['reviewPolicyScope'],policyReviewEvidence=str(p),userApproved=False)
 u=next(x for x in U['clips'] if x['id']==id);u.update(newFile=v['path'],newSha256=h,reviewState='reviewed-unchanged',reviewPolicy=POLICY,action='本轮扫查未发现三类画面问题，保留当前文件，不重导',findings=findings[id],actualCheckEvidence=str(p),newReviewedRange=[[0,t]],userApproved=False)
 v.update(reviewPolicy=POLICY,userReviewRepairStatus='reviewed-unchanged',policyReviewEvidence=str(p),userApproved=False)
write(O/'review/picture-usability.json',Q);write(O/'user-review-repair.json',U);write(O/'delivery.json',D);print('Four current SHAs now carry current-round picture policy; audio and user approval remain pending.')
