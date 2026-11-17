from user_repair import *
from collections import Counter
p=O/'user-review-batch2.json';r=rd(p);first=rd(reportpath);picture=rd(O/'review/picture-usability.json')
treatments={
'V01':'保留原用户通过的救援片及合理现场呼喊；无新声/新剧情。',
'V02':'恢复旧LI02A完整营外士兵沟通；增时来自实际交流，原心声/入帐/认人保留。',
'V03A':'按用户复用B画面，配完整A既有原句，排除旧黑屏。',
'V03B':'原用户通过版本保留。',
'V04':'删0–4秒元说明及尾段；007/008正确Seed-Audio1.0参考原句，玩家原WAV完整保留，30.17→18.17秒。',
'V05':'原用户通过版本保留；已核转写定位为正常问账/看吧，无导演说明检出。',
'V06':'旧纸面模糊层撤除，新源只取无字0–4秒真实拿纸动作，0.8倍至5秒，完整心声保留。',
'V07':'严格只静音前3秒，视频及后续正常话保留。',
'V08A':'去纸面遮字层并提供完整022合法短句候选；两条玩家原句与沉默停顿保留，32.60→18.08秒，原通过片保留。',
'V08B':'删除原4.208333–10.041667秒脏声音和同段画面，保留前面两句安慰及后续NPC句，18.34→12.51秒。',
'V09':'删明确角色元说明及多余等待，027正确参考原句补齐；完整取出/拿持/放下封套保留，36.31→27.79秒。',
'V10':'删元说明造成的音画拖长，原12–28秒声音内容保留；后四条NPC句按白名单补齐，所有玩家原句完整，75.13→45.75秒。',
'L01':'底片清除非授权固定人声；本次confirmedText由运行时在确认后播放阶段处理，无固定TTS文本可预制，不伪造朗读。',
'V11T':'保留原用户通过版本；ASR只覆盖部分不是听审失败证据，不生成替代声音。',
'V11D':'保留原用户通过版本；ASR只覆盖部分不是听审失败证据，不生成替代声音。',
'V11R':'原用户通过版本保留，ASR定位覆盖合法回应，未检出元字段。',
'V11A':'原用户通过版本保留，ASR定位覆盖合法回应，未检出元字段。',
'V11N':'严格只静音原1.76–2.395秒误读姓名；用户要求其他不变，既有重复片语不另裁。',
'V12':'元说明/重复叮嘱/不完整心声剔除；021正确参考新句，023/024原正确句保留，025完整中央心声只在我持纸末段；纯面部反应排除旧纸和前臂，36.13→19.46秒。'}
for x in r['rows']:
 sid=x['id'];a=rd(O/'assembled'/f'{sid}-assembly.json');assert sha(a['path'])==a['sha256'];assert sha(x['reviewedFile'])==x['reviewedSha256']
 retained=x['originalApproved'] and x['reviewedSha256']==a['sha256'];x.update(candidateFile=a['path'],candidateSha256=a['sha256'],newDuration=a['duration'],status='original-approved-retained' if retained else 'repaired-candidate-awaiting-user-listening',userApproved=bool(retained),oldApprovalNotTransferred=x['reviewedSha256']!=a['sha256'],treatment=treatments[sid],listeningReview='pending actual listening; ASR is locator only',noBgmReview='pending actual listening')
 candidates=[D/'inspection'/f'{sid}-batch2-final-asr.json',D/'inspection'/f'{sid}-batch2-asr.json'];asr=next((z for z in candidates if z.exists() and rd(z)['sha256']==a['sha256']),None);assert asr is not None,('current SHA missing ASR',sid)
 x['asrLocator']=str(asr);x['asrLocatorSha256']=a['sha256'];x['asrConclusion']='用于定位和核对纯台词；同音误识/漏识不等于听审失败，不凭ASR撤销原通过。'
 q=next(q for q in picture['clips'] if q['id']==sid);assert q['sha256']==a['sha256'] and q.get('reviewPolicy')=='20261025-no-meta-no-cards-no-boxes';x['visualPolicyAudit']=dict(policy=q['reviewPolicy'],sha256=q['sha256'],status='candidate-checked',userApproved=bool(retained))
 if sid in ['V11T','V11D']:x['newAudioRequest']='not dispatched; original-approved retained'
 if sid=='V08A':x['misreadIntervalsSource']=dict(file=str(D/'V08A-撤遮字层改真实倾听镜头-R1.mp4'),sha256=sha(D/'V08A-撤遮字层改真实倾听镜头-R1.mp4'));x['intervalClassification']='未覆盖完整原句/过长尾段的候选替换，不声称ASR已经证实原音错误。'
 if sid=='V12':x['ownershipEvidence']=str(D/'inspection/V12-final-R4-timed-actions.jpg');x['finalEDL']=str(D/'V12-final-R4-action-EDL.json');x['rootOwnershipKeyframeCheck']='根已实际查看该时间码序列，关闭疑似取回凭据疑点；不代表用户/声音通过。'
 if sid=='V02':x['existingSceneUtterances']=dict(source=str(Path('C:/Users/zhousirui/Documents/ChatGPT/逆转五丈原/video/current/LI02A-granary-20261018.mp4')),sourceRange=[0,17.83],reason='用户直接要求恢复此既有营外沟通，不属于新增生成对白；仅源片例外，不扩大新发声白名单。',asrLocator=str(D/'inspection/LI02A-asr.json'))
