"""Current user repairs; immutable cuts, no overlays, freeze or repeated padding."""
from user_review_render import *
P=read(O/'plan.json')
def part(id,a,b,crop=None,new=False):
    x=dict(range=[a,b])
    if new:x['file']=str((R/'generated'/(id+'.mp4')).resolve())
    else:x['source']=id
    if crop:x['crop']=crop
    return x
def latest(id):
    return read(sorted((R/'candidates').glob(id+'-*.json'),key=lambda p:p.stat().st_mtime)[-1])
def voice(id):return next(c for c in P['clips'] if c['id']==id)['voice']['path']
def add(id,parts,audio=None,nodes=None,**extra):
    c=dict(id=id,parts=parts,audio=audio,sourceNodes=nodes or [],**extra)
    recipe=read(R/'clean-recipes.json');recipe['clips']=[x for x in recipe['clips'] if x['id']!=id]+[c];save(R/'clean-recipes.json',recipe)
    return render(c)
def join(id,ids):
    ms=[latest(x) for x in ids]
    return add(id,[dict(file=m['file'],range=[0,m['videoSeconds']]) for m in ms],audioMode='parts',nodes=[s['node'] for c in P['clips'] if c['parent']==id for s in c['sourceLines']],childIds=ids)
def docs():
    # Each short contact is a separate acquisition, in source order. Backs do not claim readable body.
    add('V15-D01',[part('UR-DOC-ABC-R1',0,1.45,new=True)],nodes=['CH2-LY04-D01'])
    add('V15-D02',[part('UR-LEDGER-DE-R2',0,2.8,new=True)],nodes=['CH2-LY04-D02'])
    add('V15-D03',[part('UR-LEDGER-DE-R2',5.55,7.65,new=True)],nodes=['CH2-LY04-D03'])
    join('V15',['V15-intro','V15-D01','V15-D02','V15-D03'])
    add('V18-D04',[part('UR-LEDGER-DE-R2',0,2.8,new=True)],nodes=['CH2-LY04-D04'])
    add('V18-W01',[part('UR-LEDGER-DE-R2',2.8,5.15,new=True),part('V15-01',0,2.8)],audio=dict(file=voice('V18-03'),offset=.25),nodes=['CH2-LY04-W01'])
    add('V18-C01',[part('V15-01',2.8,3.5),part('V14-02',0,1.5),part('V15-02',7.8,9.6)],audio=dict(file=voice('V18-05'),offset=.25),nodes=['CH2-LY04-C01'])
    add('V18-D06',[part('UR-LEDGER-DE-R2',5.55,7.65,new=True)],nodes=['CH2-LY04-D06'])
    join('V18',['V18-T01','V18-D04','V18-W01','V18-D05','V18-C01','V18-D06'])
def spoken():
    j=read(R/'audio/V17-01-seed-audio-state.json')
    add('V17',[part('V17-01',0,.75),part('V18-03',0,1.8),part('V15-02',6,9.4),part('UR-DOC-ABC-R1',5,6.2,new=True),part('V14-02',0,.65)],audio=dict(file=j['file'],start=0,end=7.6),nodes=['CH2-LY04-F02'],comment='New correct Seed-Audio1.0 reference-upload voice; 7.6-second voiced action cut, no old-duration padding')
    # Remove silent lead created by discarded native metadata from the C response.
    add('V19C-player',[part('V15-02',6,10.1)],audio=dict(file=voice('V19C-01'),offset=.25),nodes=['CH2-LY04-Q4C'])
    add('V19C-response',[part('V14-02',0,1.0),part('UR-LEDGER-DE-R2',7,10.1,new=True),part('V19C-02',7.15,9.416667),part('V14-02',1.0,1.4)],audio=dict(file=raw('V19C-02'),start=3.2,end=9.416667,offset=.1),nodes=['CH2-LY04-Q4FB1'],comment='Natural0.4s warehouse continuation after face retains entire selected canonical native-audio range plus tail after parent frame rounding')
    join('V19C',['V19C-player','V19C-response'])
    # Remove reused review actions repeated within both A turns; use different clean action spans.
    add('V19A-player',[part('UR-LEDGER-DE-R2',1,4.25,new=True),part('V14-02',0,1.4),part('V13-04',0,1),part('V15-02',9.4,10.1)],audio=dict(file=voice('V19A-01'),offset=.25),nodes=['CH2-LY04-Q4A'])
    join('V19A',['V19A-player','V19A-response'])
