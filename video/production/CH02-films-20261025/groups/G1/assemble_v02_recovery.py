"""Recover V02 from valid continuous shots; no new generation or TTS."""
from pathlib import Path
import json,subprocess,hashlib,re
OUT=Path(__file__).resolve().parent;BASE=OUT.parents[1];ROOT=BASE.parents[2]
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def run(args):subprocess.run([FF,'-v','error','-y']+list(map(str,args)),check=True,capture_output=True)
def dur(p):
    s=subprocess.run([FF,'-hide_banner','-i',str(p)],capture_output=True,text=True,encoding='utf8',errors='replace').stderr;m=re.search(r'Duration: (\d+):(\d+):([\d.]+)',s);return int(m[1])*3600+int(m[2])*60+float(m[3])
voice=read(BASE/'voice/manifest.json')['rows'];specs=[
 ('V02-road1',OUT/'edited/V02-01-R2-normalized.mp4',0,7.3,.90,'无字营道，保持第一视角'),
 ('V02-road2',OUT/'edited/V02-02-R2-normalized.mp4',0,7.5,.90,'裁除8秒起的额外人物肩背；同场另一段连续观察'),
 ('V02-tent-existing',ROOT/'video/current/LI02B-full-speed-20261022.mp4',0,11.08,1.0,'复用现片连续入帐与卧榻认人；009心声覆盖走近，012在近景认人时响起'),
 ('V02-question',OUT/'edited/V02-06-normalized.mp4',0,53/24,1.0,'裁除2.3秒起出现的白布与额外道具，短问句完整容纳'),
 ('V02-answer',OUT/'edited/V02-07-normalized.mp4',0,7.3,1.0,'同脸同榻苟安反问；原音问题暂标记'),
]
parts=[];files=[];offset=0
for cid,src,a,b,rate,note in specs:
    dst=OUT/'edited'/f'{cid}-recovery.mp4'
    filt=f'trim=start={a}:end={b},setpts=(PTS-STARTPTS)/{rate},scale=1280:720,setsar=1'
    # Only the last shot carries NPC audio. All earlier source voice is removed
    # before central voice is added, so no new narration or overlapping actor.
    audio=f'atrim=start={a}:end={b},asetpts=PTS-STARTPTS,atempo={rate}'
    if cid!='V02-answer':audio+=',volume=0'
    run(['-i',src,'-vf',filt,'-af',audio,'-r','24','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p','-c:a','aac','-ar','48000','-b:a','192k','-movflags','+faststart',dst])
    actual=dur(dst);parts.append(dict(id=cid,path=str(dst),slotStart=offset,slotEnd=offset+actual,sourcePath=str(src),sourceSha256=hashlib.sha256(src.read_bytes()).hexdigest(),sourceTrim=[a,b],rate=rate,note=note,review=dict(visualReview='usable-after-recovery-edit',actualDynamicReview=False,method='ordered2fps source checks; final dynamic playback pending',audioIssues=['原音待统一；纯画面段复用中央已有配音，环境声暂缺'])));offset+=actual;files.append(dst)
listing=OUT/'assembled/V02-recovery.concat.txt';listing.write_text(''.join("file '"+p.as_posix()+"'\n" for p in files),encoding='utf8');picture=OUT/'edited/V02-recovery-picture.mp4';run(['-f','concat','-safe','0','-i',listing,'-c','copy',picture])
road_end=parts[1]['slotEnd'];question_start=parts[3]['slotStart'];cues=[];start=.30
for node in ['CH2-LY01-002','CH2-LY01-007','CH2-LY01-008']:
    r=voice[node];cues.append(dict(node=node,slotStart=start,slotEnd=start+r['duration'],path=r['path'],text=r['text'],sha256=r['sha256']));start+=r['duration']+.15
assert cues[-1]['slotEnd']<road_end-.1
for node,start in [('CH2-LY01-009',road_end+.30),('CH2-LY01-012',road_end+4.80),('CH2-LY01-013',question_start+.30)]:
    r=voice[node];cues.append(dict(node=node,slotStart=start,slotEnd=start+r['duration'],path=r['path'],text=r['text'],sha256=r['sha256']))
assert cues[-1]['slotEnd']<parts[3]['slotEnd']
args=['-i',picture];filters=['[0:a]aresample=48000[base]'];tracks=['[base]']
for i,c in enumerate(cues):
    args+=['-i',c['path']];filters.append(f'[{i+1}:a]aresample=48000,adelay={round(c["slotStart"]*1000)}:all=1[v{i}]');tracks.append(f'[v{i}]')
filters.append(''.join(tracks)+f'amix=inputs={len(tracks)}:duration=first:normalize=0:dropout_transition=0[a]')
dest=OUT/'assembled/V02-回忆与伤帐认人.mp4';run(args+['-filter_complex',';'.join(filters),'-map','0:v','-map','[a]','-c:v','copy','-c:a','aac','-b:a','192k','-ar','48000','-movflags','+faststart',dest]);run(['-i',dest,'-f','null','NUL'])
slot=next(s for s in read(OUT/'plan.json')['slots'] if s['id']=='V02')
record=dict(id='V02',name='回忆与伤帐认人',path=str(dest),duration=dur(dest),size=[1280,720],fps=24,audioRate=48000,entry=slot['entry'],next=slot['next'],endEvent=slot['endEvent'],subclips=parts,centralVoiceCues=cues,sha256=hashlib.sha256(dest.read_bytes()).hexdigest(),decode='passed',userReview='待review',audioIssues=['6条玩家/心声采用中央既有音轨，原句完整；未新增TTS。','NPC反问原声疑有多余字，留统一配音处理；未完成逐字听审。','玩家段原音静音以防制作说明，环境声待恢复。'],visualReview='final dynamic playback pending',editNotes=['营道两段为连续源区间，均0.90倍摄影机行进；没有一秒片段循环。','所有记忆只用心声，不拍未来事实。','同V内部将009心声覆盖入帐走近；011认人演出承接，012近景确认。','裁剪保留全部固定原句与UI-LIGHT之前的停顿边界。'])
(OUT/'assembled/V02-assembly.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf8')
(OUT/'review/V02-recovery.html').write_text('<meta charset=utf-8><title>G1 V02 recovery dynamic</title><style>body{background:#111;color:#eee}video{width:96vw}</style><h3>V02 recovery actual 37s</h3><video controls src="../assembled/V02-回忆与伤帐认人.mp4"></video>',encoding='utf8')
print(json.dumps(dict(id='V02',duration=record['duration'],roadSeconds=road_end,cues=cues),ensure_ascii=False))