for q in picture['clips']:
 q['integrationConditions']=[s for s in q.get('integrationConditions',[]) if '画面字形只作' not in s]
 if q['id']=='V06':q['integrationConditions']=['日期由完整既有心声及冻结UI-DATE信息提供；本片仅空白纸背，不展示新文书事实。']
 if q['id']=='V12':q['integrationConditions']=['凭据已实际转至我，后续一直由我持有。','CH2-LY03-025完整心声仅在末段我持纸镜头16.46–19.46秒响起，NPC不回应。','影片不显示可读村名/批次；冻结规范允许精确信息由正式证据界面承接，当前游戏对应界面实现尚未在本媒体任务中验证。']
 if q['id']=='V12':q['rootOwnershipKeyframeCheck']=next(x for x in r['rows'] if x['id']=='V12')['rootOwnershipKeyframeCheck']
for c in first['neededReferenceAudioLines']:
 state=D/'seed-audio-required-probe-state.json' if c['node']=='CH2-LY02-008' else D/f"{c['node']}-seed-audio1-state.json";s=rd(state);assert s['status']=='succeeded';c.update(status='generated-and-used-candidate-pending-listening',file=s['file'],sha256=s['sha256'],state=str(state))
for g in first.get('globalRepairs',[]):
 if 'unresolved' in g.get('details',{}):g['details']['unresolved']=[]
first['status']='candidates-ready-awaiting-listening-and-user-review';first['batch2Report']=str(p)
first['notes']+=['batch2已更新19槽，原通过只对原SHA有效；声音实际听审仍pending。'] if not any('batch2已更新19槽' in z for z in first['notes']) else []
central=[]
for node,v in voice.items():
 assert sha(v['path'])==v['sha256'],node;central.append(node)
states=[]
for node in ['CH2-LY02-007','CH2-LY02-008','CH2-LY03-021','CH2-LY03-012','CH2-LY03-013','CH2-LY03-015','CH2-LY03-017','CH2-LY02-022','CH2-LY02-027']:
 sp=D/'seed-audio-required-probe-state.json' if node=='CH2-LY02-008' else D/f'{node}-seed-audio1-state.json';s=rd(sp);assert s['status']=='succeeded' and s['reference'].get('uploaded') and sha(s['file'])==s['sha256'];states.append(dict(node=node,state=str(sp),file=s['file'],sha256=s['sha256'],model=s['model'],referenceSha256=s['reference']['sha256'],uploaded=True,listeningReview='pending'))
r.update(status='candidates-ready-awaiting-listening-and-user-review',summary=dict(slots=19,originalApprovedVersionsRetained=sum(x['status']=='original-approved-retained' for x in r['rows']),repairedCandidates=sum(x['status']=='repaired-candidate-awaiting-user-listening' for x in r['rows']),visualPolicyChecked=19,currentShaAsrLocators=19,actualListeningCompleted=False),referenceAudioCandidates=states,technicalValidation=dict(all19CurrentFileShaMatch=True,all19ReviewedSourceFilesPreserved=True,central76WavsMatchOriginalManifest=len(central)==76,wrongPresetTts2Quarantine=str(D/'QUARANTINED-TTS2.json'),wrongPresetTts2Adopted=False,videoGenerationState=rd(O/'status.json'),newVideoPostPending=False),remaining=['实际听审：音色、自然度、逐字、无BGM及精确口型；不以ASR或接口字幕替代。','新候选由用户重新review，原通过不迁移到新SHA。','L01实际confirmedText声音与正式证据UI的游戏整合验证由执行/整合负责人完成，本媒体任务未修改程序。'])
save(p,r);save(reportpath,first);save(O/'review/picture-usability.json',picture)
contract=B/'reviews/user-20261025-1549/voice-contract.json';d=rd(contract);d['status']='correct-model-reference-candidates-produced-pending-listening';d['listeningReview']['requiredAction']='actual listening remains pending; batch2 direct user authorization removed it as an execution blocker';d['batch2Authorization']=str(B/'reviews/user-20261025-batch2/repair-policy.json');d['G1ReferenceAudioCandidates']=states;save(contract,d)
lines=['# G1 第二章媒体返修候选说明','', '本轮19槽已逐条登记。原通过版本保留7条，返修候选12条；新版本不继承通过。声音实际听审未完成。','','|影片|本轮结果|旧→新时长|','|---|---|---|']
for x in r['rows']:lines.append(f"|{x['id']}|{x['treatment']}|{x['oldDuration']:.2f}→{x['newDuration']:.2f}秒|")
lines+=['','权威成片路径和SHA见[delivery.json](delivery.json)，逐条白名单、误读区间、旧新版本、动作和衔接见[user-review-batch2.json](user-review-batch2.json)。','','V12最终物权证据见[带时间码序列](user-review-20261025/inspection/V12-final-R4-timed-actions.jpg)及[EDL](user-review-20261025/V12-final-R4-action-EDL.json)。UR1前0–2.7秒伪字区间与旧局部模糊层均不得复用。','','必要新句全部使用Seed-Audio1.0真实上传苟安参考；正确008样本直接复用，其他必要句8条，小批生成且不重投。旧7条错误预置TTS2仍隔离。中央76条WAV与原manifest逐一比对一致。','','已完成：当前文件SHA、成片解码、黑场检查、19槽新画面标准检查、实际浏览器播放与关键动作核对、当前SHA的ASR辅助定位。未完成：实际听审、音色/自然度/无BGM/精确口型及用户复审。','','L01底片无固定台词；确认本次原话后单播，末帧保持，动态声音只用confirmedText。对应游戏运行验证和正式证据界面不在本媒体返修中冒称完成。','']
(O/'G1-制作候选交付说明.md').write_text('\n'.join(lines),encoding='utf-8');print(json.dumps(r['summary'],ensure_ascii=False))
