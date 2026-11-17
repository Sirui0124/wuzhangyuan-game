from pathlib import Path
import sys,subprocess
OUT=Path(__file__).parent;sys.path.insert(0,str(OUT))
from run_pipeline import FF,read,save,metadata

def pad(id,src,start,end):
    source=OUT/'edited/sources'/f'{src}.mp4';dest=OUT/'edited/sources'/f'{id}.mp4';duration=metadata(source)['duration']+start+end
    subprocess.run([str(FF),'-v','error','-y','-i',str(source),'-filter_complex',f'[0:v]tpad=start_mode=clone:start_duration={start}:stop_mode=clone:stop_duration={end}[v];[0:a]adelay={int(start*1000)}:all=1,apad,atrim=duration={duration}[a]','-map','[v]','-map','[a]','-t',str(duration),'-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-r','24','-c:a','aac','-ar','48000','-ac','2','-movflags','+faststart',str(dest)],check=True)
    save(dest.with_suffix('.json'),dict(id=id,source=str(source.resolve()),startDocumentHold=start,endDocumentHold=end,liveActionLoop=False,newPaidRequest=False,metadata=metadata(dest)))
    return dest

if __name__=='__main__':
    receipt=pad('V36-01-C4-receipt','V36-01-C3-paper-focus',0,3)
    cross=pad('V32A-07-C4-crossout','V32A-07-C3-crossout-composite',2.5,1.5)
    d=read(OUT/'review/decisions.json')
    for id,source in [('V32A-01','V32A-listener-C1'),('V32A-04','V32A-04-C2')]:
        dec=d[id];dec.pop('trim',None)
        dec.update(sourceId=source,sourceFile=str((OUT/'edited/sources'/f'{source}.mp4').resolve()),visualReview='candidate-pass-with-limits',visualIssues=['本组既有夜帐镜头裁成闭口面部与案面观察，替换日间半趴借片；同一身份/衣着/空间/灯火','面部闭口段与无嘴案面段分镜补接，未把开口原段当闭口；无短循环'],reuse=dict(newPaidRequest=False,source='V32A-04-R2 known succeeded task; no recovery or repost of unknown V32A-01',recipe=str((OUT/'edited/sources'/f'{source}.json').resolve())),dynamicReview='全时段4fps序列已复核，最终V待复看')
    d['V36-01'].update(sourceId='V36-01-C4-receipt',sourceFile=str(receipt.resolve()),visualReview='candidate-pass-with-limits',postOverride=[dict(text='原信\n查粮材料\n苟安、李严各自的补充说明',start=4.8,end=7.8,fullFrame=True)],visualIssues=['保留首叠材料实际接触、放稳与松手；错误生成字作局部柔焦，效果可见，未伪称纸面已可精确阅读','放稳后准确材料名称为后期插入，尚未提前确认收齐/结案；其后V36-02才宣布收齐'],reuse=dict(newPaidRequest=False,sourceRange=[0,4.8],hold='末3秒静态文书插入，不循环交接动作'))
    d['V32A-07'].update(sourceId='V32A-07-R2 + C4 composite',sourceFile=str(cross.resolve()),visualReview='review-candidate-with-issues',postOverride=[dict(text='若仍不听便赴魏',start=0,end=2.5,fullFrame=True),dict(text='若仍不听便赴魏\n\n苟安',start=7.4,end=9.62,fullFrame=True,strike=True,strikeLine=0)],visualIssues=['R2拍到横划、提笔、下方署名及放下手；准确撤回条款后期配准于实际横划轨迹，未冒充模型准确手写','上方旧错误字擦除仍有残迹，合成文字与纸面透视/署名字形仍需画面精修；未宣称全视觉通过'],reuse=dict(newPaidRequest=False,paidRepairTask='task_3EvIHe3Ddwdhin1uxLFICucERTF1fWb4',sourceRange=[3.8,9.42],exactGlyphs='postproduction composite',unknownOriginalUntouched=True),dynamicReview='全时段4fps序列已复核，最终V待复看')
    save(OUT/'review/decisions.json',d)
    print('Night listener and free paper composites selected; every previous delivered file retained')
