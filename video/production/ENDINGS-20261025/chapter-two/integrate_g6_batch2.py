"""Integrate registered G6 short versions, preserving E1 and the independent epilogue."""
from pathlib import Path
import json,hashlib,copy,shutil,subprocess,sys,time,math
import av
from PIL import Image,ImageDraw
R=Path(__file__).resolve().parent
G=R.parents[1]/'CH02-films-20261025/groups/G6'
D=R/'review/G6-batch2-integration';D.mkdir(parents=True,exist_ok=True)
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
MAP={'E2':['V38'],'E3':['V39','V40'],'E4-early':['V41E'],'E4-late':['V39','V41L'],'E5':['V43']}
def read(p):return json.loads(Path(p).read_text('utf-8'))
def save(p,v):Path(p).write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n','utf-8')
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def run(args):return subprocess.run([FF,'-nostdin',*map(str,args)],capture_output=True,text=True,encoding='utf-8',errors='replace',check=True)
def track(path):
 c=av.open(str(path));s=c.streams.video[0];times=[];sizes=set()
 for f in c.decode(video=0):times.append(float(f.pts*f.time_base));sizes.add((f.width,f.height))
 container=c.duration/1e6;c.close();c=av.open(str(path));samples=0;audio_end=0
 for f in c.decode(audio=0):samples+=f.samples;audio_end=float(f.pts*f.time_base)+f.samples/f.sample_rate
 c.close();duration=len(times)/24
 assert times and abs(times[0])<.00001 and all(abs((b-a)-1/24)<.0001 for a,b in zip(times,times[1:])),path
 assert abs(times[-1]+1/24-duration)<.001 and sizes=={(1280,720)},path
 return dict(path=str(path),sha256=sha(path),containerDuration=container,videoFrames=len(times),firstPTS=times[0],lastPTS=times[-1],videoEnd=duration,audioDecodedSamples=samples,audioEnd=audio_end,fullVideoTrack=True,frameSizes=sorted(sizes),maxFrameGap=max(b-a for a,b in zip(times,times[1:])))
def sheets(path,name,indices):
 c=av.open(str(path));images={}
 for i,f in enumerate(c.decode(video=0)):
  if i in indices:images[i]=f.to_image().resize((320,180))
 c.close();paths=[]
 for k in range(0,len(indices),24):
  selected=indices[k:k+24];im=Image.new('RGB',(1280,math.ceil(len(selected)/4)*202));draw=ImageDraw.Draw(im)
  for j,n in enumerate(selected):
   x=j%4*320;y=j//4*202;im.paste(images[n],(x,y));draw.text((x+4,y+182),f'frame {n} / {n/24:.4f}s',fill='white')
  p=D/f'{name}-{k//24}.jpg';im.save(p);paths.append(str(p))
 return paths
