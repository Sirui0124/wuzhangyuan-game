from pathlib import Path
import json,subprocess
import pipeline

OUT=Path(__file__).resolve().parent;d=OUT/'G20';src=d/'source.mp4';dest=d/'selected-tight.mp4'
if not dest.exists():
    pipeline.run([pipeline.FF,'-v','error','-i',src,'-t','3','-vf','crop=768:432:560:80,scale=1280:720:flags=lanczos,setsar=1,fps=24','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-an','-movflags','+faststart',dest],timeout=180)
pipeline.run([pipeline.FF,'-v','error','-i',dest,'-vf','fps=2,scale=384:216,tile=3x2','-frames:v','1','-update','1',d/'contact-tight.jpg'],timeout=45)
state=pipeline.read(d/'state.json');state['selected_file']=str(dest);state['selection_recipe']=[{'source':str(src),'in':0,'out':3,'speed':1,'crop_record':str(d/'reframe-record.json')}];state['edit_note']='工作剪辑裁到诸葛亮面部，排除模型擅加的前景武将；原生原片及未裁版本保留。';pipeline.save(d/'state.json',state)
pipeline.save(d/'reframe-record.json',{'source':'source.mp4','source_in':0,'source_out':3,'crop':[768,432,560,80],'output':[1280,720,24],'speed':1,'file':dest.name,'purpose':'排除原片擅加的前景铠甲人物，保持本镜为诸葛亮垂眼含泪的反打特写。','quality_note':'从原生1344×768中的768×432区域重新构图并放大至工作版720p；不称为原生720p细节。','original_preserved':True})
print('G20 tighter crop rendered; source preserved')
