from pathlib import Path
import json,subprocess,hashlib,sys,re
O=Path(__file__).resolve().parent;E=O/'edited/picture-usability-v2';R=O/'review/picture-repair'
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
P=read(O/'plan.json');D=read(O/'delivery.json');over=read(R/'candidate-overrides.json')
ids=sys.argv[1].split(',') if len(sys.argv)>1 else ['V23','V25']
files={c['id']:c['file'] for c in D['subclips']}
for id,r in over.items():
 if not r.get('reviewState','').startswith('rejected'):files[id]=r['file']
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def duration(p):
 s=subprocess.run([FF,'-hide_banner','-i',str(p)],capture_output=True,text=True,encoding='utf-8',errors='replace').stderr
 m=re.search(r'Duration: (\d+):(\d+):([\d.]+)',s);return int(m[1])*3600+int(m[2])*60+float(m[3])
def dissolve(a,b,out):
 if not out.exists():
  offset=duration(a)-.4
  f=f'[0:v]fps=24,settb=AVTB[v0];[1:v]fps=24,settb=AVTB[v1];[v0][v1]xfade=transition=fade:duration=0.4:offset={offset}[v];[0:a][1:a]acrossfade=d=0.4[a]'
  subprocess.run([FF,'-v','error','-y','-i',str(a),'-i',str(b),'-filter_complex_threads','1','-filter_complex',f,'-map','[v]','-map','[a]','-r','24','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p','-c:a','aac','-ar','48000',str(out)],check=True)
 return str(out)
staged=read(R/'staged-logical-versions.json') if (R/'staged-logical-versions.json').exists() else {}
for v in P['logicalClips']:
 if v['id'] not in ids:continue
 sources=[files[i] for i in v['subclips']]
 if v['id']=='V24':
  assert 'V24-03' in over and 'V24-06' in over,'Memory repair not ready.'
  sources=[dissolve(sources[0],sources[1],E/'V24-entry-v2.mp4'),sources[2],sources[3],sources[4],dissolve(sources[5],O/'edited/V24-return-reaction.mp4',E/'V24-exit-v2.mp4')]
 out=O/'assembled'/f"{v['id']}-{v['name']}_画面修复V2.mp4";lst=E/f"{v['id']}-assembly.concat.txt"
 lst.write_text('\n'.join("file '"+Path(s).as_posix()+"'" for s in sources),encoding='utf-8')
 fingerprints=[sha(s) for s in sources];rec=out.with_suffix('.json')
 if not out.exists() or not rec.exists() or read(rec).get('sourceHashes')!=fingerprints:
  subprocess.run([FF,'-v','error','-y','-f','concat','-safe','0','-i',str(lst),'-vf','fps=24,setsar=1','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p','-c:a','aac','-ar','48000','-b:a','192k','-movflags','+faststart',str(out)],check=True)
  subprocess.run([FF,'-v','error','-i',str(out),'-f','null','NUL'],check=True,capture_output=True)
  r=dict(id=v['id'],file=str(out),sha256=sha(out),sourceIds=v['subclips'],sourceFiles=sources,sourceHashes=fingerprints,decode='passed',size=[1280,720],fps=24,audioSampleRate=48000,reviewState='pending-final-dynamic-review',previousFile=next(x['path'] for x in D['logicalClips'] if x['id']==v['id']),expectedSourceNodes=[l['node'] for c in P['clips'] if c['logicalId']==v['id'] for l in c['sourceLines']])
  rec.write_text(json.dumps(r,ensure_ascii=False,indent=2),encoding='utf-8')
 staged[v['id']]=read(rec);print(v['id'],str(out),flush=True)
(R/'staged-logical-versions.json').write_text(json.dumps(staged,ensure_ascii=False,indent=2),encoding='utf-8')
manifest=[[i,Path(staged[i]['file']).relative_to(O).as_posix()] for i in ids if i in staged]
(R/('staged-preview-'+','.join(ids)+'.json')).write_text(json.dumps(manifest,ensure_ascii=False),encoding='utf-8')