def build():
 before=read(R/'delivery.json');save(D/'before-delivery.json',before)
 for n in ['审片.html','第二章结局交付.md']:shutil.copy2(R/n,D/('before-'+n))
 source=read(G/'user-review-batch2/final-edl-and-sources.json');delivery=read(G/'delivery.json');reg={x['id']:x for x in delivery['films']};sources={x['id']:x for x in source}
 save(D/'source-final-edl.json',source);save(D/'source-delivery.json',delivery)
 for x in source:assert sha(x['path'])==x['sha256']==reg[x['id']]['sha256']
 oldrows={x['id']:x for x in before['films']};candidates=[]
 for id,slots in MAP.items():
  old=oldrows[id];out=R/'films'/f"{id}-{old['title']}-纯台词短版-V4.mp4"
  frames=sum(sources[s]['videoTrack']['videoFrames'] for s in slots)
  if len(slots)==1:shutil.copy2(sources[slots[0]]['path'],out)
  else:
   args=['-v','error','-filter_complex_threads','1'];filters=[]
   for i,s in enumerate(slots):
    x=sources[s];n=x['videoTrack']['videoFrames'];args+=['-i',x['path']]
    filters += [f'[{i}:v]settb=1/24000,setpts=N*1000,setsar=1[v{i}]',f'[{i}:a]aresample=48000,aformat=channel_layouts=stereo,apad,atrim=duration={n/24},asetpts=PTS-STARTPTS[a{i}]']
   filters+=[''.join(f'[v{i}][a{i}]' for i in range(len(slots)))+f'concat=n={len(slots)}:v=1:a=1[v][a]']
   run(args+['-filter_complex',';'.join(filters),'-map','[v]','-map','[a]','-c:v','libx264','-threads','2','-preset','fast','-crf','18','-r','24','-fps_mode','cfr','-c:a','aac','-ar','48000','-b:a','192k','-t',frames/24,'-movflags','+faststart','-y',out])
  video=track(out);assert video['videoFrames']==frames
  run(['-v','error','-i',out,'-f','null','-'])
  check=run(['-hide_banner','-i',out,'-vf','blackdetect=d=0.08:pix_th=0.10','-an','-f','null','-'])
  blacks=[l for l in check.stderr.splitlines() if 'black_start:' in l];assert not blacks,(id,blacks)
  refs=sheets(out,id+'-overview',list(range(0,frames,24))+([frames-1] if (frames-1)%24 else []))
  joins=[];offset=0;parts=[]
  for s in slots:
   x=sources[s];n=x['videoTrack']['videoFrames'];parts.append(dict(slot=s,path=x['path'],sourceSha256=x['sha256'],frames=n,start=offset/24,end=(offset+n)/24,duration=n/24,sourceEDL=x['edl'],integrationConditions=reg[s].get('integrationConditions',[])));offset+=n
   if offset<frames:joins.append(offset)
  if id=='E3':joins.append(sources['V39']['videoTrack']['videoFrames']+310)
  if joins:refs+=sheets(out,id+'-cuts',sorted(set(n for j in joins for n in range(j-6,j+7) if 0<=n<frames)))
  row=copy.deepcopy(old);row.update(path=str(out),sha256=video['sha256'],duration=round(frames/24,6),videoCoverage=dict(videoSeconds=frames/24,decodedFrames=frames,expectedSeconds=frames/24,passed=True),decode='passed',sources=parts,editDecisionList=parts,previousRevision=old,overview=refs[0],overviewSheets=refs,visualReviewEvidence=str(D/'visual-review.json'),audioReview='采用G6登记的纯台词短版及已核来源；实际逐字听审仍pending',userApproved=False,gameIntegrated=False,adoptionMethod='byte-identical-source-copy' if len(slots)==1 else 'frame-exact-concat-of-registered-sources',sourceSignature=hashlib.sha256(''.join(sources[s]['sha256'] for s in slots).encode()).hexdigest(),postProcessing=dict(type='registered-G6-batch2-short-source-integration',newGeneration=False))
  # Old joins and repair statements refer to prior revisions only.
  for key in ['joinFrames','overviewProvenance','visualAssessment','pictureUsability']:row.pop(key,None)
  row['joinFrames']=joins;row['visualReview']='新版关键切点/全时段有序抽帧待核对'
  candidates.append(dict(record=row,videoTrack=video,blackIntervals=blacks))
  save(D/'candidates.json',candidates);print(id,frames/24,video['sha256'],flush=True)
 for x in source:assert sha(x['path'])==x['sha256']
