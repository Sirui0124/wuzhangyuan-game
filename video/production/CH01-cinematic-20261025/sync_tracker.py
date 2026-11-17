from pathlib import Path
import json,subprocess,sys,html
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).parent
CLI='C:/Users/zhousirui/AppData/Local/npm-cache/_npx/cca705bd6109e4e4/node_modules/@larksuite/cli/bin/lark-cli.exe'
COMMON=['--spreadsheet-token','P639srOPdhDTifttjZfcP7kVnXg','--sheet-id','8e7b02']
def save(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2),encoding='utf-8')
def call(args):
    r=subprocess.run([CLI,*args,'--as','user'],cwd=ROOT,capture_output=True,text=True,encoding='utf-8')
    if r.returncode:raise RuntimeError((r.stderr or r.stdout)[:1000])
    d=json.loads(r.stdout);assert d.get('ok'),d;return d['data']
def sheet():
    d=call(['sheets','+cells-get',*COMMON,'--range','A1:K5','--include','value']);assert not d['has_more'];return d['ranges'][0]
mode=sys.argv[1];before=sheet();save(OUT/'audit'/f'tracker-{mode}-before.json',before)
cols=before['col_indices'];headers=[x.get('value') for x in before['cells'][0]];writes=[]
runNote='2026-10-25｜用户明确要求重做并生成：新开场OP01灯与急报15秒＋OP02掀帘灭灯6秒＋OP03手机与错过12秒＋OP04离开许愿12秒，总45秒。实际模型MiniMax-H3，核心参考18项见source-art/core/assets.json。当前本地独立Prompt在video/production/CH01-cinematic-20261025；旧在线Prompt保留历史，不能再直接提交。固定对白补片同时制作；任务编号、原请求、原片和16:9微裁记录逐条落盘。生成与自查不代替用户review。'
delivery=OUT/'integration.json'
for i,cells in enumerate(before['cells'][1:],1):
    vals=[x.get('value','') for x in cells];id=vals[0]
    if id not in ['PR01-A','PR01-B','PR01-C','PR01-D/E/F']:continue
    row=before['row_indices'][i]
    feedback=vals[headers.index('处理反馈')]
    if '2026-10-25｜用户明确要求重做并生成' not in feedback:feedback+='\n'+runNote
    changes={'处理反馈':feedback,'prompt状态':'待更新','当前状态':'待更新'}
    if mode=='delivery' and delivery.exists():
        integ=json.loads(delivery.read_text(encoding='utf-8'));changes['当前状态']='待review'
        changes['最新版视频路径']=integ['openingFile']
        old=vals[headers.index('最新版视频路径')];history=vals[headers.index('历史视频素材')]
        if old and old not in history:changes['历史视频素材']=history+'\n2026-10-25替换前：'+old
        changes['处理反馈']+='\n2026-10-25｜新片已下载、微裁至1344×756、整理并接入；成片路径见最新版视频路径。Prompt状态待更新专指本行旧在线正文尚未重建；实际生成输入以本地逐条request快照为准。成片仍待人工review。'
    for label,v in changes.items():writes.append({'range':cols[headers.index(label)]+str(row),'cells':[[{'value':v}]]})
fresh=sheet();assert [[c.get('value','') for c in r] for r in fresh['cells']]==[[c.get('value','') for c in r] for r in before['cells']],'Concurrent tracker change'
p=OUT/'audit'/f'tracker-{mode}-writes.json';save(p,writes)
call(['sheets','+cells-set',*COMMON,'--writes','@'+p.relative_to(ROOT).as_posix()])
after=sheet();save(OUT/'audit'/f'tracker-{mode}-after.json',after)
for w in writes:
    import re
    m=re.fullmatch(r'([A-Z]+)(\d+)',w['range']);actual=after['cells'][after['row_indices'].index(int(m[2]))][after['col_indices'].index(m[1])].get('value','');assert actual==w['cells'][0][0]['value'],w['range']
print('Tracker values guarded, updated and read-back verified:',len(writes))
if mode=='start':
    sources=json.loads((ROOT/'video/production/PR01-direction-20261023/production.json').read_text(encoding='utf-8'))
    for row in sources:
        token=row['cloud_prompt'];d=call(['docs','+fetch','--doc',token,'--detail','full']);save(OUT/'audit'/(row['id']+'-guard.json'),d)
        if '20261025_LOCAL_REPLACEMENT' in d['document']['content']:continue
        content='<p>20261025_LOCAL_REPLACEMENT｜本页为历史稿，停止用于新提交。用户已要求重新设计并实际生成；当前独立请求、参考图和生成记录位于本地 C:/Users/zhousirui/Documents/ChatGPT/逆转五丈原/video/production/CH01-cinematic-20261025/。本页历史图文与意见保留，模型及时长以新请求快照为准。新成片待review。</p>'
        p=OUT/'audit'/(row['id']+'-deprecation.xml');p.write_text(content,encoding='utf-8')
        call(['docs','+update','--doc',token,'--command','block_insert_after','--block-id','0','--revision-id',str(d['document']['revision_id']),'--content','@'+p.relative_to(ROOT).as_posix()])
        after=call(['docs','+fetch','--doc',token,'--detail','full']);assert '20261025_LOCAL_REPLACEMENT' in after['document']['content'];save(OUT/'audit'/(row['id']+'-historical.json'),after)
    print('4 previous online prompts clearly marked historical; current local requests remain independent.')
