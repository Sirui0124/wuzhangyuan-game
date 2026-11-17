from pathlib import Path
import json,re,subprocess,time
OUT=Path(__file__).resolve().parent
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2),encoding='utf-8')
d=read(OUT/'delivery.json');plan=read(OUT/'plan.json');assignment=read(OUT/'assignment.json')
assert len(d['clips'])==14 and not d['missingSlots']
want=[l['node'] for s in assignment['clips'] for l in s['lines']]
got=[n for c in plan['clips'] for n in c['sourceNodes']]
assert want==got and len(want)==36
assert len(d['subclips'])==37
assert all(t['status'] in ['succeeded','failed','cancelled','canceled'] for t in d['tasks'])
warnings={'V27':['部分原玩家画面有口部活动，须结合最终配音复核，当前不声称口型通过'], 'V28C':['玩家段有少量口部活动，最终音轨关系待核'], 'V29':['玩家咨询段有可见口部活动，最终音轨关系待核'], 'V28B':['背景人员有走动，未作为新剧情或证据使用'], 'L02':['7.4秒日间闭口有效段；长自由输入续播方式留后续游戏整合，不能冒作夜景']}
for c in d['clips']:
    f=Path(c['file']);assert f.is_file()
    meta=subprocess.run([FF,'-hide_banner','-i',str(f)],capture_output=True,text=True,encoding='utf-8',errors='replace').stderr
    m=re.search(r'Video:.*? (\d{3,5})x(\d{3,5})',meta);fps=re.search(r'(\d+(?:\.\d+)?) fps',meta);hz=re.search(r'Audio:.*?(\d{4,6}) Hz',meta)
    assert m and tuple(map(int,m.groups()))==(1280,720)
    assert fps and float(fps[1])==24 and hz and int(hz[1])==48000
    c['technical'].update(fps=24,sampleRate=48000,decode='passed')
    c['visualReview']=dict(completed=True,method='0.5秒连续时序图＋浏览器逐条完整动态播放＋成片真正第一解码帧核验',status='制作自查候选，待用户review',remaining=warnings.get(c['id'],[]),evidence=str(OUT/'review/assembled-playback-complete.png'))
    c['audioIssues']=['声音留统一配音阶段；未完成逐字听审、音色与BGM听审，ASR不能代替听审']
    for sub in [x for x in d['subclips'] if x['slot']==c['id']]:
        for issue in sub.get('audioIssues',[]):
            if issue not in c['audioIssues']:c['audioIssues'].append(issue)
    c['userApproval']='待review'
d.update(status='G4全部14逻辑槽位画面候选已拼接交付；音频待统一',sourceCoverage=dict(expectedSlots=14,assembledSlots=14,expectedSourceNodes=36,deliveredSourceNodes=36,requestCount=37,originalTaskSucceeded=36,originalTaskFailed=1,repairTaskSucceeded=4),visualReview=dict(completed=True,rawApiVideos=40,rawTemporalEvidence='review/*/timeline.jpg',assembledSlotsPlayed=14,firstDecodedFramesChecked=14,actualPlaybackEvidence='review/assembled-playback-complete.png'),newTTSRequests=0,audioReview='未听审；音频不作为本轮画面通过条件，留后续统一配音',unresolved=['所有成片仍待用户review，不等于用户通过','声音未完成逐字听审、统一配音/音色及无BGM确认；实际异常见各段audioIssues','V27/V28C/V29部分玩家画面口部活动留最终音画关系核查','部分安静听者段复用了同组同日间同姿势素材并均匀变速，来源与区间已逐片记录；无一秒口型循环'],submissionPaused=False)
for r in d['subclips']:
    src=Path(r['source']);key=src.stem.replace('-16x9','')
    state=OUT/'tasks'/f'{key}.json'
    r['sourceTaskId']=read(state).get('task_id') if state.exists() else 'task_K3cY2lbT6H1esMYpuYmmQACPCU5fPe11' if '准确转运简报' in src.name else None
    r['targetLines']=[l for c in plan['clips'] if c['id']==r['id'] for l in c['lines']]
