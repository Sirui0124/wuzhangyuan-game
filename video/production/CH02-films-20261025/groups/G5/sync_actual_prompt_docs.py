from pathlib import Path
import json,shutil
OUT=Path(__file__).parent
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
clips=read(OUT/'plan.json')['clips']+read(OUT/'repair-plan.json')['clips']
for id in ['V37-03','V42-01','V42-02','V42-03','V37-02-R2','V32A-07-R2']:
    c=next(c for c in clips if c['id']==id);req=read(OUT/'requests'/f'{id}.local.json')
    path=OUT/'prompts'/f'{id}.md';history=OUT/'prompts/history';history.mkdir(exist_ok=True)
    if path.exists() and not (history/f'{id}-before-actual-minimal.md').exists():shutil.copy2(path,history/f'{id}-before-actual-minimal.md')
    refs=[x['image_url']['local_path'] for x in req['content'] if x['type']=='image_url']
    assert all(Path(x).is_file() for x in refs)
    rows=['尺寸：16:9','模型：MiniMax-H3（本轮OpenAI Next实际使用）','声音：有声音',f'时长：{c["duration"]}秒','','## 参考图（实际上传顺序）','']
    for n,ref in enumerate(refs,1):rows +=[f'{n}. 图片{n}｜{ref}｜作为本条唯一首帧；负责既定人物、服装、空间、构图和光照。']
    rows+=['','## 逐句映射（制作记录，不发送API）','']
    for x in c['sourceLines']:rows.append(f'- {x["node"]}｜{x["speaker"]}｜{x["voiceAndLipOwner"]}｜{x["text"]}')
    rows+=['','本稿对应 requests/'+id+'.local.json 的实际简洁英文镜头请求；旧长稿保存在 history，不能当成本次已发送内容。对白/文书正文及游戏状态边界仍以以上冻结映射为准。','','## 视频生成 Prompt','',f'分镜1｜0-{c["duration"]}秒','参考图关系：图片1锁定本镜起始空间与构图。人物镜头绑定同一身份及衣着；案头镜头只取木案、纸卷和左侧自然光，不把环境图中未要求的人物带入剧情。','画面动作与摄影：'+c['action'],'对白：'+('；'.join(x['text'] for x in c.get('generatedSpokenLines',[])) or '无新增对白；玩家心声由已有中央WAV后期加入，演出与文书说明不朗读。'),'','API实际镜头文本：','',next(x['text'] for x in req['content'] if x['type']=='text'),'','连续性约束：保留本条源动作先后及独立UI确认边界；结局允许第三人称与背影，不新增玩家正脸。V32A07只划去原有赴魏安排并署名，不提前寄出；V37只适用E1；V42只适用E1/E3。','', '拍摄手法参考：《1917》仅取按人物动作路径与实际耗时安排机位、随注意力平稳改变视线的拍法，应用本条连续镜头；沿用总控已核验的ASC摄影访谈 https://theasc.com/article/lives-under-siege-the-goldfinch-and-1917/ ，不复制其时代或人物。','','声音要求：全片无BGM、无背景音乐、无配乐。只保留本条冻结源明确指定的对白及与当前动作同步的纸张、笔尖、衣料、脚步、木轮和轻风；无对白镜头禁止新增人声，文书与演出说明不念。']
    path.write_text('\n'.join(rows)+'\n',encoding='utf-8')
    print(id,'actual request and independent MD aligned')
