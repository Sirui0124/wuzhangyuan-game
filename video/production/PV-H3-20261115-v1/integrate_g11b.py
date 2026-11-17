from pathlib import Path
import json
import pipeline

OUT=Path(__file__).resolve().parent;d=OUT/'G11';b=OUT/'G11B'
first=d/'cut-first4.mp4';last=b/'fall-last2.mp4';combined=d/'selected-with-fall.mp4'
vf='crop=1344:756:0:6,scale=1280:720:flags=lanczos,setsar=1,fps=24'
for source,start,duration,dest in [(d/'source.mp4',0,4,first),(b/'source.mp4',2,2,last)]:
    if not dest.exists():pipeline.run([pipeline.FF,'-v','error','-i',source,'-ss',start,'-t',duration,'-vf',vf,'-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-an','-movflags','+faststart',dest],timeout=180)
concat=d/'fall-concat.txt';concat.write_text('\n'.join("file '"+p.as_posix()+"'" for p in (first,last))+'\n','utf-8')
if not combined.exists():pipeline.run([pipeline.FF,'-v','error','-f','concat','-safe','0','-i',concat,'-c:v','copy','-an','-movflags','+faststart',combined],timeout=60)
pipeline.run([pipeline.FF,'-v','error','-i',combined,'-f','null','-'],timeout=90)
pipeline.run([pipeline.FF,'-v','error','-i',combined,'-vf','fps=2,scale=320:180,tile=4x3','-frames:v','1','-update','1',d/'contact-with-fall.jpg'],timeout=60)
state=pipeline.read(d/'state.json');state.update(selected_file=str(combined),selection_recipe=[{'source':str(d/'source.mp4'),'in':0,'out':4,'speed':1},{'source':str(b/'source.mp4'),'in':2,'out':4,'speed':1}],edit_note='回望、中箭取G11前4秒；坠马取独立补镜G11B的2—4秒，合计仍为6秒。');pipeline.save(d/'state.json',state)
state_b=pipeline.read(b/'state.json');state_b.update(selected_file=str(last),selection_recipe=[{'source':str(b/'source.mp4'),'in':2,'out':4,'speed':1}]);pipeline.save(b/'state.json',state_b)
pipeline.save(d/'fall-integration.json',{'source_segments':state['selection_recipe'],'duration':6,'file':combined.name,'supplement':str(b/'plan.json'),'speed_changed':False,'all_sources_preserved':True})
print('G11 actual fall integrated, duration 6 seconds')
