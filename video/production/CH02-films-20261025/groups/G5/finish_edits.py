from pathlib import Path
import sys,subprocess,json,copy,shutil
OUT=Path(__file__).parent;sys.path.insert(0,str(OUT))
from run_pipeline import FF,read,save,metadata

def compose(id,parts,audio_id,reason):
    dest=OUT/'edited/sources'/f'{id}.mp4'
    inputs=[];filters=[];labels=[];duration=0
    for n,p in enumerate(parts):
        inputs+=['-i',str(OUT/'generated'/f'{p["source"]}-16x9.mp4')]
        crop=p.get('crop');spatial=f'crop={crop[2]}:{crop[3]}:{crop[0]}:{crop[1]},' if crop else ''
        speed=p.get('speed',1);duration+=(p['end']-p['start'])/speed
        filters.append(f'[{n}:v]trim=start={p["start"]}:end={p["end"]},setpts=(PTS-STARTPTS)/{speed},{spatial}scale=1280:720,setsar=1,fps=24[v{n}]');labels.append(f'[v{n}]')
    n=len(parts);filters.append(''.join(labels)+f'concat=n={n}:v=1:a=0[v]')
    inputs+=['-i',str(OUT/'generated'/f'{audio_id}-16x9.mp4')]
    filters.append(f'[{n}:a]apad,atrim=duration={duration},asetpts=PTS-STARTPTS[a]')
    subprocess.run([str(FF),'-v','error','-y']+inputs+['-filter_complex',';'.join(filters),'-map','[v]','-map','[a]','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-ar','48000','-ac','2','-movflags','+faststart',str(dest)],check=True)
    save(dest.with_suffix('.json'),dict(id=id,parts=parts,audioSource=audio_id,reason=reason,duration=duration,newPaidRequest=False,loop=False,audioListening='未逐字听审',metadata=metadata(dest)))
    print(id,round(duration,3),flush=True)
    return dest

def invalidate(ids):
    archive=OUT/'edited/pre-duration-repair';archive.mkdir(exist_ok=True)
    for id in ids:
        for ext in ['.mp4','.json']:
            p=OUT/'edited'/f'{id}-final{ext}'
            if p.exists():p.replace(archive/p.name)
    for slot in set(x.split('-')[0] for x in ids):
        p=OUT/'assembled'/f'{slot}.mp4'
        if p.exists():p.replace(archive/p.name)

if __name__=='__main__':
    d=read(OUT/'review/decisions.json')
    targets={
      'V32A-03-C2':('V32A-03',[dict(source='V32A-03',start=5.5,end=8,speed=.85),dict(source='V32A-04-R2',start=1.5,end=6.7,crop=[200,400,632,356],speed=.85)],'保留原句完整8秒音轨，面部回应后接本场案面观察；两段各使用一次，无短循环'),
      'V32A-05-C2':('V32A-05',[dict(source='V32A-05',start=0,end=3.38,speed=.85),dict(source='V32A-04-R2',start=0,end=3.5,crop=[200,400,632,356],speed=.85)],'取纸动作后接同场案面，保留8秒原音轨及气口；不再用3.38秒承担整句'),
      'V34-01-C2':('V34-01',[dict(source='V34-01',start=0,end=2.45,crop=[112,0,1120,630],speed=.85),dict(source='V34-02',start=0,end=7.5,crop=[112,0,1120,630]),dict(source='V34-01',start=9.72,end=10.94,crop=[112,0,1120,630]),dict(source='V34-01',start=11.43,end=15.08,crop=[112,0,1120,630])],'读信与李严回应之间接本场信使观察位，保留原15秒完整声音；说明污染仍仅记音频问题'),
      'V36-04-C2':('V36-04',[dict(source='V36-02',start=0,end=3.5,crop=[112,0,1120,630]),dict(source='V36-04',start=7.5,end=12.25,speed=.85)],'同场军吏核阅案面后接清楚宣读；原声全句5.26–12.06保留需音轨前移，画面约9秒留足自然气口')
    }
    changed=[]
    for new,(parent,parts,reason) in targets.items():
        dest=compose(new,parts,parent,reason)
        # V36 original first 5.26 seconds contain no prescribed sentence; keep the full sentence with margins.
        if parent=='V36-04':
            tmp=dest.with_name(dest.stem+'-audio.mp4')
            subprocess.run([str(FF),'-v','error','-y','-i',str(dest),'-ss','4.5','-i',str(OUT/'generated/V36-04-16x9.mp4'),'-map','0:v','-map','1:a','-c:v','copy','-af','apad','-t',str(metadata(dest)['duration']),'-c:a','aac','-ar','48000','-ac','2',str(tmp)],check=True);tmp.replace(dest)
        dec=d[parent];dec.pop('trim',None);dec.pop('spatialCrop',None)
        dec.update(sourceId=new,sourceFile=str(dest.resolve()),visualReview='candidate-pass-with-limits',visualIssues=[reason,'重新合成版待整V动态复核；原声未逐字听审'],reuse=dict(newPaidRequest=False,loop=False,sourceRecipe=str(dest.with_suffix('.json').resolve())),dialogueTiming=dict(requiredText=''.join(x['text'] for x in next(c for c in read(OUT/'plan.json')['clips'] if c['id']==parent)['generatedSpokenLines']),visualDuration=metadata(dest)['duration'],sourceAudioPreserved=True,asrIsAuxiliary=True,listening='未逐字听审'))
        changed.append(parent)
    # The six-character line fits 2.8 seconds and the first full rendition is retained.
    d['V32A-02']['dialogueTiming']=dict(text='那就把纸铺开。',hanCharacters=6,visualDuration=2.8,asrLocatedFullFirstRendition=[0,2.1],listening='未逐字听审')
    for id,source in [('V37-02','V37-02-R2'),('V37-03','V37-03'),('V42-01','V42-01'),('V42-03','V42-03')]:
        d[id]=dict(sourceId=source,visualReview='candidate-pass-with-limits',visualIssues=['已复核全时段4fps序列，待连续动态审','结局允许第三人称/背影，未新增玩家正脸']+(['纸面仅作旧记录纹理，不作为精确数字/文字证据'] if id.startswith('V42') else []),audioIssues=['未逐字听审；音频问题独立留后期'],dynamicReview='pending')
    d['V37-03']['visualIssues'].append('本版用背后双人推车兑现搭手；车轮越辙未入画，未把隐含动作声当画面证据')
    invalidate(changed);save(OUT/'review/decisions.json',d)
