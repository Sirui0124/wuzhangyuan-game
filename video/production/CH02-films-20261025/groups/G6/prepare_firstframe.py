"""Pre-prepare only unsubmitted first-frame requests. Never changes a remote job."""
from pathlib import Path
import json,copy,importlib.util,sys,re,time
OUT=Path(__file__).resolve().parent; BASE=OUT.parents[1]
spec=importlib.util.spec_from_file_location('shared_video_api',Path('C:/Users/zhousirui/Documents/ChatGPT/平行世界/tools/video_api.py'))
api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,d):api.atomic_json(p,d)
d=read(OUT/'plan.json')
for target in ['V38-02','V39-02']:
    if any(c['id']==target+'-R2' for c in d.get('retries',[])):continue
    c=copy.deepcopy(next(x for x in d['requests'] if x['id']==target));c.update(id=target+'-R2',replaces=target,retryReason='保留完整原句时长，修复越肩/纸面元文字/额外人物');d.setdefault('retries',[]).append(c)
save(OUT/'plan.json',d)
comp=read(BASE/'groups/G5/references/composition-manifest.json')['byId']['clerk-receiving-desk']
assert comp['ready']
gouan=BASE/'references/source-frames/gouan-talk.png'
selected=set(sys.argv[1:])
targets=[c for c in d['requests']+d['retries'] if (c['id'].startswith('V41L') or c.get('replaces') or c['id'] in ['V41E-01','V41E-02','V41E-03','V41E-04','V43-01']) and (not selected or c['id'] in selected)]
for c in targets:
    id=c['id'];state=OUT/'tasks'/f'{id}.json'
    if state.exists():print(id,'already dispatched: untouched',flush=True);continue
    is_gouan=c.get('replaces') in ['V40-01','V40-02'] or c['id'] in ['V41E-02','V41E-03','V41E-04','V43-01']
    path=str(gouan.resolve()) if is_gouan else comp['path'];person='苟安' if is_gouan else '军吏'
    if c['id']=='V43-01':
        supplemental=read(OUT/'references/manifest.json')['byId']['gouan-release-road']
        assert supplemental['ready'];path=supplemental['path']
    if c['id']=='V40-06-R2':path=str((OUT/'references/empty-cart-tent/image-01.png').resolve());person='空木车'
    npc=[l['text'] for l in c['lines'] if l['spoken'] and (l['speaker']=='苟安' or '军吏' in l['speaker'])]
    action=f'{person}保持首帧姿势自然呼吸，面对镜头，视线不偏向画面外的另一个人。身体只有细微重心与呼吸，不起身，不走动，不写字。'
    if id=='V39-02-R2':action='军吏将案上一束已经收到的闭合竹简卷向自己轻收少许，抬眼面向镜头，说完闭口。所有卷束保持闭合，动作慢而真实。'
    if id=='V40-03-R2':action='军吏将一束封闭的素色卷束放平在案上，抬眼看向镜头。卷束从不展开，纸面和字迹始终不可见。只有这一个动作，不说话。'
    if id.startswith('V41L-04'):action='军吏全程闭口，低头把案上一束闭合卷束轻轻收拢。镜头从他的脸缓慢低下少许停在没有文字的卷束。卷束绝不展开。'
    sound=f'只由画面里的{person}清楚自然地说：'+''.join(npc) if npc else '全程完全无人声，没有任何对白、旁白、心声；画中人始终闭口。'
    if not npc and is_gouan:action='苟安保持首帧姿势自然呼吸，嘴唇全程轻合，不张嘴、不接话、不点头，眼神缓缓落低，少量衣料随呼吸移动；只有他一个人，镜头不切换，不出现文书或任何文字。'
    if id=='V43-01':action='摄像机双眼向路边平移半步让开通路，不出现任何身体。苟安缓缓转身背向镜头，沿营外土路谨慎慢走离开，保持伤后步态，不奔跑、不消失、不突然远移。全程一人，无车、无粮袋、无军吏，没有呈报或交件行为。'
    if id in ['V38-01-R2','V39-01-R2']:action='镜头位置的一只右手从画面底边把一束闭合竹简平稳送到案中央，放开后向下退出画面。军吏闭口，目光随竹简落下，再抬眼安静看向镜头。'
    # The actual API text is deliberately positive and minimal. Long negative
    # lists and production vocabulary caused text/reverse-shot artifacts.
    short_action=f'{person}保持首帧姿势，面对镜头自然呼吸，双肩放松，目光稳定。'
    if not npc:short_action=f'{person}保持首帧姿势，嘴唇轻合，安静倾听，缓缓低下目光。'
    if id in ['V38-01-R2','V39-01-R2','V39-02-R2','V40-03-R2','V43-01']:short_action=action
    if id=='V41L-04':short_action='军吏嘴唇轻合，缓缓低头收拢一束闭合竹简。'
    if id=='V41E-01':short_action='军吏闭口，将已经收到的一束闭合卷束平放在案边，静静低头核看。'
    text=f'{c["duration"]}秒写实三国电影。严格从这张首帧开始，同一个{person}、同一服装和空间。第一人称眼平视点，眼前只有{person}一人。固定连续镜头。{short_action}{sound}画面干净，只有自然环境动作声，无配乐。'
    if id=='V40-06-R2':
        action='摄像机固定在空床旁。帐口外的空木车缓慢向右匀速驶过，车轮按行驶方向转动，裸露的平坦木底板始终清楚可见。床铺一直空着。'
        text='8秒写实三国电影，从首帧继续。固定人眼高度镜头，从帐内空床旁望向帐口。帐口外空木车缓慢向右匀速驶过，车轮自然转动。平坦裸木底板一直清楚可见，木车空无一物。空床不动。只有帐布风声和同步木车轮声，全程无人声、无配乐。'
    body=dict(model='MiniMax-H3',duration=c['duration'],resolution='768P',ratio='16:9',content=[dict(type='text',text=text),dict(type='image_url',role='first_frame',image_url=dict(local_path=path))])
    local=OUT/'requests'/f'{id}.local.json';prepared=OUT/'requests'/f'{id}.json'
    save(local,body)
    save(OUT/'requests'/f'{id}.firstframe.local.json',body)
    # Preparation has no paid-video request; safe to retry a failed reachability check.
    for attempt in range(3):
        try:b,refs=api.prepare_request(body,OUT);break
        except api.PipelineError:
            if attempt==2:raise
            time.sleep(4)
    save(prepared,b);save(prepared.with_suffix('.references.json'),refs)
    # Keep the independently reviewable document complete and bound to one image.
    doc=f'尺寸：16:9\n模型：MiniMax-H3\n声音：有声音\n时长：{c["duration"]}秒\n\n## 参考图\n\n1. 图片1｜{person}第一视角构图｜用途：严格首帧，同时绑定中央同一身份、服装、空间与机位。\n   本地路径：`{path}`\n\n## 视频生成 Prompt\n\n### 分镜1｜0-{c["duration"]}秒\n\n参考图关系：图片1是本镜唯一首帧，锁定同一个{person}与首帧空间、光线和站位，不附加其他reference_image，不复制额外角色。\n\n画面与动作：{action}\n\n摄影与切点：严格光学第一视角，镜头就是我眼睛；不拍我的头、肩、背。一个连续镜头，保留呼吸与句末停顿。结束后保持原V的下一事件边界。\n\n对白与追溯：\n'
    for l in c['lines']:doc+=f'- {l["node"]}｜{l["speaker"]}｜{l["voiceAndLipOwner"]}｜{l["text"]}\n'
    doc+='\n全片约束：'+c['endState']+'；纸张空白或闭合，不生成可读文字、字幕、水印、分屏、黑边。\n\n拍摄手法参考：项目已核验《影》摄影研究（https://theasc.com/article/dual-nature-shadow/）的低饱和天然材质与有限暖色用于分镜1；本镜固定主观机位由当前对话关系设计，不声称复刻原片。\n\n声音要求：'+sound+'全片无BGM、无背景音乐、无配乐、无吟唱、无音乐鼓点，只留当前画面同步自然环境声。\n'
    (OUT/'prompts'/f'{id}.md').write_text(doc,encoding='utf-8')
    save(OUT/'requests'/f'{id}.firstframe-override.json',dict(id=id,reason='shared composition prevents third-person reverse shots and reference-image cuts',reference=path,role='first_frame',prepared_sha256=__import__('hashlib').sha256(prepared.read_bytes()).hexdigest(),remoteSubmitted=False))
    print(id,'prepared first_frame',flush=True)
