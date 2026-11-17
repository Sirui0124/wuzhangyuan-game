from pathlib import Path
import json,subprocess,hashlib,datetime
R=Path(__file__).resolve().parent
FF=r'D:/AI视频/VJ-1106/motion-runtime/node_modules/ffmpeg-static/ffmpeg.exe'
FP=r'D:/AI视频/VJ-1106/motion-runtime/node_modules/ffprobe-static/bin/win32/x64/ffprobe.exe'
def save(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2),'utf-8')
def run(args):return subprocess.run([str(x) for x in args],capture_output=True,check=True,timeout=180)
S=json.loads((R/'storyboard.json').read_text('utf-8'));M=json.loads((R/'h3-remake-manifest.json').read_text('utf-8'))
last=0
for s in S['shots']:
 assert s['in']==last and s['out']-s['in']==s['duration'];last=s['out']
 if s['kind'] not in ['title','black']:assert Path(s['source']).exists()
 if s['audio_source']:assert Path(s['audio_source']).exists()
assert last==92 and sum(s['duration'] for s in S['shots'] if s['kind']=='still')==18
for u in M['units']:
 for p in u['references']:assert Path(p).exists()
 assert not u['submitted'];assert 4<=u['duration']<=15
 assert hashlib.sha256((Path(u['directory'])/'prompt.txt').read_bytes()).hexdigest()==u['prompt_sha256']
final=R/'开篇PV-v2-92秒-分镜预演-背景声候选.mp4'
run([FF,'-v','error','-i',final,'-f','null','-'])
meta=json.loads(run([FP,'-v','error','-show_streams','-show_format','-of','json',final]).stdout)
v=next(s for s in meta['streams'] if s['codec_type']=='video');a=next(s for s in meta['streams'] if s['codec_type']=='audio')
assert v['width']==1280 and v['height']==720 and v['avg_frame_rate']=='24/1' and int(v['nb_frames'])==2208
assert abs(float(v['duration'])-92)<.0001 and abs(float(a['duration'])-92)<.0001 and float(meta['format']['duration'])==92
asr=json.loads((R/'v2-背景声分离候选.ASR-unverified.json').read_text('utf-8'))
result={'date':'2026-11-15','artifact_type':'storyboard_previs_not_finished_film','file':str(final),'sha256':hashlib.sha256(final.read_bytes()).hexdigest(),'bytes':final.stat().st_size,'full_decode':'pass','video':{'width':1280,'height':720,'fps':24,'frames':2208,'duration':92},'audio':{'codec':a['codec_name'],'sample_rate':a['sample_rate'],'channels':a['channels'],'duration':float(a['duration']),'ASR_segments':len(asr['segments']),'human_word_by_word_review':'not completed','no_new_BGM':True},'storyboard':{'shots':25,'duration':92,'static_placeholder_seconds':18,'source_paths_verified':True},'new_reference_images':3,'remake_prompts':{'count':len(M['units']),'requested_seconds':M['requested_seconds'],'submitted':0,'references_exist':True,'status':'待review'},'visual_review':'逐张查看三张新图，逐剪辑单元中点总览；未完成全片人工动态审阅','user_approval':'pending','game_integration':'not performed'}
save(R/'final-verification.json',result)
save(R/'checksums.json',{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in [final,R/'开篇PV-整体优化导演稿-v2.md',R/'整体优化审阅.html',R/'storyboard.json',R/'h3-remake-manifest.json']})
print(json.dumps({'checks':'pass','frames':2208,'seconds':92,'static_seconds':18,'new_H3_submissions':0,'ASR_segments':len(asr['segments'])},ensure_ascii=False))
