"""Refine the approved v2 layout in native Blender. No image paintovers."""
import bpy,bmesh,os,json,math,random,sys,time,glob
from mathutils import Vector,Matrix,noise
from mathutils.kdtree import KDTree
from mathutils.bvhtree import BVHTree
ROOT=os.path.dirname(os.path.abspath(__file__))
BASE=os.path.join(os.path.dirname(ROOT),'yiling-camp-v2-20261106')
bpy.ops.wm.open_mainfile(filepath=os.path.join(BASE,'yiling-camp-v2.blend'))
random.seed(61107);start=time.time();s=bpy.context.scene
layout=json.load(open(os.path.join(BASE,'camera-layout.json'),encoding='utf-8'))
details=bpy.data.collections.new('10_Art_refinement');s.collection.children.link(details)
ground=bpy.data.objects['Playable valley and terrace']
ground_bvh=BVHTree.FromPolygons([v.co for v in ground.data.vertices],[p.vertices[:] for p in ground.data.polygons],all_triangles=True)
def gz(x,y):
    p,n,f,d=ground_bvh.ray_cast(Vector((x,y,900)),Vector((0,0,-1)))
    if p is not None:return p.z,n
    return -5,Vector((0,0,1))
def clamp(x):return max(0,min(1,x))
def ss(x):x=clamp(x);return x*x*(3-2*x)
def nval(x,y,scale):return noise.noise_vector(Vector((x*scale,y*scale,7.17)))[0]
def in_camp(x,y):return min(max(abs(x+188)/50,abs(y+174)/40),max(abs(x+317)/59,abs(y+260)/32))<1
def bank(x,side):return 68+42*math.sin((x+160)/270)+18*math.sin(x/660)+side*(83+13*math.sin(x/185+.6))
roadpoints=[p for key in ['fu','sha','dock','imperial','north'] for p in layout['routes'][key]]
roads=KDTree(len(roadpoints))
for i,p in enumerate(roadpoints):roads.insert((p[0],p[1],0),i)
roads.balance()
def road_dist(x,y):return roads.find((x,y,0))[2]
oldtrees=[o for o in bpy.data.objects if o.name.startswith(('Woodland tree','Foreground tree'))]
tree_kd=KDTree(len(oldtrees))
for i,o in enumerate(oldtrees):tree_kd.insert((o.location.x,o.location.y,0),i)
tree_kd.balance()

def addmesh(name,vs,fs,mat=None):
    me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update()
    if mat:me.materials.append(mat)
    o=bpy.data.objects.new(name,me);details.objects.link(o);return o
def instance(name,me,loc,scale=(1,1,1),rotation=0):
    o=bpy.data.objects.new(name,me);details.objects.link(o);o.location=loc;o.scale=scale;o.rotation_euler.z=rotation;return o
def cube(name,loc,size,mat,bevel=.02):
    vs=[(-.5,-.5,-.5),(.5,-.5,-.5),(.5,.5,-.5),(-.5,.5,-.5),(-.5,-.5,.5),(.5,-.5,.5),(.5,.5,.5),(-.5,.5,.5)]
    vs=[(a*size[0],b*size[1],c*size[2]) for a,b,c in vs]
    o=addmesh(name,vs,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],mat);o.location=loc
    mod=o.modifiers.new('Worn edges','BEVEL');mod.width=bevel;mod.segments=2
    return o
def tube(name,pts,r,mat):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=r;c.bevel_resolution=2
    sp=c.splines.new('POLY');sp.points.add(len(pts)-1)
    for p,co in zip(sp.points,pts):p.co=(*co,1)
    o=bpy.data.objects.new(name,c);details.objects.link(o);c.materials.append(mat);return o
def load(asset,predicate):
    path=os.path.join(ROOT,'assets',asset,asset+'_1k.blend')
    with bpy.data.libraries.load(path,link=False) as (src,dst):dst.objects=[k for k in src.objects if predicate(k)]
    result=[]
    for o in dst.objects:
        if o and o.type=='MESH':
            me=o.data.copy();me.transform(o.matrix_world);me.update();result.append(me)
        if o:bpy.data.objects.remove(o,do_unlink=True)
    assert result,asset
    return result
