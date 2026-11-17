from pathlib import Path
import json,sys,datetime,hashlib,re
OUT=Path(__file__).parent;sys.path.insert(0,str(OUT))
from run_pipeline import read,save,metadata
report=read(OUT/'delivery.json');ledger=[]
for path in sorted((OUT/'tasks').glob('*.json')):
    if any(s in path.name for s in ['.request.','.latest.']):continue
    state=read(path);id=path.stem
    ledger.append(dict(id=id,task_id=state.get('task_id'),status=state.get('status'),downloaded=(OUT/'generated'/f'{id}-delivery.json').exists(),originalUnknownHeld=(id=='V32A-01'),stateFile=str(path.resolve())))
assert len(report['assembled'])==7 and not report['sourceCoverage']['missing']
assert len(set(report['sourceCoverage']['delivered']))==35
for slot in report['assembled']:
    file=Path(slot['file']);assert file.is_file() and file.stat().st_size>1000
    m=metadata(file);assert m['size']==[1280,720]
    assert re.search(r'\b24 fps\b',m['probe']) and '48000 Hz' in m['probe']
    slot['technicalReview']=dict(size=[1280,720],ratio='16:9',fps=24,audioRate=48000,decode=slot['decode'],sha256=slot['sha256'])
    slot['userReview']='待review';slot['audioListening']='未逐字听审'
report.update(completedAt=datetime.datetime.now().astimezone().isoformat(),phase='seven-slots-delivered-for-review',taskLedger=ledger,paidSubmissionAccounting=dict(knownTaskIds=sum(bool(x['task_id']) for x in ledger),knownSucceeded=sum(x['status']=='succeeded' for x in ledger),explicitFailed=sum(x['status']=='failed' for x in ledger),unknownOutcome=['V32A-01'],unknownResubmitted=False),dialogueDurationAudit=str((OUT/'review/dialogue-duration-audit.json').resolve()),userReview='待review',audioListening='未逐字听审',boundedVisualRemainder=['V32A-07：真实横划与下方署名已有独立R2演出，撤回条款后期配准；纸面旧字擦除残迹、合成文字的透视/署名字形仍需精修，保留review-candidate-with-issues','V36-01：移动纸面错误字采用局部柔焦，准确材料名称用后期插入；柔焦效果可见，需用户审阅','V42：旧墨字形与红线栏目仅作旧记录视觉纹理，不能作为精确人口或其他数值证据'],dynamicReview=dict(firstCompletePass=['V32A','V33','V34','V35','V36','V37','V42'],method='本地IAB从头至尾实际连续播放；全时段4fps序列辅助检查。播放完成记录不等同逐帧观看、声音听审或用户通过',finalChangedSlots='最终V32A与V36另做连续复看，实际结果见review/final-dynamic-review.json'),scope='仅G5制作候选；未修改游戏、在线策划表、其他组或原始素材；未新增TTS；无压缩包')
save(OUT/'delivery.json',report)
plan=read(OUT/'plan.json');plan['status']='seven-slots-delivered-for-review';save(OUT/'plan.json',plan)
lines=['# G5 共同补救与归途｜制作自查与交付','','七个V槽位均已合片，覆盖冻结源35个独立节点，缺失节点0。全部为待review制作候选，不能当作用户通过。','','| 槽位 | 实际时长 | 合片 | 画面状态 |','| --- | ---: | --- | --- |']
for slot in report['assembled']:
    lines.append(f'| {slot["id"]} | {slot["metadata"]["duration"]:.2f}秒 | [播放]({Path(slot["file"]).as_posix()}) | {slot["visualReview"]} |')
lines+=['','## 画面与衔接','','- V32A改用本组夜帐闭口面部与案面观察段，替换原先G4日间半趴借片。只读借片历史及旧版均保留；unknown V32A-01未重投。','- V32A-03、05、V34-01、V36-04以同场观察/案面段及适度慢放补足完整原句承载时间；没有1–2秒短循环。对应源音轨范围与ASR定位分别记录。','- V32A-07采用单独R2的实际横划、提笔和下方署名，后期正确撤回条款配准于横划轨迹；准确字层不是模型手写。纸面擦除与透视仍有遗留，未宣称全视觉通过。','- V33保留交卷、接触和松手。V34是李严远方读信、补报与交出材料，未将其当作玩家提前收件。','- V35采用V33指定区间倒放画面构成取卷递回，来源明确；随后真实展开/核阅与准确文书插入。动态及4fps检查覆盖手、布囊、卷轴接触方向，仍留用户审阅。','- V36-01保留材料放稳及松手后插入准确材料名称；移动错误字局部柔焦。02裁掉错误纸面，03实际取卷后插入准确裁处正文。先收齐、再核实及裁处的流程未提前。','- V37只适用于E1，普通粮兵苟安与空车、搭手推车都有画面；越辙车轮未入镜，不把音效当作轮子画面证据。','- V42只适用于E1/E3，不新增玩家正脸或穿越特效，不把生成旧字当作精确史料/数值。','','## 实际验证','','- 7段均完整解码，1280×720、16:9、24fps、48kHz；SHA256与每个子片来源、裁剪、复用、中央玩家WAV时间窗都在delivery.json。','- 七段完成一次本地IAB从头到尾连续播放，另有全时段4fps序列；最终修改的V32A/V36复看另记。没有把播放完成或ASR当作逐字听审。','- 声音未逐字听审。原声可能含错词、制作说明、额外人声或音乐，全部单独留audioIssues；未因此重拍画面或新增TTS。','','## 明确保留的问题','']+[f'- {x}' for x in report['boundedVisualRemainder']]
lines+=['','## 请求与版本记录','',f'- 现有任务ID共{report["paidSubmissionAccounting"]["knownTaskIds"]}个，成功{report["paidSubmissionAccounting"]["knownSucceeded"]}个，明确失败{report["paidSubmissionAccounting"]["explicitFailed"]}个；另V32A-01初始提交结果未知且始终未重投。','- V37-02原任务明确input_download_failed后独立R2恢复；V32A-04-R2为单条构图试拍；V32A-07-R2为单条关键动作返修。其他R2草稿未当作已付费任务。','- 所有新付费请求使用总控同字节验证的res-1参考图运输，单条不超过15秒；无第二运行器并发重复提交。','- 所有已登记可播文件和旧版保留，新版本写完、解码后再原子更新交付登记。','','[交付登记]('+str((OUT/'delivery.json').resolve().as_posix())+')  ｜  [对白时长核验]('+str((OUT/'review/dialogue-duration-audit.json').resolve().as_posix())+')  ｜  [合片审阅页]('+str((OUT/'合片审阅.html').resolve().as_posix())+')','']
(OUT/'制作自查与交付.md').write_text('\n'.join(lines),encoding='utf-8')
print('7 slots, 35/35 source nodes; final report saved; all user states remain 待review')
