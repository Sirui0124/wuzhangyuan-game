from pathlib import Path
import json
import pipeline

OUT=Path(__file__).resolve().parent;r=OUT/'G24-25-v2';source=r/'source.mp4';active=pipeline.read(r/'state.json')
assert active.get('status')=='downloaded'
active['version']='v2';pipeline.save(r/'state.json',active)
for uid,start,end in [('G24',0,3),('G25',3,8)]:
    d=OUT/uid;dest=r/f'part-{uid}.mp4'
    if not dest.exists():pipeline.run([pipeline.FF,'-v','error','-i',source,'-ss',start,'-t',end-start,'-vf','crop=1344:756:0:6,scale=1280:720:flags=lanczos,setsar=1,fps=24','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-an','-movflags','+faststart',dest],timeout=180)
    poster=r/f'poster-{uid}.png'
    pipeline.run([pipeline.FF,'-v','error','-ss',start,'-i',source,'-frames:v','1','-update','1',poster],timeout=45)
    previous=pipeline.read(d/'state.json')
    if not (d/'v1-selection-state.json').exists():pipeline.save(d/'v1-selection-state.json',previous)
    pipeline.save(d/'v1-not-selected-review.json',{'status':'not_selected','reason':'旧版G24出现施救者背影；G25继承后又增加一条新手臂，违背第一视角和两人施救关系。','method':'查看原片2fps联系表。','old_task_id':previous.get('task_id'),'old_source':str(d/'source.mp4'),'replacement':str(r)})
    state={**previous,'id':uid,'version':'v2','status':'downloaded','active_directory':str(r),'active_source_file':str(source),'selected_file':str(dest),'poster_file':str(poster),'task_id':active['task_id'],'selection_recipe':[{'source':str(source),'in':start,'out':end,'speed':1}],'edit_note':'采用单一干净起始图重新生成的连续第一视角版本，前3秒与后5秒切分；旧第三人称原片保留但不采用。','user_review':'待review'}
    pipeline.save(d/'state.json',state)
pipeline.save(r/'integration.json',{'version':'v2','replaces':['G24','G25'],'source':str(source),'selected_range':[0,8],'parts':{'G24':[0,3],'G25':[3,8]},'duration':8,'speed':1,'pov_review':'已查看2fps总览及4—8秒的8fps动作抽帧，未见施救者肩背或全身。','hand_action':'模型后段让伤兵双手攀住我右前臂，与原设计单手回握有差异，保留待review。','full_realtime_visual_review':False,'user_review':'待review'})
print('Continuous POV rescue v2 selected for the final 8-second section')
