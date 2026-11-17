"""Free, versioned local repairs. Never mutates generated originals or other groups."""
from pathlib import Path
import sys, subprocess, hashlib, shutil
from PIL import Image,ImageEnhance
OUT=Path(__file__).parent;sys.path.insert(0,str(OUT))
from run_pipeline import FF,read,save,metadata
from paper_composite import process,interp
from assemble import assemble

def raw(name):return OUT/'generated'/f'{name}-16x9.mp4'
def compose(name,parts,audio,duration=None):
    dest=OUT/'edited/sources'/f'{name}.mp4';ins=[];filters=[];total=0
    for n,p in enumerate(parts):
        src=p.get('file') or raw(p['source']);ins+=['-i',str(src)]
        a,b=p['range'];speed=p.get('speed',1);total+=(b-a)/speed
        spatial='scale=1280:720,'
        if p.get('crop'):
            x,y,w,h=p['crop'];spatial+=f'crop={w}:{h}:{x}:{y},'
        filters.append(f'[{n}:v]trim=start={a}:end={b},setpts=(PTS-STARTPTS)/{speed},{spatial}scale=1280:720,setsar=1,fps=24[v{n}]')
    total=duration or total;labels=''.join(f'[v{n}]' for n in range(len(parts)))
    hold=max(0,round(total-sum((p['range'][1]-p['range'][0])/p.get('speed',1) for p in parts),6))
    filters.append(labels+f'concat=n={len(parts)}:v=1:a=0,tpad=stop_mode=clone:stop_duration={hold:.6f}[v]')
    ins+=['-i',str(audio)];filters.append(f'[{len(parts)}:a]apad,atrim=duration={total},asetpts=PTS-STARTPTS[a]')
    if not dest.exists():
        temp=dest.with_name(dest.stem+'.pending.mp4')
        subprocess.run([str(FF),'-v','error','-y']+ins+['-filter_complex',';'.join(filters),'-map','[v]','-map','[a]','-t',str(total),'-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-ar','48000','-ac','2','-movflags','+faststart',str(temp)],check=True)
        subprocess.run([str(FF),'-v','error','-i',str(temp),'-f','null','NUL'],check=True);temp.replace(dest)
    save(dest.with_suffix('.json'),dict(id=name,parts=[{**p,'file':str(p['file'])} if p.get('file') else p for p in parts],audioSource=str(audio),duration=metadata(dest)['duration'],newPaidRequest=False,loop=False,holdOnlyUnderReadingPanel=duration is not None,sha256=hashlib.sha256(dest.read_bytes()).hexdigest(),reviewState='pending-current-SHA-motion-review'))
    return dest

def adopt(d,id,name,file,reason,post=None):
    dec=d[id];dec.pop('trim',None);dec.pop('spatialCrop',None)
    dec.update(sourceId=name,sourceFile=str(file.resolve()),visualReview='candidate-pass-with-limits',visualIssues=reason,dynamicReview='新局部版待当前SHA动态复核',reuse=dict(newPaidRequest=False,loop=False,recipe=str(file.with_suffix('.json').resolve())))
    if post is not None:dec['postOverride']=post

