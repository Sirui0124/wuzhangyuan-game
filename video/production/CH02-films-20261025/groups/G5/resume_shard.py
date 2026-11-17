from pathlib import Path
import json,copy
OUT=Path(__file__).parent;ROOT=OUT.parents[1]
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,x):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,ensure_ascii=False,indent=2),encoding='utf-8')
plan=read(OUT/'plan.json');central=read(ROOT/'references/manifest.json')['byId'];own=read(OUT/'references/composition-manifest.json')['byId']
prompts={
'V37-03':('gouan-empty-cart-road','Gou An in plain grey linen steadies the left side of the empty wooden grain cart. From behind the cart at human eye height, two hands in grey-brown linen sleeves enter the bottom of the frame and grasp its solid rear crossbar. Together they push forward slowly. The wooden wheels roll across a shallow rut and continue south. A single continuous 9 second historical live-action shot. Soft overcast daylight. Only wheel creaks, footsteps and quiet wind.'),
'V42-01':('收件案头','A historical live-action shot of old military records on a rough wooden desk in a Han-era tent. Two hands in coarse grey-brown sleeves slowly unroll an aged paper scroll across the table. The camera rises a little and looks down at the opened scroll. Faded small abstract ink strokes on old paper, soft daylight from the left. Seven seconds, quiet paper rustle and room ambience.'),
'V42-02':('收件案头','A historical live-action close view drifting slowly over aged paper records spread across a rough wooden desk. Human eye-height attention shifts down to worn paper fibres, faded ink columns and the edges of several scrolls. Gentle daylight from the left. Fifteen seconds, restrained and still. Only quiet room ambience and slight paper movement.'),
'V42-03':('收件案头','A historical live-action close view of an old scroll on a rough wooden desk. A grey-brown linen sleeve and one hand enter from the bottom of the image, hold the near edge gently, and turn one sheet to an earlier page. The hand settles beside the paper. The camera remains near the table in soft daylight. Seven seconds, only paper rustle and quiet room ambience.')}
for id,(key,text) in prompts.items():
    if (OUT/'tasks'/f'{id}.json').exists():continue
    ref=(own if key in own else central)[key]
    c=next(c for c in plan['clips'] if c['id']==id)
    c['references']=[dict(id=key,path=ref['path'],use=ref['use'])]
    local=OUT/'requests'/f'{id}.local.json'
    save(local,dict(model='MiniMax-H3',duration=c['duration'],resolution='768P',ratio='16:9',content=[dict(type='text',text=text+' No background music.'),dict(type='image_url',image_url={'local_path':ref['path']},role='first_frame')]))
    prepared=OUT/'requests'/f'{id}.json'
    if prepared.exists():
        historical=OUT/'requests'/'before-res1-minimal';historical.mkdir(exist_ok=True)
        for p in [prepared,prepared.with_suffix('.references.json')]:
            if p.exists() and not (historical/p.name).exists():p.rename(historical/p.name)
failed=read(OUT/'tasks/V37-02.json')
assert failed['status']=='failed' and failed.get('error',{}).get('code')=='input_download_failed'
r=copy.deepcopy(next(c for c in plan['clips'] if c['id']=='V37-02'));r.update(id='V37-02-R2',parentId='V37-02',status='explicit-input-failure-recovery',visualRepairReason='原任务明确input_download_failed，按总控res-1同字节恢复')
save(OUT/'requests/V37-02-R2.local.json',dict(model='MiniMax-H3',duration=6,resolution='768P',ratio='16:9',content=[dict(type='text',text='Historical live action. Gou An, wearing his plain grey linen clothes, stands beside the left rear of the empty wooden grain cart. He turns his head toward the camera, says in Mandarin: “别光看着，搭把手！” He then turns back toward the road. Six seconds in soft overcast daylight. Only his speech, cloth movement and light wind. No background music.'),dict(type='image_url',image_url={'local_path':own['gouan-empty-cart-road']['path']},role='first_frame')]))
rp=read(OUT/'repair-plan.json');rp['clips']=[c for c in rp['clips'] if c['id']!=r['id']]+[r];save(OUT/'repair-plan.json',rp)
save(OUT/'plan.json',plan)
pilot=next(c for c in rp['clips'] if c['id']=='V32A-04-R2')
save(OUT/'queue-plan.json',dict(group='G5',clips=[r]+plan['clips']+[pilot]))
save(OUT/'post-gate.json',dict(enabled=True,reason='root confirmed unique res-1 recovery probe succeeded; use same-byte promote()',knownUnknownHeld='V32A-01'))
print('Resumed four original requests plus only explicit failed V37-02-R2; unknown initial task unchanged')
