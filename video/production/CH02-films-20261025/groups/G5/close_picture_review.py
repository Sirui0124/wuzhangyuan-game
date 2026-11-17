"""Record observed current-SHA reviews. Bound to reviewed hashes, never auto-approve changed files."""
from pathlib import Path
import sys,hashlib,collections
OUT=Path(__file__).parent;sys.path.insert(0,str(OUT))
from run_pipeline import read,save,metadata
ORDER=['V32A','V33','V34','V35','V36','V37','V42']
REVIEWED={
'V32A':'441fbe43f92f67e52db5f02aed7f9f6c7800caa80b13c40e7ac7ec9a8a2169a9',
'V33':'37e7da6b6c4baa324d6711cd21bc8d35b64aca82c584c850ff23594939b2b7d1',
'V34':'b7801ff6a94f76dedd87438c6a36b21fde13167d9b7b38233499bd1722090de7',
'V35':'c827a0ea4f750433d842d4e7674f996da0636f630a1b996f33748cc25cfefb26',
'V36':'4c8730beeb3f1610f28f3ccb789010ab137fe23937352cf3c2acf09ef3d0ab42',
'V37':'774d79f97bb46ef3cce71e5ea120dfa67c7bf7bc17068b1c19b75a09ecf8b69c',
'V42':'8abbd6b6087cf63d30dee4dade2fc5af245a7f595ea54242058de724cfd44284'}
def main():
    report=read(OUT/'delivery.json');report['assembled'].sort(key=lambda x:ORDER.index(x['id']))
    slots={x['id']:x for x in report['assembled']};r=read(OUT/'review/picture-usability.json')
    for id,x in slots.items():assert REVIEWED[id]==x['sha256']==hashlib.sha256(Path(x['file']).read_bytes()).hexdigest(),f'{id}: changed after actual review'
    evidence=[]
    for id in ['V32A','V34','V35','V37']:
        x=slots[id];evidence.append(dict(id=id,file=x['file'],sha256=x['sha256'],actuallyReviewedRanges=[[0,x['metadata']['duration']]],visiblePlaybackEnd=True,rate=1))
    save(OUT/'review/current-SHA-playback-round2.json',dict(browser='IAB tab2',page='当前SHA复核2.html',method='Model observed each current-SHA item listed in completed UI after continuous 1x playback; full timed frame sequences inspected separately',clips=evidence,additionalSource=dict(id='V35-R2-clean',sha256='5677b14edffb75abbb32b848e708562dc06f5dc562e9016809e40f7ee293f6eb',actuallyReviewedRanges=[[0,8]],visiblePlaybackEnd=True),audioListening='未逐字听审',userApproved=False))
    conditions={
      'V34':['仅远方李严已收信后的传信人目击；交给信使不等于我已收件，V35才进入回营接收','同场李严近景跨句复用，完整原音保留；临时嘴型差异归音频','签署后整理材料以剪辑省略，真实取件/递出及接收者握边均保留；微距不可再放大','可见原生落笔只证明签署动作，不证明准确字形；姓名/责任标题沿冻结阅读层；不能宣称镜头展示了整份已签精确文本','旧计划移离不作为镜头可见放稳证明，以原句撤回和后续实际补报承接，不新增玩家已收附件状态'],
      'V35':['必须在真实回营交件入口；保留取卷、我接触、信使松手/退开与纸包留手的完整动作','两附件来自同一新8秒源，分别放稳和松手后再显示冻结全文；纸背不作可读签名证明','核阅结束等待UI正式提交；不可由视频结束直接送军吏或结案','原通用旧卷未冒充两附件；本版近景只保留案面/麻袖/纸背，不把未展示的全景声称为已匹配场景'],
      'V37':['仅E1实际裁处完成后使用；普通粮兵、空车、我随后搭手，不能用于苟安死亡或投魏分支','14.4秒后复用已生成快乐招呼8秒源，ENDINGS原文件/配音/60秒合辑未修改','移除后段重复回头0–2秒，保留双人实际接触横木及推行；未新增玩家正脸','车轮越辙未入画，不能把隐含音效当可见轮子动作证明；临时口型归音频']}
    for c in r['clips']:
        id=c['id'];x=slots[id];assert c['sha256']==x['sha256']
        if id in conditions:
            c.update(pictureUsability='usable-with-integration-condition',reviewState='reviewed',integrationConditions=conditions[id],userApproved=False)
            indices={'V34':['review/current-V34-final-C6/sequence-index.json','review/V34-cut-boundary-check.jpg'], 'V35':['review/current-V35-final-R2/sequence-index.json','review/V35-R2-clean/sequence-index.json','review/current-V35-01-C2-return-complete/sequence-index.json'], 'V37':['review/current-V37-happy/sequence-index.json','review/E1-happy-readonly/sequence-index.json']}[id]
            c['dynamicReview']=dict(method='IAB当前SHA 1倍0至片尾；全4fps/同源裁剪动作序列复核，动态与技术检测分开',actuallyReviewedRanges=[[0,x['metadata']['duration']]],evidence=['review/current-SHA-playback-round2.json']+indices)
            c['issues']=[dict(type='prior-picture-issue',state='closed-by-local-repair-and-reviewed-replacement',description={'V34':'清理遮挡/伪文/错姓名，保留真实写、提笔、递出与握边；旧版问题与文件保留在history','V35':'唯一8秒补镜显示两独立附件接触、放稳、松手，已去字幕/伪文；完整收回纸包也已修正','V37':'按最新快乐要求接入同角色笑着招呼→转身，并切除后续重复回头，未新生成'}[id])]
        c['userApproved']=False
        assert c['reviewState']=='reviewed' and c['pictureUsability'] in ['usable','usable-with-integration-condition']
    r.update(reviewStatus='七个逻辑槽当前SHA完成画面自查；均有接入条件；仍待用户review',newTTS=0,pendingSlots=[],needsRepairSlots=[])
    save(OUT/'review/picture-usability.json',r)
    byid={c['id']:c for c in r['clips']}
    for x in report['assembled']:
        c=byid[x['id']];x.update(pictureUsability=c['pictureUsability'],reviewState=c['reviewState'],integrationConditions=c['integrationConditions'],dynamicReview=c['dynamicReview'],userApproved=False,userReview='待review',unresolved=['音频未逐字听审；错词/额外人声/BGM/临时口型需统一声音阶段处理'],pictureIssues=c['issues'])
    # Report frozen source coverage without replacing existing node IDs or dialogue.
    plan=read(OUT/'plan.json')['clips'];expected=[n for c in plan for n in c['nodes']];actual=[n for c in report['assembled'] for n in c['nodes']]
    assert len(actual)==len(set(actual))==35 and collections.Counter(expected)==collections.Counter(actual)
    report.update(sourceCoverage=dict(planned=expected,delivered=actual,missing=[]),reviewStatus='待review',pictureReview='current-SHA reviewed with integration conditions',scope='仅G5候选制作；不改游戏、在线表或ENDINGS',newTTS=0)
    decisions=read(OUT/'review/decisions.json')
    for row in report.get('clips',[]):
        if row['id'] in decisions:row['decision']=decisions[row['id']]
        if row.get('slot') in byid:
            accepted=byid[row['slot']]
            row['currentSlotReview']=dict(file=accepted['file'],sha256=accepted['sha256'],reviewState=accepted['reviewState'],pictureUsability=accepted['pictureUsability'],authority='review/picture-usability.json; source decision.dynamicReview text is retained production history, not current slot acceptance',userApproved=False)
    save(OUT/'delivery.json',report)
    override=read(OUT/'review/slot-picture-overrides.json');override['V42']=slots['V42'];save(OUT/'review/slot-picture-overrides.json',override)
    tasks=[read(p) for p in (OUT/'tasks').glob('*.json') if read(p).get('task_id')]
    states=collections.Counter(x.get('status') for x in tasks)
    assert states==dict(succeeded=30,failed=1),states
    unknown=read(OUT/'tasks/V32A-01.json');assert not unknown.get('task_id')
    save(OUT/'review/final-picture-closure.json',dict(group='G5',logicalSlots=7,frozenNodes=35,currentFilesVerified=True,technical='All adopted versioned outputs decoded before atomic pointer update; final SHA matched reviewed files; 1280x720 CFR24 AAC48k stereo',pictureStates={x['id']:x['pictureUsability'] for x in r['clips']},paidKnownTasks=31,paidKnownStates=dict(states),unknownOriginal=dict(id='V32A-01',recordPreserved=True,repostForbidden=True),postGateEnabled=read(OUT/'post-gate.json')['enabled'],newTTS=0,audioListening='未逐字听审',userApproved=False))
    rows=['# G5 共同补救与归途：制作自查与交付','','七个逻辑槽、35个冻结节点的当前文件均已完成画面自查，结论为有接入条件可用；这是执行者审片，全部仍待用户review。声音未逐字听审，不宣称配音、原词或无BGM已经通过。','','|片段|时长|当前文件|画面结论|','|---|---:|---|---|']
    for id in ORDER:
        x=slots[id];rows.append(f'|{id}|{x["metadata"]["duration"]:.2f}秒|[{Path(x["file"]).name}]({Path(x["file"]).as_posix()})|有接入条件可用|')
    rows+=['','## 本轮完成','', '- V32A：写交代改为真实手/笔/纸边微距；末尾C13真实横划、下移、署名和提笔完整保留。','- V33：真实交卷接触、松手和入囊保留；仅在实际发信确认后接入。','- V34：裁掉遮挡、伪文和错姓名，保留李严读/答/写、提笔、递出及信使握住纸边。','- V35：收卷完整到信使松手退开；唯一8秒纸张补镜展示两附件分开放稳和松手，冻结回信全文保留。','- V36：宣读近景避开案上伪文字，完整对白承载保留。','- V37：只读复用ENDINGS已生成快乐苟安8秒，接回搭手并去掉重复回头；未改其60秒版本。','- V42：连续15.10秒纸背展开/观察/翻页，保留原三句心声；无卡无叠字母片已独立交接。','','## 接入条件','']
    for id in ORDER:
        rows.append(f'### {id}');rows.append('')
        rows += ['- '+s for s in byid[id]['integrationConditions']];rows.append('')
    rows+=['## 验证与状态','', '- 每个当前SHA均有实际从0至片尾的动态播放范围；关键动作有连续4fps序列辅助。技术解码/帧率检查不替代画面审片。','- 7个当前文件SHA与审片记录一致，35个冻结节点无缺失或重复。全部原片和历史候选保留。','- 31个已知视频任务：30成功、1明确失败；另有原始V32A-01未知记录永久保留、禁止重投。新增付费派发门已关闭。','- 本轮无新增TTS。错词、额外人声、音乐、音色和临时声口同步问题仍留统一声音阶段。','- 详细逐片SHA、实际范围、关闭问题、接入条件和音频问题见 [picture-usability.json]('+str((OUT/'review/picture-usability.json').resolve()).replace('\\','/')+')；正式制作指针见 [delivery.json]('+str((OUT/'delivery.json').resolve()).replace('\\','/')+')。']
    (OUT/'制作自查与交付.md').write_text('\n'.join(rows)+'\n','utf-8')
    print('Seven current-SHA picture reviews closed with explicit integration conditions; userApproved=false')

if __name__=='__main__':main()