print('Loading scanned assets',flush=True)
tree=load('tree_small_02',lambda n:n=='tree_small_02_LOD1')[0]
rocks=load('rock_moss_set_01',lambda n:'_rock' in n)
faces=load('rock_face_01',lambda n:n=='rock_face_01')
grasses=load('grass_medium_02',lambda n:n.endswith(('_a_geo','_b_geo','_c_geo','_d_geo','_e_geo')))
ferns=load('fern_02',lambda n:n.endswith(('_a','_b','_c','_d')))
branches=load('dry_branches_medium_01',lambda n:n.endswith(('_a','_b','_c')))
trunk=load('dead_tree_trunk',lambda n:n=='dead_tree_trunk')[0]
# Appended image paths may still be relative to their source .blend.
paths={os.path.basename(p):p for p in glob.glob(os.path.join(ROOT,'assets','**','textures','*'),recursive=True)}
paths.update({os.path.basename(p):p for p in glob.glob(os.path.join(ROOT,'textures','*'))})
for im in bpy.data.images:
    name=os.path.basename(im.filepath)
    if not im.packed_file and name in paths:im.filepath=paths[name]

def shader(mat):
    mat.use_nodes=True;ns=mat.node_tree.nodes;ns.clear();ls=mat.node_tree.links
    out=ns.new('ShaderNodeOutputMaterial');p=ns.new('ShaderNodeBsdfPrincipled');ls.new(p.outputs[0],out.inputs['Surface'])
    coord=ns.new('ShaderNodeTexCoord');return ns,ls,p,coord.outputs['Object']
def scanned(ns,ls,asset,scale,coord):
    mul=ns.new('ShaderNodeVectorMath');mul.operation='SCALE';mul.inputs['Scale'].default_value=scale;ls.new(coord,mul.inputs[0]);out={}
    for suffix,key in [('diff','color'),('rough','rough'),('disp','height')]:
        matches=glob.glob(os.path.join(ROOT,'textures',asset+'_'+suffix+'_*'))
        if not matches:matches=glob.glob(os.path.join(BASE,'textures',asset+'_'+suffix+'_*'))
        if not matches:continue
        im=bpy.data.images.load(matches[0],check_existing=True)
        if key!='color':im.colorspace_settings.name='Non-Color'
        tex=ns.new('ShaderNodeTexImage');tex.image=im;tex.projection='BOX';tex.projection_blend=.3;ls.new(mul.outputs['Vector'],tex.inputs[0]);out[key]=tex.outputs['Color']
    return out
def mix(ns,ls,fac,a,b):
    m=ns.new('ShaderNodeMixRGB')
    if isinstance(fac,(float,int)):m.inputs[0].default_value=fac
    else:ls.new(fac,m.inputs[0])
    for val,socket in [(a,m.inputs[1]),(b,m.inputs[2])]:
        if isinstance(val,tuple):socket.default_value=val
        else:ls.new(val,socket)
    return m.outputs[0]
def tint(ns,ls,col,mult):
    m=ns.new('ShaderNodeMixRGB');m.blend_type='MULTIPLY';m.inputs[0].default_value=1;m.inputs[2].default_value=(*mult,1);ls.new(col,m.inputs[1]);return m.outputs[0]
def attr(ns,name):o=ns.new('ShaderNodeAttribute');o.attribute_name=name;return o.outputs['Fac']
def noise_node(ns,ls,coord,scale):
    n=ns.new('ShaderNodeTexNoise');n.inputs['Scale'].default_value=scale;n.inputs['Detail'].default_value=5;n.inputs['Roughness'].default_value=.72;ls.new(coord,n.inputs[0]);return n

