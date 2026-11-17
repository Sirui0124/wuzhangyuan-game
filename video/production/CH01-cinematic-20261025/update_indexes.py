from pathlib import Path
import json,shutil
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).parent
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,x):p.write_text(json.dumps(x,ensure_ascii=False,indent=2),encoding='utf-8')
def link(p,label):return f'[{label}](<{Path(p).resolve().as_posix()}>)'
movies=read(ROOT/'GameStarter/web-demo/public/cinematics.json');media=read(ROOT/'GameStarter/web-demo/public/video/media-manifest.json')
integ=read(OUT/'integration.json');meta={x['url']:x for x in media['clips']};current=[]
for group,clips in movies.items():
    if not isinstance(clips,list):continue
    for c in clips:
        if not isinstance(c,dict) or not c.get('src'):continue
        current.append(dict(group=group,**c,absolutePath=str((ROOT/c['src'].lstrip('/')).resolve()),sha256=meta[c['src']]['sha256'],duration=meta[c['src']].get('duration')))
for rel in ['docs/video/ASSET-INDEX.md','docs/video/ASSET-INDEX.json','video/README.md','docs/video/VIDEO-SELECTION-MANIFEST.json']:
    p=ROOT/rel;dst=OUT/'audit'/(p.name+'-before')
    if not dst.exists():shutil.copy2(p,dst)
save(ROOT/'docs/video/ASSET-INDEX.json',dict(updated='2026-10-25',authority='GameStarter/web-demo/public/cinematics.json and public/video/media-manifest.json',records=current,coverage=read(OUT/'audit/coverage.json')))
index='# 当前视频资产索引｜2026-10-25\n\n'+link(OUT/'第一关视频审阅与交付.md','本轮审阅与交付')+' · '+link(ROOT/'source-art/core/README.md','核心资产')+' · [游戏试玩](http://127.0.0.1:8812/)\n\n以游戏cinematics.json和public/video/media-manifest.json为准。现有39个唯一播放文件，第一关对白／行动29组、固定节点81个。新开场36.93秒，后接SC03。生成、接入和人工通过独立。\n\n| 分组 | ID | 内容 | 时长 | 当前文件 |\n| --- | --- | --- | ---: | --- |\n'
for c in current:index+=f'| {c["group"]} | {c["id"]} | {c["title"]} | {c["duration"]:.2f}秒 | '+link(c['absolutePath'],Path(c['absolutePath']).name)+' |\n'
index+='\n两处动态AI答应句、玩家输入和结算界面文字保留原呈现。旧存档停在片中时回退原文，不重新授予线索。姜维授权用词、跨片音色和人物连续感待人工review。旧索引原文保存在本轮audit，不再作为当前采用入口。\n'
(ROOT/'docs/video/ASSET-INDEX.md').write_text(index,encoding='utf-8')
(ROOT/'video/README.md').write_text('# 视频素材\n\n'+link(OUT/'第一关视频审阅与交付.md','当前交付')+' · '+link(ROOT/'docs/video/ASSET-INDEX.md','当前播放索引')+' · '+link(ROOT/'source-art/core/README.md','18项核心资产')+'\n\n- current：发布影片及有追溯需要的源版本，是否采用只看游戏白名单。\n- raw：用户提供的原始素材。\n- production/CH01-cinematic-20261025：本轮制作，generated只留采用源片，edited只留7个采用剪辑。\n- review：各次技术核验，历史记录不代表当前采用。\n\n实际播放以GameStarter/web-demo/public/cinematics.json和GameStarter/web-demo/public/video/media-manifest.json为准。2026-10-25开场36.93秒、固定剧情29组。旧四段在线Prompt已标为历史；后续人物和场景从source-art/core选择。\n',encoding='utf-8')
selection=read(ROOT/'docs/video/VIDEO-SELECTION-MANIFEST.json');selection['auditedAt']='2026-10-25 Asia/Shanghai'
selection['scope']='当前采用：开场和对白更新为20261025，其他场景保留原核验及人工状态'
for c in selection['selections']:
    if not c.get('scene','').startswith('PR01-'):continue
    c.update(cloudPrevious=c.get('cloudCurrent'),cloudCurrent=None,selectedFile=integ['openingFile'],selectedSha256=meta[integ['opening']['src']]['sha256'],source=None,sourceSha256=None,gameClipId=integ['opening']['id'],gameUrl=integ['opening']['src'],humanState='待review',cloudBytesMatchSelected=None,sourceBytesMatchRecord=None,subjectiveAudioReview=False,integratedFile=integ['openingFile'],integratedSha256=meta[integ['opening']['src']]['sha256'],selectionReason='用户要求重做：OP01—04新片加正确旧手机桥接，剪成36.93秒完整开场',integrationNote='请求、采用区间、配音和裁切见20261025交付报告；未标用户通过')
selection['dialogueSelections']=[dict(id=c['id'],file=str((ROOT/c['src'].lstrip('/')).resolve()),rows=c['rows'],sha256=meta[c['src']]['sha256']) for c in movies['chapterDialogue']]
save(ROOT/'docs/video/VIDEO-SELECTION-MANIFEST.json',selection)
print('Stale primary indexes replaced with the actual 39-file playback list; previous versions retained as audit evidence.')
