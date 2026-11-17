from pathlib import Path
import json,datetime
OUT=Path(__file__).parent
p=json.loads((OUT/'plan.json').read_text(encoding='utf-8-sig'));d=json.loads((OUT/'review/decisions.json').read_text(encoding='utf-8-sig'))
lines={l['node']:l['text'] for c in p['clips'] for l in c['sourceLines']};order={c['id']:i for i,c in enumerate(p['clips'])};where={l['node']:c['id'] for c in p['clips'] for l in c['sourceLines']}
layers=[]
for c in p['clips']:
    if c['kind']=='document':
        l=c['sourceLines'][0];layers.append(dict(clip=c['id'],type='current-source-acquisition',sourceNodes=[l['node']],text=l['text'],firstVisibleSeconds=2.8 if c['id']=='V18-06' else 2,authority='冻结稿当前文书正文；没有添加数值',integration='仅在本镜实际操作及准确正文展示后授予此节点，前序不能提前读；不新增朗读'))
for id,spec in [('V16C-02',dict(nodes=['CH2-LY04-D01','CH2-LY04-D02'],texts=['本队签收：列明批次、经手人、应交粮数和实际收到的粮数。','出仓交付：记有交给本队的实粮数；欠交的部分列在缺额栏。'],start=2.1)),('V20-05',dict(nodes=['CH2-LY06-015'],texts=['本村追加粮尚未征齐，实收不足，无法按原数交付。'],start=0))]:
    for n,text in zip(spec['nodes'],spec['texts']):assert lines[n]==text and order[where[n]]<order[id]
    layers.append(dict(clip=id,type='previously-acquired-revisit',sourceNodes=spec['nodes'],texts=spec['texts'],firstVisibleSeconds=spec['start'],integration='只回看已取得正文，不授新证物、不得把口头反馈变新书面证据'))
for id in ['V20-07','V20-08']:
    spec=d[id]['knownTextPanel'];n=spec['sourceNode'];assert lines[n]==spec['text'] and order[where[n]]<order[id]
    layers.append(dict(clip=id,type='previously-acquired-revisit',sourceNodes=[n],texts=[spec['text']],firstVisibleSeconds=spec['start'],integration='旧材料回看；V20-07受杖前时间来自019的当下口述，V20-08当天未补足来自021的当下口述，不能从旧D04重新授予当天仓账证据'))
for id,nodes,start in [('V16A-01',['CH2-LY04-D01','CH2-LY04-D02'],2.1),('V16C-01',['CH2-LY04-D01','CH2-LY04-D02'],2.1),('V18-05',['CH2-LY04-D05'],1.2),('V19A-01',['CH2-LY04-D06'],1.2),('V19B-01',['CH2-LY04-D06'],1.2)]:
    for n in nodes:assert order[where[n]]<order[id]
    layers.append(dict(clip=id,type='previously-acquired-revisit',sourceNodes=nodes,texts=[lines[n] for n in nodes],firstVisibleSeconds=start,integration='只回看该入口之前已经取得的正文；不新增文书、不提前显示下一问题答案'))
r=dict(updatedUtc=datetime.datetime.now(datetime.timezone.utc).isoformat(),exactSourceTextMatch=True,previouslyAcquiredOrderChecked=True,noInventedNumbers=True,noNewConfessionOrSignatureAction=True,layers=layers,userApproved=False)
(OUT/'review/evidence-layer-provenance.json').write_text(json.dumps(r,ensure_ascii=False,indent=2),encoding='utf-8');print('Evidence layers exact source and chronology',len(layers))
