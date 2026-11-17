from pathlib import Path
import json,hashlib
R=Path(__file__).resolve().parent
def read(p):return json.loads(p.read_text('utf-8-sig'))
q=read(R/'final-technical.json');timeline=read(R/'edit-timeline.json');audio=read(R/'audio-provenance.json')
out=Path(q['file']);sha=hashlib.sha256(out.read_bytes()).hexdigest();assert sha==q['sha256']
events=read(out.with_suffix('.events.json'));asr=read(out.with_suffix('.asr.json'))
assert events['source_sha256']==sha and asr['source_sha256']==sha,'音频筛查必须绑定当前输出，不能沿用旧导出'
records=[]
for d in sorted(p for p in R.iterdir() if p.is_dir() and (p/'prompt.txt').exists()):
    taskids=sorted({read(p)['task_id'] for p in d.glob('api/**/task.json')})
    if taskids:
        records.append(dict(id=d.name,task_ids=taskids,source=str(d/'source.mp4'),technical=read(d/'technical.json')['checks'] if (d/'technical.json').exists() else None,prompt_status='待review',video_status='待review',selected=any(s['id']==d.name and not ('source_path' in s and 'PV-H3-20261115-v2.5' in s['source_path']) for s in read(R/'edit-selection.json')['shots'])))
save=lambda name,value:(R/name).write_text(json.dumps(value,ensure_ascii=False,indent=2),'utf-8')
save('api任务与选片记录.json',dict(date='2026-11-17',unique_tasks=len({t for r in records for t in r['task_ids']}),records=records,unknown_post_retries=0,user_review='待review'))
browser=read(R/'browser-playback.json') if (R/'browser-playback.json').exists() else {'status':'not_recorded'}
qa=dict(date='2026-11-17',sha256=sha,duration=q['duration'],full_decode=q['full_decode'],frames=q['frames'],audio_asr_segments=asr['segments'],music_event_max=max(w['music'] for w in events['windows']),audio_method='ASR与音频事件模型辅助筛查，非听审证明',picture_method='逐镜联系表、重点动作高频联系表、合并版总览及4处转场连续帧目视抽查',browser=browser,full_human_av_review=False,user_review='待review')
save('验证记录.json',qa)
rows=[]
for s in timeline['shots']:
    p=Path(s['source']);rows.append(f"| {s['id']} | {s['timeline_in']:.2f}—{s['timeline_out']:.2f} | {s['source_in']:.2f}—{s['source_out']:.2f} | {p.parent.name} | {s.get('selection_reason','')} |")
doc=f'''# 三国遗憾 PV｜电影转场版 v2

2026-11-17。状态：制作审阅版，待用户review。用户本轮授权增加转场、调用指定MiniMax-H3 API生成并合并；生成授权不等于文稿或成片审核通过。

## 交付

- [播放合并版]({out.as_posix()})：**{q['duration']:.2f}秒**，1280×720，24fps，{q['frames']}帧，H.264/AAC。
- [本地审阅页]({(R/'审阅.html').as_posix()})：合并版与实际选片逐镜播放；单镜卡片为画面，声音以合并版为准。
- [实际剪辑表]({(R/'edit-timeline.json').as_posix()})、[剪辑选择与原因]({(R/'edit-selection.json').as_posix()})、[转场与剪辑源脚本]({(R/'render_film.py').as_posix()})。
- [声音来源与排除记录]({(R/'audio-provenance.json').as_posix()})、[API任务与选片记录]({(R/'api任务与选片记录.json').as_posix()})、[验证记录]({(R/'验证记录.json').as_posix()})。

未提供压缩副本。原片、参考图、独立生成文档和API结果均保存在本目录各镜文件夹，旧v1稿及夷陵独立成片未改动。

## 实际制作

本轮共生成{len({t for r in records for t in r['task_ids']})}条独立H3任务（包含A03R与D03R两次针对明确失败原因的修正），全部使用指定本机DPAPI凭据与MiniMax-H3入口。请求768P、16:9；本轮原片实际多为1344×768、24fps，成片统一重新取景到16:9并输出720p。个别近景进行了整幅裁切放大，不称原生1080p/2K。

合并版14个画面镜头，其中13条来自本轮生成，雨中诸葛亮选用既有H3 R06的0.5—2.75秒。本轮A03/A03R出现新火和口型，均未入片；旧R06只选经本轮重新查看的正确区间，并整幅裁切保留人物和动作。原D03落手未入片，D03R改用本轮真实悬手首帧，上收并悬停。

原75秒导演设计随可用动作收紧为{q['duration']:.2f}秒。所有入片段保持原速，无定格、重复画面或倒放补时。

## 实际转场

1. 开场灯火接谷火：0.25秒失焦接切，在失焦最重处直接换镜，恢复清晰；无两幅景物叠影或白闪。
2. 雨景接旷野：同样以0.25秒焦点变化完成换场，场景声音随之从雨过渡至旷野风。
3. 松手接实际落刀，落刀接刑场低刀：保留动作因果与刀刃的斜线关系；刑场不翻转、不甩镜。
4. 马谡与诸葛亮：E07原图右上望→监斩反打左下看→举扇→马谡短反应，使用普通视线/动作切镜。
5. 刑场入夜：0.25秒暗场过渡。没有追加局部遮罩或人物变形。
6. 灯已实际熄灭后：0.25秒整体淡黑进入片名，保留余烟过程。

## 声音与验证

无对白、旁白和BGM。保留开场单独筛查过的呼吸、可用的余炭原声；含音乐或疑似额外人声的生成音轨整条排除，改用已注明来源的公有领域雨声及本地生成的非音调风声。落刀切点加一次非音调接触声。没有用音乐分离残留冒充无BGM。

当前输出完整解码通过，视频帧数和音视频时长已核对。ASR未识别到词句；音频事件筛查各窗口音乐分值最高{qa['music_event_max']:.4f}，仅作辅助证据。已看逐镜总览、重点动作细节及4处转场联系表。浏览器播放检查记录：{browser.get('status','not_recorded')}。

这些检查不构成完整人工逐声听审，也不代替用户对本版本的视听审核。C02实际有摄影机推进，和原稿固定机位存在差异；D01实际全景落手，入片改为上半身整幅取景，未将原全景动作记为通过。微表情、道具连续性和整体节奏仍以用户看此合并版的意见为准。

## 实际镜头表

| 镜头 | 成片秒数 | 原片区间 | 来源目录 | 选片说明 |
|---|---|---|---|---|
'''+ '\n'.join(rows)+f'''

输出SHA-256：`{sha}`。
'''
(R/'交付与验证.md').write_text(doc,'utf-8')
index='# 三国遗憾 PV｜v2独立生成文档索引\n\n2026-11-17。全部Prompt与视频仍待用户review；本轮16条请求文档和原片保留，实际入片以剪辑表为准。\n\n'
for r in records:
    p=R/r['id']/'生成文档.md';index+=f"- [{r['id']} 生成文档]({p.as_posix()})\n"
index+=f"\n[实际交付与验证]({(R/'交付与验证.md').as_posix()})\n"
(R/'Prompt索引.md').write_text(index,'utf-8')
print(json.dumps(dict(file=str(out),duration=q['duration'],tasks=len(records),asr_words=len(asr['segments']),music_max=qa['music_event_max'],browser=browser.get('status'),user_review='待review'),ensure_ascii=False))
