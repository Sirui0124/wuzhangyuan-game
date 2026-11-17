from picture_repair import O,P,F,rd,wr,run,dur,voice,assemble,cut
import hashlib
old=rd(O/'assembled/V05-assembly.json')
obs=old['subclips'][0]['path'];face=old['subclips'][1]['path'];record=old['subclips'][2]['path'];v=voice['CH2-LY02-012']
on=dur(obs)-v['duration']-.35;newobs=P/'V05-observation-player.mp4'
run(['-i',obs,'-i',v['path'],'-filter_complex',f'[1:a]adelay={round(on*1000)}:all=1,apad,atrim=duration={dur(obs)}[a]','-map','0:v','-map','[a]','-c:v','copy','-c:a','aac','-ar','48000',str(newobs)])
# Ask while observing the camp, then turn to the clerk for his own permission.
fc=cut(face,'V05-clerk-own-permission',.5,1.8);newface=P/'V05-clerk-permission-voiced.mp4'
run(['-i',fc['path'],'-i',old['path'],'-filter_complex','[1:a]atrim=start=13.89:end=14.77,asetpts=PTS-STARTPTS,adelay=100:all=1,apad,atrim=duration=1.3[a]','-map','0:v','-map','[a]','-c:v','copy','-c:a','aac','-ar','48000',str(newface)])
fc['path']=str(newface);fc['method']='管事出镜仅承载其自己的允许，不承载我的请求。'
soft=P/'V05-record-softened.mp4';run(['-i',record,'-vf','gblur=sigma=5','-c:v','libx264','-crf','18','-preset','fast','-c:a','copy',str(soft)])
parts=[dict(id='V05-observation-player',path=str(newobs),sourcePath=obs,sourceSha256=hashlib.sha256(open(obs,'rb').read()).hexdigest(),centralVoiceCues=[dict(node='CH2-LY02-012',speaker='我',text=v['text'],centralPath=v['path'],centralSha256=v['sha256'],slotStart=on,slotEnd=on+v['duration'])],method='营地观察最后阶段我的画外请求，人物无近景代说；观察源不循环/重复。'),fc,dict(id='V05-record-after-permission',path=str(soft),sourcePath=record,sourceSha256=hashlib.sha256(open(record,'rb').read()).hexdigest(),centralVoiceCues=[],method='只在允许之后看桌上原件；文字进一步散焦，不采信图中文字。')]
a=assemble('V05',parts);print(a['path'],a['duration'])
