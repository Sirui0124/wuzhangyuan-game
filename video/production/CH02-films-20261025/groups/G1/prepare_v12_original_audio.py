from user_repair import *
old=Path(snapshot['V12']['file']);rows=[]
for node,a,b,text in [
 ('CH2-LY03-023',15.85,23.78,'就是这批。记录上写的那天之前，粮早就备好了，是李严扣着不发。'),
 ('CH2-LY03-024',29.9,33.1,'凭这个能领本队材料，别拿着它乱闯。')]:
 p=D/f'{node}-保留原片正常原句.wav'
 run(['-ss',a,'-to',b,'-i',old,'-vn','-ar','48000','-ac','1','-c:a','pcm_s16le',p])
 rows.append(dict(node=node,text=text,path=str(p),sha256=sha(p),source=str(old),sourceSha256=snapshot['V12']['sha256'],sourceRange=[a,b],duration=dur(p),verification='原片指定正常原句区间；ASR仅定位，未冒称实际听审'))
save(D/'V12-original-audio-keeps.json',dict(rows=rows,excludedMetaRanges=[[0,3.48],[6.42,15.85],[23.78,29.9],[33.1,36.13]],excludedReason='排除角色标签、动作说明、重复叮嘱、旁白错读和不完整心声。'))
r=rd(reportpath)
if not any(x['node']=='CH2-LY03-021' for x in r['neededReferenceAudioLines']):r['neededReferenceAudioLines'].append(dict(node='CH2-LY03-021',role='苟安',text='好，我先不走。',slot='V12',sourceInterval=[0,9.44],requestedModel='Seed-Audio1.0',status='waiting-approved-reference-audio-flow',doNotUse='quarantined preset TTS2',reason='原片含角色标签/重复片语，缺少一条完整精确原句；023/024保留原有正常句，025复用既有中央心声。'))
x=next(x for x in r['comments'] if x['id']=='V12');x['unresolved']=['真实纸背交付/指示替换待生成核验。','好，我先不走。需要正确Seed-Audio1.0参考音色原句，等待样本实际听审；不采用隔离预置音。'];x['preparedAudio']=str(D/'V12-original-audio-keeps.json')
save(reportpath,r)
print('V12 proper original quotes isolated; no new audio generation')
