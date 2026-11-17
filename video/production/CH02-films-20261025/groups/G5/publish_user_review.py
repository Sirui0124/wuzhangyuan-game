"""Publish only the independently reviewed 20261025 G5 picture candidates."""
from pathlib import Path
import copy, datetime, json, os
from user_review_repairs import OUT, WORK, POLICY, read, sha, metadata

NOW = datetime.datetime.now().astimezone().isoformat()

def atomic(path, value):
    path = Path(path)
    pending = path.with_name(path.name + '.pending')
    pending.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', 'utf-8')
    os.replace(pending, path)

def archive(path):
    path = Path(path)
    dest = WORK / ('before-user-review-' + path.name)
    if path.exists() and not dest.exists():
        dest.write_bytes(path.read_bytes())

def main():
    candidates = read(WORK/'candidates.json')['clips']
    base = read(WORK/'baseline-delivery.json')
    oldslots = {s['id']: s for s in base['assembled']}
    tech = {c['id']:c for c in read(WORK/'technical-checks.json')['clips']}
    motion = read(WORK/'review-motion-six.json')
    # The V32A current-SHA ended log was observed after the six-clip record.
    assert candidates[0]['sha256'] == '710ecaf35be6eb7941465d3f6a38c0e2aafbde45e20cc10808f16fb0f9850921'
    motion['clips'].insert(0, dict(id='V32A',sha256=candidates[0]['sha256'],range=[0,43.71],state='completed',evidence='IAB AX: V32A 43.71/43.71 and ended log with the same SHA'))
    motion.update(reviewPolicy=POLICY,checkedAt=NOW,method='Current-file 1x muted playback from zero to ended; full-range native-frame-zero 1fps sheets actually inspected; critical source actions separately inspected at4fps. Playback is not continuous frame-by-frame watching or audio listening.',userApproved=False)
    conditions = {
        'V32A':['夜帐、苟安身份及交代语境须由前文建立；夜帐回应与案面镜头复用了同一已成功源的不同时间窗，未以定格或短循环延长。','写交代→原生横划→下方署写→提笔为动作证据；少量原生墨迹不是精确条款或“苟安”字形证明，准确条款与署名身份查独立来源映射，由既有游戏信息承担。','保留原对白；替换回应画面与对白的口型匹配未通过声音验收。普通剧情保持玩家视角。'],
        'V33':['保留真实递件动作及原分支入口；卷内精确信息查独立来源映射。'],
        'V34':['须完整保留写、提笔、取件、伸递与收件方抓住纸边；原生短墨迹不当作精确姓名证明。','未出现文书全文和制作标题；准确文书名称、签署身份及行动后果由既有游戏信息承担。'],
        'V35':['真实收件→展开回信→两张独立附件放稳并松手为连续动作；无阅读卡与静帧停留。','四段回信及两附件内容保存在独立来源映射，影片不提供精确可读正文；接入须保持原分支与既有游戏信息。'],
        'V36':['开头只见收件人反应、真实纸张右侧留白页缘与接触/松手；不以纸背推断文件数量或内容，准确材料列表查独立来源映射。','原第一句音轨整体前移1秒，完整保留语音区间；尾部真实回令交接保留。此调整不代表声音听审通过。'],
        'V37':['保持既定顺利归途分支（E1）及空车状态，不能挪作失败或其他结局的结果证据。'],
        'V42':['只用于原定E1/E3旧记录语境；干净纸背/页缘不承载精确人口、粮数或其他数值证明。','保持原分支边界及既有中央WAV；声音仍待逐字听审。']
    }
    fixes = {
        'V32A':'移除两段交代正文卡、合成撤回句及墨迹处理；原生横划/署写动作重取C8动态源；补4秒无对白书写；两个旧日间露纸面回应改同一夜帐回应/干净案面，原对白音轨保留。',
        'V33':'文件未改；按新规则重新扫描全片并核对本SHA的完整播放。',
        'V34':'末段改用无图层动态源0–7.85秒，去掉末尾制作标题及静帧垫尾；写、提笔、取件、递件动作保留。',
        'V35':'去掉两组回信正文卡和阅读静帧；保留完整回件交接，再连续播放8秒展开回信/两附件落桌松手的动态源。',
        'V36':'移除开头0–4.8秒局部模糊及4.8–7.8秒材料清单卡；重剪闭口反应和原片真实收件留白页缘，原第一句整体前移1秒，无新增人声；回令交接保留。',
        'V37':'文件未改；按新规则重新扫描全片并核对本SHA的完整播放，保留空车。',
        'V42':'文件未改；按新规则重新扫描全片并核对本SHA的完整播放，保留干净纸背。'
    }
    special = {
        'V32A':[OUT/'review/user-review-writing-UR1/sequence-index.json',OUT/'review/user-review-crossout-native/sequence-index.json'],
        'V36':[OUT/'review/user-review-receipt-unmasked/sequence-index.json']
    }
    for c in candidates:
        assert sha(c['file']) == c['sha256'] == tech[c['id']]['sha256']
        assert tech[c['id']]['decode']=='passed' and not tech[c['id']]['blackDetection']
        done = next(x for x in motion['clips'] if x['id']==c['id'])
        assert done['sha256']==c['sha256'] and done['state']=='completed'
        index = WORK/'review'/(c['id']+'-'+c['sha256'][:10])/'sequence-index.json'
        ix = read(index); assert ix['sha256']==c['sha256']
        assert all(Path(p).exists() for p in ix['sheets'])
        ix.update(visualReview='actually-inspected-current-SHA-full-range',reviewPolicy=POLICY,checkedAt=NOW)
        atomic(index,ix)
        c.update(reviewPolicy=POLICY,reviewState='reviewed',userApproved=False,audioApproved=False,gameIntegrated=False)
    atomic(WORK/'review-motion.json',motion)

    delivery = read(OUT/'delivery.json')
    pic = read(OUT/'review/picture-usability.json')
    repair = read(OUT/'user-review-repair.json')
    for path in [OUT/'delivery.json',OUT/'review/picture-usability.json',OUT/'review/slot-picture-overrides.json',OUT/'review/final-picture-closure.json',OUT/'review/root-handoff-notice.json',OUT/'制作自查与交付.md']:
        archive(path)
    slots=[]; picrows=[]; repairrows={r['id']:r for r in repair['clips']}
    for c in candidates:
        id=c['id']; slot=copy.deepcopy(oldslots[id]); src=slot['sources']
        replacements={}
        if id=='V32A':
            replacements={1:WORK/'sources/V32A-02-night-no-paper-face.mp4',4:WORK/'sources/V32A-05-night-no-paper-face.mp4',5:OUT/'generated/V32A-06-UR1-16x9.mp4',6:OUT/'edited/sources/V32A-07-C8-follow-brush.mp4'}
        elif id=='V34': replacements={3:WORK/'sources/V34-04-no-title.mp4'}
        elif id=='V35': replacements={1:OUT/'edited/sources/V35-R2-C1-paper-actions.mp4',2:OUT/'edited/sources/V35-R2-C1-paper-actions.mp4'}
        elif id=='V36': replacements={0:WORK/'sources/V36-01-no-mask-no-list-v2.mp4'}
        cursor=0
        for n,s in enumerate(src):
            if n in replacements:
                s['historicalSource']={k:copy.deepcopy(s.get(k)) for k in ['file','source','metadata','textLayers','visualIssues','reuse','postVoice']}
                s.update(file=str(replacements[n].resolve()),source=str(replacements[n].resolve()),sourceId='user-review-20261025/'+s['id'],metadata=metadata(replacements[n]),textLayers=[],trim=None,spatialCrop=None,visualReview='current-parent-reviewed',visualIssues=[],containsTextOverlay=False,containsFullFrameCard=False)
                s.pop('reuse',None)
                if id=='V36':
                    for v in s.get('postVoice',[]): v['start']-=1;v['end']-=1
                if id=='V32A' and n in [5,6]: s['postVoice']=[]
            duration=s['metadata']['duration'] if 'metadata' in s else 0
            if id=='V35' and n in [1,2]:
                bounds=[0,2.65] if n==1 else [2.65,8]
                s.update(sourceRange=bounds,adoptedDuration=bounds[1]-bounds[0],sharedContinuousSource=True)
                duration=bounds[1]-bounds[0]
            else:s['adoptedDuration']=duration
            s['timelineRange']=[round(cursor,3),round(cursor+duration,3)]
            cursor+=duration
        ev=[str((WORK/'review-motion.json').resolve()),str((WORK/'review'/(id+'-'+c['sha256'][:10])/'sequence-index.json').resolve())]+[str(p.resolve()) for p in special.get(id,[])]
        assert all(Path(p).exists() for p in ev),ev
        dynamic=dict(method=motion['method'],actuallyReviewedRanges=[[0,c['metadata']['duration']]],evidence=ev,sha256=c['sha256'])
        issue=dict(type='20261025-user-global-picture-correction',state='closed-in-current-candidate' if not c.get('unchanged') else 'new-policy-current-SHA-scan-passed',description=fixes[id])
        audio=['未逐字听审；未验证无多余人声、无元说明朗读或无BGM，不作为声音通过结论。']
        if id=='V32A': audio.append('V32A-02/05原对白保留而回应画面替换；口型/说话人对应仍须声音审核。')
        slot.update(file=c['file'],sha256=c['sha256'],metadata=c['metadata'],decode='passed',reviewPolicy=POLICY,sourceMap=c.get('sourceMap',{}),visualReview='usable-with-integration-condition',visualIssues=[],pictureIssues=[issue],pictureUsability='usable-with-integration-condition',reviewState='reviewed',dynamicReview=dynamic,integrationConditions=conditions[id],userReview='待review',userApproved=False,audioApproved=False,gameIntegrated=False,audioIssues=audio,unresolved=[])
        slots.append(slot)
        oldrow=next(x for x in pic['clips'] if x['id']==id)
        hist=copy.deepcopy(oldrow);hist.pop('history',None)
        row=dict(id=id,file=c['file'],sha256=c['sha256'],duration=c['metadata']['duration'],pictureUsability='usable-with-integration-condition',reviewState='reviewed',reviewPolicy=POLICY,dynamicReview=dynamic,issues=[issue],integrationConditions=conditions[id],audioIssues=audio,userApproved=False,audioApproved=False,gameIntegrated=False,history=oldrow.get('history',[])+[hist])
        picrows.append(row)
        rr=repairrows[id]
        rr.update(newFile=c['file'],newSHA=c['sha256'],newDuration=c['metadata']['duration'],fix=fixes[id],candidate=c,reviewState='reviewed',actualReviewEvidence=ev,reviewedRanges=[[0,c['metadata']['duration']]],unresolved=[],integrationConditions=conditions[id],userApproved=False,audioApproved=False,gameIntegrated=False)
        rr['audio']['issues']=audio
        rr['audio']['retiming']=dict(child='V36-01',shift=-1,originalSpeechRange=[1,5.775041666666667],newSpeechRange=[0,4.775041666666667],wholeOriginalVoiceRetained=True) if id=='V36' else None
        if id=='V32A': rr['oldIssues'].extend([dict(kind='brief-daytime-paper-face-exposure',oldRange=[7.25,10.08]),dict(kind='brief-daytime-paper-face-exposure',oldRange=[25.49,29.47])])
    assert [n for s in slots for n in s['nodes']]==[n for s in base['assembled'] for n in s['nodes']]
    assert len({n for s in slots for n in s['nodes']})==35
    delivery['assembled']=slots
    for c in delivery['clips']:
        s=next(s for s in slots if s['id']==c['slot'])
        c['currentSlotReview']=dict(file=s['file'],sha256=s['sha256'],reviewState='reviewed',reviewPolicy=POLICY,pictureUsability=s['pictureUsability'],authority='review/picture-usability.json; historical decisions are not current acceptance',userApproved=False)
        c['adoptedSource']=next(x for x in s['sources'] if x['id']==c['id'])
    ledger=[]
    for f in sorted((OUT/'tasks').glob('*.json')):
        t=read(f);ledger.append(dict(id=f.stem,task_id=t.get('task_id'),status=t.get('status'),unknownNeverRepost=f.stem=='V32A-01'))
    known=[x for x in ledger if x['task_id']]
    delivery.update(reviewPolicy=POLICY,completedAt=NOW,phase='user-review-picture-repairs-delivered-for-review',reviewStatus='画面按20261025规则复核；用户待review，声音未逐字听审，未接入游戏',userReview='待review',userApproved=False,audioApproved=False,gameIntegrated=False,audioListening='未逐字听审',newTTS=0,taskLedger=ledger,paidSubmissionAccounting=dict(knownTaskIds=len(known),knownSucceeded=sum(x['status']=='succeeded' for x in known),explicitFailed=sum(x['status']=='failed' for x in known),unknownOutcome=['V32A-01'],unknownResubmitted=False,thisReviewRound=dict(newReferenceImages=1,newVideoRequests=1,requestedSeconds=4,returnedSeconds=4.46,task='V32A-06-UR1',newTTS=0)),boundedVisualRemainder=[],resolvedVisualIssues={s['id']:fixes[s['id']] for s in slots},pictureReview=str((OUT/'review/picture-usability.json').resolve()),dynamicReview=dict(authority=str((WORK/'review-motion.json').resolve()),reviewPolicy=POLICY),sourceFacts=str((WORK/'source-facts-map.json').resolve()),localCleanupAttempts='Historical attempts archived; current authority user-review-repair.json',localSingleSlotRepair='Superseded by current user-review-policy repairs',incremental='Four changed slots and three unchanged current-SHA scans',audioPolicy='保留既有音轨；V36第一句前移1秒；无新增TTS；声音、口型及无BGM均未验收')
    pic.update(clips=picrows,reviewPolicy=POLICY,checkedAt=NOW,userApproved=False,audioApproved=False,gameIntegrated=False)
    repair.update(status='picture-repairs-reviewed-awaiting-user-review',reviewPolicy=POLICY,completedAt=NOW,pictureUnresolved=[],audioListening='未逐字听审',audioApproved=False,gameIntegrated=False,userApproved=False,sourceFacts=str((WORK/'source-facts-map.json').resolve()),newReferenceImages=1,newVideoRequests=1,newTTS=0)
    # Stage all authoritative records before any pointer changes.
    pending=[]
    for path,value in [(OUT/'delivery.json',delivery),(OUT/'review/picture-usability.json',pic),(OUT/'user-review-repair.json',repair),(OUT/'review/slot-picture-overrides.json',{s['id']:s for s in slots}),(WORK/'candidates.json',{'clips':candidates})]:
        dest=path.with_name(path.name+'.pending');dest.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n','utf-8');pending.append((dest,path))
    for dest,path in pending: os.replace(dest,path)
    closure=dict(group='G5',reviewPolicy=POLICY,logicalSlots=7,frozenNodes=35,currentFilesVerified=True,pictureStates={s['id']:s['pictureUsability'] for s in slots},technical=str((WORK/'technical-checks.json').resolve()),dynamicReview=str((WORK/'review-motion.json').resolve()),repairs=str((OUT/'user-review-repair.json').resolve()),paidSubmissionAccounting=delivery['paidSubmissionAccounting'],unknownOriginal=dict(id='V32A-01',repostForbidden=True),postGateEnabled=False,newTTS=0,audioListening='未逐字听审',audioApproved=False,gameIntegrated=False,userApproved=False,completedAt=NOW)
    atomic(OUT/'review/final-picture-closure.json',closure)
    atomic(OUT/'review/root-handoff-notice.json',dict(reviewPolicy=POLICY,deliveryReady=True,rootIntegrationAcknowledged=False,priorAcknowledgement='Previous 14:31 acceptance is archived and does not apply to this review round',authoritativeFiles=['delivery.json','review/picture-usability.json','user-review-repair.json'],completedAt=NOW))
    lines=['# G5 用户实审返修说明','',f'更新时间：{NOW}','', '本轮按用户2026-10-25要求处理画面：删除正文卡、清单、制作信息及可见方框模糊。七条均按当前SHA重新检查，制作画面结论为附接入条件可用；仍待用户review。声音未逐字听审，未修改游戏或在线策划表。','', '|片段|当前时长|本轮处理|影片|','|---|---:|---|---|']
    for s in slots: lines.append(f'|{s["id"]}|{s["metadata"]["duration"]:.2f}秒|{fixes[s["id"]]}|[播放]({Path(s["file"]).as_posix()})|')
    lines += ['', '文书事实与交接动作分开保留。准确交代、撤回条款、署名身份、回信与材料内容保存在[独立来源映射]('+str((WORK/'source-facts-map.json').resolve().as_posix())+')，覆盖原27个子段、35个稳定节点；影片里的少量原生笔迹不作为准确汉字证明。没有新增解说或把文字直接提交进游戏。', '', '本轮新增1张参考图、1次4秒无对白书写请求（返回4.46秒），其余为已有素材重剪。V32A-02/05复用已有夜帐回应源，原对白保留，口型另待审核。V36-01既有第一句完整前移1秒。未知结果的原V32A-01从未重投。', '', '验证：七条当前文件全解码及黑帧检查通过，1280×720、24fps、48kHz双声道；七条实际1倍静音播放从0到片尾，全片1fps辅助图已看，书写、横划、署写和收件关键动作另看4fps源序列。ASR/技术检查均不能代替听审或用户通过。', '', '旧素材和旧审查记录保留，当前交付已固定七条新版入口，避免后续组装恢复旧卡与旧遮字。若ENDINGS使用过旧版G5的正文卡/收件遮字段，应改取本次干净来源；本组没有修改ENDINGS。', '', '[返修登记]('+str((OUT/'user-review-repair.json').resolve().as_posix())+') ｜ [画面检查]('+str((OUT/'review/picture-usability.json').resolve().as_posix())+') ｜ [播放记录]('+str((WORK/'review-motion.json').resolve().as_posix())+') ｜ [技术检查]('+str((WORK/'technical-checks.json').resolve().as_posix())+')', '']
    md='\n'.join(lines)
    (WORK/'返修说明.md').write_text(md,'utf-8')
    (OUT/'制作自查与交付.md').write_text(md,'utf-8')
    print(json.dumps(dict(slots=[dict(id=s['id'],sha256=s['sha256'],duration=s['metadata']['duration']) for s in slots],paid=delivery['paidSubmissionAccounting'],policy=POLICY),ensure_ascii=False,indent=2))

if __name__=='__main__':main()
