from pathlib import Path
import json, re, hashlib

ROOT=Path(__file__).resolve().parents[4]
OUT=Path(__file__).resolve().parents[1]
manifest=json.loads((OUT/'交付映射.json').read_text('utf-8'))
source=json.loads((OUT/'audit/source-handoff.json').read_text('utf-8-sig'))
original={s['id']:s for s in source['segments']}
whitelist=json.loads((OUT/'逐镜对白白名单.json').read_text('utf-8'))
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
checks=[]
for s in manifest['segments']:
    sid=s['id']; p=Path(s['promptPath']); t=p.read_text('utf-8'); old=original[sid]
    assert sha(s['sourcePrompt'])==s['sourceSha256'], (sid,'source changed')
    assert t.splitlines()[:4]==['尺寸：16:9','模型：seedance2.5','声音：有声音',f'时长：{s["seconds"]}秒'],sid
    assert 20<=s['seconds']<=30
    assert '{{' not in t and '}}' not in t
    assert s['entry'] in t and s['end'] in t
    refs=re.findall(r'本地路径：`([^`]+)`',t)
    assert refs==[Path(r['path']).as_posix() for r in s['references']],(sid,'order')
    for i,r in enumerate(s['references'],1):
        assert i==r['index'] and Path(r['path']).is_file()
        assert sha(r['path'])==sha(r['sourcePath'])==r['sha256']
    ms=list(re.finditer(r'### 分镜(\d+)｜([\d.]+)-([\d.]+)秒',t))
    assert len(ms)==len(old['shots']); end=0
    for i,(m,q) in enumerate(zip(ms,old['shots'])):
        key=(sid,i+1)
        assert int(m[1])==i+1 and float(m[2])==end==q['startSeconds'],(key,'start')
        end=float(m[3]); assert end==q['endSeconds'],(key,'end')
        b=t[m.end():ms[i+1].start() if i+1<len(ms) else t.index('### 全片约束')]
        a=re.search(r'唯一允许发声的原句：(.*)',b)[1]
        expected=q['ttsText']; assert q['onlyAllowedSpokenSentence']==expected
        assert (a==f'“{expected}”') if expected else a.startswith('无：'),(key,'dialogue mismatch')
        for field in ['参考图关系：','画面与动作：','摄影与切点：','声音执行（仅为控制说明，不朗读）：']:
            assert field in b,(key,field)
        relation=re.search('参考图关系：[^\n]*',b)[0]
        assert set(map(int,re.findall(r'图片(\d+)',relation)))==set(range(1,len(refs)+1)),(key,'refs')
        ctrl=re.search('声音执行（仅为控制说明，不朗读）：[^\n]*',b)[0]
        if q['speaker']=='我':
            assert '唯一画内口型承担者：无' in ctrl and '嘴唇自然合拢' in ctrl,(key,'player voice')
        elif q['speaker']=='我（心声）': assert 'NPC听不见' in ctrl
        elif q['speaker']=='无': assert '不发声' in ctrl and '完整说完' not in ctrl
        else: assert f'唯一口型承担者：{q["speaker"]}' in ctrl
        w=next(w for w in whitelist if w['segmentId']==sid and w['shot']==i+1)
        assert w['text']==expected
        assert q['listenerReactionAndAction'] in b and q['camera'] in b,(key,'action changed')
        assert '。；' not in relation and '。。' not in relation
    assert end==s['seconds']
    assert t.index('拍摄手法参考：')<t.rindex('声音要求：')
    assert not re.search(r'\n#+ ',t[t.rindex('声音要求：'):])
    assert all(x in t for x in ['无BGM','无背景音乐','无配乐','绝不生成局部方框模糊'])
    checks.append({'id':sid,'seconds':s['seconds'],'shots':len(ms),'dialogueExact':True,'pathsAndOrder':True,'sha256':sha(p)})
assert sha(ROOT/'outputs/ch2-review-20261026/prompt-handoff.json')==manifest['sourceHandoffSha256']
assert (OUT/'01-台词单独审阅.md').read_bytes()==Path(source['authoritativeFiles']['dialogue']).read_bytes()
review={'status':'passed-document-checks','prompts':len(checks),'shots':len(whitelist),'spokenLines':sum(bool(w['text']) for w in whitelist),'silentShots':sum(not w['text'] for w in whitelist),'imageCopies':sum(len(s['references']) for s in manifest['segments']),'uniqueImages':len(set(r['sha256'] for s in manifest['segments'] for r in s['references'])),'checks':checks,'referenceVisualReview':'已查看原9图联系表及夜间苟安实际图；55份复制图逐字节SHA校验与来源相同。','collaborationRevision':38,'collaborationDifference':'本地末句多一条“已同步revision38并回读”开发记录，规则正文一致；保留本地注记，不覆盖。','sourceUnchanged':True,'userApproved':False,'videoGenerated':False,'actualAudioListening':False,'actualVoiceTimingTrial':False,'limitations':['文档时长与分镜时间连续，不代表实际生成语速或口型合格。','所有新台词仍待用户审核。','C03无专门画卷首帧，图像为材质/空间参考，未宣称首帧已制作。']}
(OUT/'audit/validation.json').write_text(json.dumps(review,ensure_ascii=False,indent=2)+'\n','utf-8')
p=OUT/'00-交付清单.md'
t=p.read_text('utf-8').replace('61个镜头的发声白名单（以核验记录实际统计为准）','61个镜头的发声白名单（60条发声、1镜静默）')
p.write_text(t,'utf-8')
for p in [OUT/'00-交付清单.md',OUT/'03-参考图上传清单.md']:
    for link in re.findall(r'\]\(<([^>]+)>\)',p.read_text('utf-8')):
        if not link.startswith('http'): assert Path(link).exists(),link
print(json.dumps({k:review[k] for k in ['status','prompts','shots','spokenLines','silentShots','imageCopies','uniqueImages','sourceUnchanged']},ensure_ascii=False))