save(OUT/'delivery.json',d)
save(OUT/'status.json',dict(group='G4',stage='本组画面候选全部交付；声音留后续统一',logicalSlots=14,deliveredSlots=14,sourceNodes=36,originalRequests=37,submitted=41,succeeded=40,failed=1,active=0,newTTSRequests=0,delivery=str(OUT/'delivery.json'),index=str(OUT/'交付索引.md'),userApproval='待review'))
lines=['# G4｜军情与第二次交谈｜完整交付索引','14个逻辑槽位全部已有独立可播放制作候选。分支、UI、确认边界分别保留；未改游戏、在线表格或冻结对白。','本轮共41个实际任务：40成功，L02原任务1次参考图下载失败；L02采用已注明的同组日间闭口有效段，未再提交。4个V26画面R2保留原片与任务ID。恢复后新图采用res-1同字节校验。未新增TTS。','声音按用户最新要求留后续统一配音。本轮未逐字听审，不声称音色、口型或无BGM已通过；自查不等于用户审核。','## 播放文件','| 槽位 | 名称 | 实际时长 | 文件 |','|---|---|---:|---|']
for c in d['clips']:lines.append(f"| {c['id']} | {c['name']} | {c['technical']['duration']:.2f}秒 | [{c['id']} MP4](<{c['file']}>) |")
lines+=['','## 本轮修复','- V26核收改为闭合卷束真实接触与落稳，删除原版展开乱码与提前交案暗示。','- V26简报采用干净纸面，冻结原文按镜头纸面透视逐帧叠加；准确文字未交给模型拼写。','- V26军吏长句以稳定单首帧重拍，烧录字幕通过裁幅去除；完整原句承载时间保留。','- V27去掉额头新血伤、越肩字纸和无来源搬被离开，按同场同脸日间听者替换；来源、裁剪、速度见机器索引。','- L02主版为原V28A01的0–5.55秒，0.75倍均匀放慢，约7.4秒全段闭口；旧8.38秒备选保留供已引用方使用0–7.4秒。没有机械循环口型。','- 裁剪在解码后trim/atrim并重置时间基；每个最终V直接抽第一解码帧检查，没有通过seek掩盖旧帧。','','## 剩余限制','- 音频未逐字听审，包含待统一配音与待核音轨；各段audioIssues分开列出。','- V27、V28C、V29部分玩家画面有口部活动，须结合最终音轨复核；未把暂时音轨不同自动判成画面失败，也未宣称口型通过。','- V28B背景人员走动只作为营地环境，未当作新增剧情或证据。','','## 追溯文件',f'- [机器交付索引](<{OUT/"delivery.json"}>)',f'- [分镜脚本](<{OUT/"分镜脚本.md"}>)',f'- [逐条画面与音频问题](<{OUT/"review/visual-audio-review.json"}>)',f'- [简报叠字与纸面追踪记录](<{OUT/"review/document-overlay-placement.json"}>)',f'- [真正首解码帧核验](<{OUT/"review/first-decoded-frames/verification.json"}>)','','## 逐请求独立Prompt']
for c in plan['clips']:lines.append(f'- [{c["id"]}](<{OUT/"prompts"/(c["id"]+".md")}>)｜原计划{c["duration"]}秒')
for c in read(OUT/'retake-plan.json')['clips']:lines.append(f'- [{c["id"]}](<{OUT/"prompts"/(c["id"]+".md")}>)｜画面返修')
(OUT/'交付索引.md').write_text('\n'.join(lines),encoding='utf-8')
print(json.dumps(dict(slots=14,sourceNodes=36,tasks=len(d['tasks']),seconds=sum(c['technical']['duration'] for c in d['clips'])),ensure_ascii=False))