print('Layering soil, track wear and stone surfaces',flush=True)
for obj in [ground,bpy.data.objects['Far ridges and valley']]:
    forest=[];ruts=[]
    for v in obj.data.vertices:
        x,y,z=v.co;td=tree_kd.find((x,y,0))[2];rd=road_dist(x,y)
        forest.append((1-ss((td-3)/12))*(.7+.3*nval(x,y,.08)))
        ruts.append((1-ss(abs(rd-.78)/.36))*(1-ss((rd-1.8)/.5)))
    for name,values in [('forest_mask',forest),('rut_mask',ruts)]:
        at=obj.data.attributes.new(name,'FLOAT','POINT');at.data.foreach_set('value',values)
earth=bpy.data.materials['Soil, exposed stone and short hillside grass']
ns,ls,p,coord=shader(earth)
grass=scanned(ns,ls,'aerial_grass_rock',.32,coord)
floor=scanned(ns,ls,'forest_ground_04',.38,coord)
rock=scanned(ns,ls,'rocky_terrain_02',.12,coord)
mud=scanned(ns,ls,'brown_mud_dry',.55,coord)
shore=scanned(ns,ls,'gravelly_sand',.65,coord)
grasscol=tint(ns,ls,grass['color'],(.40,.49,.31));floorcol=tint(ns,ls,floor['color'],(.7,.65,.53))
col=mix(ns,ls,attr(ns,'forest_mask'),grasscol,floorcol)
geo=ns.new('ShaderNodeNewGeometry');sep=ns.new('ShaderNodeSeparateXYZ');ls.new(geo.outputs['Normal'],sep.inputs[0])
slope=ns.new('ShaderNodeMapRange');slope.inputs['From Min'].default_value=.88;slope.inputs['From Max'].default_value=.52;ls.new(sep.outputs['Z'],slope.inputs['Value'])
col=mix(ns,ls,slope.outputs[0],col,tint(ns,ls,rock['color'],(.55,.57,.54)))
col=mix(ns,ls,attr(ns,'shore_mask'),col,tint(ns,ls,shore['color'],(.7,.7,.62)))
roadcol=tint(ns,ls,mud['color'],(.55,.48,.37));roadcol=mix(ns,ls,attr(ns,'rut_mask'),roadcol,tint(ns,ls,roadcol,(.72,.73,.71)))
col=mix(ns,ls,attr(ns,'road_mask'),col,roadcol);ls.new(col,p.inputs['Base Color'])
p.inputs['Roughness'].default_value=.9
h=mix(ns,ls,attr(ns,'road_mask'),floor['height'],mud['height'])
bump=ns.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.7;bump.inputs['Distance'].default_value=.055;ls.new(h,bump.inputs['Height']);ls.new(bump.outputs[0],p.inputs['Normal'])

for name in ['Unbleached linen','Darker linen','Oxide red military cloth']:
    mat=bpy.data.materials[name];ns,ls,p,coord=shader(mat)
    no=noise_node(ns,ls,coord,1.65)
    colors=((.14,.118,.087,1),(.42,.38,.29,1)) if name!='Oxide red military cloth' else ((.055,.009,.008,1),(.17,.026,.016,1))
    ls.new(mix(ns,ls,no.outputs['Fac'],*colors),p.inputs['Base Color'])
    weave=noise_node(ns,ls,coord,360);b=ns.new('ShaderNodeBump');b.inputs['Distance'].default_value=.0014;b.inputs['Strength'].default_value=.36;ls.new(weave.outputs['Fac'],b.inputs['Height']);ls.new(b.outputs[0],p.inputs['Normal'])
    p.inputs['Roughness'].default_value=.91;p.inputs['Sheen Weight'].default_value=.22
