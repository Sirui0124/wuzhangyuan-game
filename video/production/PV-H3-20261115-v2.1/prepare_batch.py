from pathlib import Path
import json,shutil,hashlib
R=Path(__file__).resolve().parent;D=R.parent/'PV-redesign-20261115-v2';OLD=R.parent/'PV-H3-20261115-v1'
def save(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2),'utf-8')
manifest=json.loads((D/'h3-remake-manifest.json').read_text('utf-8'))
auth={'date':'2026-11-15','user_request':'可以，按v2.1整体重做，直接用指定的H3流程生成视频。不要BGM，保留人物声音和环境音，做好匹配，最后给我完整成片。','scope':'v2.1整体制作与必要重拍、声音匹配、整片交付','prompt_approval':'用户明确通过v2.1并要求直接生成','film_approval':'尚未发生','unknown_submission_policy':'有ID恢复同任务；未知POST不自动重投，旧G09不重投','SOP':'D:/AI视频/VJ-1106/api-tools/docs/MiniMax-H3-API视频生成SOP-20261114-v1.md'}
save(R/'authorization.json',auth)
units=[]
for u in manifest['units']:
 d=R/u['id'];d.mkdir(exist_ok=True)
 for p in Path(u['directory']).iterdir():
  if p.is_file() and p.suffix in ('.txt','.json','.md') and not (d/p.name).exists():shutil.copy2(p,d/p.name)
 units.append({'id':u['id'],'title':u['title'],'version':'v2.1','duration':u['duration'],'edit_duration':u['duration'],'planned_adopt':u['adopt'],'reference_paths':u['references'],'depends_on':None,'status':'prepared','prompt_sha256':u['prompt_sha256']})
# Priority: shared scene and dialogue early, so failures can be diagnosed before assembly.
order=['H01','H02','H09','H03','H04','H05','H06','H07','H08'];units.sort(key=lambda x:order.index(x['id']))
save(R/'production-plan.json',{'version':'v2.1','authorization':auth,'model':'MiniMax-H3','resolution':'768P','ratio':'16:9','audio':'native voices and ambience retained; no BGM; output must be audited','units':units})
if not (R/'pipeline.py').exists():
 t=(OLD/'pipeline.py').read_text('utf-8')
 t=t.replace("{'id':d.name,'version':'v1'}","{'id':d.name,'version':'v2.1'}")
 t=t.replace("'-map','0:v:0','-vf',filt","'-map','0:v:0','-map','0:a:0?','-vf',filt")
 t=t.replace("'-pix_fmt','yuv420p','-an','-movflags'","'-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags'")
 t=t.replace("'audio_removed_in_selected':True","'audio_removed_in_selected':False")
 (R/'pipeline.py').write_text(t,'utf-8')
 shutil.copy2(OLD/'invoke_unit.ps1',R/'invoke_unit.ps1')
save(R/'approved-prompt-snapshot.json',{'approval':auth,'units':[{'id':u['id'],'sha256':hashlib.sha256((R/u['id']/'prompt.txt').read_bytes()).hexdigest()} for u in units]})
print('Prepared nine approved H3 units; native audio preservation enabled.')