def liyan():
    d=read(OUT/'review/decisions.json')
    specs=[('V34-01','V34-01-C6-clean-response',[
        dict(source='V34-01',range=[0,2.35],crop=[100,0,1050,590],speed=.85),
        dict(source='V34-03',range=[0,5.35],crop=[150,0,976,550],speed=.79),
        dict(source='V34-02',range=[6.8,9.35],crop=[420,0,800,450]),
        dict(source='V34-01',range=[12,15.08],crop=[170,0,976,550])]),
      ('V34-02','V34-02-C5-clean-response',[
        dict(source='V34-02',range=[6.8,9],crop=[420,0,800,450]),
        dict(source='V34-01',range=[10,10.85],crop=[170,0,976,550]),
        dict(source='V34-03',range=[0,5.35],crop=[150,0,976,550],speed=.98),
        dict(source='V34-01',range=[12,15.08],crop=[170,0,976,550])])]
    for id,name,parts in specs:
        file=compose(name,parts,raw(id));adopt(d,id,name,file,['同场李严读信/回应清理版，裁去遮挡与原生字幕/伪字；同场回应素材跨句复用，不循环','完整原句音轨保留；临时口型与声音不一致单列音频；裁后不把看不到的纸卷放稳当动作证据'],[])
    def grip(im,t):
        x,y=interp(t,[(10.2,[865,190]),(10.6,[805,255]),(11,[770,300]),(12,[750,320]),(12.25,[750,320])])
        return im.crop((int(x),int(y),int(x)+320,int(y)+180)).resize((1280,720),Image.Resampling.LANCZOS)
    macro=OUT/'edited/sources/V34-04-C2-received-edge.mp4'
    if not macro.exists():process('V34-04-C2-received-edge','V34-04',10.2,12.25,grip,'真实接收者手握纸包边缘，跟随裁幅排除纸面所有伪字；非字卡替代交接')
    name='V34-04-C3-write-handoff';file=compose(name,[
        dict(source='V34-04',range=[4.3,6.85],crop=[390,450,340,192]),
        dict(source='V34-04',range=[6.85,8.3],crop=[330,0,800,450]),
        dict(source='V34-04',range=[8.3,10.15]),
        dict(file=macro,range=[0,2.05])],raw('V34-04'),duration=9.4)
    adopt(d,'V34-04',name,file,['实际落笔/提笔、取件、递出及接收者握住纸边均保留；不同角度以剪辑省略整理材料，未伪称一镜到底','署名字形仅作为签署动作，准确李严姓名/标题由冻结源阅读层说明；微距裁幅偏软，不再放大'],[dict(text='李严\n更正粮情、本人责任说明',start=7.9,end=9.4,fullFrame=True)])
    save(OUT/'review/decisions.json',d);assemble([c for c in read(OUT/'plan.json')['clips'] if c['slot']=='V34'])

def happy():
    source=Path('C:/Users/zhousirui/Documents/ChatGPT/逆转五丈原/video/production/ENDINGS-20261025/chapter-two/revision-v2/generated/E1-GOUAN-HAPPY-V2-clean.mp4')
    assert hashlib.sha256(source.read_bytes()).hexdigest()=='8629d5e0000e45493ffcb035743395f54e9f1e24bc2555e2a65fd7d9735825f7'
    file=compose('V37-02-C2-happy-gouan',[dict(file=source,range=[0,8])],raw('V37-02-R2'))
    d=read(OUT/'review/decisions.json');adopt(d,'V37-02','V37-02-C2-happy-gouan',file,['按用户最新快乐要求只读复用ENDINGS同SHA完整8秒；笑着招呼后转身，空车与普通粮兵装束保留','未动ENDINGS源/60秒版/配音；原苟安搭手台词音轨保留，临时口型只列音频；未新增玩家正脸'],[])
    save(OUT/'review/decisions.json',d);assemble([c for c in read(OUT/'plan.json')['clips'] if c['slot']=='V37'])

def writing():
    def macro(im,t):
        x,y=interp(t,[(2.5,[540,400]),(2.8,[540,385]),(3.5,[535,330]),(4.5,[540,315])])
        im=im.crop((int(x),int(y),int(x)+320,int(y)+180)).resize((1280,720),Image.Resampling.LANCZOS)
        im=ImageEnhance.Brightness(im).enhance(.78);r,g,b=im.split();b=ImageEnhance.Brightness(b).enhance(.86)
        return Image.merge('RGB',(r,g,b))
    detail=OUT/'edited/sources/V32A-06-C2-write-detail.mp4'
    if not detail.exists():process('V32A-06-C2-write-detail','V32A-06',2.5,4.5,macro,'仅笔尖、手和纸边的真实书写微距；排除日光帐景/侧面全身，轻降亮度统一夜帐纸面；局部墨迹不作为可读事实')
    file=compose('V32A-06-C3-write-reading',[dict(file=detail,range=[0,2])],raw('V32A-06'),duration=14.38)
    d=read(OUT/'review/decisions.json');post=d['V32A-06']['postOverride'];post[0].update(start=2,end=8.5);post[1].update(start=8.5,end=14.38)
    adopt(d,'V32A-06','V32A-06-C3-write-reading',file,['修正33.65秒后的日间侧视突变：只留真实笔尖/手/纸边微距，排除人物侧身、日光背景及旁人；局部书写为两秒连续动作，不循环','纸上残留局部墨迹不作可读事实；精确交代全文沿冻结阅读层；微距偏软，不再放大；未借用后续划线/署名动作充当前面的写交代'],post)
    save(OUT/'review/decisions.json',d);assemble([c for c in read(OUT/'plan.json')['clips'] if c['slot']=='V32A'])

