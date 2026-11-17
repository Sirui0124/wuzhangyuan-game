from pathlib import Path
import json
import pipeline

OUT=Path(__file__).resolve().parent;d=OUT/'G09'
segments=[('G07',7,8),('G08',3,4),('G05',1,2)]
clips=[];recipe=[]
for index,(uid,start,end) in enumerate(segments,1):
    src=OUT/uid/'source.mp4';clip=d/f'fallback-cut-{index}.mp4'
    if not clip.exists():pipeline.run([pipeline.FF,'-v','error','-i',src,'-ss',start,'-t',end-start,'-vf','crop=1344:756:0:6,scale=1280:720:flags=lanczos,setsar=1,fps=24','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-an','-movflags','+faststart',clip],timeout=120)
    clips.append(clip);recipe.append({'source':str(src),'in':start,'out':end,'speed':1})
concat=d/'fallback-concat.txt';concat.write_text('\n'.join("file '"+p.as_posix()+"'" for p in clips)+'\n','utf-8')
dest=d/'selected-existing-montage.mp4'
if not dest.exists():pipeline.run([pipeline.FF,'-v','error','-f','concat','-safe','0','-i',concat,'-c:v','copy','-an','-movflags','+faststart',dest],timeout=60)
pipeline.run([pipeline.FF,'-v','error','-i',dest,'-f','null','-'],timeout=90)
pipeline.run([pipeline.FF,'-v','error','-i',dest,'-vf','fps=2,scale=384:216,tile=3x2','-frames:v','1','-update','1',d/'contact-fallback.jpg'],timeout=50)
pipeline.run([pipeline.FF,'-v','error','-sseof','-0.06','-i',dest,'-frames:v','1','-update','1',d/'end-fallback.png'],timeout=30)
state=pipeline.read(d/'state.json');
if not (d/'v1-unknown-submission-state.json').exists():pipeline.save(d/'v1-unknown-submission-state.json',state)
state.update(status='edited_from_existing',original_api_status='unknown_outcome',selected_file=str(dest),poster_file=str(d/'end-fallback.png'),selection_recipe=recipe,edit_note='原背向迎敌镜头无ID且重投授权待回复。先使用已生成原片未采用范围，替换为3秒战况蒙太奇，未将原动作标为已完成。',user_review='待review');pipeline.save(d/'state.json',state)
pipeline.save(d/'fallback-edit.json',{'date':'2026-11-15','duration':3,'original_motion_completed':False,'original_api_status':'unknown_outcome','new_api_submission':False,'reason':'无ID提交的重投尚未获确认，采用正常剪辑替代，原请求保留不自动重提。','segments':recipe,'file':dest.name,'repeated_selected_ranges':False,'speed_changed':False,'user_review':'待review'})
pipeline.save(d/'review.json',{'technical':'pass','motion_review':'pending','user_review':'待review','notes':['本段为现有原片未采用尾段的替代剪辑：双骑背向前路、城门敌军冲近、沿江火场。','原设计的冯习张南分别迎敌没有独立生成成功，不把替代剪辑当成原动作已完成。']})
print('G09 3-second alternate edit rendered; no new API request')
