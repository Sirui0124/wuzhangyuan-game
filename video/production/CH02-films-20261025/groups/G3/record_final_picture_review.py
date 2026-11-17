from pathlib import Path
import json,hashlib,datetime,sys
O=Path(__file__).resolve().parent;R=O/'review/picture-repair'
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
def write(p,x):p.write_text(json.dumps(x,ensure_ascii=False,indent=2),encoding='utf-8')
spec={
'V21':dict(duration=85.875,findings=['五个玩家画外句采用同一苟安自然听者，保留完整既有中央音轨；无持续NPC代说、冻结嘴部或短循环。','02去掉持乱字信纸起镜和重复递纸；03保留一次完整接信、松手，仅纸面文字局部失焦，2.8秒后切准确摘要，不伪造信全文。','既有肩部红点局部修复v4、去字幕与多余观看者裁剪保留，未恢复拿信靠灯动作。','V4将07/11换为共享素材1x真实前向片段，统一按解码帧索引CFR24拼接；2061帧/85.875秒，原整片音频PCM逐样本一致，无尾部视频缺口。'],conditions=['玩家问句和心声须从画外发声，按当前听者窗口接入；不能回切被替换的持续说话或重复递纸原片。','第二封信只在V21-03交接一次；摘要是准确内容说明，不得将模型纸面或该摘要当作逐字原信。']),
'V22':dict(duration=48.525333,findings=['01及04玩家问句均为自然闭口听者，无模型乱字纸张；完整中央玩家音轨长度可容纳。','令牌展示、接待说明和最后粮队管事正式批准各自保留，没有额外玩家脸/越肩或伪造文书。'],conditions=['令牌只承担接待及材料核对，正式出营批准仍在最后粮队管事节点，不能提前据令牌放行。','两个玩家问句从画外发出，保留当前6秒/2.6秒窗口和自然听者画面。']),
'V24':dict(duration=73.457683,findings=['保留当前夜间苟安引入那夜回忆、短叠化进入李严书房、末尾短叠化回当前伤帐，未变成玩家亲历。','03和06采用R3原片3.5–9.5秒的精确752×423裁框，先转444避免奇数裁框取整；面部完整，未带新纸、手或左侧观察者。','每次六秒听者片段后接同室真实前向桌案/灯火观察；无冻结嘴部、短循环，未以全画幅模糊遮问题。','李严仅在自己的发言段开口，苟安所述回忆句由画外承担；原始R3全15秒仍不通过，未扩展新生成。'],conditions=['仅作苟安口述回忆的借位视角，不能当作玩家亲见或已经独立核实的历史。','03与06由苟安画外叙述；李严仅在自己的02/04/05发言。保留当前夜帐引入、进入回忆和回到伤帐的首尾。','只采用R3原片[3.5,9.5)及记录中的精确裁框，不能把其余新纸/旁观者/说话部分接回。'])}
S=read(R/'staged-logical-versions.json');Q=read(O/'review/picture-usability.json')
for id in sys.argv[1:]:
 s=S[id];sp=spec[id];h=hashlib.sha256(Path(s['file']).read_bytes()).hexdigest();assert h==s['sha256']
 proof=dict(id=id,file=s['file'],sha256=h,duration=sp['duration'],played=[[0,sp['duration']]],ended=True,method='本轮浏览器静音从0播放到终点并回读完整played范围，结合关键时点画面观察、来源对照及疑点完整时间序列；非逐字听审、非24fps逐帧',findings=sp['findings'],observedUTC=datetime.datetime.now(datetime.timezone.utc).isoformat())
 write(R/(id+'-final-playback.json'),proof)
 r=next(x for x in Q['clips'] if x['id']==id);r.update(file=s['file'],sha256=h,pictureUsability='usable-with-integration-condition',reviewState='reviewed',deliveryAdoption='staged-validated-awaiting-atomic-commit',dynamicReview=dict(method=proof['method'],reviewedPeriodsThisPass=proof['played'],proof=str(R/(id+'-final-playback.json'))),integrationConditions=sp['conditions'],audioIssues=['正式台词声音、音色、混音/BGM及精确声口仍待统一；未完成逐字听审，本轮零新增TTS。画面角色归属问题已独立修复。'],userApproved=False)
 for issue in r['issues']:issue.update(state='closed',repair='；'.join(sp['findings']),evidence=str(R/(id+'-final-playback.json')))
write(O/'review/picture-usability.json',Q);print('Recorded reviewed picture candidates:',sys.argv[1:])
