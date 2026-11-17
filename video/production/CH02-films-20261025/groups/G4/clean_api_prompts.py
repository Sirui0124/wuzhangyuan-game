from pathlib import Path
import json,os,hashlib
OUT=Path(__file__).resolve().parent
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,v):
    tmp=p.with_suffix(p.suffix+'.tmp');tmp.write_text(json.dumps(v,ensure_ascii=False,indent=2),encoding='utf-8');tmp.replace(p)
clips=read(OUT/'plan.json')['clips']+(read(OUT/'retake-plan.json')['clips'] if (OUT/'retake-plan.json').exists() else [])
changed=[]
for c in clips:
    cid=c['id']
    if (OUT/'tasks'/f'{cid}.json').exists():continue
    l=c['lines'][0] if c['lines'] else None
    person='苟安' if c['refset']=='gou' else '收件军吏'
    place='原伤帐，右侧绳编木榻、旧米白帐布，灰麻衣黑巾短须、受伤休养，不加绷带' if c['refset']=='gou' else '原收件处木案前，案后同一灰袍黑软冠军吏，衣领米白'
    speech='无对白、无旁白、无人声，画内人物全段闭嘴。' if c['silent'] or c.get('audioOverlay') else f'只有{person}看向摄影机开口，用自然清晰普通话说一次：“{l["text"]}”。不增加其他人声。'
    action=c['action'].replace('后期叠字空间','干净平整区域').replace('文字不由模型生成','不出现文字')
    if c['refset']=='gou':
        action=action.replace('坐靠','半趴撑靠').replace('坐姿','半趴撑靠姿势').replace('被褥','绳榻边').replace('被边','榻沿')
        place='原伤帐中，苟安保持图中灰麻衣黑巾、半趴在绳榻边的伤后姿势，不加绷带'
    if c.get('textOverlay'):
        person='无字案头';place='同一收件处木案，展开的一张平整无字麻纸，无人无手入画';action='保持纸面平整和所有卷束静止，仅有极轻的自然光影变化，没有任何文字或印章，不翻页、不添笔、不引入人物。'
    text=f'''16:9写实历史电影。镜头是我的眼睛，不出现我的脸、肩背或倒影，没有第三人称反打。低饱和墨灰土褐，自然肤色，暗部可读，柔和天光。不要绘画、CG皮肤、HDR、全局蓝橙。
图片1是唯一首帧，直接从图中同一个人、同一空间、同一构图开始继续动作，绝不切成另一张参考照片。锁{person}的脸、发型、年龄、衣冠和环境；只取前景指定人物，忽略背景路人。
分镜1，0至{c['duration']}秒：{place}。{action}。参考图关系：图片1负责本镜身份、空间、首帧和光照；35–50mm自然人眼透视，全片连续一个镜头，固定机位，不绕拍、不推拉、不切镜。结尾留完整动作和闭口停顿，不出现离开、签署、判决等额外行为。
{speech}
人物与道具数量稳定，手指正常，接触有重量，不穿模、不瞬移；所有卷束和纸面无可读文字，不落印，不生成字幕、标题、标注、水印和黑边。
声音要求：全片无BGM、无背景音乐、无配乐、无吟唱、无音乐鼓点。只保留实际发生的轻微帐布、衣料、纸木接触及脚步声；人声严格按上述规定，不朗读镜头描述。'''
    p=OUT/'requests'/f'{cid}.local.json';body=read(p);body['content'][0]['text']=text
    if c['refset']=='gou':first=OUT.parents[1]/'references/source-frames/gouan-talk.png'
    elif c.get('textOverlay'):first=OUT.parents[1]/'references/generated/收件案头/image-01.png'
    else:
        shared=read(OUT.parent/'G5/references/composition-manifest.json')['byId']['clerk-receiving-desk']
        first=Path(shared['path'])
        assert shared['ready'] and hashlib.sha256(first.read_bytes()).hexdigest()==shared['sha256']
    body['content']=body['content'][:1]+[dict(type='image_url',role='first_frame',image_url=dict(local_path=str(first)))]
    save(p,body)
    # A previously prepared file without a task can be refreshed without dispatch.
    prepared=OUT/'requests'/f'{cid}.json'
    if prepared.exists():
        # Prepared reference media must also be rebound, not mixed with first_frame.
        prepared.unlink()
    md=OUT/'prompts'/f'{cid}.md'
    if md.exists():
        track='\n'.join(f"{x['node']}｜说话人：{x['speaker']}｜原句：{x['text']}｜{x['voiceAndLipOwner']}" for x in c['lines']) or '动态玩家原话不预录；本片只作闭口听者环境画面。'
        full=f'''尺寸：16:9
模型：MiniMax-H3（本轮指定）
声音：有声音
时长：{c['duration']}秒

## 参考图（实际上传顺序）

1. 图片1｜{person}连续镜头首帧｜用途：身份、当前空间、构图与光照；角色不可换脸。
   本地路径：`{first}`
   实际媒体角色：first_frame；不混用reference_image。

## 逐句追溯与配音说明

{track}

{'本次API只生成闭口人物和环境声；已有中央玩家音轨后期配入，不新增语音合成。' if c.get('audioOverlay') else '仅指定NPC原句进入视频原声；音频异常单列记录，不因纯音频问题重拍。'}

## 视频生成 Prompt

### 分镜1｜0-{c['duration']}秒

参考图关系：图片1负责本镜人物身份、空间、构图、光照及首帧；直接连续拍摄，不变为逐图展示。

画面与动作：{place}。{action}

摄影与切点：35–50mm自然人眼透视，固定第一视角，一个连续镜头。人物不离开原位置；完整动作与闭口停顿后结束，衔接{'、'.join(c['next'])}，不跨选择或确认边界。

对白：{speech}

连续性与限制：锁同脸、衣冠、伤姿和空间；无额外人物、无第三人称反打、无可读乱码文书，无签署落印或额外剧情。API实际正文保存在同编号requests文件，制作编号与后期说明不发给模型。

拍摄手法参考：参考《影》摄影指导赵小丁访谈（American Cinematographer，Dual Nature: Shadow）中有动机的克制机位与局部光源，用于本镜帐布层次和可读暗部；保留自然肤色，不复刻未经核验的具体镜头。

声音要求：全片无BGM、无背景音乐、无配乐、无吟唱、无音乐鼓点。只保留实际发生的轻微帐布、衣料、纸木接触及脚步声；人声严格按上述规定，不朗读镜头描述。'''
        md.write_text(full,encoding='utf-8')
    changed.append(cid)
print(json.dumps(dict(cleaned=changed),ensure_ascii=False))