def publish():
 before=read(D/'before-delivery.json');current=read(R/'delivery.json');assert before==current,'Concurrent delivery update; merge explicitly'
 reviewed=read(D/'visual-review.json');assert reviewed['allSheetsViewed'] and reviewed['userApproved'] is False
 candidates=read(D/'candidates.json');assert len(candidates)==5
 registered={x['id']:x for x in read(G/'delivery.json')['films']}
 for x in read(D/'source-final-edl.json'):
  assert sha(x['path'])==x['sha256']==registered[x['id']]['sha256'],'Source registration changed; compare before publishing'
 idx={x['record']['id']:x['record'] for x in candidates}
 for x in idx.values():
  assert sha(x['path'])==x['sha256'];x['visualReview']='已查看全时段有序抽帧及拼接切点，非连续全片观看';x['integrationConditions']=[condition for s in x['sources'] for condition in s['integrationConditions']]
  x['sourceDuration']=x['duration'];x['status']='registered-short-version-awaiting-user-review'
  x['sourceAudioNotes']=[dict(slot=s['slot'],note='采用G6本轮已登记声音来源和对白窗口，实际听审pending') for s in x['sources']]
  save(R/'revision-v2'/f"{x['id']}-delivery.json",x)
 after=copy.deepcopy(current);after['films']=[idx.get(x['id'],x) for x in current['films']];after['updatedEpoch']=time.time()
 save(R/'delivery.json',after)
 page=(R/'审片.html').read_text('utf-8')
 for old in before['films']:
  if old['id'] not in idx:continue
  new=idx[old['id']];page=page.replace(Path(old['path']).name,Path(new['path']).name)
  # Update duration only inside the corresponding article.
  marker='src="films/'+Path(new['path']).name+'"';pos=page.index(marker);end=page.index('</article>',pos);chunk=page[pos:end];chunk=chunk.replace(f"{round(old['duration'],1)} 秒",f"{round(new['duration'],1)} 秒");page=page[:pos]+chunk+page[end:]
 (R/'审片.html').write_text(page,'utf-8')
 lines=['# 第二章结局修订版','','快乐结局54.04秒，苟安笑着招呼后共同推车。魏地广人众独立15秒。其余五条路线采用G6本轮纯台词短版；已清除制作说明与冗余音画，保留各分支收件和裁处条件。','','| 影片 | 当前长度 | 文件 |','| --- | ---: | --- |']
 for x in after['films']+after['epilogues']:lines.append(f"| {x['title']} | {x['duration']:.2f}秒 | [播放]({Path(x['path']).as_posix()}) |")
 lines+=['','本轮只接入已登记源片，无新增生成。旧片和审核记录保留；实际逐字听审、用户审阅及游戏接入均未完成。','', '来源与实质剪辑边界见 review/G6-batch2-integration/source-final-edl.json；完整视频轨和七文件SHA核验见 audit.json。']
 (R/'第二章结局交付.md').write_text('\n'.join(lines)+'\n','utf-8')
 tracks=[]
 for x in after['films']+after['epilogues']:
  t=track(x['path']);assert t['sha256']==x['sha256'];tracks.append(dict(id=x['id'],**t))
 for id in ['E1','EPILOGUE']:
  a=next(x for x in before['films']+before['epilogues'] if x['id']==id);b=next(x for x in after['films']+after['epilogues'] if x['id']==id);assert a==b
 live=read(G/'delivery.json');reg={x['id']:x for x in live['films']};sourceaudit=[]
 for x in idx.values():
  for s in x['sources']:
   actual=sha(s['path']);assert actual==s['sourceSha256']==reg[s['slot']]['sha256'];sourceaudit.append(dict(ending=x['id'],slot=s['slot'],sourcePath=s['path'],usedSha256=s['sourceSha256'],currentSha256=reg[s['slot']]['sha256'],actualSha256=actual,matches=True,conditions=s['integrationConditions']))
 oldaudit=R/'review/motion-followup/G6-source-audit.json';shutil.copy2(oldaudit,D/'historical-G6-source-audit.json')
 save(oldaudit,dict(sourceDelivery=str(G/'delivery.json'),sourceDeliverySha256=sha(G/'delivery.json'),records=sourceaudit,allMatch=True,recordScope='current-registered-G6-batch2-sources',historicalSnapshot=str(D/'historical-G6-source-audit.json')))
 save(D/'audit.json',dict(tracks=tracks,sources=sourceaudit,allSevenVideoTracksComplete=True,allSourcesMatch=True,preserved=['E1','EPILOGUE'],newGeneration=False,audioListening=False,userApproved=False,gameIntegrated=False))
 audit=read(R/'review/pace-v2/technical-audit.json')
 for x in audit['records']:
  if x['id'] in idx:
   row=idx[x['id']];x.update(sha256=row['sha256'],duration=row['duration'],fullDecode=row['videoCoverage'],blackIntervals=[],repairEvidence=str(D/'audit.json'))
 save(R/'review/pace-v2/technical-audit.json',audit)
 print('Published five updated endings; seven current video tracks and source hashes verified',flush=True)
if __name__=='__main__':globals()[sys.argv[1]]()
