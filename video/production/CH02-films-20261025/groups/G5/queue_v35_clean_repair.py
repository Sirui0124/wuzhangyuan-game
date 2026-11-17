from pathlib import Path
import json,copy,hashlib
OUT=Path(__file__).parent
def read(p):return json.loads(p.read_text('utf-8-sig'))
def save(p,x):p.write_text(json.dumps(x,ensure_ascii=False,indent=2),'utf-8')
id='V35-R2-clean'
assert not (OUT/'tasks'/f'{id}.json').exists(),'Never submit any known or unknown outcome twice'
ref=read(OUT/'references/old-scroll-oblique-back/dispatch-guard.json')
assert ref['state']=='succeeded' and hashlib.sha256(Path(ref['path']).read_bytes()).hexdigest()==ref['sha256']
prompt='One continuous eight-second historical live-action insert, keeping exactly the grey-brown linen sleeves, two ordinary hands, rough wooden low desk, daylight and plain paper reverse from the first frame. Low oblique camera at the paper edge, no head or face. The inked fronts always face away from camera. From 0 to 2 seconds the hands finish opening the folded reply already being held, and lower it to the far part of the desk. From 2 to 6 seconds the hands draw exactly two separate loose paper sheets from beneath it, place one on the left and one on the right, side by side on the near desk. Keep the sheets distinct, their plain backs facing camera, with no text, symbols or captions. From 6 to 8 seconds both sheets settle flat, the fingertips release each edge and withdraw, leaving both papers visibly present and stationary. Preserve the physical paper contact and release, no morphing, duplication or extra hands. Only synchronized paper and cloth sounds, quiet room tone, no voice or music.'
save(OUT/'requests'/f'{id}.local.json',dict(model='MiniMax-H3',duration=8,resolution='768P',ratio='16:9',content=[dict(type='text',text=prompt),dict(type='image_url',image_url={'local_path':ref['path']},role='first_frame')]))
parents=[c for c in read(OUT/'plan.json')['clips'] if c['id'] in ['V35-02','V35-03']]
c=copy.deepcopy(parents[0]);c.update(id=id,parentId='V35',duration=8,nodes=[n for x in parents for n in x['nodes']],sourceLines=[n for x in parents for n in x['sourceLines']],generatedSpokenLines=[],postVoiceLines=[],post=[],action=prompt,status='necessary-picture-repair',visualRepairReason='旧核阅源有大面积清晰伪字；通用旧卷不能证明两附件整理。沿已通过V42纸背取景类单条扩展，必须实际放下两独立纸张并松手；保留准确阅读层和UI提交边界。',references=[dict(id='plain-paper-back',path=ref['path'],use='唯一首帧，锁灰褐麻袖双手、粗木低案、低斜角纸背和日光；不带入V42史料身份')],promptPath=str((OUT/'prompts'/f'{id}.md').resolve()))
for file in ['repair-plan.json','queue-plan.json']:
 q=read(OUT/file);assert id not in [x['id'] for x in q['clips']];q['clips'].append(c);save(OUT/file,q)
save(OUT/'post-gate.json',dict(enabled=True,allowedNewIds=[id],reason='User-authorized necessary picture repair only: one eight-second V35 two-paper action after successful V42 geometry pilot; no audio-only regeneration',unknownNeverRepost='V32A-01'))
rows=['尺寸：16:9','模型：MiniMax-H3（本轮OpenAI Next实际使用）','声音：有声音','时长：8秒','','## 参考图（实际上传顺序）','',f'1. 图片1｜{ref["path"]}｜唯一首帧：灰褐麻袖双手、粗木案、纸背构图及日光；此处不带入旧记录的剧情身份。','','## 逐句映射（制作记录，不发送API）','']
for x in c['sourceLines']:rows.append(f'- {x["node"]}｜{x["speaker"]}｜{x["voiceAndLipOwner"]}｜{x["text"]}')
rows+=['','## 视频生成 Prompt','','分镜1｜0-2秒','参考图关系：图片1锁定双手、灰褐麻袖、低木案、日光与低斜角纸背；内容身份改为已收到的回信，不添加文字。','画面动作与摄影：已持着的折叠回信打开后放到木案远侧，真实手纸接触；低机位不出现脸。','对白：无，不新增回信朗读。','','分镜2｜2-6秒','参考图关系：图片1继续负责同一手、麻袖、木案与纸材；镜头沿纸下缘轻移，始终只见纸背与边。','画面动作与摄影：从回信下取出两张独立附件，一左一右分开摆在近侧木案；两张纸不可融合或复制，不拍可读字面。','对白：无。','','分镜3｜6-8秒','参考图关系：图片1保持同一木案和低斜角光照，前镜的两张附件延续在同一位置。','画面动作与摄影：两张纸各自放稳，指尖分别离开纸边并退出，保留两份同时在案上的终态。','对白：无。','','API实际镜头文本：',prompt,'','连续性约束：只在真实收回纸包后核阅；准确粮情和责任内容沿冻结源后期阅读层逐项核对，不新增事实或署名证明。视频结束不自动提交军吏或结案。禁止新增玩家脸、第三人、制作编号、字幕、可读原生伪字。新请求仅此8秒一条，不重投旧请求或未知V32A-01。','','拍摄手法参考：《1917》按动作实际耗时安排注意力转移，应用三段连续纸张动作；沿用已核验ASC摄影访谈 https://theasc.com/article/lives-under-siege-the-goldfinch-and-1917/ 的动作连续性方法，不复制影片人物或年代。','','声音要求：全片无BGM、无背景音乐、无配乐。无对白，禁止新增人声；只保留同步纸张、麻袖摩擦和安静帐内环境音，不生成TTS。']
(OUT/'prompts'/f'{id}.md').write_text('\n'.join(rows)+'\n','utf-8')
print('Queued one necessary eight-second V35 repair; originals held')
