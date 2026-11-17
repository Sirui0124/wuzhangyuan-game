from pathlib import Path
import json,hashlib
import pipeline

OUT=Path(__file__).resolve().parent;d=OUT/'G11B';d.mkdir(exist_ok=True)
identity=OUT.parent/'PV-opening-20261114/references/new/N03-沙摩柯-孤骑回望-v1.png'
prompt='''生成4秒、横向16:9、真人历史电影镜头，无音频，正常速度。

参考图1是上一条实际生成约6秒处的画面，锁定深棕马、皮鞍、骑手衣甲、近侧马镫与靴子，这是动作起点。参考图2只锁同一名成年骑手沙摩柯的身份、衣甲与山路环境，不要求恢复端坐姿势或回望动作。当前骑手已经失去意识，右手已经松开，重心正在离开马鞍；本条只拍清楚一次失去平衡后滑落的动作，不重演中箭。

从参考图1的腰腿低机位连续拍摄，镜头稍向后退，让骑手落下的路径可见。0至1秒近侧靴子从马镫退出，骑手上身向近侧倾，臀部离开鞍座；1至2.5秒整个人受重力从马的近侧向地面滑落，衣摆和腿一起离开鞍座，身体在画面下半部真正接触泥地；2.5至4秒他留在地面不动，马继续向画面右方跑出，最后看见空鞍和地面的身影。不要让人始终坐在马上，不让人凭空消失，不让马身体覆盖整个落地过程。只发生一次完整落马，衣料、皮带和马步随真实接触受力，无浮空、无身体融合、不倒放、不让他重新站起。

画面不展示伤口、血液或穿刺，不增加新的攻击；这是普通电影特技式落马。保持已有服装与马的比例，山路、暮色、远处烟火连续。真实演员与实物衣甲，正常透视、自然光和克制摄影质感。无音乐、声音、字幕、额外人物、文字或水印。不要慢动作、定格、淡黑或转场特效。'''
u={'id':'G11B','title':'沙摩柯落马独立补镜','version':'v1','duration':4,'edit_duration':2,'source_shots':['S16'],'reference_ids':['G11-selected-end','N03'],'reference_paths':[str(OUT/'G11/end-selected.png'),str(identity)],'depends_on':None,'action':'只完成失去平衡、身体离鞍与实际落地。','prompt_sha256':hashlib.sha256(prompt.encode()).hexdigest(),'status':'prepared'}
if not (d/'prompt.txt').exists():(d/'prompt.txt').write_text(prompt,'utf-8')
pipeline.save(d/'references.json',u['reference_paths']);pipeline.save(d/'plan.json',u)
pipeline.save(d/'scope.json',{'date':'2026-11-15','reason':'G11已生成回望、中箭和松手，但未完整生成S16坠马；按SOP拆开复杂动作，单独补足原分镜已有动作。','scope':'新增一个4秒请求，只生成一次；不是替换或重复提交G11已有任务。','planned_usage':'替换原G11工作剪辑最后2秒，保持总片长108秒。'})
pipeline.work(u)