def trim_push():
    d=read(OUT/'review/decisions.json');d['V37-03']['trim']=[2,metadata(raw('V37-03'))['duration']]
    d['V37-03']['visualIssues']=['切去重复回头/转身0–2秒，承接快乐镜转身后我靠近搭手；保留实际双人接触空车横木与推行','未新增玩家正脸；车轮越辙未入画，不把隐含动作声当画面证明']
    save(OUT/'review/decisions.json',d);assemble([c for c in read(OUT/'plan.json')['clips'] if c['slot']=='V37'])

def received_papers():
    def crop_scene(im,t):
        x,y,w,h=interp(t,[(0,[384,210,896,504]),(2.5,[190,210,896,504]),(3.5,[190,210,896,504]),(4.25,[0,0,1280,720]),(8,[0,0,1280,720])])
        return im.crop((int(x),int(y),int(x+w),int(y+h))).resize((1280,720),Image.Resampling.LANCZOS)
    clean=OUT/'edited/sources/V35-R2-C1-paper-actions.mp4'
    if not clean.exists():process('V35-R2-C1-paper-actions','V35-R2-clean',0,8,crop_scene,'纸边微距排除首段窗外/书架，仅同一粗木案、麻袖、纸背；随后自然回到两纸放稳俯视，保留每次接触/松手')
    d=read(OUT/'review/decisions.json')
    file=OUT/'edited/sources/V35-01-C2-return-complete.mp4'
    adopt(d,'V35-01','V35-01-C2-return-complete',file,['完整复用V33 0–8.2秒倒放画面，回信纸包从囊取出、我接触、信使完全松手并退开，未倒放声音','同一纸包在我手中保持，之后才展开核阅；不是视频结束自动收件确认'],[])
    file=compose('V35-02-C2-clean-reply',[dict(file=clean,range=[0,2.65])],raw('V35-R2-clean'),duration=11.1)
    adopt(d,'V35-02','V35-02-C2-clean-reply',file,['独立补镜的回信真实展开/放稳0–2.65秒；无伪字、无脸，局部机位只见右手与纸边，不伪造全景伤帐','随后的精确文书阅读层沿冻结源保留，不新增朗读、事实或提交动作；静态只在阅读层下'],[dict(text='此次粮乏，应据实请退。',start=2.65,end=6.85,fullFrame=True),dict(text='日后是否再战，留待另议。',start=6.85,end=11.1,fullFrame=True)])
    file=compose('V35-03-C2-two-attachments',[dict(file=clean,range=[2.65,8])],raw('V35-R2-clean'),duration=16.23)
    adopt(d,'V35-03','V35-03-C2-two-attachments',file,['新8秒源的后5.35秒实际取出两张独立附件、左右分开、各自触案并松手，非通用旧卷假充','背面无字，不能当成可读署名证明；准确粮情/责任全文保留冻结阅读层；未交给军吏或提前结案'],[dict(text='种粮、口粮各需多少，现粮能撑多久，当一并核明。',start=5.35,end=10.15,fullFrame=True),dict(text='隐瞒粮情和商议行险的事，我会如实交代。借魏之计就此作罢。',start=10.15,end=16.23,fullFrame=True)])
    save(OUT/'review/decisions.json',d);assemble([c for c in read(OUT/'plan.json')['clips'] if c['slot']=='V35'])

if __name__=='__main__':
    if sys.argv[1]=='liyan':liyan()
    elif sys.argv[1]=='happy':happy()
    elif sys.argv[1]=='writing':writing()
    elif sys.argv[1]=='trim-push':trim_push()
    elif sys.argv[1]=='received-papers':received_papers()
