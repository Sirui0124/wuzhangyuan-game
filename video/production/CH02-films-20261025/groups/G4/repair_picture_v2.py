"""Local picture-only role-ownership repairs. Preserves every original; no API/TTS."""
from pathlib import Path
import json, subprocess, hashlib, re, time

OUT=Path(__file__).resolve().parent
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
def read(p): return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,d):
    p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8')
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def run(a): subprocess.run([FF,'-v','error','-y',*map(str,a)],check=True,capture_output=True)
def probe(p):
    s=subprocess.run([FF,'-hide_banner','-i',str(p)],capture_output=True,text=True,encoding='utf-8',errors='replace').stderr
    t=re.search(r'Duration: (\d+):(\d+):([\d.]+)',s)
    w,h=map(int,re.search(r'Video:.*? (\d{3,5})x(\d{3,5})',s).groups())
    return dict(duration=int(t[1])*3600+int(t[2])*60+float(t[3]),width=w,height=h,fps=24.0,sampleRate=48000,sha256=sha(p),bytes=p.stat().st_size)

original=read(OUT/'review/usability-v1-snapshot.json')
plan=read(OUT/'plan.json')
voices=read(OUT.parents[1]/'voice/manifest.json')['rows']
gouan=OUT/'generated/V28A-01-16x9.mp4'
desk=OUT/'generated/V26-04-R2-16x9.mp4'
# Keep the strictly closed 0-5.55 seconds, avoid any mouth preparation at its old tail.
specs={
 'V27-02':dict(source=gouan,end=5.55,duration=8.333333,crop=None),
 'V27-05':dict(source=gouan,end=5.55,duration=7.5,crop=[112,0,1056,594]),
 'V27-07':dict(source=gouan,end=5.55,duration=8.0,crop=None),
 'V28A-01':dict(source=gouan,end=5.55,duration=6.25,crop=None),
 'V28B-01':dict(source=gouan,end=5.55,duration=7.833333,crop=[112,0,1056,594]),
 'V28C-01':dict(source=gouan,end=5.55,duration=6.5,crop=[112,0,1056,594]),
 'V29-02':dict(source=desk,end=4.5,duration=9.0,crop=[320,360,640,360]),
}
confirmed={
 'V27':[('V27-05',[6,10.13],'玩家句尾后连续开口、额外说话表演'),('V27-07',[2.5,6.2],'玩家长句期间连续开口、转头发言')],
 'V28C':[('V28C-01',[1.5,9.44],'玩家承诺期间苟安反复作说话口型')],
 'V29':[('V29-02',[0,12.25],'军吏持续作说话表演并切近景，明显代说玩家咨询')],
}
audit=read(OUT/'review/picture-usability.json')
for c in audit['clips']:
 if c['id'] in confirmed:
  c['issues']=[dict(subclip=x[0],subclipRange=x[1],description=x[2],status='confirmed-needs-repair',evidence='review/usability/'+x[0]+'.jpg',repair='同场闭口段/无字案头本地替换，原版保留，新文件复核后切换') for x in confirmed[c['id']]]
  c['dynamicChecks']=[dict(method='独立浏览器从头完整播放并复核时间序列帧；纯画面检查',file=str(OUT/'edited'/f'{x[0]}.mp4'),sha256=sha(OUT/'edited'/f'{x[0]}.mp4'),range=[0,probe(OUT/'edited'/f'{x[0]}.mp4')['duration']]) for x in confirmed[c['id']]]
save(OUT/'review/picture-usability.json',audit)

records=[]
for cid,s in specs.items():
 dst=OUT/'edited/picture-v2'/f'{cid}.mp4'
 dst.parent.mkdir(parents=True,exist_ok=True)
 pc=next(c for c in plan['clips'] if c['id']==cid)
 voice=voices[pc['sourceNodes'][0]]
 assert voice['ready'] and voice['duration']+.7<=s['duration']
 speed=s['end']/s['duration']
 crop=s['crop'];vf=f'trim=start=0:end={s["end"]},setpts=(PTS-STARTPTS)/{speed}'
 if crop:vf+=f',crop={crop[2]}:{crop[3]}:{crop[0]}:{crop[1]},scale=1280:720,setsar=1'
 # Reuse the existing centralized audio only. No synthesis and no changed text.
 af=f'[0:a]atrim=start=0:end={s["end"]},asetpts=PTS-STARTPTS,atempo={speed},volume=0.5[bed];[1:a]adelay=400:all=1[voice];[bed][voice]amix=inputs=2:duration=first:normalize=0[a]'
 if not dst.exists():
  run(['-i',s['source'],'-i',voice['path'],'-filter_complex',af,'-map','0:v:0','-map','[a]','-vf',vf,'-t',s['duration'],'-r','24','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-movflags','+faststart',dst])
 run(['-i',dst,'-f','null','NUL'])
 r=dict(id=cid,slot=pc['slot'],file=str(dst),source=str(s['source']),sourceSha256=sha(s['source']),trim=dict(start=0,end=s['end']),speed=speed,crop=crop,centralVoice=voice['path'],centralVoiceDuration=voice['duration'],voiceOffset=.4,technical=probe(dst),userApproved=False,audioIssues=['仅复用既有中央音轨；环境声、音色、BGM和逐字听审未通过，留统一配音阶段'],repair='只替换画面角色归属；无循环、无倒放、无新增证据/动作')
 save(dst.with_suffix('.json'),r);records.append(r)
 print(cid,r['technical']['duration'],flush=True)

candidate=[]
for c in original['clips']:
 if not any(x in specs for x in c['clipIds']):continue
 parts=[OUT/'edited/picture-v2'/f'{cid}.mp4' if cid in specs else OUT/'edited'/f'{cid}.mp4' for cid in c['clipIds']]
 dst=Path(c['file']).with_name(Path(c['file']).stem+'-picture-v2.mp4')
 listing=OUT/'edited/picture-v2'/f'{c["id"]}.concat.txt'
 listing.write_text('\n'.join("file '"+p.as_posix()+"'" for p in parts),encoding='utf-8')
 if not dst.exists():run(['-f','concat','-safe','0','-i',listing,'-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p','-r','24','-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-movflags','+faststart',dst])
 run(['-i',dst,'-f','null','NUL'])
 cc=dict(c);cc.update(file=str(dst),path=str(dst),technical=probe(dst),previousFile=c['file'],previousSha256=c['technical']['sha256'])
 candidate.append(cc)
save(OUT/'review/picture-v2-candidates.json',dict(clips=candidate,subclips=records,newAPIRequests=0,newTTSRequests=0,status='候选已生成，未切换delivery；待动态视觉复核',created=time.strftime('%Y-%m-%d %H:%M:%S')))

# Independent page and history; IDs alone never reuse a previous-file played status.
html=(OUT/'review-assembled.html').read_text(encoding='utf-8')
data=[]
for c in candidate:
 cs=[x for x in plan['clips'] if x['slot']==c['id']]
 data.append(dict(id=c['id'],src=Path(c['file']).relative_to(OUT).as_posix(),expected=' / '.join(l['text'] for x in cs for l in x['lines']),silent=False))
start=html.index('const data=');end=html.index(';\nconst s=',start)
html=html[:start]+'const data='+json.dumps(data,ensure_ascii=False)+html[end:]
(OUT/'review-picture-v2.html').write_text(html,encoding='utf-8')
print('New candidates:',len(candidate),'delivery unchanged',flush=True)
