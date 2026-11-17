"""Build independent frame-accurate shortened candidates; never adopts delivery."""
from pathlib import Path
import json,subprocess,hashlib,wave,sys
import numpy as np
from track_integrity import inspect
ROOT=Path(__file__).resolve().parent;OUT=ROOT/'user-review-batch2'
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
base={f['id']:f for f in json.loads((OUT/'baseline-delivery.json').read_text(encoding='utf-8'))['films']}
voices={v['node']:v for v in json.loads((OUT/'player-voice-reuse.json').read_text(encoding='utf-8'))}
def span(a,b):return [round(a*24),round(b*24)]
def B(pics,node=None,original=False,audioStart=None,delay=0,reason=''):
    return dict(pictures=[span(a,b) for a,b in pics],node=node,audio='original-whitelist-window' if original else 'central-authorized-player' if node else 'silence-essential-action',audioStart=audioStart,delay=delay,reason=reason)
edl={
'V38':[
 B([(0,5.5)],'CH2-E2-001',delay=.25,reason='实际交材料；NPC闭口听'),
 B([(13.958333,17.666667)],'CH2-E2-002',True,13.94,reason='只保留材料收到/停手补报已记下，前端标签截至真实材料原句'),
 B([(21.416667,25.875)],'CH2-E2-002',True,21.4,reason='保留留营受查、李严仍待核，删前后空余'),
 B([(26.208333,32.708333)],'CH2-E2-003',delay=.2,reason='苟安仍活着的闭口反应；完整心声')],
'V39':[
 B([(0,2.416667),(5.791667,9.291667)],'CH2-LY12A-001',delay=.15,reason='保留递交动作和中性案头；不让NPC代说我的话'),
 B([(13.458333,17.75)],'CH2-LY12A-003',True,13.45,reason='仅真实共同核收原句，不能提前宣布定案')],
'V40':[
 B([(0,1.083333)],reason='短暂交代查办中的伤帐；不念演出说明'),
 B([(6.291667,8.333333)],'CH2-LY12A-005',True,6.30,reason='苟安主动担责前半'),
 B([(9.958333,11.5)],'CH2-LY12A-005',True,9.95,reason='苟安承担问责后半，缩掉过长停顿'),
 B([(12,16.25)],'CH2-LY12A-006',delay=.15,reason='我要求查李严，苟安闭口反应'),
 B([(20,20.875)],reason='正式处置另时传来，用无字卷束短转场，不念007演出说明'),
 B([(28.5,31.625)],'CH2-LY12A-008',True,28.52,reason='李严革职/交官印真实原句'),
 B([(37.25,40.875)],'CH2-LY12A-009',True,37.25,reason='实际军法死讯先于空铺；删除苟安死讯等标签段'),
 B([(41.166667,44.083333),(48.5,52.333333)],reason='死亡报告后才空铺/空粮车；三句心声完整放入',delay=0)],
'V41E':[
 B([(0,5.166667)],'CH2-LY07-BAD1',delay=.15,reason='收件查办与退军旁白，NPC仅收卷'),
 B([(14.958333,16.458333)],'CH2-LY07-BAD2',True,14.98,reason='只留大军退了吗，删口型/反应控制说明'),
 B([(16.75,22.5),(23.25,26.833333)],'CH2-LY07-BAD3',delay=.15,reason='完整早停查心声，苟安闭口反应；未获后期合谋')],
'V41L':[
 B([(1.416667,4.666667)],'CH2-E4-LATE-001',True,1.42,reason='李严参与线索第一分句'),
 B([(5.083333,8)],'CH2-E4-LATE-001',True,5.08,reason='材料里已有线索，缩停顿'),
 B([(9.666667,13.166667)],'CH2-E4-LATE-001',True,9.65,reason='细节尚不能对上'),
 B([(13.833333,17.416667)],'CH2-E4-LATE-001',True,13.82,reason='不能照结论认定'),
 B([(19.916667,25.25)],'CH2-E4-LATE-002',True,19.90,reason='认罪先入案，其余继续核查；不把核升级为定罪'),
 B([(27,35.208333)],'CH2-E4-LATE-003',delay=.2,reason='完整晚支撑不足心声，闭口低头归卷动作')],
'V43':[
 B([(.083333,2.583333),(6.25,9.416667)],reason='保留回身/离开实行动作，删中间重复步行，原污染声音去除；不以静音填旧长片'),
 B([(9.5,12),(16,20.166667)],'CH2-E5-002',delay=.25,reason='放行后另时营地与兵士反应，明确后来，禁止兵士代说旁白')]
}
results=[];selected=set(sys.argv[1:])
for fid,blocks in edl.items():
    if selected and fid not in selected:continue
    version='R1';new_state=None
    if fid=='V40':
        version='R2';blocks[6]['pictures']=[span(31.625,31.75),span(37.375,40.875)]
        blocks[6]['reason']+='；前镜连续尾部3帧承接死讯起音，再切已坐定镜头，删掉孤立入座闪镜；原句音轨完整不动'
    if fid=='V41L' and (OUT/'CH2-E4-LATE-002-R1-seed-audio-state.json').exists():
        new_state=json.loads((OUT/'CH2-E4-LATE-002-R1-seed-audio-state.json').read_text(encoding='utf-8'))
        if new_state['status']=='succeeded':
            version='R2';bl=blocks[4];bl.update(pictures=[span(19.916667,24.666667)],audio='seed-audio1-reference',delay=.125,crop=[0,360,640,360],reason='句尾边界不稳的一句用冻结同军吏参考补齐，实际上传Seed-Audio1.0；连续案头手部近景承载军吏画外续答，避免新声音对应旧口型')
        else:raise ValueError('New voice unresolved; do not resubmit or silently adopt')
    f=base[fid];p=Path(f['path']);assert hashlib.sha256(p.read_bytes()).hexdigest()==f['sha256']
    total=sum(b-a for bl in blocks for a,b in bl['pictures']);dur=total/24
    audio=np.zeros(round(dur*48000),dtype=np.float32);cursor=0;audioRecords=[];pics=[]
    def add_audio(path,start,end,timeline,node,mode):
        raw=subprocess.run([FF,'-v','error','-i',str(path),'-ss',str(start),'-t',str(end-start),'-f','f32le','-ar','48000','-ac','1','pipe:1'],capture_output=True,check=True).stdout
        arr=np.frombuffer(raw,dtype=np.float32);offset=round(timeline*48000)
        if offset+len(arr)>len(audio):raise ValueError('Audio would be cut: '+node)
        audio[offset:offset+len(arr)]+=arr
        audioRecords.append(dict(node=node,mode=mode,source=str(path),sourceSha256=hashlib.sha256(Path(path).read_bytes()).hexdigest(),sourceRange=[start,end],timelineRange=[timeline,timeline+len(arr)/48000],samples=len(arr)))
    for bl in blocks:
        n=sum(b-a for a,b in bl['pictures']);bd=n/24;bl['timelineRange']=[cursor,cursor+bd]
        for a,b in bl['pictures']:pics.append((a,b))
        if bl['audio']=='original-whitelist-window':add_audio(p,bl['audioStart'],bl['audioStart']+bd,cursor,bl['node'],'existing-NPC-original-cut')
        elif bl['node']:
            v=dict(path=new_state['file'],sha256=new_state['sha256'],duration=new_state['duration']) if bl['audio']=='seed-audio1-reference' else voices[bl['node']]
            if bl['delay']+v['duration']>bd:raise ValueError('Voice does not fit '+bl['node'])
            add_audio(v['path'],0,v['duration'],cursor+bl['delay'],bl['node'],'seed-audio1-actual-uploaded-role-reference' if bl['audio']=='seed-audio1-reference' else 'authorized-existing-player-WAV')
        elif fid=='V40' and bl is blocks[-1]:
            for node,delay in [('CH2-LY12A-011',.35),('CH2-LY12A-012',2.15),('CH2-LY12A-013',4.9)]:
                v=voices[node];add_audio(v['path'],0,v['duration'],cursor+delay,node,'authorized-existing-player-WAV')
        cursor+=bd
    peak=float(np.max(np.abs(audio)));scale=.94/peak if peak>.94 else 1
    audio*=scale
    wav=OUT/(fid+'-speech-only-'+version+'.wav')
    with wave.open(str(wav),'wb') as w:w.setparams((1,2,48000,0,'NONE','not compressed'));w.writeframes((np.clip(audio,-1,1)*32767).astype('<i2').tobytes())
    dest=OUT/(fid+'-纯台词短版-'+version+'.mp4');filters=[];labels=[];pic_opts=[bl.get('crop') for bl in blocks for _ in bl['pictures']]
    for i,(a,b) in enumerate(pics):
        crop=pic_opts[i];crop_filter=f'crop={crop[2]}:{crop[3]}:{crop[0]}:{crop[1]},' if crop else ''
        filters.append(f'[0:v]trim=start_frame={a}:end_frame={b},{crop_filter}scale=1280:720,setsar=1,settb=1/24000,setpts=N*1000[v{i}]');labels.append(f'[v{i}]')
    filters.append(''.join(labels)+f'concat=n={len(labels)}:v=1:a=0,settb=1/24000,setpts=N*1000[v]')
    subprocess.run([FF,'-v','error','-y','-threads','2','-i',str(p),'-i',str(wav),'-filter_complex',';'.join(filters),'-filter_complex_threads','2','-map','[v]','-map','1:a','-c:v','libx264','-threads','2','-crf','18','-preset','fast','-pix_fmt','yuv420p','-r','24','-fps_mode','cfr','-video_track_timescale','24000','-c:a','aac','-ar','48000','-b:a','192k','-movflags','+faststart',str(dest)],check=True)
    track=inspect(dest);assert track['fullVideoTrack'] and track['videoFrames']==total
    r=dict(id=fid,path=str(dest),sha256=hashlib.sha256(dest.read_bytes()).hexdigest(),oldPath=str(p),oldSHA=f['sha256'],oldDuration=f['duration'],duration=track['containerDuration'],removedSeconds=f['duration']-track['containerDuration'],videoTrack=track,edl=blocks,audioTracks=audioRecords,mixPeakBefore=peak,mixScale=scale,newVideoRequests=0,newAudioRequests=int(new_state is not None),newVoiceState=str(OUT/'CH2-E4-LATE-002-R1-seed-audio-state.json') if new_state else None,originalBaseAudioRemovedExceptWhitelistWindows=True,whitelistCoverage=sorted(set(x['node'] for x in audioRecords)),listening='pending; ASR and engineering checks cannot establish hearing or absence of BGM',reviewState='candidate-do-not-adopt-yet',userApproved=False)
    (OUT/(fid+'-candidate.json')).write_text(json.dumps(r,ensure_ascii=False,indent=2),encoding='utf-8');results.append(r)
    print(json.dumps({k:r[k] for k in ['id','path','sha256','oldDuration','duration','removedSeconds']},ensure_ascii=False),flush=True)
all_results=[json.loads(p.read_text(encoding='utf-8')) for p in OUT.glob('V*-candidate.json')]
(OUT/'candidate-manifest.json').write_text(json.dumps(all_results,ensure_ascii=False,indent=2),encoding='utf-8')
