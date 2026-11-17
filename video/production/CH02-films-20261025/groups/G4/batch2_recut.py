"""Free local batch2 recut. Preserve legal utterances/actions, never generate fixed L02 speech."""
from batch2_audio import *
import av,math
from concurrent.futures import ThreadPoolExecutor,as_completed
BASE=read(W/'baseline-delivery.json');PLAN=read(O/'plan.json')
PC={c['id']:c for c in PLAN['clips']};SUB={c['id']:c for c in BASE['subclips']}
VOICE=read(B/'voice/manifest.json')['rows'];WH={c['id']:c for c in read(B/'reviews/user-20261025-batch2/spoken-whitelist.json')['clips']}
RECIPES={
 'V26-01':dict(end=5.25),
 'V26-02':dict(start=1,end=124/24,mute=True,reason='保留伸手/核看闭合卷束/落稳后离手；删开头空等及尾部非白名单人声，行动段不配旁白'),
 'V26-03':dict(start=3/24),
 'V26-04':dict(end=1.75,reason='无对白文书观察，仅保留有用连续观察，删去原空白纸面等待，不新增读文书声音'),
 'V26-05':dict(end=87/24,voice='CH2-LY09-010',offset=.25,reason='原来是白名单外杂句且合法玩家问句缺失；复用中央76条中对应纯文本玩家原句，画外我，军吏不代说'),
 'V26-06':dict(start=3/24),
 'V26-07':dict(),
 'V26-08':dict(start=29/24,end=191/24,reason='删军吏合法句前无动作冗余，保留他担心至将来更难打完整句'),
 'V26-09':dict(start=43/24,end=276/24,reason='删合法句前无动作冗余，保留兴复汉室至究竟能撑多久完整句'),
 'V28A-01':dict(end=5.25), 'V28A-02':dict(start=38/24),
 'V28B-01':dict(end=165/24), 'V28B-02':dict(start=34/24),
 'V28C-01':dict(end=136/24), 'V28C-02':dict(start=6/24),
 'V29-01':dict(end=26/24,mute=True,reason='首段无对白建立镜头，原3.06–3.96秒白名单外词整段随多余画面删除；保留1.083秒认识军吏及案头'),
 'V29-02':dict(end=8.25),
 'V29-03':dict(start=.25,end=11.5),
 'V29-04':dict(start=38/24),
 'V29-05':dict(start=16/24,end=11.5),
 'V29-06':dict(start=.75),
 'V29-07':dict(end=5.25,voice='CH2-LY10-007',offset=.25,reason='合法我心声原句缺失而混有杂句；补回已有纯文本玩家心声，不给NPC做口型，保留案头观察'),
 'V30-01':dict(start=32/24),
 'V31T-01':dict(start=22/24),
 'V31A-01':dict(start=27/24),
 'V31N-01':dict(start=36/24),
 'V32R-01':dict(start=29/24),
}
UNCHANGED={'L02','V31D','V31R'}
def meta(p):
 with av.open(str(p)) as c:
  v=c.streams.video[0];a=c.streams.audio[0]
  return dict(duration=c.duration/1e6,videoDuration=float(v.duration*v.time_base),frames=v.frames,fps=str(v.average_rate),width=v.width,height=v.height,sampleRate=a.sample_rate,audioTrack=True,sha256=sha(p),bytes=Path(p).stat().st_size)
