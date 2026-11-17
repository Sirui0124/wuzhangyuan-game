from pathlib import Path
import json
OUT=Path(__file__).resolve().parent;BASE=OUT.parents[1]
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,d):p.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8')
c=next(c for c in read(OUT/'plan.json')['requests'] if c['id']=='V43-02')
ref=read(BASE/'references/manifest.json')['byId']['粮仓'];assert ref['ready']
text='11秒三国写实电影。以首帧开始，保持同一营地粮棚材质，时间是另一天阴天。固定人眼平视机位。开头1秒看空的棚前通道；两名普通士卒从柱子旁慢慢走入，停步交换不安的目光，再分别慢慢走开。人物在中远景，动作克制自然。全程只有环境风声和同步脚步声，无人声、无音乐。'
body=dict(model='MiniMax-H3',duration=11,resolution='768P',ratio='16:9',content=[dict(type='text',text=text),dict(type='image_url',role='first_frame',image_url=dict(local_path=ref['path']))])
save(OUT/'requests/V43-02.firstframe.local.json',body)
save(OUT/'requests/V43-02.firstframe-override.json',dict(id='V43-02',reference=ref['path'],role='first_frame',reason='另一天营中粮棚门外，空间示意不作粮数或新证据；不继承放行时苟安在场',prepared=False,remoteSubmitted=False))
doc=f'''尺寸：16:9
模型：MiniMax-H3
声音：有声音
时长：11秒

## 参考图

1. 图片1｜中央粮仓空间｜用途：严格首帧，只锁营地粮棚、通道、旧木粗麻与天光；图中粮袋数量不成为此结局新证据。
   本地路径：`{ref['path']}`

## 视频生成 Prompt

### 分镜1｜0-11秒

参考图关系：图片1为本镜单一首帧，表现另一天的同营环境。此镜没有苟安，不继承放行首帧人物。

画面与动作：开头1秒空的棚前通道，两名普通士卒从柱旁走入，停步交换不安目光，随后慢走散开。此处不生成谣言具体内容，也不新增指控文字或证据。

摄影与切点：人眼平视，固定第一视角机位，中远景，不出现我的脸、肩背或倒影。与上一片分隔为明确的另一天，保留自然停顿。

声音与原句：CH2-E5-002｜旁白｜画外叙述，无口型承担者。原句“后来，苟安去了魏国。关于丞相的谣言，还是传回了营中。”保存在中央voice/CH2-E5-002.wav，本次模型不生成该人声。

连续性：只在UI-RELEASE已确认且实际放行镜头后使用。旁白交代后来的后果，不把本镜当作玩家亲见魏国，不追加具体谣言内容。

拍摄手法参考：采用项目已核验《影》摄影研究（https://theasc.com/article/dual-nature-shadow/）的低饱和天然材质和可读暗部，用于本镜营地与服装；固定机位由当前第一视角场景设计，不声称复刻原片。

声音要求：全片无BGM、无背景音乐、无配乐、无吟唱、无音乐鼓点。模型只保留风声与同步脚步声，完全无对白、无旁白、无心声；中央已备旁白可在后期低成本混入，本阶段不发起任何新TTS。
'''
(OUT/'prompts/V43-02.md').write_text(doc,encoding='utf-8')
print('aftermath local prepared; no image upload or video POST')
