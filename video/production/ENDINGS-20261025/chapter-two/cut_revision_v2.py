"""User-directed 60-second E1 and independent, overlay-free epilogue.
Immutable source snapshots; never writes group deliverables or runtime routing.
"""
from pathlib import Path
import json,hashlib,subprocess,re,shutil,time,html,sys
R=Path(__file__).resolve().parent
P=R.parents[3]
G=P/'video/production/CH02-films-20261025/groups'
V=R/'revision-v2'
FF=Path('C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe')
sys.path.insert(0,str(R))
from assemble_endings import video_coverage
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,d):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8')
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def run(a):
 x=subprocess.run([str(FF),'-v','error','-nostdin',*a],capture_output=True,text=True,encoding='utf-8',errors='replace')
 if x.returncode:raise RuntimeError(x.stderr[-2500:])
 return x
def duration(p):
 x=subprocess.run([str(FF),'-hide_banner','-i',str(p)],capture_output=True,text=True,encoding='utf-8',errors='replace')
 m=re.search(r'Duration: (\d+):(\d+):(\d+\.\d+)',x.stderr)
 return int(m[1])*3600+int(m[2])*60+float(m[3])
def snapshot():
 for name in ['delivery.json','审片.html','第二章结局交付.md']:
  p=V/'before'/name
  if not p.exists():p.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(R/name,p)
 for group in ['G5','G6']:
  p=V/'before'/f'{group}-delivery.json'
  if not p.exists():shutil.copy2(G/group/'delivery.json',p)
def part(id,path,frames,start=0,reason='',audio=None):
 return dict(id=id,path=str(path),sourceSha256=sha(path),start=start,frames=frames,duration=frames/24,reason=reason,audio=audio)
def render_segment(s):
 dest=V/'segments'/f"{s['id']}.mp4";dest.parent.mkdir(exist_ok=True)
 signature=sha(s['path'])+json.dumps(s,ensure_ascii=False,sort_keys=True)
 sig=hashlib.sha256(signature.encode()).hexdigest()
 meta=dest.with_suffix('.json')
 if dest.exists() and meta.exists() and read(meta).get('recipeHash')==sig and sha(dest)==read(meta)['sha256']:return dest
 n=s['frames'];start=s['start'];secs=n/24
 args=['-i',s['path']]
 vf=f'[0:v]trim=start={start}:end={start+secs},setpts=PTS-STARTPTS,fps=24,scale=1280:720,setsar=1,format=yuv420p[v]'
 af=f'[0:a]atrim=start={start}:end={start+secs},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo'
 if s.get('audio'):
  voice=s['audio'];args+=['-i',voice['path']]
  vf+=';'+af+',volume=0.28[bed];[1:a]aresample=48000,aformat=channel_layouts=stereo,adelay=300:all=1[voice];[bed][voice]amix=inputs=2:duration=first:normalize=0[a]'
 else:vf+=';'+af+'[a]'
 pending=dest.with_suffix('.building.mp4')
 run([*args,'-filter_complex',vf,'-map','[v]','-map','[a]','-frames:v',str(n),'-t',str(secs),'-c:v','libx264','-threads','2','-preset','fast','-crf','18','-c:a','aac','-b:a','192k','-ar','48000','-movflags','+faststart','-y',str(pending)])
 video_coverage(pending,secs);pending.replace(dest)
 save(meta,dict(recipe=s,recipeHash=sig,sha256=sha(dest)))
 return dest
