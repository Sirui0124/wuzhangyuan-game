from pathlib import Path
import sys,json,hashlib
sys.path.insert(0,'tools/video-history/202610')
from recheck_video_feedback_20261022 import call,COMMON
ROOT=Path.cwd();base=ROOT/'video/production/PR01-direction-20261023';out=base/'cloud'
def save(p,x):p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
def table(name):
 p=out/name;call(['sheets','+cells-get',*COMMON,'--range','A1:K8','--include','value,formula,data_validation','--output-path',p.relative_to(ROOT).as_posix()]);return json.loads(p.read_text(encoding='utf8'))['ranges'][0]
rows=json.loads((base/'production.json').read_text(encoding='utf8'));b=table('tracker-before-final.json');h=[c.get('value') for c in b['cells'][0]];writes=[];expected={}
movie=ROOT/'video/current/PR01-opening-pace-five-years-20261023.mp4';assert movie.is_file()
for row in rows:
 scene='PR01-D/E/F' if row['id']=='PR01-DEF' else row['id'];i=next(i for i,r in enumerate(b['cells']) if r[0].get('value')==scene);r=b['cells'][i]
 details={'PR01-A':'9秒：火光构图接切、一次点灯与诸葛亮微反应，蹄声先行接奔马。','PR01-B':'11秒：马蹄接靴底，接报转身接途中步履，遮挡省略路程，只在末镜到帐一次。','PR01-C':'6秒：手触帘接帐内关系，开帘即灭，短反应落灯芯，末镜匹配手机。','PR01-DEF':'30秒：重构第一人称对白与7镜头，明确“五年代码”，以“代码能回退，日子怎么就不行呢”接许愿；停用旧6.85秒录音；新做工位、持机、AI同学展示和离职人群4图，连同通勤、灯尾镜共6图按序嵌入。'}[row['id']]
 note='2026-10-23｜开篇导演重构：'+details+' 原链接正文、分镜、时长与真实参考图已回读核对。新Prompt待review，用户自行生成；未生成新视频。临时现片已按用户要求局部1.4倍、删除原18.25—20.708秒重复抵帐，并补录“五年代码”；完整现片53.056秒，解码、构建、Chrome原速播放与续接SC03通过；未代替人工听审。现片路径：'+str(movie)
 changes={'prompt状态':'待review','当前状态':'待更新','时长预估':str(row['seconds'])+'秒','处理反馈':(r[h.index('处理反馈')].get('value') or '')+'\n'+note,'最新版视频路径':str(movie)}
 oldpath=r[h.index('最新版视频路径')].get('value') or '';history=r[h.index('历史视频素材')].get('value') or ''
 if oldpath and oldpath not in history:changes['历史视频素材']=history+'\n2026-10-23重构前采用素材：'+oldpath
 for label,value in changes.items():writes.append({'range':f'{b["col_indices"][h.index(label)]}{b["row_indices"][i]}','cells':[[{'value':value}]]})
 expected[scene]=changes
 if scene=='PR01-D/E/F':
  j=h.index('视频prompt链接');formula=r[j].get('formula')
  if formula and '28秒' in formula:writes.append({'range':f'{b["col_indices"][j]}{b["row_indices"][i]}','cells':[[{'formula':formula.replace('28秒','30秒')}]]})
assert table('tracker-final-guard.json')==b
save(out/'tracker-final-writes.json',writes);call(['sheets','+cells-set',*COMMON,'--writes','@'+(out/'tracker-final-writes.json').relative_to(ROOT).as_posix()]);a=table('tracker-final.json')
for r in a['cells'][1:]:
 for label,value in expected.get(r[0].get('value'),{}).items():assert r[h.index(label)].get('value')==value
# Keep source index current without discarding unrelated entries.
p=ROOT/'video/production/CURRENT-20261021/production.json';raw=p.read_text(encoding='utf8');index=json.loads(raw)
for item in index:
 match=next((r for r in rows if r['id']==item['id']),None)
 if item['id'] in ['PR01-D','PR01-E','PR01-F']:match=rows[-1];item['generation_group']='PR01-D/E/F';item['group_seconds']=30
 if not match:continue
 item.update(prompt=match['prompt'],reference_paths=match['reference_paths'],cloud_prompt='https://my.feishu.cn/docx/'+match['cloud_prompt'],seconds=match['seconds'],production_status='2026-10-23导演重构已同步；Prompt待review，待用户重新生成',runtime_file=str(movie.relative_to(ROOT)),runtime_status='临时剪辑已局部提速、去重并修正五年代码配音；新导演稿尚未生成',images_status='实际在线附件已回读；现代段4张新参考图',next='用户审阅并自行生成；出片后听审、口型和衔接验证',checks='连续时间轴、参考图顺序、在线正文与本地一致；生成效果待验证',latest_video=str(movie),video_status='待更新')
 assert 'upload_file' not in item or True
 if 'upload_file' in item:item.pop('upload_file')
assert p.read_text(encoding='utf8')==raw;save(p,index)
p=ROOT/'docs/video/VIDEO-SELECTION-MANIFEST.json';m=json.loads(p.read_text(encoding='utf8'))
for item in m['selections']:
 if item['scene'].startswith('PR01-'):
  item.update(gameUrl='/video/current/'+movie.name,integratedFile=str(movie),integratedSha256=hashlib.sha256(movie.read_bytes()).hexdigest(),humanState='待更新',integrationNote='2026-10-23局部1.4倍、去重复抵帐、五年代码补录；新导演Prompt已重构，待用户生成。selectedFile保留段落来源，不等于当前完整剪辑。')
save(p,m)
save(out/'final-status.json',dict(promptStatus='待review',videoStatus='待更新',newVideosGenerated=False,existingMoviePlaybackVerified=True))
print('Four tracker rows and production indexes synchronized; user notes preserved')