def run(a):subprocess.run([FF,'-hide_banner','-loglevel','error','-y',*map(str,a)],check=True,capture_output=True)
def part(cid):
 c=PC[cid];old=SUB[cid];src=Path(old.get('file',O/'edited'/f'{cid}.mp4'));r=RECIPES.get(cid,{})
 m=meta(src);n0=round(r.get('start',0)*24);n1=min(m['frames'],round(r.get('end',m['videoDuration'])*24));assert n1>n0
 start=n0/24;end=n1/24;dur=(n1-n0)/24;dst=W/'parts'/f'{cid}.mp4';dst.parent.mkdir(exist_ok=True)
 args=['-i',src];voice=None
 if r.get('voice'):
  voice=VOICE[r['voice']];assert voice['ready'] and sha(voice['path'])==voice['sha256'];assert voice['duration']+r['offset']+.15<dur
  allowed={x['node']:x['text'] for x in WH[c['slot']]['spokenWhitelist']};assert allowed[r['voice']]==voice['text']
  assert '/groups/G1/user-review-20261025/' not in voice['path'].replace('\\','/')
  args+=['-i',voice['path'],'-map','0:v:0','-map','1:a:0','-af',f'adelay={round(r["offset"]*1000)}:all=1,apad,atrim=duration={dur},asetpts=PTS-STARTPTS']
 else:
  args+=['-map','0:v:0','-map','0:a:0','-af',f'atrim=start={start}:end={end},asetpts=PTS-STARTPTS,'+('volume=0,' if r.get('mute') else '')+f'apad,atrim=duration={dur}']
 args+=['-vf',f'trim=start_frame={n0}:end_frame={n1},setpts=PTS-STARTPTS','-t',dur,'-r','24','-c:v','libx264','-crf','18','-preset','fast','-threads','2','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-movflags','+faststart',dst]
 if not dst.exists():run(args)
 record=dict(id=cid,slot=c['slot'],file=str(dst),sha256=sha(dst),oldFile=str(src),oldSha256=m['sha256'],oldDuration=m['duration'],sourceFrames=[n0,n1],sourceRange=[start,end],newDuration=dur,technical=meta(dst),speakerLines=c['lines'],spokenWhitelist=[] if c['silent'] else [x for x in WH[c['slot']]['spokenWhitelist'] if x['node'] in c['sourceNodes']],actionOrBoundary='原节点/分支/下一段边界保留，无新增事件',reason=r.get('reason','只收紧对白前后无动作等待，完整真实原句及句间反应保留'),silentAction=bool(r.get('mute')),newTTS=False,voiceReuse=dict(node=r['voice'],file=voice['path'],sha256=voice['sha256'],text=voice['text'],offset=r['offset'],scope='根明确允许复用的原中央76条纯玩家原音，非隔离的G1错误7条预置NPC音轨') if voice else None,listeningReview='pending, ASR only')
 save(dst.with_suffix('.json'),record);print('PART',cid,dur,flush=True);return record
def build():
 rows=[];ids=[x['id'] for x in PLAN['clips'] if x['slot'] not in UNCHANGED and x['slot']!='V27']
 with ThreadPoolExecutor(max_workers=2) as pool:
  for f in as_completed([pool.submit(part,cid) for cid in ids]):rows.append(f.result())
 by={r['id']:r for r in rows};clips=[]
 for old in BASE['clips']:
  sid=old['id'];dst=W/'candidates'/f'{sid}-纯台词与时长返修B2.mp4';dst.parent.mkdir(exist_ok=True)
  if sid in UNCHANGED:clips.append(dict(old,batch2Changed=False,batch2Operation='完整ASR未检出元说明且开头已较短/听者无固定原句；原版保留，听审pending'));continue
  if sid=='V27':
   if not dst.exists():run(['-i',old['file'],'-map','0:v:0','-map','0:a:0','-c:v','copy','-af','volume=0:enable=lt(t\,1.3333333333333333)','-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-movflags','+faststart',dst])
   operation='仅清除开头0–1.333333秒纯演出段乱声；32帧必要入帐动作保留，后面内容/画面按用户后面还好保留，不扩为全段重配'
  else:
   listing=W/'candidates'/f'{sid}.concat.txt';children=[by[x] for x in old['clipIds']];listing.write_text('\n'.join("file '"+Path(x['file']).as_posix()+"'" for x in children),encoding='utf-8')
   if not dst.exists():run(['-f','concat','-safe','0','-i',listing,'-c:v','libx264','-crf','18','-preset','fast','-threads','2','-pix_fmt','yuv420p','-r','24','-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-movflags','+faststart',dst])
   operation='逐句白名单与说话归属核对；删除额外杂句及无动作等待，保留完整原句和关键动作，不以静帧/循环/长静音填充'
  m=meta(dst);assert m['duration']<=old['technical']['duration']+.1
  clips.append(dict(old,file=str(dst),path=str(dst),sha256=m['sha256'],technical=m,previousFile=old['file'],previousSha256=old['technical']['sha256'],batch2Changed=True,batch2Operation=operation,userApproved=False))
 save(W/'candidates.json',dict(clips=clips,subclips=rows,newAPIRequests=0,newTTSRequests=0,createdAt=now()))
 # Fresh independent history; existing user comments/approval are never changed.
 h=(O/'review-assembled.html').read_text(encoding='utf-8');data=[]
 for c in clips:data.append(dict(id=c['id'],src=Path(c['file']).relative_to(O).as_posix(),expected=' / '.join(x['text'] for x in WH[c['id']]['spokenWhitelist']),silent=c['id']=='L02'))
 a=h.index('const data=');b=h.index(';\nconst s=',a);h=h[:a]+'const data='+json.dumps(data,ensure_ascii=False)+h[b:];(O/'review-batch2-candidates.html').write_text(h,encoding='utf-8')
 print(json.dumps(dict(clips=len(clips),changed=sum(c.get('batch2Changed',False) for c in clips),seconds=sum(c['technical']['duration'] for c in clips)),ensure_ascii=False),flush=True)
if __name__=='__main__':build()
