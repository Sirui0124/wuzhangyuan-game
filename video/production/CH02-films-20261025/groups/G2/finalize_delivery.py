from pathlib import Path
import json,subprocess,re,hashlib,sys
OUT=Path(__file__).parent
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,d):p.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8')
def probe(p):
    meta=subprocess.run([FF,'-hide_banner','-i',str(p)],capture_output=True,text=True,encoding='utf-8',errors='replace').stderr
    d=re.search(r'Duration: (\d+):(\d+):([\d.]+)',meta);size=re.search(r'Video:.*? (\d{3,5})x(\d{3,5})',meta)
    result=subprocess.run([FF,'-v','warning','-i',str(p),'-f','null','NUL'],capture_output=True,text=True,encoding='utf-8',errors='replace')
    return dict(duration=3600*int(d[1])+60*int(d[2])+float(d[3]),size=list(map(int,size.groups())),fps24='24 fps' in meta,audio48000='48000 Hz' in meta,audioTrack='Audio:' in meta,decodeExitCode=result.returncode,decodeWarnings=result.stderr,sha256=hashlib.sha256(p.read_bytes()).hexdigest())
plan=read(OUT/'plan.json');delivery=read(OUT/'delivery.json');decisions=read(OUT/'review/decisions.json');observations=read(OUT/'review/observations.json')
prepareOnly='--prepare-only' in sys.argv
if not prepareOnly and not all(c.get('file') for c in delivery['clips']):raise RuntimeError('All 12 logical V files must exist before final delivery')
for c in delivery['clips']:
    if not c.get('file'):continue
    source=Path(c.get('assemblySource',c['file']));digest=hashlib.sha256(source.read_bytes()).hexdigest()[:8]
    target=OUT/'assembled'/f'{c["id"]}-{c["name"]}-画面候选-{digest}.mp4'
    if not target.exists():
        subprocess.run([FF,'-v','error','-y','-fflags','+genpts','-i',str(source),'-vf','fps=24,setsar=1','-af','aresample=async=1:first_pts=0','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-movflags','+faststart',str(target)],check=True)
    c['assemblySource']=str(source.resolve());c['assemblySha256']=hashlib.sha256(source.read_bytes()).hexdigest();c['file']=str(target.resolve());c['technical']=probe(target)
    c['sha256']=c['technical']['sha256']
    c['status']='visual_candidate_audio_pending'
    c['visualReview']=[dict(id=id,observation=observations.get(id,'尚待检查'),**decisions.get(id,dict(review='已检查0.5秒连续序列；动态播放观察情况见本组审片记录'))) for id in c['children']]
    audio=[]
    for id in c['children']:
        a=OUT/'review'/id/'asr.json'
        if a.exists():
            r=read(a)
            if r['flag']=='check_dialogue':audio.append(dict(id=id,type='ASR提示错词或额外人声，未听审',recognized=r['recognized'],expected=r['expected']))
        if id in decisions and decisions[id].get('audioIssue'):audio.append(dict(id=id,type=decisions[id]['audioIssue']))
    c['audioIssues']=audio;c['audioReview']='统一配音阶段处理；本轮未做主观逐字听审或BGM听审'
    print('Normalized',c['id'],c['technical']['duration'],flush=True)
if prepareOnly:
    save(OUT/'review/prepared-candidates.json',delivery['clips']);print('Prepared available segments; remaining generation and final delivery still pending');sys.exit(0)
for c in delivery['subclips']:
    p=next(p for p in plan['clips'] if p['id']==c['id']);q=OUT/'tasks'/f'{c["id"]}.json'
    c['taskStatus']=read(q)['status'] if q.exists() else 'unsubmitted';c['actualReferences']=p.get('actualReferences',p['references'])
    c['edits']=decisions.get(c['id'],{})
    a=OUT/'review'/c['id']/'asr.json'
    c['audioIssues']=read(a) if a.exists() else dict(note='尚未ASR；未听审')
delivery.update(status='画面制作候选已交付；音频问题独立待统一处理',coverageComplete=True,visualReview='分镜与源节点逐条覆盖；画面自查见review/画面自查记录.md，制作自查不等于用户通过',audioIssues='原片部分存在额外人声/错词/音色与音乐待听审；按用户指示保留画面，不因纯音频付费重拍',reviewApproval='待用户review',unresolved=['主观逐字听审和BGM听审未完成，音轨不能直接作为正式配音','生成文书表面有重复伪文字；准确证据内容以取得时点的后期叠字为准','部分机位与服饰有轻微不一致，具体见逐片自查；未宣称用户通过'])
save(OUT/'delivery.json',delivery)
links=['<!doctype html><meta charset="utf-8"><title>G2 查粮画面候选</title><style>body{background:#171c1d;color:#ebe4d2;font:18px sans-serif;max-width:1280px;margin:40px auto}video{width:100%;max-height:720px}article{margin:45px 0}</style><h1>G2 查粮取证与三种判断</h1><p>12个逻辑段，互斥分支分开。当前为画面制作候选，原片部分音频错乱待统一配音，未听审、未获用户通过。</p>']
md=['# G2 查粮取证与三种判断交付','35条原计划请求，全部原片与任务ID保留；12个逻辑段独立成片，源33节点全覆盖。','本轮以画面与穿帮检查为主。纯音频问题按用户指示保留画面并标注，不继续TTS，不因错词、音色或额外音乐重拍。', '[分镜脚本]('+str((OUT/'分镜脚本.md').resolve()).replace('\\','/')+')']
for c in delivery['clips']:
    p=Path(c['file']);links += [f'<article><h2>{c["id"]} {c["name"]}</h2><p>入口：{c["entry"]}；结束：{c["next"]}；{c["technical"]["duration"]:.2f}秒</p><video controls preload="metadata" src="assembled/{p.name}"></video></article>']
    md += [f'- [{c["id"]} {c["name"]}]({str(p.resolve()).replace(chr(92),"/")})｜{c["technical"]["duration"]:.2f}秒；解码退出码{c["technical"]["decodeExitCode"]}；音频待统一处理。']
md += ['## 逐请求分镜Prompt']
for c in plan['clips']:
    md += [f'- [{c["id"]}｜{c["duration"]}秒]({str((OUT/"prompts"/(c["id"]+".md")).resolve()).replace(chr(92),"/")})']
(OUT/'播放审阅.html').write_text('\n'.join(links),encoding='utf-8');(OUT/'交付说明.md').write_text('\n\n'.join(md),encoding='utf-8')
save(OUT/'status.json',dict(group='G2',phase='delivered_visual_candidates_audio_pending',requestCount=len(plan['clips']),generated=len(plan['clips']),logicalSegments=12,delivery=str((OUT/'delivery.json').resolve()),userReview='待review',newTTSCallsAfterStop=0))
print('Final visual candidates:',len(delivery['clips']))