def assemble(id,title,parts):
 targets=[render_segment(s) for s in parts]
 target=R/'films'/f'{id}-{title}-V2.mp4'
 expected=sum(s['frames'] for s in parts)/24
 args=['-filter_complex_threads','1'];fs=[]
 for i,p in enumerate(targets):
  args+=['-i',str(p)]
  fs += [f'[{i}:v]setpts=PTS-STARTPTS,fps=24,setsar=1[v{i}]',f'[{i}:a]aresample=48000,asetpts=PTS-STARTPTS[a{i}]']
 fs+=[''.join(f'[v{i}][a{i}]' for i in range(len(targets)))+f'concat=n={len(targets)}:v=1:a=1[v][a]']
 pending=target.with_suffix('.building.mp4')
 run([*args,'-filter_complex',';'.join(fs),'-map','[v]','-map','[a]','-c:v','libx264','-threads','2','-preset','fast','-crf','18','-c:a','aac','-ar','48000','-b:a','192k','-t',str(expected),'-movflags','+faststart','-y',str(pending)])
 coverage=video_coverage(pending,expected)
 run(['-i',str(pending),'-f','null','-'])
 for s in parts:
  assert sha(s['path'])==s['sourceSha256'],'Source changed during edit'
 pending.replace(target)
 overview=R/'review/pace-v2'/f'{id}-V2.jpg'
 run(['-i',str(target),'-vf',f'fps=16/{expected},scale=320:180,tile=4x4','-frames:v','1','-q:v','2','-y',str(overview)])
 elapsed=0
 for s in parts:
  s['timelineStart']=elapsed;elapsed+=s['duration'];s['timelineEnd']=elapsed
 row=dict(id=id,title=title,path=str(target),sha256=sha(target),duration=round(expected,3),decode='passed',videoCoverage=coverage,editDecisionList=parts,overview=str(overview),userApproved=False,gameIntegrated=False,executesGameState=False,artifactType='edited-review-candidate',audioReview='原声及已有心声沿用，未完成逐字听审',visualReview='待新版动态播放检查')
 save(V/f'{id}-delivery.json',row)
 print(id,expected,'seconds',row['sha256'],flush=True)
 return row
def build(which):
 if (R/'review/G6-batch2-integration/audit.json').exists() and which in ['all','E3','E4']:
  raise RuntimeError('Registered G6 batch2 short endings are adopted; use integrate_g6_batch2.py for future source updates, not the legacy builder')
 snapshot()
 old=read(V/'before/delivery.json')
 sources={x['id']:x for x in read(V/'before/G5-delivery.json')['assembled']}
 parts={p['id']:p for f in sources.values() for p in f['sources']}
 if which in ['all','E1']:
  repair=R/'review/batch2-audio/E1-adoption.json'
  if repair.exists():
   current=read(V/'E1-delivery.json');record=read(repair)
   assert current['sha256']==record['newSha256']==sha(current['path']),'Current E1 must retain the adopted director-speech cleanup'
   print('Retained E1 V3 happy ending with director speech removed',flush=True)
   if which=='E1':return
   raise RuntimeError('Do not use legacy all-builder after E1 V3; build other named slots explicitly')
  clerk=V/'generated/E1-CLERK-NOCARD-V2-clean.mp4';gou=V/'generated/E1-GOUAN-HAPPY-V2-clean.mp4'
  if not clerk.exists() or not gou.exists():raise RuntimeError('Wait for both authorized new video takes')
  assert read(V/'generation-selection.json')['approvedForCandidate']==['E1-CLERK-NOCARD-V2','E1-GOUAN-HAPPY-V2']
  if (V/'clean-source-overrides.json').exists():
   overrides=read(V/'clean-source-overrides.json')
   for name,record in overrides.items():
    if name in parts:
     assert sha(record['path'])==record['sha256']
     parts[name]={**parts[name],'file':record['path'],'source':record['path']}
  out=[]
  for name,n in [('V36-02',328),('CLERK',192),('V36-04',218),('V36-05',277),('V36-06',88),('GOUAN',192),('V37-03',145)]:
   path=clerk if name=='CLERK' else gou if name=='GOUAN' else Path(parts[name]['file'])
   reason={'V36-02':'删除旧片前7.79秒，从核收答复开始；约等于用户指定第8秒','CLERK':'新拍军吏胸像替换文字卡及错误文字特写','GOUAN':'新拍明确快乐的招呼和转身','V37-03':'从准备搭手进入，两人共同推空车；缩短重复路面停留'}.get(name,'保留原责任、裁处或退军令关键动作')
   audio=None
   if name=='V37-03':
    voice=P/'video/production/CH02-films-20261025/voice/CH2-LY12B-019.wav'
    audio=dict(path=str(voice),sha256=sha(voice),text='人活着，可这趟北伐，还是得退。',newTTS=False)
   out.append(part(name,path,n,start=2 if name=='V37-03' else 0,reason=reason,audio=audio))
  assert sum(x['frames'] for x in out)==1440
  assemble('E1','一起回头-60秒',out)
 if which in ['all','epilogue']:
  if (V/'clean-source-overrides.json').exists():
   for name,record in read(V/'clean-source-overrides.json').items():
    if name.startswith('V42'):
     assert sha(record['path'])==record['sha256']
     parts[name]={**parts[name],'file':record['path'],'source':record['path']}
  seq=[part('V42-01-clean',Path(parts['V42-01']['source']),102,start=3,reason='使用未叠字源片；从展开旧卷动作进入，移除户口/征发/损耗浮层'),part('V42-02-voice',Path(parts['V42-02']['file']),232,reason='保留两句已混入的原心声'),part('V42-03-tail',Path(parts['V42-03']['file']),87,reason='保留往更早去原心声，缩短结束拖尾')]
  assemble('EPILOGUE','魏地广人众',seq)
 if which in ['all','E3']:
  repair=R/'review/motion-followup/E3-tail-repair.json'
  if repair.exists():
   fixed=read(repair);current=read(V/'E3-delivery.json')
   assert current['sha256']==fixed['sha256']==sha(fixed['path']),'Adopt the reviewed E3 end-frame repair before rebuilding'
   print('Retained reviewed E3 V3 end-frame repair',flush=True)
  else:
   row=next(x for x in old['films'] if x['id']=='E3')
   end=next(x['start'] for x in row['sources'] if x['slot']=='V42')
   assemble('E3','真相到了人没回来',[part('E3-without-shared-tail',Path(row['path']),round(end*24),reason='仅保留本分支收件、查办、死亡及空铺；V42拆出独立')])
 if which=='E4':
  latest=read(G/'G6/delivery.json')
  registry={f['id']:f for f in latest['films']}
  assert '-R2.mp4' in registry['V41E']['path'] and '-R4.mp4' in registry['V41L']['path'],'Await final owner repairs'
  save(V/'G6-E4-repair-snapshot.json',latest)
  for id,title,slots in [('E4-early','认下来的罪-早停查',['V41E']),('E4-late','认下来的罪-晚支撑不足',['V39','V41L'])]:
   seq=[]
   for slot in slots:
    f=registry[slot];assert sha(f['path'])==f['sha256'] and f['decode']=='passed'
    seq.append(part(slot+'-owner-repair',Path(f['path']),round(f['duration']*24),reason='采用原组本轮闭口反应/收卷修版；保持本支线事实，未导入别支线对白'))
   assemble(id,title,seq)
