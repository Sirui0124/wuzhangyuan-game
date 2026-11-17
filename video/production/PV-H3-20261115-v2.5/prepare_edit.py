from pathlib import Path
import json,shutil
R=Path(__file__).resolve().parent;P=R.parent/'PV-H3-20261115-v2.4'
c=json.loads((P/'final-edit.json').read_text('utf-8'));shots=[];removed=[]
changed={'V02','V03','V10','V11','V12','V11B','V14'}
for old in c['shots']:
 s=dict(old);id=s['id']
 if id in ('V05','V06','V07','V08','V15'):
  removed.append(s);continue
 if id=='V02':s.update(source=str(R/'edit/V02-picture.mp4'),audio_source=str(R/'sound/pang-dialogue-horse-camp.wav'),title_name='庞统交印 · 马上与连营',picture_edit_record='camp-edit-record.json')
 if id=='V03':s.update(**{'in':68/24},duration=52/24,title_name='连营继续展开')
 if id in ('V10','V11','V12','V11B'):s['audio_source']=str(R/'sound/rain-sequence.wav')
 if id=='V12':s.update(source=str(R/'R06/source.mp4'),**{'in':.5},duration=2.25,pre_crop='crop=1280:720:64:24,',title_name='诸葛亮雨营反应 · 同一地面空间')
 if id=='V11B':s['audio_in']=4.5
 if id=='V14':s.update(source=str(R/'M04/source.mp4'),**{'in':0},duration=4,audio_source=str(R/'sound/masu-location.wav'),audio_in=0,gain_db=0,title_name='马谡跪地 · 重拍连续表演')
 s['reuse_unchanged']=id not in changed
 shots.append(s)
 if s['reuse_unchanged']:
  for suffix in ['-picture.mp4','-sound.wav']:shutil.copy2(P/'edit'/(id+suffix),R/'edit'/(id+suffix))
 elif id in ('V10','V11','V11B'):shutil.copy2(P/'edit'/(id+'-picture.mp4'),R/'edit'/(id+'-picture.mp4'))
c.update(version='v2.5',shots=shots,user_review='待review');(R/'final-edit.json').write_text(json.dumps(c,ensure_ascii=False,indent=2),'utf-8')
(R/'removed-from-cut.json').write_text(json.dumps({'source':'v2.4','shots':removed,'delete_original_files':False,'reason':'30.25-45.5whole sequence removed; old Ma Su close replaced by newly generated continuous take'},ensure_ascii=False,indent=2),'utf-8')
print('Candidate duration',sum(s['duration'] for s in shots))
