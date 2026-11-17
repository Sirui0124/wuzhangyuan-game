from user_repair import *
from urllib.parse import urlparse,unquote
import numpy as np
from faster_whisper import WhisperModel
src=B/'reviews/user-20261025-batch2/comments-and-versions.json';captured=rd(src);plan=rd(O/'plan.json')
whitelist={x['id']:x for x in rd(B/'reviews/user-20261025-batch2/spoken-whitelist.json')['clips']}
report=O/'user-review-batch2.json'
rows=[]
for u in captured['rows']:
 if not u['video'].startswith('/groups/G1/'):continue
 sid=u['id'];old=B/unquote(urlparse(u['video']).path).lstrip('/');a=rd(O/'assembled'/f'{sid}-assembly.json')
 white={z['node']:dict(node=z['node'],speaker=z['roleControlOnly'],text=z['text'],voiceAndLipOwnerControlOnly=z['voiceAndLipOwnerControlOnly']) for z in whitelist[sid]['spokenWhitelist']}
 x=dict(id=sid,source=str(src),userComment=u['note'],originalApproved=u['approved'],reviewedFile=str(old),reviewedSha256=sha(old),oldDuration=dur(old),pureDialogueWhitelist=list(white.values()),candidateFile=a['path'],candidateSha256=a['sha256'],newDuration=a['duration'],status='candidate-awaiting-user-review' if sha(old)!=a['sha256'] else 'original-approved-retained' if u['approved'] else 'pending-audio-cleanup',userApproved=False if sha(old)!=a['sha256'] else u['approved'],listeningReview='pending; ASR is locator only',noBgmReview='pending actual listening',misreadIntervals=[],preservedActionsAndBoundaries=dict(entry=a['entry'],next=a['next'],endEvent=a['endEvent']),oldApprovalNotTransferred=sha(old)!=a['sha256'])
 if sid=='L01':x['pureDialogueWhitelist']=[];x['dynamicAudioContract']='只播放本次confirmedText；本底片无固定朗读。确认后单播，末帧保持，等待实际判定/回应。'
 x['nonSpoken']=whitelist[sid]['neverReadStageOrDocumentText']
 rows.append(x)
save(report,dict(group='G1',status='in-progress',source=str(src),repairPolicy=str(B/'reviews/user-20261025-batch2/repair-policy.json'),rows=rows,notes=['用户实际通过仅对所评旧文件SHA有效。','新版本保留旧片，不继承通过。','角色标签/动作控制说明不可发声；合法心声不删除。','错误预置TTS2七条继续隔离，只有Seed-Audio1.0真实上传同角色参考可补缺。']))
model=WhisperModel('small',device='cpu',compute_type='int8',local_files_only=True,cpu_threads=2)
for x in rows:
 p=Path(x['candidateFile']);dest=D/'inspection'/f"{x['id']}-batch2-asr.json"
 if dest.exists() and rd(dest).get('sha256')==sha(p):continue
 raw=run(['-i',p,'-f','f32le','-ac','1','-ar','16000','pipe:1']).stdout
 segs,info=model.transcribe(np.frombuffer(raw,dtype=np.float32),language='zh',beam_size=5,word_timestamps=True,condition_on_previous_text=False)
 ss=[dict(start=s.start,end=s.end,text=s.text,words=[dict(start=w.start,end=w.end,word=w.word) for w in (s.words or [])]) for s in segs]
 save(dest,dict(file=str(p),sha256=sha(p),method='ASR locator only, not listening or user approval',segments=ss));print(json.dumps(dict(id=x['id'],segments=[{k:v for k,v in s.items() if k!='words'} for s in ss]),ensure_ascii=False),flush=True)
print('batch2 ASR locators ready')
