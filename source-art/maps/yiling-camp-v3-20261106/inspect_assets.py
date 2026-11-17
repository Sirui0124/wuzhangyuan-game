import bpy,os,json
ROOT=os.path.dirname(os.path.abspath(__file__));records=[]
for asset in ['tree_small_02','rock_face_01','rock_moss_set_01','grass_medium_02','fern_02','dry_branches_medium_01','dead_tree_trunk']:
    path=os.path.join(ROOT,'assets',asset,asset+'_1k.blend')
    if not os.path.exists(path):continue
    with bpy.data.libraries.load(path,link=False) as (src,dst):dst.objects=src.objects
    for o in dst.objects:
        if not o or o.type!='MESH':continue
        coords=[o.matrix_world@v.co for v in o.data.vertices]
        lo=[min(p[i] for p in coords) for i in range(3)];hi=[max(p[i] for p in coords) for i in range(3)]
        records.append({'asset':asset,'object':o.name,'vertices':len(o.data.vertices),'bounds':[lo,hi],'modifiers':[(m.name,m.type) for m in o.modifiers]})
json.dump(records,open(os.path.join(ROOT,'asset-inspection.json'),'w',encoding='utf-8'),indent=2)
print(json.dumps(records),flush=True)
