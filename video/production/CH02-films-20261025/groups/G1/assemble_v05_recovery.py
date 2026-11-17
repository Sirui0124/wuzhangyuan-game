"""V05 local picture repair: night continuity, first-person paper insert, no new API."""
from pathlib import Path
import json,subprocess,re,hashlib
OUT=Path(__file__).resolve().parent;BASE=OUT.parents[1]
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
def read(p):return json.loads(p.read_text(encoding='utf8'))
def run(a):subprocess.run([FF,'-v','error','-y']+list(map(str,a)),check=True,capture_output=True)
def dur(p):
 s=subprocess.run([FF,'-hide_banner','-i',str(p)],capture_output=True,text=True,encoding='utf8',errors='replace').stderr;m=re.search(r'Duration: (\d+):(\d+):([\d.]+)',s);return int(m[1])*3600+int(m[2])*60+float(m[3])
srca=OUT/'edited/V05-01-normalized.mp4';srcb=OUT/'edited/V05-02-normalized.mp4';specs=[
 ('V05-observation',srca,0,10.14,"eq=brightness=-0.12:gamma=0.80:saturation=0.82:enable='gte(t,3.8)'",'后两夜统一压到灯下夜景；背向粮兵是观察对象，不是我的外拍'),
 ('V05-permission-face',srcb,0,4.6,'eq=brightness=-0.12:gamma=0.80:saturation=0.82','管事正面；完整请求及允许先发生'),
 ('V05-record-insert',srcb,4.6,9.44,'crop=640:360:200:340,gblur=sigma=2.8,scale=1280:720,eq=brightness=-0.12:gamma=0.80:saturation=0.82','裁掉右侧肩背和剑柄大部；只看桌上记录与核验的手。文字散焦，不作精确日期依据'),
]
parts=[];files=[];offset=0
for cid,src,a,b,vf,note in specs:
 dst=OUT/'edited'/f'{cid}-recovery.mp4';run(['-ss',a,'-to',b,'-i',src,'-vf',vf+',setsar=1','-af','volume=0','-r','24','-c:v','libx264','-crf','18','-preset','fast','-c:a','aac','-ar','48000','-movflags','+faststart',dst]);d=dur(dst);parts.append(dict(id=cid,path=str(dst),slotStart=offset,slotEnd=offset+d,sourcePath=str(src),sourceSha256=hashlib.sha256(src.read_bytes()).hexdigest(),sourceTrim=[a,b],edit=note,review=dict(visualReview='pending-final-dynamic',actualDynamicReview=False,audioIssues=['原生成说明声静音，现场环境音待统一恢复'])));offset+=d;files.append(dst)
listing=OUT/'assembled/V05-recovery.concat.txt';listing.write_text(''.join("file '"+p.as_posix()+"'\n" for p in files),encoding='utf8');pic=OUT/'edited/V05-recovery-picture.mp4';run(['-f','concat','-safe','0','-i',listing,'-c','copy',pic])
voice=read(BASE/'voice/manifest.json')['rows']['CH2-LY02-012'];start=parts[0]['slotEnd']+.3;allow_start=parts[0]['slotEnd']+3.75
dest=OUT/'assembled/V05-夜间取账.mp4';filters=f'[0:a]volume=0[a0];[1:a]aresample=48000,adelay={round(start*1000)}:all=1[a1];[2:a]atrim=start=6.95:end=7.80,asetpts=PTS-STARTPTS,aresample=48000,adelay={round(allow_start*1000)}:all=1[a2];[a0][a1][a2]amix=inputs=3:duration=first:normalize=0[a]'
run(['-i',pic,'-i',voice['path'],'-i',srcb,'-filter_complex',filters,'-map','0:v','-map','[a]','-c:v','copy','-c:a','aac','-ar','48000','-b:a','192k','-movflags','+faststart',dest]);run(['-i',dest,'-f','null','NUL'])
slot=next(x for x in read(OUT/'plan.json')['slots'] if x['id']=='V05');row=dict(id='V05',name='夜间取账',path=str(dest),duration=dur(dest),entry=slot['entry'],next=slot['next'],endEvent=slot['endEvent'],size=[1280,720],fps=24,audioRate=48000,subclips=parts,centralVoiceCues=[dict(node='CH2-LY02-012',text=voice['text'],slotStart=start,slotEnd=start+voice['duration'],path=voice['path'],sha256=voice['sha256'])],sha256=hashlib.sha256(dest.read_bytes()).hexdigest(),decode='passed',userReview='待review',visualReview='pending-final-dynamic',audioIssues=['复用既有中央请求原句；没新增TTS。','NPC临时看吧摘自6.95–7.80s，嗯字是否完整尚未逐字听审，待统一配音。','原生成多余说明人声已静音，环境声待统一恢复。'],editNotes=['允许声先于翻看/按住文书的近景；原件最后仍在桌上。','后两夜与取账镜统一夜景；精确日期由UI-DATE呈现，本片不以模糊字当证据。'])
(OUT/'assembled/V05-assembly.json').write_text(json.dumps(row,ensure_ascii=False,indent=2),encoding='utf8')
(OUT/'review/V05-final.html').write_text('<meta charset=utf-8><title>G1 V05 final review</title><style>body{background:#111;color:#eee}video{width:96vw}</style><h3>V05 complete candidate</h3><video controls src=../assembled/V05-夜间取账.mp4></video>',encoding='utf8');run(['-i',dest,'-vf','fps=2,scale=320:-1,tile=4x10:padding=2:margin=2','-frames:v','1',OUT/'review/V05-final.jpg']);print(json.dumps(dict(id='V05',duration=row['duration'],permissionAt=allow_start),ensure_ascii=False))
