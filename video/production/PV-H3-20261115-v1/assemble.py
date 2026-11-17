from pathlib import Path
import json,subprocess,html,hashlib,datetime,sys
from PIL import Image,ImageOps,ImageDraw,ImageFont

OUT=Path(__file__).resolve().parent
FF=Path(r'D:/AI视频/VJ-1106/motion-runtime/node_modules/ffmpeg-static/ffmpeg.exe')
FP=Path(r'D:/AI视频/VJ-1106/motion-runtime/node_modules/ffprobe-static/bin/win32/x64/ffprobe.exe')
plan=json.loads((OUT/'production-plan.json').read_text('utf-8'))
def read(p,default=None):return json.loads(p.read_text('utf-8-sig')) if p.exists() else default
def run(args,**kwargs):return subprocess.run(list(map(str,args)),capture_output=True,check=True,**kwargs)
def make_title():
    title=OUT/'title.mp4';(OUT/'title.txt').write_text('逆转五丈原','utf-8')
    if not title.exists():
        vf="drawtext=fontfile='C\\:/Windows/Fonts/msyh.ttc':textfile='title.txt':fontcolor=0xDDD8C9:fontsize=70:x=(w-tw)/2:y=(h-th)/2"
        run([FF,'-v','error','-n','-f','lavfi','-i','color=c=black:s=1280x720:r=24:d=4','-vf',vf,'-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-an','-movflags','+faststart',title],cwd=OUT,timeout=100)
    return title
def write_review():
    e=html.escape;cards=[]
    frame_notes=read(OUT/'frame-review-notes.json',{}).get('units',{})
    for u in plan['units']:
        d=OUT/u['id'];s=read(d/'state.json',{});status=s.get('status','prepared')
        active=Path(s.get('active_directory') or d)
        source=Path(s.get('active_source_file') or d/'source.mp4');selected=Path(s.get('selected_file') or d/'selected.mp4');technical=read(active/'technical.json',{}).get('checks',{})
        if source.exists() or selected.exists():
            poster=Path(s.get('poster_file') or d/'end-selected.png')
            poster_url=poster.relative_to(OUT).as_posix() if poster.exists() else ''
            selected_url=selected.relative_to(OUT).as_posix()
            video=f'<video controls preload="metadata" poster="{poster_url}" src="{selected_url}"></video>' if selected.exists() else f'<video controls preload="metadata" src="{source.relative_to(OUT).as_posix()}"></video>'
            links=(f'<a href="{source.relative_to(OUT).as_posix()}">采用版本原片</a> · ' if source.exists() else '')+f'<a href="{u["id"]}/prompt.txt">原Prompt</a>'
            if (d/'contact.jpg').exists():links+=f' · <a href="{u["id"]}/contact.jpg">2fps抽帧</a>'
            if u['id']=='G09':links+=' · <a href="G09/fallback-edit.json">3秒替代剪辑记录</a>'
            if source!=d/'source.mp4' and (d/'source.mp4').exists():links+=f' · <a href="{u["id"]}/source.mp4">旧版原片</a>'
            if u['id']=='G11' and (OUT/'G11B/source.mp4').exists():links+=' · <a href="G11B/source.mp4">坠马补镜原片</a>'
        else:video=f'<div class="pending">{e(status)}</div>';links=f'<a href="{u["id"]}/prompt.txt">Prompt</a>'
        motion=frame_notes.get(u['id'],{}).get('notes') or read(d/'review.json',{}).get('notes',[])
        note='；'.join(motion) or '动态内容等待人工审阅'
        label={'downloaded':'已生成，待review','edited_from_existing':'替代剪辑，待review'}.get(status,status)
        title='战况蒙太奇（替代剪辑）' if u['id']=='G09' else u['title']
        spec='替代剪辑1280×720／24fps，无独立原片' if u['id']=='G09' else f'原生{technical.get("native_width","—")}×{technical.get("native_height","—")}／{technical.get("native_fps","—")}fps'
        cards.append(f'<article><h2>{u["id"]} {e(title)}</h2>{video}<p>剪辑采用{u["edit_duration"]}秒 · {e(label)}</p><p>原分镜 {e("、".join(u["source_shots"]))} · {spec}</p><p>{e(note)}</p><p>{links}</p></article>')
    final=OUT/'开篇PV-H3-v1-108秒-无声动态审阅.mp4'
    hero='<h2>完整108秒工作剪辑</h2><video class="hero" controls preload="metadata" src="'+final.name+'"></video>' if final.exists() else '<p class="notice">完整工作剪辑将在25条素材均下载后合成；这里不会用静态图或重复镜头补空缺。</p>'
    page='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>开篇PV H3视频审阅</title><style>*{box-sizing:border-box}body{margin:0;background:#f6f5f1;color:#252b27;font:16px/1.7 "Microsoft YaHei",sans-serif}main{max-width:1400px;margin:auto;padding:35px 28px 70px}h1{font-size:29px}h2{font-size:20px;margin:8px 0 15px}p{color:#59605b}a{color:#355c53;text-underline-offset:3px}.links{display:flex;gap:24px;margin:15px 0 25px;flex-wrap:wrap}.notice{background:white;padding:14px 18px;border-left:3px solid #9d784c}video{display:block;width:100%;background:#141914;aspect-ratio:16/9}.hero{max-width:1100px;margin-bottom:28px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}article{padding:20px;background:#fff;border:1px solid #dde1d9;border-radius:8px}article p{font-size:14px}.pending{height:220px;display:grid;place-items:center;background:#e9ece5;color:#65705f}@media(max-width:750px){main{padding:22px 15px}.grid{grid-template-columns:1fr}h1{font-size:24px}}</style><main><p>2026年11月15日 · v1 · 用户审核待定</p><h1>逆转五丈原 开篇PV 动态审阅</h1><p class="notice">MiniMax-H3素材按无声使用。本页预览不含配音、环境音或BGM；原生原片单独保留。技术检查、抽帧动作检查与用户通过分别记录。</p><div class="links"><a href="制作单.md">25条制作单</a><a href="production-plan.json">镜头与参数记录</a><a href="../PV-opening-20261114/开篇PV-导演修订稿-v1.md">108秒导演稿</a></div>'''+hero+'<h2>逐条原片与采用片段</h2><section class="grid">'+''.join(cards)+'</section></main></html>'
    (OUT/'视频审阅.html').write_text(page,'utf-8')
    return final

