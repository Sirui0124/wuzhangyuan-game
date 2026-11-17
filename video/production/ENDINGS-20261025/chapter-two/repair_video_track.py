"""Independent local edit: restore all four V41L images without changing group files."""
import json
import subprocess
from pathlib import Path
from assemble_endings import ROOT,GROUPS,FF,read,dump,digest,video_coverage

d=read(GROUPS/'G6/delivery.json')
row=next((x for x in d.get('films',[])+d.get('heldFilms',[]) if x['id']=='V41L'),None)
if row is None:
    # The owning task correctly withdrew the broken container. Reconstruct only
    # its known four adopted picture sources; preserve that container's audio.
    adopted=read(GROUPS/'G6/review/visual-adopted.json')
    originals=list((GROUPS/'G6/assembled').glob('V41L-*-R2.mp4'))
    assert len(originals)==1
    row={'id':'V41L','path':str(originals[0]),'sha256':digest(originals[0]),'duration':39.16,
         'adopted':[adopted[f'V41L-0{i}'] for i in range(1,5)],
         'audioIssues':['原39.16秒声音完整复制；部分心声/旁白尚待混入，未听审。']}
source=Path(row['path'])
assert digest(source)==row['sha256']
parts=[Path(x['path']) for x in row['adopted']]
assert len(parts)==4 and all(p.is_file() for p in parts)
inputs=[{'path':str(p),'sha256':digest(p)} for p in parts]
folder=ROOT/'repairs'
folder.mkdir(exist_ok=True)
target=folder/'V41L-完整画面时间轴-R3.mp4'
temp=target.with_suffix('.building.mp4')
args=[str(FF),'-hide_banner','-nostdin','-v','error','-filter_complex_threads','1']
for p in parts: args+=['-i',str(p)]
args+=['-i',str(source)]
filters=[]
for i in range(4): filters.append(f'[{i}:v:0]setpts=PTS-STARTPTS,fps=24,scale=1280:720,setsar=1,format=yuv420p[v{i}]')
filters.append('[v0][v1][v2][v3]concat=n=4:v=1:a=0[v]')
args+=['-filter_complex',';'.join(filters),'-map','[v]','-map','4:a:0','-c:v','libx264','-threads','2','-preset','fast','-crf','18','-r','24','-pix_fmt','yuv420p','-c:a','copy','-movflags','+faststart','-y',str(temp)]
subprocess.run(args,check=True)
assert all(digest(Path(x['path']))==x['sha256'] for x in inputs)
coverage=video_coverage(temp,row['duration'])
temp.replace(target)
repair={'V41L':{'path':str(target),'sha256':digest(target),'duration':row['duration'],'supersedesSha256':row['sha256'],'originalPath':str(source),'baseSource':row,'owner':'G6素材／本任务时间轴修复','sourceParts':inputs,'videoCoverage':coverage,'reason':'将四个输入独立归零时间戳、统一24fps后用concat filter重拼完整画面；原39.16秒音轨整轨复制，未裁音、未新增配音或生成请求。','userApproved':False}}
dump(ROOT/'local-source-repairs.json',repair)
print(json.dumps(coverage,ensure_ascii=False),flush=True)
