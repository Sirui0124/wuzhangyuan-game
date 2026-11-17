from pathlib import Path
import json,hashlib,uuid
from datetime import datetime,timezone
OUT=Path(__file__).resolve().parent
before=json.loads((OUT/'review/G2-document-cleanup-assist-before.json').read_text(encoding='utf-8'))
sampling={x['id']:x for x in json.loads((OUT/'review/G2-assist-frame-evidence.json').read_text(encoding='utf-8'))}
durations={'V13-01':5.8,'V15-04':10,'V18-04':10,'V20-05':7}
clips=[]
for row in before:
    k=row['id'];p=Path(row['file']);after=hashlib.sha256(p.read_bytes()).hexdigest();unchanged=after==row['sha256']
    c=dict(**row,sha256Before=row['sha256'],sha256After=after,unchangedDuringReview=unchanged,userApproved=False,dynamicChecks=[dict(method='IAB原生视频1倍静音，从0.00播放至ended；8894根下/groups/...实际文件，未修改审核台状态',actualReviewedRanges=[[0,durations[k]]],evidence=str(OUT/'review'/f'G2-{k}-dynamic-end.png'))],auxiliaryEvidence=sampling[k],audioIssues=['只读画面协审，未逐字听审；未新增API/TTS'])
    if not unchanged:
        c.update(reviewState='pending-source-changed',pictureUsability=None,conclusion='审前后SHA变化，旧观察不用于当前文件，暂停等待拥有者');clips.append(c);continue
    if k in ['V15-04','V18-04']:
        c.update(reviewState='retired-draft-not-final',pictureUsability=None,excludedFromCurrentVerdict=True,conclusion='总控已明确此旧路径未采用、G2正另出独立新版；停止重复验收，待新路径再审。以下仅为收到停审消息前的一次观察，不当最终结论',historicalObservations=[dict(timeRange=[1,9.5] if k=='V15-04' else [3.5,7.5],detail='V15纸面中心大块失焦、7秒背景另一页仍见字迹' if k=='V15-04' else 'V18左边0–90像素纸页仍见清晰伪字列，前景横向遮罩覆盖手和纸的接触细节')])
    elif k=='V13-01':
        c.update(reviewState='reviewed',pictureUsability='usable-with-integration-condition',excludedFromCurrentVerdict=False,conclusion='走近案桌并呈出凭据的大轮廓可用，无可读伪文；不能当作凭据细节已被看清或收走的完成镜头',findings=[dict(timeRange=[0,3],observation='背景仓营和对方人物保持清楚，前景册页失焦随走近移动；未见可读的伪证据字句'),dict(timeRange=[3.5,5.8],observation='书册及两侧拇指进入近景，整片前景明显重度柔化；持书姿态及向案前递近可辨，但指尖接触和纸纹细节不可辨。像重度前景失焦，不是固定在桌面不动的硬边色块；审美上处理痕迹明显')],integrationConditions=['仅用作第一视角走近和呈出凭据的过渡，不声称这一段已经展示凭据准确内容或对方实际接走','凭据核对细节依靠同父片后续正确镜头/已批准准确证据插页；不能把本片重糊近景作为阅读证据','若后续节奏允许，可缩短3.5–5.8秒过近失焦停留；如这一段被要求承担清楚的拇指与纸接触特写，则应本地细化遮罩后再审'],openVisualDefects=[],requiresNewVideoRequest=False)
    else:
        c.update(reviewState='reviewed',pictureUsability='usable-with-integration-condition',excludedFromCurrentVerdict=False,conclusion='当前7秒画面可用：准确既有正文插页之后接NPC说明，未漏生成纸面伪字、未见遮罩盖住脸或手纸接触动作',findings=[dict(timeRange=[0,3.95],observation='全幅“缺额报告·已取得正文”准确插页，画面清楚稳定，无底层生成文书漏边；本段不是演出新取得'),dict(timeRange=[3.95,7],observation='接仓中经手人中近景发话，角色、衣服、背景稳定，底部无可读假文书；本段本就没有翻纸动作，不能额外声称翻阅已在本片发生')],integrationConditions=['插页所需来源、已取得状态和条件由G2确保；只回看已有正文，不作为新取得证据','保留正文插页到经手人说明的清楚切点，只有该NPC做其既定说明口型；正确台词和声音由G2后续审核','此结论不覆盖前后其他取得/翻看镜头，也不代替G2父片整段验收'],openVisualDefects=[],requiresNewVideoRequest=False)
    clips.append(c)
report=dict(assistedGroup='G2',reviewerGroup='G6',updatedUTC=datetime.now(timezone.utc).isoformat(),status='two-current-reviewed-two-retired-awaiting-new-paths',scope='仅四条被指定子片的只读协审；旧V15/V18已按总控后续指示排除最终结论。不改G2/ENDINGS、不发API/TTS',clips=clips,counts={'currentReviewed':2,'currentConditionalUsable':2,'retiredDraftExcluded':2,'sourceChanged':sum(not c['unchangedDuringReview'] for c in clips)},newAPIRequests=0,newTTSRequests=0,userApproved=False)
p=OUT/'review/G2-document-cleanup-assist.json';t=p.with_name(p.name+'.'+uuid.uuid4().hex+'.tmp');t.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');t.replace(p)
print(json.dumps(dict(report=str(p),counts=report['counts'],shaUnchanged=all(c['unchangedDuringReview'] for c in clips)),ensure_ascii=False))