for name in ['Unpainted split timber','Worn plank grain']:
    mat=bpy.data.materials[name];ns,ls,p,coord=shader(mat)
    tex=scanned(ns,ls,'bark_brown_02' if name.startswith('Unpainted') else 'oak_wood_planks',.65 if name.startswith('Unpainted') else .8,coord)
    ls.new(tint(ns,ls,tex['color'],(.42,.39,.34)),p.inputs['Base Color']);p.inputs['Roughness'].default_value=.86
    bump=ns.new('ShaderNodeBump');bump.inputs['Distance'].default_value=.025 if name.startswith('Unpainted') else .009;bump.inputs['Strength'].default_value=.65;ls.new(tex['height'],bump.inputs['Height']);ls.new(bump.outputs[0],p.inputs['Normal'])

print('Refining cloth, crates and camp objects',flush=True)
for obj in list(bpy.data.objects):
    if obj.type!='MESH':continue
    if obj.name.startswith(('Canvas side wall','Open entrance flap','Rear tent wall','Open command awning','Lookout awning')):
        bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.subdivide_edges(bm,edges=list(bm.edges),cuts=18,use_grid_fill=True);bm.to_mesh(obj.data);bm.free()
        for v in obj.data.vertices:
            x,y,z=v.co
            if obj.name.startswith(('Open command','Lookout')):v.co.z+=.055*math.sin(x*4.1+y*.9)
            else:
                v.co.y+=.06*math.sin(x*5.6+z*.6)*math.sin(z*1.2)
                v.co.x+=.032*math.sin(y*6.1+z*.7)
        for face in obj.data.polygons:face.use_smooth=True
        sol=obj.modifiers.new('Cloth hem thickness','SOLIDIFY');sol.thickness=.012
    elif obj.name.startswith('Tensioned linen roof'):
        for v in obj.data.vertices:
            x,y,z=v.co;v.co.z+=.045*math.sin(x*5.4+y*.25)+.025*math.sin(y*6.3+x*.7)
    elif obj.name.startswith('Split stockade stake'):
        center=sum((v.co for v in obj.data.vertices),Vector())/len(obj.data.vertices)
        for v in obj.data.vertices:
            v.co.x=center.x+(v.co.x-center.x)*1.42;v.co.y=center.y+(v.co.y-center.y)*1.42
    elif obj.name.startswith('Storage jar'):
        sol=obj.modifiers.new('Pottery wall thickness','SOLIDIFY');sol.thickness=.025
plank=bpy.data.materials['Worn plank grain'];rope=bpy.data.materials['Hemp rope'];linen=bpy.data.materials['Darker linen']
for obj in list(bpy.data.objects):
    if not obj.name.startswith('Supply crate'):continue
    x,y,z=obj.location;w,d,h=obj.scale
    for side in [-1,1]:
        for k in range(4):
            cube('Joined crate side board',(x,y+side*d*.5,z-h*.5+(k+.5)*h/4),(w,.04,h/4-.012),plank,.008)
            cube('Joined crate end board',(x+side*w*.5,y,z-h*.5+(k+.5)*h/4),(.04,d,h/4-.012),plank,.008)
    for k in range(5):cube('Crate lid board',(x-w*.5+(k+.5)*w/5,y,z+h*.5),(w/5-.01,d,.04),plank,.006)
    bpy.data.objects.remove(obj,do_unlink=True)
for obj in list(bpy.data.objects):
    if obj.name.startswith(('Cart bed plank','Cart shaft','Cart wheel','Landing plank','Table top plank','Crate binding')) and obj.type=='MESH':
        b=obj.modifiers.new('Small worn timber edges','BEVEL');b.width=.012;b.segments=2

