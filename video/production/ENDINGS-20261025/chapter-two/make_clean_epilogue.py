"""Mix existing three inner-voice lines into the owner-approved clean take."""
from pathlib import Path
import sys,json,hashlib,subprocess
R=Path(__file__).resolve().parent
P=R.parents[3]
sys.path.insert(0,str(R))
from cut_revision_v2 import FF,run,save,sha
from assemble_endings import video_coverage
def main(source,expected_sha):
 source=Path(source).resolve();assert sha(source)==expected_sha
 selection=json.loads((R/'revision-v2/clean-tail-source-selection.json').read_text(encoding='utf-8'))
 assert selection['sha256']==expected_sha and selection['visualCandidate']
 target=R/'films/EPILOGUE-魏地广人众-V2.mp4'
 temp=target.with_suffix('.building.mp4')
 nodes=[('CH2-LY13-002',1.6,'魏地广人众，蜀中这些年，却一再折损。'),('CH2-LY13-003',5.8,'光改这趟运粮，补不上这些缺口。'),('CH2-LY13-004',10.2,'还得往更早的时候去。')]
 args=['-i',str(source)];voices=[]
 for node,start,text in nodes:
  path=P/'video/production/CH02-films-20261025/voice'/f'{node}.wav';assert path.is_file()
  voices.append(dict(node=node,path=str(path),sha256=sha(path),start=start,text=text,newTTS=False));args+=['-i',str(path)]
 vf='[0:v]fps=24,scale=1280:720,setsar=1,format=yuv420p,tpad=stop_mode=clone:stop_duration=0.1,trim=duration=15,setpts=PTS-STARTPTS[v]'
 fs=[vf,'[0:a]aresample=48000,aformat=channel_layouts=stereo,volume=0.18,apad=whole_dur=15,atrim=duration=15[bed]']
 for i,row in enumerate(voices,1):fs.append(f'[{i}:a]aresample=48000,aformat=channel_layouts=stereo,adelay={int(row["start"]*1000)}:all=1[a{i}]')
 fs+=['[bed][a1][a2][a3]amix=inputs=4:duration=first:normalize=0,alimiter=limit=0.95[a]']
 run([*args,'-filter_complex_threads','1','-filter_complex',';'.join(fs),'-map','[v]','-map','[a]','-t','15','-c:v','libx264','-threads','2','-preset','fast','-crf','18','-c:a','aac','-ar','48000','-b:a','192k','-movflags','+faststart','-y',str(temp)])
 coverage=video_coverage(temp,15);run(['-i',str(temp),'-f','null','-']);assert sha(source)==expected_sha
 if target.exists():
  historic=R/'revision-v2/before/EPILOGUE-superseded-paper-review.mp4'
  if not historic.exists():target.replace(historic)
 temp.replace(target)
 overview=R/'review/pace-v2/EPILOGUE-V2.jpg'
 run(['-i',str(target),'-vf','fps=1,scale=320:180,tile=4x4','-frames:v','1','-y',str(overview)])
 row=dict(id='EPILOGUE',title='魏地广人众',path=str(target),sha256=sha(target),duration=15,decode='passed',videoCoverage=coverage,source=dict(path=str(source),sha256=expected_sha),voices=voices,overview=str(overview),artifactType='standalone-reusable-epilogue',userApproved=False,gameIntegrated=False,executesGameState=False,visualReview='待本次合成全时段抽帧；源片采用记录见clean-tail-source-selection.json',audioReview='仅重混既有三句心声，未新TTS；未完成逐字听审')
 save(R/'revision-v2/EPILOGUE-delivery.json',row)
 print('Clean standalone epilogue:',row['sha256'],coverage,flush=True)
if __name__=='__main__':main(sys.argv[1],sys.argv[2])
