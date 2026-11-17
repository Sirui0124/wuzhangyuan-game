from pathlib import Path
import json,hashlib,shutil,subprocess
O=Path(__file__).resolve().parent;R=O/'review/picture-repair';S=R/'reuse-sources';S.mkdir(exist_ok=True)
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
specs=[('G1','L01','9a0c513b3124245265c6ec67785d4cbbc4f634959523579ad6d134181bae38a3'),('G4','L02','fe5e86520c33d33a60f24c839976a8f279daeab49916f10fa081af0eed0c3ed6')]
rows=[]
for group,id,expected in specs:
 d=read(O.parent/group/'delivery.json');c=next(c for c in d['clips'] if c['id']==id);src=Path(c['file']);h=hashlib.sha256(src.read_bytes()).hexdigest();assert h==expected,(id,'Source changed; review newer owner evidence before reuse.')
 dst=S/f'{group}-{id}-{h[:10]}.mp4'
 if not dst.exists():shutil.copyfile(src,dst)
 assert hashlib.sha256(dst.read_bytes()).hexdigest()==h
 jpg=dst.with_suffix('.jpg')
 if not jpg.exists():subprocess.run([FF,'-v','error','-y','-i',str(dst),'-vf','fps=3,scale=320:-1,tile=5x5','-frames:v','1',str(jpg)],check=True)
 rows.append(dict(id=f'{group}-{id}',source=str(src),sourceSha256=h,snapshot=str(dst),ownerConditions=c.get('integrationConditions'),use='仅复用人物视觉表演，不引入原自由输入流程、剧情判定或声音',userApproved=False,reviewState='pending-own-dynamic-review'))
(R/'shared-listener-reuse.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
(R/'shared-listener-preview.json').write_text(json.dumps([[r['id'],Path(r['snapshot']).relative_to(O).as_posix()] for r in rows]),encoding='utf-8');print('Two exact-SHA shared listener snapshots ready for read-only inspection.')