# Low, non-interactive stores deepen the camp without adding available units.
for i,(x,y,zoff) in enumerate([(-196.3,-175,.83),(-197,-175,.83),(-195.9,-176,.0),(-191.8,-162,1.85),(-192.2,-161.5,1.65),(-218,-170,0),(-217.3,-170,0)]):
    z,_=gz(x,y);bm=bmesh.new();bmesh.ops.create_uvsphere(bm,u_segments=32,v_segments=20,radius=1)
    me=bpy.data.meshes.new('Filled grain sack');bm.to_mesh(me);bm.free()
    for v in me.vertices:
        p=v.co;v.co.x*=.35;v.co.y*=.55;v.co.z*=.26;p.z+=.018*math.sin(p.x*31+p.y*17)
    me.materials.append(linen)
    for p in me.polygons:p.use_smooth=True
    instance('Tied supply sack',me,(x,y,z+zoff+.27),rotation=random.random())
    tube('Sack binding',[(x+.35*math.cos(t*math.tau/40),y+.53*math.sin(t*math.tau/40),z+zoff+.27+.045*math.cos(t*math.tau/40)) for t in range(41)],.014,rope)

# Vegetation keeps all existing roots and road clearances. Nearby trees use a scan.
print('Replacing nearby vegetation and stone geometry',flush=True)
replaced=0
for o in oldtrees:
    x,y,z=o.location
    if min(math.hypot(x+188,y+174),math.hypot(x+100,y-140))<620:
        old_scale=o.scale.copy();o.data=tree;factor=1.78
        o.scale=(old_scale.x*factor,old_scale.y*factor,old_scale.z*factor);replaced+=1
for o in list(bpy.data.objects):
    if o.name.startswith(('Loose limestone','Camp gravel')):
        o.data=random.choice(rocks);o.rotation_euler.x=random.uniform(-.2,.2);o.rotation_euler.y=random.uniform(-.2,.2)
        o.scale.z*=1.8
        o.location.z-=min(.08,o.scale.z*.12)

anchors=[(-236,-99,2.7),(-295,-321,4.2),(-330,-325,5.8),(-265,-344,6.0),(-204,-298,3.0),(-38,-237,2.8),(30,-295,3.2),(-5,-371,3.5),(92,252,3.2),(-101,249,4.0),(-195,298,5.4),(240,320,6.4),(375,275,3.5)]
for x,y,scale in anchors:
    z,n=gz(x,y)
    instance('Weathered exposed rock ledge',faces[0],(x,y,z-scale*.8),(scale,scale*.75,scale),random.uniform(-.4,.4))

# Dense plants occupy patches along the same routes; clear walking lanes remain.
plant_count=0
print('Planting route edges',flush=True)
for key in ['dock','fu','sha','imperial','north']:
    pts=layout['routes'][key]
    for a,b in zip(pts,pts[1:]):
        dx,dy=b[0]-a[0],b[1]-a[1];length=math.hypot(dx,dy)
        if length<.01:continue
        for j in range(max(2,int(length*8))):
            t=random.random();side=random.choice([-1,1]);offset=random.uniform(2.6,9)
            x=a[0]+dx*t-dy/length*side*offset;y=a[1]+dy*t+dx/length*side*offset
            if in_camp(x,y) or bank(x,-1)<y<bank(x,1) or road_dist(x,y)<2.2:continue
            if nval(x,y,.15)<-.18:continue
            z,n=gz(x,y)
            if z<1 or n.z<.42:continue
            sc=random.uniform(.65,2.0);me=random.choice(ferns if random.random()<.17 else grasses)
            instance('Roadside undergrowth',me,(x,y,z-.025),(sc,sc,sc*random.uniform(.8,1.3)),random.random()*math.tau);plant_count+=1
print('Planting forest floor',plant_count,flush=True)
for i in range(15000):
    x=random.uniform(-400,350);y=random.uniform(-380,300)
    if in_camp(x,y) or bank(x,-1)<y<bank(x,1) or road_dist(x,y)<3:continue
    if min(math.hypot(x+175,y+170),math.hypot(x+95,y+200),math.hypot(x+100,y-160))>160:continue
    if nval(x,y,.11)<-.1:continue
    z,n=gz(x,y)
    if z<.8 or n.z<.48:continue
    sc=random.uniform(.9,2.1);instance('Forest floor growth',random.choice(grasses+ferns),(x,y,z-.025),(sc,sc,sc),random.random()*math.tau);plant_count+=1