def publish(allow_pending=False):
 clean=(V/'epilogue-clean-selection.json').exists()
 assert clean or allow_pending,'Do not publish the old readable pseudo-writing epilogue'
 if clean:assert read(V/'epilogue-clean-selection.json')['sha256']==read(V/'EPILOGUE-delivery.json')['sha256']
 old=read(V/'before/delivery.json')
 rows=[]
 for r in old['films']:
  if r['id'] in ['E1','E2','E3','E4-early','E4-late','E5'] and (V/f"{r['id']}-delivery.json").exists():
   new=read(V/f"{r['id']}-delivery.json")
   new['previousVersion']=dict(path=r['path'],sha256=r['sha256'],duration=r['duration'])
   new['entryPrerequisite']=r['entryPrerequisite'];new['description']=r['description'];new['slots']=[x for x in r['slots'] if x!='V42']
   if r['id']=='E3':new['entryPrerequisite']='UI-CASE已确认且锁定Q真；先V39实际收件，再V40查办裁处。本合辑结束于空铺/空车；V42经原游戏确认/继续边界作为独立尾声接入，不由本片结束自动触发。'
   if r['id']=='E1':new['description']='两人担责后，苟安活下来，笑着招呼我搭手推空车；北伐仍须撤回。'
   rows.append(new)
  else:
   assert sha(r['path'])==r['sha256'];rows.append(r)
 tail=read(V/'EPILOGUE-delivery.json');tail.update(description='魏地广人众，蜀中反复折损；光改运粮补不上缺口，还得往更早的时候去。',reusePolicy='独立可复用尾声，未绑定固定结局；游戏触发仍由原流程负责。',slots=['V42'])
 payload=dict(version='user-revision-v2',scope='五种结局六个版本，另加独立通用尾声',complete=clean,updatedEpoch=time.time(),films=rows,epilogues=[tail] if clean else [],pendingEpilogue=None if clean else '魏地广人众：纸面画面返修中，旧可读伪字版本不采用',userApproved=False,gameIntegrated=False)
 for r in rows+([tail] if clean else []):assert Path(r['path']).exists() and sha(r['path'])==r['sha256']
 save(R/'delivery.json',payload)
 save(R/'assembly-policy.json',dict(activeBuilder='cut_revision_v2.py',legacyAssemblerDisabled=True,reason='保留最新E1快乐结局及导演说明清理；V42独立，不可用旧全长片覆盖。'))
 def card(r):
  rel=Path(r['path']).relative_to(R).as_posix()
  return '<article><video controls preload="metadata" playsinline src="'+html.escape(rel)+'"></video><div><h2>'+html.escape(r['title'])+'</h2><p>'+html.escape(r['description'])+'</p><small>'+str(round(r['duration'],1))+' 秒 · 待审阅</small></div></article>'
 page='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>第二章结局审片 · 修订版</title><style>*{box-sizing:border-box}body{margin:0;background:#171b1b;color:#ece9df;font:16px/1.7 system-ui,"Microsoft YaHei",sans-serif}main{max-width:1360px;margin:auto;padding:32px}h1,h2{font-weight:500}h2{font-size:23px;margin:0 0 12px}.intro,small{color:#b9beb2}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px;margin-top:28px}article{background:#252b2b;border:1px solid #414841;border-radius:10px;overflow:hidden}video{display:block;width:100%;aspect-ratio:16/9;background:#080b0b}article>div{padding:20px}p{margin:0 0 12px}.tail{margin-top:48px}a{color:#dac18c}@media(max-width:800px){main{padding:20px}.grid{grid-template-columns:1fr}}</style><main><nav><a href="../审片.html">第一章候选</a></nav><h1>第二章 · 结局审片</h1><p class="intro">「一起回头」60秒修订版：去掉说明浮层，苟安笑着招呼搭手。共同尾声已独立。声音仍待统一处理，影片待审阅。</p><section class="grid">'''+''.join(card(r) for r in rows)+'''</section><section class="tail"><h1>独立尾声</h1><p class="intro">可接在不同分支结局之后单独播放。</p><div class="grid">'''+card(tail)+'''</div></section></main><script>document.querySelectorAll('video').forEach(v=>v.addEventListener('play',()=>document.querySelectorAll('video').forEach(o=>{if(o!==v)o.pause()})))</script></html>'''
 e1=next(r for r in rows if r['id']=='E1')
 page=page.replace('「一起回头」60秒修订版',f"「一起回头」约{e1['duration']:.0f}秒修订版")
 if not clean:page=page.replace(card(tail),'<article><div><h2>魏地广人众</h2><p>独立尾声正在替换翻卷画面，完成后在这里单独播放。</p></div></article>')
 (R/'审片.html').write_text(page,encoding='utf-8')
 notes=['# 第二章结局修订版','', '按用户要求：一起回头压为60秒；原片约第8秒开始；苟安快乐表演及军吏无卡宣读由OpenAI Next补镜。魏地广人众从E1/E3拆出，作为独立尾声。所有后期说明卡/浮层从当前审片采用版本移除。', '', '| 影片 | 当前长度 | 文件 |','| --- | ---: | --- |']
 for r in rows+([tail] if clean else []):notes.append(f"| {r['title']} | {r['duration']:.2f}秒 | [播放]({Path(r['path']).as_posix()}) |")
 notes=[line.replace('一起回头压为60秒',f"一起回头当前为{e1['duration']:.2f}秒") for line in notes]
 if not clean:notes+=['','独立尾声画面修订中；旧纸面有可读生成伪字，不作为当前可用片。']
 notes += ['','只更新审片候选与剪辑记录；旧片留存。原组V节点未覆盖，游戏路由未修改。声音仍待统一处理，未声称逐字听审或用户通过。','', '详细来源、时间线与SHA见 delivery.json 的 editDecisionList；生成请求及参考图绑定见 revision-v2/prompts。']
 (R/'第二章结局交付.md').write_text('\n'.join(notes)+'\n',encoding='utf-8')
 print('Published 6 endings + '+('independent epilogue' if clean else 'pending epilogue notice'),flush=True)
if __name__=='__main__':
 action=sys.argv[1]
 publish(action=='publish-pending') if action in ['publish','publish-pending'] else build(action)