def v20():
    j=read(R/'audio/V20-01-seed-audio-state.json')
    add('V20-C04',[part('V20-01',4.8,9.416667),part('V14-02',0,.55)],audio=dict(file=j['file'],start=0,end=5.1),nodes=['CH2-LY04-C04'])
    # Paper R2 only the plain-back recipient contact, globally reframed to exclude background labels.
    add('V20-015',[part('UR-LEDGER-DE-R2',0,2.8,new=True)],nodes=['CH2-LY06-015'])
    add('V20-016',[part('V18-03',0,2),part('V15-02',9.0,10.1)],audio=dict(file=voice('V20-04'),offset=.25),nodes=['CH2-LY06-016'])
    add('V20-018',[part('UR-LEDGER-DE-R2',5.55,7.65,new=True)],nodes=['CH2-LY06-018'])
    add('V20-019',[part('V20-07',2.65,4.25,crop=[690,80,650,366]),part('UR-LEDGER-DE-R2',7.1,10.1,new=True)],audio=dict(file=raw('V20-07'),start=3.0,end=7.15,offset=.35),nodes=['CH2-LY06-019'])
    add('V20-021',[part('V20-08',0,2.6),part('V15-02',5.4,10.1),part('V18-03',0,.4)],audio=dict(file=raw('V20-08'),start=0,end=7.5),nodes=['CH2-LY06-021'])
def v20_parent():
    add('V20-014015',[part('UR-V20-OPERATOR-R1',1.8,5.3,new=True),part('UR-V20-OPERATOR-R1',6.7,9.25,new=True)],audio=dict(file=raw('V20-02'),start=3.45,end=9.35,offset=.1),nodes=['CH2-LY06-014','CH2-LY06-015'],comment='Remove original3.45s silent lead too. Continuous handoff6.7–9.25 includes recipient grip8.7 and both donor hands opening clear at9.041667–9.208333. Stop before red frames9.291667/9.458333/9.625 and later regrip/written front. Exact body remains separate game integration after end; no duplicate grant.')
    join('V20',['V20-C04','V20-014015','V20-016','V20-017','V20-018','V20-019','V20-021'])
def v13():
    add('V13-entry',[part('V13-01',0,1.4,crop=[100,0,1000,562])])
    add('V13-player',[part('UR-V13-VOUCHER-R1',0,4.1,new=True)],audio=dict(file=voice('V13-02'),offset=.15),nodes=['CH2-LY04-001'])
    j=read(R/'audio/V13-03-seed-audio-state.json')
    add('V13-manager',[part('V13-03',0,.85,crop=[0,0,650,366]),part('V13-04',0,1.2),part('UR-LEDGER-DE-R2',3.3,5.3,new=True)],audio=dict(file=j['file'],start=0,end=4),nodes=['CH2-LY04-002'])
    j=read(R/'audio/V13-04-seed-audio-state.json')
    add('V13-clerk',[part('V20-08',.3,2.3),part('V15-02',6,10.1),part('V18-03',0,.4)],audio=dict(file=j['file'],start=0,end=6),nodes=['CH2-LY04-003'],comment='0.4s natural next movement preserves complete generated final word atWAV5.96 and breathing tail after parent frame rounding; no hold or loop')
    join('V13',['V13-entry','V13-player','V13-manager','V13-clerk'])
if __name__=='__main__':
    for f in sys.argv[1:]:globals()[f]()