# Irregular camp perimeter growth; trampled central area remains clear.
print('Dressing camp perimeter',plant_count,flush=True)
for i in range(2400):
    x=random.uniform(-232,-143);y=random.uniform(-212,-138)
    if min(x+232,-143-x,y+212,-138-y)>5 or road_dist(x,y)<2.6:continue
    z,_=gz(x,y);sc=random.uniform(.5,1.2);instance('Camp edge grass',random.choice(grasses),(x,y,z-.02),(sc,sc,sc*.8),random.random()*math.tau);plant_count+=1
for i in range(1500):
    x=random.uniform(-410,560);side=random.choice([-1,1]);y=bank(x,side)+side*random.uniform(1,8)
    if min(math.hypot(x+116,y-bank(-116,-1)),math.hypot(x+88,y-bank(-88,1)))<11:continue
    z,n=gz(x,y)
    if z<-.2:continue
    sc=random.uniform(.12,.7);instance('Shoreline washed stones',random.choice(rocks),(x,y,z-.08),(sc,sc*.8,sc*.5),random.random()*math.tau)
for i in range(130):
    x=random.uniform(-270,-60);y=random.uniform(-260,-70)
    if road_dist(x,y)<3 or in_camp(x,y):continue
    z,n=gz(x,y)
    if z<2:continue
    instance('Fallen branches',random.choice(branches),(x,y,z+.025),rotation=random.random()*math.tau)
for x,y,rz in [(-124,-88,.4),(-236,-145,1.2),(-82,-224,.6)]:
    z,_=gz(x,y);instance('Fallen weathered trunk',trunk,(x,y,z),rotation=rz)

water=bpy.data.materials['Broad flowing river'];ns,ls,p,coord=shader(water)
p.inputs['Base Color'].default_value=(.035,.073,.065,1);p.inputs['Roughness'].default_value=.14;p.inputs['IOR'].default_value=1.333;p.inputs['Transmission Weight'].default_value=.35
stretch=ns.new('ShaderNodeVectorMath');stretch.operation='MULTIPLY';stretch.inputs[1].default_value=(.3,2.7,1);ls.new(coord,stretch.inputs[0])
n=noise_node(ns,ls,stretch.outputs[0],1.4);b=ns.new('ShaderNodeBump');b.inputs['Distance'].default_value=.065;b.inputs['Strength'].default_value=.6;ls.new(n.outputs['Fac'],b.inputs['Height']);ls.new(b.outputs[0],p.inputs['Normal'])

print('Packing final native scene',flush=True)
s.view_settings.exposure=0;s.view_settings.look='AgX - Medium High Contrast'
s.world.node_tree.nodes.get('Background').inputs[1].default_value=.42
sun=bpy.data.lights.get('Late afternoon sun');sun.energy=2.2;sun.angle=math.radians(2.5)
s.cycles.samples=96;s.cycles.max_bounces=8;s.cycles.transparent_max_bounces=12;s.cycles.use_denoising=True
s.render.resolution_x=1920;s.render.resolution_y=1080;s.render.resolution_percentage=100
s.camera=bpy.data.objects['camp']
layout['version']='yiling-camp-v3-20261106';layout['status']='visual-refinement-pending-review'
layout['geometry']['refinement']={'scannedTrees':replaced,'groundPlants':plant_count,'baseLayout':'v2 unchanged','source':'Native Blender geometry and CC0 scans; no image generation'}
json.dump(layout,open(os.path.join(ROOT,'camera-layout.json'),'w',encoding='utf-8'),ensure_ascii=False,indent=2)
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'yiling-camp-v3.blend'))
summary={'objects':len(s.objects),'images':len([i for i in bpy.data.images if i.packed_file]),'seconds':round(time.time()-start,1),**layout['geometry']['refinement']}
json.dump(summary,open(os.path.join(ROOT,'scene-build.json'),'w'),indent=2);print('SCENE_SAVED',summary,flush=True)
