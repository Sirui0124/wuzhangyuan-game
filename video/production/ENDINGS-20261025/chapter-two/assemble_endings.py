"""Assemble review-only ending films from owners' verified delivery manifests.

Does not generate, change group assets, advance game state or claim approval.
Only adopts a file if its digest matches its owning manifest at build time.
"""
from pathlib import Path
import hashlib
import html
import json
import re
import subprocess
import time
import argparse

ROOT=Path(__file__).resolve().parent
GROUPS=ROOT.parents[1]/'CH02-films-20261025/groups'
FF=Path('C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe')
DEFS=[
 ('E1','一起回头',['V36','V37','V42'],'两人承担责任，苟安留下做粮兵；我与他推着空车归去，粮荒仍未解决。'),
 ('E2','救下眼前的人',['V38'],'个人补报已经收下，苟安留营候查；其他责任仍待查明。'),
 ('E3','真相到了，人没回来',['V39','V40','V42'],'实际收件、查办与裁处之后，留下空铺、空粮车和未能补上的缺口。'),
 ('E4-early','认下来的罪·早停查',['V41E'],'听到认罪便停下追查，未问明背后商议。'),
 ('E4-late','认下来的罪·晚支撑不足',['V39','V41L'],'已听过李严参与，但几处细节支撑不足；案上仍压着苟安的认罪。'),
 ('E5','还是走上了险路',['V43'],'先实际让路放行，再推进时间，交代赴魏与谣言回营的后果。')
]
ENTRY={
 'E1':'UI-E1-FILE已确认；双方停手及全部附件已齐；V36实际核收和裁处完成后进入归途。',
 'E2':'Q假且UI-E2-FILE已确认；苟安停手署名已发生；V38承载个人补报核收和留营候查。',
 'E3':'UI-CASE已确认且锁定Q真；先V39实际收件，再V40查办裁处，最后V42。',
 'E4-early':'普通②B听认罪后UI-EARLY-FILE已明确确认；尚未问出合谋。',
 'E4-late':'UI-CASE已确认且锁定Q假；先V39实际收件，再V41L支撑不足收束。',
 'E5':'UI-RELEASE已确认；V43先实际放行，再叙述后果。'
}
def read(p): return json.loads(p.read_text(encoding='utf-8-sig'))
def digest(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def ff(args): return subprocess.run([str(FF),'-hide_banner','-nostdin',*args],capture_output=True,text=True,encoding='utf-8',errors='replace')
def video_coverage(path,expected):
    p=ff(['-v','error','-i',str(path),'-map','0:v:0','-an','-fps_mode','passthrough','-progress','pipe:1','-nostats','-f','null','-'])
    times=re.findall(r'^out_time_us=(-?\d+)$',p.stdout,re.M)
    frames=re.findall(r'^frame=(\d+)$',p.stdout,re.M)
    seconds=int(times[-1])/1e6 if times else 0
    count=int(frames[-1]) if frames else 0
    if p.returncode or p.stderr.strip() or abs(seconds-expected)>0.75 or count<expected*24*.95:
        raise RuntimeError(f'Incomplete video track: {path.name}: {count} frames, {seconds:.3f}s video vs {expected:.3f}s container. '+p.stderr[-400:])
    return {'videoSeconds':round(seconds,3),'decodedFrames':count,'expectedSeconds':expected,'passed':True}
def dump(p,value):
    tmp=p.with_suffix('.tmp')
    tmp.write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf-8')
    tmp.replace(p)

def main(only=None):
    if (ROOT/'assembly-policy.json').exists():
        raise RuntimeError('User-directed edited revision is active. Use cut_revision_v2.py; do not restore legacy full-length compilation or attach V42 automatically.')
    for folder in ['films','review','snapshots']: (ROOT/folder).mkdir(exist_ok=True)
    registry={}
    for group in ['G5','G6']:
        source=GROUPS/group/'delivery.json'
        data=read(source)
        dump(ROOT/'snapshots'/f'{group}-delivery.json',data)
        for row in data.get('films',data.get('assembled',[])):
            registry[row['id']]={**row,'owner':group}
    previous=read(ROOT/'delivery.json') if (ROOT/'delivery.json').exists() else {}
    holds=read(ROOT/'review-holds.json') if (ROOT/'review-holds.json').exists() else {}
    prev={x['id']:x for x in previous.get('films',[])}
    repairs=read(ROOT/'local-source-repairs.json') if (ROOT/'local-source-repairs.json').exists() else {}
    for slot,repair in repairs.items():
        if not repair.get('enabled',False):
            continue
        if slot not in registry:
            original=Path(repair['originalPath'])
            if original.is_file() and digest(original)==repair['supersedesSha256']:
                registry[slot]=repair['baseSource']
        if slot in registry and registry[slot].get('sha256')==repair['supersedesSha256']:
            registry[slot]={**registry[slot],**repair,'decode':'passed'}
    results=[]
    for ident,title,slots,description in DEFS:
        if only and ident not in only:
            kept=prev.get(ident)
            if not kept or not kept.get('path') or digest(Path(kept['path']))!=kept.get('sha256'):
                raise RuntimeError('Cannot preserve an unverified existing candidate: '+ident)
            results.append(kept)
            print(ident,'preserved without refresh',flush=True)
            continue
        row={'id':ident,'title':title,'description':description,'slots':slots,'entryPrerequisite':ENTRY[ident],'artifactType':'fixed-route-review-compilation','executesGameState':False,'userApproved':False,'gameIntegrated':False,'audioReview':'未逐字听审；保留现有采用版本声音','status':'waiting-for-owner'}
        selected=[]
        missing=[]
        audio_notes=[]
        for slot in slots:
            source=registry.get(slot)
            if not source:
                missing.append(slot+': no owning delivery yet')
                continue
            path=Path(source.get('path') or source.get('file') or '')
            if not path.is_file() or source.get('decode')!='passed' or not source.get('sha256'):
                missing.append(slot+': missing verified file/hash')
                continue
            actual=digest(path)
            if actual!=source['sha256']:
                missing.append(slot+': file changed since manifest; await owner update')
                continue
            if holds.get(slot,{}).get('sha256')==actual:
                missing.append(slot+': '+holds[slot]['reason'])
                continue
            selected.append({'slot':slot,'owner':source['owner'],'path':str(path),'sha256':actual,'duration':source.get('duration',source.get('metadata',{}).get('duration'))})
            audio_notes.extend(source.get('audioIssues',[]))
            for part in source.get('adopted',source.get('sources',[])):
                audio_notes.extend(part.get('audioIssues',[]))
        if missing:
            row['missing']=missing
            results.append(row)
            print(ident,'waiting:', '; '.join(missing),flush=True)
            continue
        row['sources']=selected
        row['sourceAudioNotes']=list(dict.fromkeys(audio_notes))
        elapsed=0.0
        for source in selected:
            source['start']=round(elapsed,3)
            elapsed+=source['duration']
            source['end']=round(elapsed,3)
        def content_signature(items):
            return hashlib.sha256(json.dumps([(x['slot'],x['path'],x['sha256']) for x in items],ensure_ascii=False).encode()).hexdigest()
        signature=content_signature(selected)
        target=ROOT/'films'/f'{ident}-{title}.mp4'
        old=prev.get(ident,{})
        if old.get('sources') and content_signature(old['sources'])==signature and target.is_file() and old.get('sha256')==digest(target):
            old.update(entryPrerequisite=ENTRY[ident],artifactType='fixed-route-review-compilation',executesGameState=False)
            old['sourceAudioNotes']=row['sourceAudioNotes']
            old['sources']=selected
            old['sourceSignature']=signature
            old['sourceDuration']=sum(x['duration'] for x in selected)
            old['duration']=round(old['duration'],2)
            if not old.get('videoCoverage',{}).get('passed'):
                old['videoCoverage']=video_coverage(target,old['duration'])
            results.append(old)
            print(ident,'unchanged verified candidate',flush=True)
            continue
        concat=ROOT/'snapshots'/f'{ident}-concat.txt'
        concat.write_text('\n'.join("file '"+Path(x['path']).as_posix().replace("'","'\\''")+"'" for x in selected),encoding='utf-8')
        temp=target.with_suffix('.building.mp4')
        if len(selected)==1:
            process=ff(['-i',selected[0]['path'],'-map','0:v:0','-map','0:a:0?','-c','copy','-movflags','+faststart','-y',str(temp)])
        else:
            # The independently repaired owner files can have different stream
            # time bases. Reset each input before concatenating; do not stream
            # copy across those boundaries.
            args=['-filter_complex_threads','1']
            filters=[]
            for i,source in enumerate(selected):
                args+=['-i',source['path']]
                filters.append(f'[{i}:v:0]setpts=PTS-STARTPTS,fps=24,scale=1280:720,setsar=1,format=yuv420p[v{i}]')
                filters.append(f'[{i}:a:0]aresample=48000,asetpts=PTS-STARTPTS,aformat=channel_layouts=stereo[a{i}]')
            filters.append(''.join(f'[v{i}][a{i}]' for i in range(len(selected)))+f'concat=n={len(selected)}:v=1:a=1[v][a]')
            args+=['-filter_complex',';'.join(filters),'-map','[v]','-map','[a]','-c:v','libx264','-threads','2','-preset','fast','-crf','18','-r','24','-c:a','aac','-ar','48000','-b:a','192k','-movflags','+faststart','-y',str(temp)]
            process=ff(args)
        if process.returncode: raise RuntimeError(process.stderr[-2000:])
        if any(digest(Path(x['path']))!=x['sha256'] for x in selected):
            row['missing']=['owning files changed during build; candidate not adopted']
            results.append(row)
            continue
        meta=ff(['-i',str(temp)])
        decoded=ff(['-v','error','-i',str(temp),'-f','null','-'])
        if decoded.returncode or decoded.stderr.strip(): raise RuntimeError(decoded.stderr[-2000:])
        match=re.search(r'Duration: (\d+):(\d+):(\d+\.\d+)',meta.stderr)
        duration=round(int(match[1])*3600+int(match[2])*60+float(match[3]),2) if match else None
        expected=sum(x['duration'] for x in selected)
        if duration is None or abs(duration-expected)>0.6: raise RuntimeError(f'{ident}: duration does not preserve sources')
        coverage=video_coverage(temp,duration)
        temp.replace(target)
        samples=ROOT/'review'/f'{ident}-overview.jpg'
        sample=ff(['-i',str(target),'-vf',f'fps=12/{duration},scale=320:180,tile=4x3','-frames:v','1','-q:v','2','-y',str(samples)])
        if sample.returncode: raise RuntimeError(sample.stderr[-1000:])
        row.update(status='review-candidate',path=str(target),sha256=digest(target),duration=duration,decode='passed',sourceSignature=signature,overview=str(samples),visualReview='原组检查继承；本合成待连接点复核',sourceDuration=expected)
        row['videoCoverage']=coverage
        joins=[]
        for source in selected[:-1]:
            for offset in [-0.25,0.25]:
                t=source['end']+offset
                frame=ROOT/'review'/f'{ident}-join-{source["slot"]}-{offset:+.2f}.jpg'
                sampled=ff(['-ss',str(t),'-i',str(target),'-frames:v','1','-q:v','2','-y',str(frame)])
                if sampled.returncode: raise RuntimeError(sampled.stderr[-1000:])
                joins.append({'time':round(t,3),'path':str(frame)})
        row['joinFrames']=joins
        results.append(row)
        print(ident,duration,'seconds; decode passed',flush=True)
    output={'updatedEpoch':time.time(),'scope':'5 endings, 6 versions; review-only assembly','complete':all(x['status']=='review-candidate' for x in results),'films':results,'userApproved':False,'gameIntegrated':False}
    dump(ROOT/'delivery.json',output)
    cards=[]
    for row in results:
        media='<p class="pending">原制作任务正在补齐</p>'
        if row.get('path'):
            path=Path(row['path']).relative_to(ROOT).as_posix()
            media=f'<video controls preload="metadata" src="{html.escape(path)}"></video>'
        cards.append(f'<article>{media}<div><h2>{html.escape(row["title"])}</h2><p>{html.escape(row["description"])}</p><small>'+('候选片 · 待审阅' if row.get('path') else '制作中')+'</small></div></article>')
    page='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>第二章结局审片</title><style>*{box-sizing:border-box}body{margin:0;background:#171b1b;color:#ece9df;font:16px/1.7 system-ui,"Microsoft YaHei",sans-serif}main{max-width:1360px;margin:auto;padding:32px}h1,h2{font-weight:500}h1{margin-bottom:8px}.intro,small{color:#b9beb2}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px;margin-top:28px}article{background:#252b2b;border:1px solid #414841;border-radius:10px;overflow:hidden}video{display:block;width:100%;aspect-ratio:16/9;background:#080b0b}article>div{padding:20px}h2{margin:0 0 12px;font-size:23px}p{margin:0 0 12px}.pending{padding:70px 20px;text-align:center;color:#b9beb2}@media(max-width:800px){main{padding:20px}.grid{grid-template-columns:1fr}}</style><main><h1>第二章 · 结局审片</h1><p class="intro">五种结局，六个版本。每个版本连续播放对应的完整收束。影片待审阅，声音尚未完成听审，未接入游戏。</p><section class="grid">'''+''.join(cards)+'''</section></main></html>'''
    page=page.replace('五种结局，六个版本。每个版本连续播放对应的完整收束。','五种结局，六个版本。固定路线审片合辑，连续播放各自结局；游戏仍保留逐段播放与确认操作。')
    page=page.replace('影片待审阅，声音尚未完成听审，未接入游戏。','画面候选待审阅；部分心声、旁白尚待混入，声音待统一处理。未接入游戏。')
    page=page.replace('<h1>第二章', '<nav><a style="color:#dac18c" href="../审片.html">第一章候选</a></nav><h1>第二章')
    (ROOT/'审片.html').write_text(page,encoding='utf-8')
    notes=['# 第二章结局影片交付','', '五种结局、六个版本，均为固定路线审片合辑。仅使用原制作任务已落盘并与交付哈希一致的采用文件。每段完整保留；未生成新声音，未改变游戏状态。播放结束不执行收件、确认或裁处状态。', '', '| 版本 | 当前候选 | 完整时长 |', '| --- | --- | --- |']
    for row in results:
        link='制作中'
        if row.get('path'): link='[播放]('+Path(row['path']).as_posix()+')'
        notes.append('| '+row['title']+' | '+link+' | '+(str(row.get('duration','—'))+' 秒' if row.get('duration') else '—')+' |')
    notes+=['', '## 完整片内的段落顺序', '']
    for row in results:
        notes.append('### '+row['title'])
        notes.append('')
        notes.append(row['description'])
        notes.append('')
        notes.append('入口前提：'+row['entryPrerequisite'])
        notes.append('')
        for source in row.get('sources',[]):
            notes.append('- '+str(source['start'])+'–'+str(source['end'])+' 秒：['+source['slot']+' 独立片]('+Path(source['path']).as_posix()+')；来源 '+source['owner']+'。')
        if row.get('missing'): notes.append('待原制作任务完成并更新交付记录：'+'；'.join(row['missing']))
        notes.append('')
    notes += ['## 检查范围','', '完整文件解码与时长保留检查已通过的影片才进入候选列表。总览抽帧和连接点采样另存review目录；抽帧不等于逐帧动态审片或逐字听审。部分心声/旁白尚待混入，原声音的错词、口型、音色与音乐仍须统一处理。未标用户通过、未接入游戏。', '', '共同旧卷只连接E1与E3；E4早晚分开。合成片用于连续审阅，不改变游戏逐段播放与交互边界。']
    (ROOT/'第二章结局交付.md').write_text('\n'.join(notes)+'\n',encoding='utf-8')
    print('Complete:',output['complete'],flush=True)

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--only',nargs='+',choices=[row[0] for row in DEFS])
    main(parser.parse_args().only)