def assemble():
    final=write_review()
    title=make_title()
    if (OUT/'G24-25-v2/plan.json').exists() and not (OUT/'G24-25-v2/integration.json').exists():
        print(json.dumps({'assembly':'waiting','reason':'第一视角修订尚未审看并接入，不用旧第三人称结尾生成整片。'},ensure_ascii=False));return
    missing=[u['id'] for u in plan['units'] if not Path(read(OUT/u['id']/'state.json',{}).get('selected_file') or OUT/u['id']/'selected.mp4').exists()]
    if missing:print(json.dumps({'assembly':'waiting','missing':missing},ensure_ascii=False));return
    files=[Path(read(OUT/u['id']/'state.json',{}).get('selected_file') or OUT/u['id']/'selected.mp4') for u in plan['units']]+[title]
    (OUT/'concat-list.txt').write_text('\n'.join("file '"+p.as_posix().replace("'","'\\''")+"'" for p in files)+'\n','utf-8')
    if '--rebuild' in sys.argv and final.exists():
        history=(OUT/'render-history').resolve();history.relative_to(OUT.resolve());history.mkdir(exist_ok=True)
        digest=hashlib.sha256(final.read_bytes()).hexdigest()[:12]
        backup=history/f'before-full-frame-reframe-{digest}.mp4'
        final.rename(backup)
    if not final.exists():
        run([FF,'-v','error','-n','-f','concat','-safe','0','-i',OUT/'concat-list.txt','-c:v','copy','-an','-movflags','+faststart',final],timeout=180)
    run([FF,'-v','error','-i',final,'-f','null','-'],timeout=240)
    meta=json.loads(run([FP,'-v','error','-show_streams','-show_format','-of','json',final],timeout=45).stdout)
    video=next(s for s in meta['streams'] if s['codec_type']=='video')
    actual=float(meta['format']['duration']);assert abs(actual-108)<0.08
    assert video['width']==1280 and video['height']==720 and video['avg_frame_rate']=='24/1'
    assert not any(s['codec_type']=='audio' for s in meta['streams'])
    meta['checks']={'full_decode':'pass','edit_duration':108,'actual_duration':actual,'user_review':'待review','audio':'无声工作版，未制作配音和音效','scaling_note':'原生素材多数1344×768，中心裁为16:9并缩至工作版1280×720；G10去除模型内嵌黑边、G20为面部局部重新构图后放大，见各自reframe-record.json。不宣称原生1080p或更高。','sha256':hashlib.sha256(final.read_bytes()).hexdigest()}
    (OUT/'final-technical.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),'utf-8')
    t=0;edl=[]
    for u in plan['units']:
        state=read(OUT/u['id']/'state.json',{})
        segments=state.get('selection_recipe') or [{'source':str(OUT/u['id']/'source.mp4'),'in':0,'out':u['edit_duration'],'speed':1}]
        edl.append({'unit':u['id'],'selected_file':state.get('selected_file'),'source_segments':segments,'timeline_in':t,'timeline_out':t+u['edit_duration']});t+=u['edit_duration']
    edl.append({'unit':'TITLE','timeline_in':104,'timeline_out':108,'file':str(title)})
    (OUT/'edit-timeline.json').write_text(json.dumps(edl,ensure_ascii=False,indent=2),'utf-8')
    write_review();print(json.dumps({'assembly':'complete','file':str(final),'duration':actual,'frames':video.get('nb_frames')},ensure_ascii=False))

if __name__=='__main__':assemble()
