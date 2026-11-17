"""Independent Yiling spatial/art study. Blender 5.2; metres; +X east, +Y north.

This is authored narrative geography, not a surveyed reconstruction. All cameras,
landmarks and routes are generated from this one scene; no AI image backgrounds.
Run: blender -b --python build_scene.py -- --preview
"""
import bpy, math, random, json, os, sys, time, functools
from mathutils import Vector, noise
from mathutils.kdtree import KDTree
from bpy_extras.object_utils import world_to_camera_view

ROOT = os.path.dirname(os.path.abspath(__file__))
random.seed(1106)
START = time.time()
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for c in list(bpy.data.collections):
    if c.name != 'Collection': bpy.data.collections.remove(c)
COLS = {}
for name in ['01_Landform', '02_River_and_landings', '03_Assembly_camp',
             '04_Imperial_camp', '05_Roads', '06_Vegetation', '07_Props',
             '08_Distant_landmarks', '09_Cameras_lighting']:
    c = bpy.data.collections.new(name); bpy.context.scene.collection.children.link(c); COLS[name] = c
ACTIVE = COLS['01_Landform']

def link(o):
    ACTIVE.objects.link(o); return o

def mesh(name, verts, faces, mat=None):
    me=bpy.data.meshes.new(name); me.from_pydata(verts,[],faces); me.update()
    o=link(bpy.data.objects.new(name,me))
    if mat: me.materials.append(mat)
    return o

def smooth(o):
    for p in o.data.polygons: p.use_smooth=True
    return o

def material(name, a, b, scale=1, bump=.12, rough=.8, stretch=(1,1,1)):
    m=bpy.data.materials.new(name);m.use_nodes=True
    ns=m.node_tree.nodes;ls=m.node_tree.links;p=ns.get('Principled BSDF')
    p.inputs['Roughness'].default_value=rough
    coord=ns.new('ShaderNodeTexCoord');mul=ns.new('ShaderNodeVectorMath');mul.operation='MULTIPLY'
    mul.inputs[1].default_value=stretch;ls.new(coord.outputs['Object'],mul.inputs[0])
    tex=ns.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=scale;tex.inputs['Detail'].default_value=4
    tex.inputs['Roughness'].default_value=.72;ls.new(mul.outputs[0],tex.inputs[0])
    ramp=ns.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].position=.2;ramp.color_ramp.elements[1].position=.8
    ramp.color_ramp.elements[0].color=(*a,1);ramp.color_ramp.elements[1].color=(*b,1)
    ls.new(tex.outputs['Fac'],ramp.inputs[0]);ls.new(ramp.outputs[0],p.inputs['Base Color'])
    bn=ns.new('ShaderNodeBump');bn.inputs['Strength'].default_value=.32;bn.inputs['Distance'].default_value=bump
    ls.new(tex.outputs['Fac'],bn.inputs['Height']);ls.new(bn.outputs[0],p.inputs['Normal'])
    return m

earth=material('Soil, exposed stone and short hillside grass',(.045,.061,.035),(.16,.18,.10),.14,.24)
stone=material('River limestone',(.14,.16,.15),(.36,.37,.34),1.7,.16)
dirt=material('Compacted earth road',(.16,.125,.086),(.32,.27,.19),1.3,.08)
sand=material('Gravel shore',(.18,.19,.16),(.34,.34,.27),1.8,.07)
timber=material('Unpainted split timber',(.035,.024,.016),(.14,.105,.064),3,.018,.85,(7,7,.24))
plank=material('Worn plank grain',(.06,.044,.026),(.21,.164,.104),2.2,.014,.82,(.15,6,6))
rope=material('Hemp rope',(.13,.11,.07),(.28,.24,.16),24,.004)
canvas=material('Unbleached linen',(.27,.25,.20),(.53,.51,.43),2.5,.008,.93)
canvas2=material('Darker linen',(.19,.185,.15),(.40,.39,.32),2,.008,.95)
red=material('Oxide red military cloth',(.065,.012,.009),(.23,.043,.025),6,.009)
iron=material('Dull wrought iron',(.025,.028,.025),(.07,.075,.07),8,.008,.5)
jar_mat=material('Unglazed dark pottery',(.065,.049,.034),(.17,.13,.092),8,.006)
leafmats=[material('Foliage '+str(i),a,b,3,.008,.85) for i,(a,b) in enumerate([
    ((.027,.047,.013),(.09,.14,.035)),((.035,.06,.018),(.145,.19,.064)),
    ((.026,.058,.033),(.09,.16,.072)),((.055,.067,.025),(.19,.205,.08))])]
for m in leafmats:
    m.node_tree.nodes.get('Principled BSDF').inputs['Subsurface Weight'].default_value=.12

def scanned_surface(mat,asset,tile_metres,bump_distance):
    ns=mat.node_tree.nodes;ls=mat.node_tree.links;p=ns.get('Principled BSDF')
    coord=ns.new('ShaderNodeTexCoord');scale=ns.new('ShaderNodeVectorMath');scale.operation='SCALE'
    scale.inputs['Scale'].default_value=1/tile_metres;ls.new(coord.outputs['Object'],scale.inputs[0])
    outputs={}
    for key,suffix,res in [('color','diff','2k'),('rough','rough','1k'),('height','disp','1k')]:
        tex=ns.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(os.path.join(ROOT,'textures',f'{asset}_{suffix}_{res}.jpg'),check_existing=True)
        if key!='color':tex.image.colorspace_settings.name='Non-Color'
        tex.projection='BOX';tex.projection_blend=.2;ls.new(scale.outputs['Vector'],tex.inputs[0]);outputs[key]=tex.outputs['Color']
    ls.new(outputs['color'],p.inputs['Base Color']);ls.new(outputs['rough'],p.inputs['Roughness'])
    bn=ns.new('ShaderNodeBump');bn.inputs['Distance'].default_value=bump_distance;bn.inputs['Strength'].default_value=.5
    ls.new(outputs['height'],bn.inputs['Height']);ls.new(bn.outputs[0],p.inputs['Normal'])
scanned_surface(earth,'aerial_grass_rock',22,.18)
scanned_surface(dirt,'rocky_trail',4,.025)
scanned_surface(sand,'gravelly_sand',4,.035)
scanned_surface(plank,'oak_wood_planks',3,.008)
# Vegetation is local material colour, not an overall yellow/cyan grading filter.
ep=earth.node_tree.nodes.get('Principled BSDF');old_color=ep.inputs['Base Color'].links[0].from_socket
hue=earth.node_tree.nodes.new('ShaderNodeHueSaturation');hue.inputs['Hue'].default_value=.575;hue.inputs['Saturation'].default_value=.7;hue.inputs['Value'].default_value=.74
earth.node_tree.links.new(old_color,hue.inputs['Color'])
tint=earth.node_tree.nodes.new('ShaderNodeMixRGB');tint.blend_type='MULTIPLY';tint.inputs[0].default_value=.45;tint.inputs[2].default_value=(.65,.76,.59,1)
earth.node_tree.links.new(hue.outputs[0],tint.inputs[1]);earth.node_tree.links.new(tint.outputs[0],ep.inputs['Base Color'])
dp=dirt.node_tree.nodes.get('Principled BSDF');dc=dp.inputs['Base Color'].links[0].from_socket
dm=dirt.node_tree.nodes.new('ShaderNodeMixRGB');dm.blend_type='MULTIPLY';dm.inputs[0].default_value=1;dm.inputs[2].default_value=(.47,.44,.37,1)
dirt.node_tree.links.new(dc,dm.inputs[1]);dirt.node_tree.links.new(dm.outputs[0],dp.inputs['Base Color'])

V=[(-.5,-.5,-.5),(.5,-.5,-.5),(.5,.5,-.5),(-.5,.5,-.5),(-.5,-.5,.5),(.5,-.5,.5),(.5,.5,.5),(-.5,.5,.5)]
F=[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
boxcache={}
def box(name,loc,sc,mat,rz=0):
    key=mat.name
    if key not in boxcache:
        m=bpy.data.meshes.new('Shared box '+key);m.from_pydata(V,[],F);m.materials.append(mat);boxcache[key]=m
    o=link(bpy.data.objects.new(name,boxcache[key]));o.location=loc;o.scale=sc;o.rotation_euler.z=rz;return o

def beam(name,a,b,r,mat=timber,r2=None,sides=8):
    a,b=Vector(a),Vector(b);axis=(b-a).normalized();u=axis.cross(Vector((0,0,1)))
    if u.length<.01:u=Vector((1,0,0))
    u.normalize();v=axis.cross(u);vs=[]
    for pos,rad in [(a,r),(b,r if r2 is None else r2)]:
        for k in range(sides):vs.append(tuple(pos+rad*(math.cos(k*math.tau/sides)*u+math.sin(k*math.tau/sides)*v)))
    fs=[tuple(range(sides-1,-1,-1)),tuple(range(sides,2*sides))]
    fs += [(k,(k+1)%sides,(k+1)%sides+sides,k+sides) for k in range(sides)]
    return smooth(mesh(name,vs,fs,mat))

def tube(name,pts,r,mat=rope):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=1;c.bevel_depth=r;c.bevel_resolution=1
    s=c.splines.new('POLY');s.points.add(len(pts)-1)
    for p,co in zip(s.points,pts):p.co=(*co,1)
    o=link(bpy.data.objects.new(name,c));c.materials.append(mat);return o

def clamp(x):return max(0,min(1,x))
def ss(x):x=clamp(x);return x*x*(3-2*x)
def river_center(x):return 68+42*math.sin((x+160)/270)+18*math.sin(x/660)
def halfwidth(x):return 83+13*math.sin(x/185+.6)
def southbank(x):return river_center(x)-halfwidth(x)
def northbank(x):return river_center(x)+halfwidth(x)
def nval(x,y,sc):return noise.noise_vector(Vector((x*sc,y*sc,7.17)))[0]

def raw_height(x,y):
    ds=southbank(x)-y;dn=y-northbank(x)
    d=max(ds,dn)
    if d<0:return -4.0-2.5*ss(-d/30)
    shore=ss(d/28)
    if ds>0:
        rise=18*ss(d/160)
        # A broad terrace, then two unequal ridges with a real valley between.
        ridge1=88*math.exp(-((y+430+48*math.sin(x/150))/112)**2)
        ridge2=170*math.exp(-((y+760+90*math.sin(x/210+1))/205)**2)
        relief=(ridge1+ridge2)*(.65+.35*math.sin(x/190+.8)**2)
        relief*=1-.76*math.exp(-((x-20+.23*(y+230))/62)**2)
    else:
        rise=12*ss(d/120)
        ridge1=112*math.exp(-((y-400-58*math.sin(x/180))/100)**2)
        ridge2=250*math.exp(-((y-860-115*math.sin(x/250))/235)**2)
        relief=(ridge1+ridge2)*(.68+.32*math.sin(x/170+1)**2)
    micro=2.5*nval(x,y,.028)+.65*nval(x,y,.18)
    crags=abs(nval(x,y,.012))*relief*.36
    return -.6+shore*(4+rise+relief+crags+micro)

# Local dimensions are staging dimensions. They do not encode historical distances.
CAMP=(-188,-174);IMPERIAL=(-317,-260)
def height(x,y):
    h=raw_height(x,y)
    d=math.sqrt(((x+270)/170)**2+((y+215)/120)**2)
    t=1-ss((d-.5)/.6);shelf=23+max(0,-y-174)*.085
    h=h*(1-t)+min(h,shelf)*t
    for cx,cy,rx,ry,z in [(*CAMP,53,43,23),(*IMPERIAL,65,37,31)]:
        d=max(abs(x-cx)/rx,abs(y-cy)/ry)
        t=1-ss((d-.83)/.5);h=h*(1-t)+z*t
    return h

@functools.lru_cache(maxsize=50000)
def grid_height(x,y):return height(x,y)
def surface_height(x,y):
    # Match the actual triangulated two-metre terrain rather than its analytic ideal.
    step=2 if -600<=x<800 and -600<=y<700 else 10
    x0=math.floor(x/step)*step;y0=math.floor(y/step)*step;u=(x-x0)/step;v=(y-y0)/step
    a=grid_height(x0,y0);b=grid_height(x0+step,y0);c=grid_height(x0+step,y0+step);d=grid_height(x0,y0+step)
    return a+(b-a)*u+(c-b)*v if u>=v else a+(c-d)*u+(d-a)*v

def terrain_tile(name,x0,x1,y0,y1,step,cut=False):
    nx=round((x1-x0)/step)+1;ny=round((y1-y0)/step)+1
    vs=[(x0+i*step,y0+j*step,height(x0+i*step,y0+j*step)) for j in range(ny) for i in range(nx)]
    fs=[]
    for j in range(ny-1):
        for i in range(nx-1):
            xx=x0+(i+.5)*step;yy=y0+(j+.5)*step
            if cut and -600<xx<800 and -600<yy<700:continue
            k=j*nx+i;fs.extend([(k,k+1,k+nx+1),(k,k+nx+1,k+nx)])
    return smooth(mesh(name,vs,fs,earth))

print('Building continuous landform',flush=True)
terrain_tile('Far ridges and valley',-1800,1800,-1700,2300,10,True)
terrain_tile('Playable valley and terrace',-600,800,-600,700,2)
# Blend steep rock faces by actual mesh normal, not randomly coloured triangles.
ns=earth.node_tree.nodes;ls=earth.node_tree.links;p=ns.get('Principled BSDF');old=p.inputs['Base Color'].links[0].from_socket
geo=ns.new('ShaderNodeNewGeometry');sep=ns.new('ShaderNodeSeparateXYZ');ls.new(geo.outputs['Normal'],sep.inputs[0])
ramp=ns.new('ShaderNodeMapRange');ramp.inputs['From Min'].default_value=.42;ramp.inputs['From Max'].default_value=.80
ls.new(sep.outputs['Z'],ramp.inputs['Value']);mix=ns.new('ShaderNodeMixRGB');mix.inputs[1].default_value=(.21,.23,.205,1)
ls.new(ramp.outputs[0],mix.inputs[0]);ls.new(old,mix.inputs[2]);ls.new(mix.outputs[0],p.inputs['Base Color'])

routes={
 'dock':[CAMP,(-176,-157),(-170,-137),(-156,-111),(-151,-80),(-132,-51),(-120,-27),(-116,southbank(-116)-9)],
 'fu':[CAMP,(-147,-169),(-102,-166),(-51,-160),(14,-177),(89,-185),(160,-166),(244,-149),(325,-163),(394,-183),(455,-170)],
 'sha':[CAMP,(-147,-169),(-102,-166),(-90,-208),(-60,-252),(-20,-295),(-20,-338),(4,-391)],
 'imperial':[CAMP,(-226,-187),(-233,-187),(-256,-202),(-281,-229),IMPERIAL],
 'north':[(-88,northbank(-88)+8),(-80,180),(-30,220),(45,237),(115,246),(185,260)]
}
def dense(pts,step=3):
    out=[]
    for idx,(a,b) in enumerate(zip(pts,pts[1:])):
        p0=pts[max(0,idx-1)];p3=pts[min(len(pts)-1,idx+2)]
        d=math.dist(a,b);num=max(2,math.ceil(d/step))
        for k in range(num):
            t=k/num
            out.append(tuple(.5*((2*a[c])+(-p0[c]+b[c])*t+(2*p0[c]-5*a[c]+4*b[c]-p3[c])*t*t+(-p0[c]+3*a[c]-3*b[c]+p3[c])*t*t*t) for c in [0,1]))
    out.append(pts[-1]);return out
def distance_to_route(x,y):
    best=1e6
    for pts in routes.values():
        for a,b in zip(pts,pts[1:]):
            dx=b[0]-a[0];dy=b[1]-a[1];t=clamp(((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy))
            best=min(best,math.hypot(x-a[0]-t*dx,y-a[1]-t*dy))
    return best
def ribbon(name,pts,width,mat,offset=.07,jagged=False):
    vs=[];across=10
    for k,(x,y) in enumerate(pts):
        a=pts[max(0,k-1)];b=pts[min(len(pts)-1,k+1)];d=Vector((b[0]-a[0],b[1]-a[1]));d.normalize()
        w=width*(1+.08*math.sin(k*1.4)) if jagged else width
        for j in range(across+1):
            side=j/across*2-1;xx=x-d.y*w*side;yy=y+d.x*w*side;vs.append((xx,yy,surface_height(xx,yy)+offset))
    faces=[]
    for k in range(len(pts)-1):
        for j in range(across):a=k*(across+1)+j;faces.append((a,a+across+1,a+across+2,a+1))
    return smooth(mesh(name,vs,faces,mat))
ACTIVE=COLS['05_Roads']
for name,pts in routes.items():
    # The two land routes share one actual road mesh until their junction.
    physical_pts=pts[2:] if name=='sha' else pts
    ribbon('Road '+name,dense(physical_pts,.8),2.5 if name in ['fu','dock'] else 1.65,dirt,.04+(0.012 if name=='dock' else 0),True)
# Irregular trampled ground inside the assembly camp, contiguous with the roads.
vv=[];ff=[]
for j in range(66):
    for i in range(86):
        x=-230+i;y=-207+j;vv.append((x,y,surface_height(x,y)+.025))
for j in range(65):
    for i in range(85):
        x=-230+i;y=-207+j
        if ((x+188)/42)**2+((y+174)/32)**2<1+.04*math.sin(i*.7+j):
            a=j*86+i;ff.append((a,a+1,a+87,a+86))
smooth(mesh('Trampled assembly ground',vv,ff,dirt))
ACTIVE=COLS['02_River_and_landings']
for side in [-1,1]:
    ribbon('Uneven gravel margin',[(x,river_center(x)+side*(halfwidth(x)+5)) for x in range(-1500,1501,4)],5,sand,.04,True)

# Roads and river gravel are painted into the actual terrain surface. This avoids
# intersecting coplanar road plates at forks and visible floating edges near the eye.
samples=[]
for key,pts in routes.items():
    for x,y in dense(pts,1.0):samples.append((x,y,2.5 if key in ['dock','fu'] else 1.65))
road_kd=KDTree(len(samples))
for i,(x,y,w) in enumerate(samples):road_kd.insert((x,y,0),i)
road_kd.balance()
for name in ['Playable valley and terrace','Far ridges and valley']:
    obj=bpy.data.objects[name];road_values=[];shore_values=[]
    for vert in obj.data.vertices:
        x,y,z=vert.co
        _,idx,dist=road_kd.find((x,y,0));width=samples[idx][2]
        road_weight=1-ss((dist-width+.6)/1.2)
        ellipse=math.sqrt(((x+188)/42)**2+((y+174)/32)**2)
        camp_weight=1-ss((ellipse-.82)/.20)
        road_values.append(max(road_weight,camp_weight))
        bankdist=max(southbank(x)-y,y-northbank(x))
        shore_values.append(ss(bankdist/3)*(1-ss((bankdist-7)/7)))
    for attr_name,vals in [('road_mask',road_values),('shore_mask',shore_values)]:
        attr=obj.data.attributes.new(attr_name,'FLOAT','POINT');attr.data.foreach_set('value',vals)

ns=earth.node_tree.nodes;ls=earth.node_tree.links;p=ns.get('Principled BSDF')
previous=p.inputs['Base Color'].links[0].from_socket
coord=ns.new('ShaderNodeTexCoord');scale=ns.new('ShaderNodeVectorMath');scale.operation='SCALE';scale.inputs['Scale'].default_value=.25
ls.new(coord.outputs['Object'],scale.inputs[0])
for attr_name,asset,color_mul in [('shore_mask','gravelly_sand',(.72,.75,.70)),('road_mask','rocky_trail',(.47,.44,.37))]:
    attribute=ns.new('ShaderNodeAttribute');attribute.attribute_name=attr_name
    tex=ns.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(os.path.join(ROOT,'textures',asset+'_diff_2k.jpg'),check_existing=True)
    tex.projection='BOX';tex.projection_blend=.2;ls.new(scale.outputs['Vector'],tex.inputs[0])
    mul=ns.new('ShaderNodeMixRGB');mul.blend_type='MULTIPLY';mul.inputs[0].default_value=1;mul.inputs[2].default_value=(*color_mul,1);ls.new(tex.outputs[0],mul.inputs[1])
    blend=ns.new('ShaderNodeMixRGB');ls.new(attribute.outputs['Fac'],blend.inputs[0]);ls.new(previous,blend.inputs[1]);ls.new(mul.outputs[0],blend.inputs[2]);previous=blend.outputs[0]
ls.new(previous,p.inputs['Base Color'])
for obj in list(bpy.data.objects):
    if obj.name.startswith(('Road ','Trampled assembly ground','Uneven gravel margin')):bpy.data.objects.remove(obj,do_unlink=True)
water=material('Broad flowing river',(.038,.09,.088),(.105,.18,.166),.09,.14,.21,(.18,1,1))
p=water.node_tree.nodes.get('Principled BSDF');p.inputs['Metallic'].default_value=.22;p.inputs['IOR'].default_value=1.333
vs=[];fs=[]
for i in range(901):
    x=-1800+4*i
    for j in range(21):
        y=river_center(x)+(j/20*2-1)*(halfwidth(x)+20)
        z=.055*math.sin(x*.22+y*.8)+.025*math.sin(x*.57-y*1.5)
        vs.append((x,y,z))
for i in range(900):
    for j in range(20):k=i*21+j;fs.append((k,k+21,k+22,k+1))
smooth(mesh('Single continuous river surface',vs,fs,water))

def landing(x,y,direction):
    # Approach rests on the gravel bank; outer deck ends over water.
    start=y-direction*6;end=y+direction*12;z=1.1
    for k in range(44):
        yy=start+(end-start)*k/43
        box('Landing deck plank',(x,yy,z),(5.7,.37,.18),plank)
    for dx in [-2.4,2.4]:
        beam('Landing stringer',(x+dx,start,z-.25),(x+dx,end,z-.25),.20)
        for k in range(5):
            yy=start+(end-start)*k/4
            beam('Landing pile',(x+dx,yy,-2),(x+dx,yy,2.05 if k==4 else 1.3),.19,r2=.14)
    approach=[(x,start-direction*9),(x,start)]
    vv=[(x-2.7,approach[0][1],height(x,approach[0][1])+.1),(x+2.7,approach[0][1],height(x,approach[0][1])+.1),(x+2.7,start,z+.09),(x-2.7,start,z+.09)]
    mesh('Bank to landing ramp',vv,[(0,1,2,3)],plank)

landing(-116,southbank(-116),1);landing(-88,northbank(-88),-1)

def boat(x,y,length=15,angle=0):
    w=length*.22
    def tr(a,b,z):return (x+a*math.cos(angle)-b*math.sin(angle),y+a*math.sin(angle)+b*math.cos(angle),z)
    vs=[]
    section=[(-.5,0),(-.40,-.63),(-.2,-1),(.27,-1),(.46,-.60),(.52,0),(.46,.60),(.27,1),(-.2,1),(-.4,.63)]
    for z,mul in [(-.7,.45),(.1,.92),(1.25,1)]:
        for a,b in section:vs.append(tr(a*length,b*w/2*mul,z))
    fs=[]
    for k in range(2):
        for j in range(10):a=k*10+j;b=k*10+(j+1)%10;fs.append((a,b,b+10,a+10))
    mesh('Planked transport hull',vs,fs,timber)
    for k in range(24):
        a=-length*.35+k*length*.031
        beam('Transverse deck board',tr(a,-w*.40,.96),tr(a,w*.40,.96),.10,plank,sides=4)
    for side in [-1,1]:
        tube('Raised gunwale',[tr(a*length,b*w/2*side,1.3) for a,b in [(-.5,0),(-.4,.63),(-.2,1),(.27,1),(.46,.6),(.52,0)]],.09,timber)
        for aa in [-.2,0,.2]:beam('Hull rib',tr(aa*length,side*w*.45,.1),tr(aa*length,side*w*.48,1.25),.06)
    for a in [-.1,.17]:
        for b in [-.35,.35]:beam('Canopy upright',tr(a*length,b*w,1),tr(a*length,b*w,2.8),.07)
    rv=[tr(-.15*length,-.4*w,2.7),tr(.22*length,-.4*w,2.7),tr(.22*length,0,3.2),tr(-.15*length,0,3.2),tr(-.15*length,.4*w,2.7),tr(.22*length,.4*w,2.7)]
    mesh('Linen transport canopy',rv,[(0,1,2,3),(3,2,5,4)],canvas2)
    beam('Stern sweep',tr(-.4*length,0,1.2),tr(-.68*length,-w,.1),.08)
    for a in [-.27,.30]:
        for side in [-1,1]:beam('Stored oar',tr(a*length,side*.4*w,1.2),tr((a-.17)*length,side*.9*w,.2),.045)
    return (x,y,1.4)
boat(-107,southbank(-116)+17,17,.13)
# One remote boat is a reported location for Cheng Ji, not an extra available fleet.
boat(411,river_center(411)-8,17,-.08)

def cloth_roof(name,x,y,w,d,eave,ridge,mat=canvas):
    z=height(x,y);vs=[];fs=[];nx=40;ny=32
    for j in range(ny+1):
        yy=-d/2+j*d/ny
        for i in range(nx+1):
            xx=-w/2+i*w/nx;t=abs(xx)/(w/2)
            zz=eave+(ridge-eave)*(1-t)-.18*math.sin(math.pi*t)*math.sin(math.pi*j/ny)
            zz+=.025*math.sin(i*2.1+j*.5)*t
            vs.append((x+xx,y+yy,z+zz))
    for j in range(ny):
        for i in range(nx):k=j*(nx+1)+i;fs.append((k,k+1,k+nx+2,k+nx+1))
    o=smooth(mesh(name,vs,fs,mat));solid=o.modifiers.new('Cloth thickness','SOLIDIFY');solid.thickness=.025
    return z

def tent(x,y,w=6,d=7,command=False):
    eave=2.1 if command else 1.4;ridge=4.8 if command else 3.2
    mat=canvas if random.random()<.7 else canvas2
    z=cloth_roof('Tensioned linen roof',x,y,w,d,eave,ridge,mat)
    for xx in [x-w/2+.15,x+w/2-.15]:
        for yy in [y-d/2+.1,y+d/2-.1]:beam('Tent post',(xx,yy,z),(xx,yy,z+eave),.095)
    for yy in [y-d/2,y+d/2]:beam('Ridge support',(x,yy,z),(x,yy,z+ridge),.105)
    beam('Ridge timber',(x,y-d/2,z+ridge),(x,y+d/2,z+ridge),.1)
    # Front curtains are tied open; the front is +Y, with a real interior.
    for side in [-1,1]:
        xx=x+side*w/2
        mesh('Canvas side wall',[(xx,y-d/2,z+.05),(xx,y+d/2,z+.05),(xx,y+d/2,z+eave),(xx,y-d/2,z+eave)],[(0,1,2,3)],mat)
        mesh('Open entrance flap',[(x+side*.7,y+d/2,z+.12),(xx,y+d/2,z+.1),(xx,y+d/2,z+eave),(x,y+d/2,z+ridge)],[(0,1,2,3)],mat)
    mesh('Rear tent wall',[(x-w/2,y-d/2,z),(x+w/2,y-d/2,z),(x+w/2,y-d/2,z+eave),(x,y-d/2,z+ridge),(x-w/2,y-d/2,z+eave)],[(0,1,2,3,4)],mat)
    for side in [-1,1]:
        for off in [-.46,0,.46]:
            start=(x+side*w/2,y+d*off,z+eave);end=(x+side*(w/2+1.6),y+d*off+.7,height(x+side*(w/2+1.6),y+d*off+.7)+.15)
            tube('Tent guy rope',[start,((start[0]+end[0])/2,(start[1]+end[1])/2,(start[2]+end[2])/2-.09),end],.018)
            beam('Peg',tuple(Vector(end)-Vector((0,0,.3))),tuple(Vector(end)+Vector((.08,0,.2))),.045)
    for yy in [-.3,.3]:tube('Roof sewn seam',[(x+xx,y+d*yy,z+eave+(ridge-eave)*(1-abs(xx)/(w/2))+.03) for xx in [-w/2,-w/4,0,w/4,w/2]],.012,rope)
    if command:
        for xx in [-2.5,2.5]:beam('Command awning post',(x+xx,y+d/2+4,z),(x+xx,y+d/2+4,z+2.4),.1)
        mesh('Open command awning',[(x-w/2,y+d/2,z+eave),(x+w/2,y+d/2,z+eave),(x+2.7,y+d/2+4,z+2.4),(x-2.7,y+d/2+4,z+2.4)],[(0,1,2,3)],mat)

def flag(x,y,h=6,imperial=False):
    z=height(x,y);beam('Wood standard',(x,y,z),(x,y,z+h),.075)
    vs=[];fs=[];w=1.55 if not imperial else 2.5
    for j in range(13):
        for i in range(23):
            t=i/22;vs.append((x+t*w,y+math.sin(t*8+j*.25)*.18*t,z+h-.2-j/12*2.1-.15*t*t))
    for j in range(12):
        for i in range(22):k=j*23+i;fs.append((k,k+1,k+24,k+23))
    smooth(mesh('Plain weathered standard',vs,fs,red))

def palisade_segment(a,b,gate=None):
    length=math.dist(a,b);n=round(length/.55)
    for i in range(n+1):
        t=i/n;x=a[0]+(b[0]-a[0])*t;y=a[1]+(b[1]-a[1])*t
        if gate and math.dist((x,y),gate)<5.5:continue
        z=height(x,y);h=1.6+random.random()*.25
        beam('Split stockade stake',(x,y,z-.15),(x+.05,y,z+h),.13,r2=.065,sides=5)
    # Rails in short lengths follow the slope.
    for i in range(math.ceil(length/4)):
        t=i/math.ceil(length/4);u=(i+1)/math.ceil(length/4)
        aa=(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t);bb=(a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u)
        if gate and math.dist(((aa[0]+bb[0])/2,(aa[1]+bb[1])/2),gate)<7:continue
        beam('Stockade brace',(*aa,height(*aa)+.9),(*bb,height(*bb)+.9),.075)

def gate(x,y,rz=0):
    z=height(x,y)
    def tr(a,b,c):return (x+a*math.cos(rz)-b*math.sin(rz),y+a*math.sin(rz)+b*math.cos(rz),z+c)
    for side in [-1,1]:
        beam('Gate upright',tr(side*4,0,0),tr(side*4,0,4.6),.22,r2=.17)
        beam('Gate diagonal brace',tr(side*4,0,2),tr(side*2.5,0,4.2),.10)
        for k in range(5):tube('Gate lashings',[tr(side*4+.24*math.cos(a*math.tau/16),.24*math.sin(a*math.tau/16),3.6+k*.04) for a in range(17)],.018)
    beam('Gate crossbar',tr(-4.4,0,4.15),tr(4.4,0,4.15),.20)

def table(x,y,z):
    for k in range(6):box('Table top plank',(x,y+(k-2.5)*.22,z+1.0),(2.6,.208,.13),plank)
    for dx in [-1,1]:
        for dy in [-.45,.45]:beam('Table leg',(x+dx,y+dy,z),(x+dx,y+dy,z+.96),.07)
    box('Unmarked document board',(x-.2,y,z+1.09),(.8,.55,.035),canvas)
    for i in range(2):beam('Rolled document',(x+.55,y-.2+i*.23,z+1.13),(x+1,y-.2+i*.23,z+1.13),.065,canvas)

def crate(x,y,z,sc=1):
    box('Supply crate',(x,y,z+.4*sc),(.95*sc,.65*sc,.8*sc),plank)
    for yy in [-.34,.34]:
        for xx in [-.33,.33]:box('Crate binding',(x+xx*sc,y+yy*sc,z+.4*sc),(.07*sc,.05*sc,.84*sc),timber)
def jar(x,y,z,s=1):
    vs=[];fs=[];rings=[(0,.22),(.08,.32),(.25,.40),(.65,.35),(.83,.20),(.9,.22)]
    for h,r in rings:
        for j in range(20):vs.append((x+s*r*math.cos(j*math.tau/20),y+s*r*math.sin(j*math.tau/20),z+s*h))
    for k in range(len(rings)-1):
        for j in range(20):a=k*20+j;b=k*20+(j+1)%20;fs.append((a,b,b+20,a+20))
    smooth(mesh('Storage jar',vs,fs,jar_mat))

print('Building the two separate camps',flush=True)
ACTIVE=COLS['03_Assembly_camp']
tent(-206,-192,11,11,True)
for x,y in [(-218,-158),(-219,-174),(-199,-150),(-157,-148),(-159,-187),(-181,-201),(-223,-197)]:tent(x,y)
for a,b,g in [((-233,-213),(-142,-213),None),((-233,-213),(-233,-137),(-233,-187)),((-233,-137),(-142,-137),(-170,-137)),((-142,-213),(-142,-137),(-142,-169))]:palisade_segment(a,b,g)
gate(-142,-169,math.pi/2);gate(-170,-137,0);gate(-233,-187,math.pi/2)
flag(-146,-174,6);flag(-174,-137,6)
table(-205,-183,height(-205,-183))
for i in range(12):
    x=-215+random.uniform(-1,6);y=-184+random.uniform(-1,4);crate(x,y,height(x,y),random.uniform(.8,1.25))
for x,y in [(-199,-182),(-198,-181),(-164,-183),(-165,-183),(-200,-183)]:jar(x,y,height(x,y))
# A working supply cart provides a human-scale foreground without inventing troops.
cx,cy=-192,-162;cz=height(cx,cy)
for i in range(9):box('Cart bed plank',(cx,cy+(i-4)*.28,cz+1.03),(1.9,.26,.12),plank)
beam('Cart axle',(cx-1.3,cy,cz+.7),(cx+1.3,cy,cz+.7),.12)
for side in [-1,1]:
    xx=cx+side*1.15
    tube('Cart wheel rim',[(xx,cy+.65*math.sin(k*math.tau/40),cz+.7+.65*math.cos(k*math.tau/40)) for k in range(41)],.075,timber)
    for k in range(10):beam('Cart wheel spoke',(xx,cy,cz+.7),(xx,cy+.62*math.sin(k*math.tau/10),cz+.7+.62*math.cos(k*math.tau/10)),.025)
    beam('Cart shaft',(cx+side*.65,cy-.8,cz+.8),(cx+side*.65,cy+3.6,cz+.4),.07)
    beam('Cart side rail',(cx+side*.95,cy-1.25,cz+1.7),(cx+side*.95,cy+1.25,cz+1.7),.06)
    for dy in [-1.25,1.25]:beam('Cart upright',(cx+side*.95,cy+dy,cz+1),(cx+side*.95,cy+dy,cz+1.7),.06)
crate(cx,cy-.3,cz+1.09,.9);crate(cx+.1,cy+.5,cz+1.09,.65)
for x,y in [(-196,-175),(-197,-175),(-197,-176)]:crate(x,y,height(x,y),.9)
# A six-metre timber lookout at the camp's rear gives a readable view of the nearby imperial camp.
tx,ty=-231,-189;tz=height(tx,ty)
for dx in [-1.8,1.8]:
    for dy in [-1.8,1.8]:beam('Lookout upright',(tx+dx,ty+dy,tz),(tx+dx,ty+dy,tz+7),.17,r2=.12)
for k in range(14):box('Lookout deck plank',(tx,ty+(k-6.5)*.27,tz+6),(3.9,.25,.14),plank)
for dy in [-1.8,1.8]:
    beam('Lookout cross brace',(tx-1.8,ty+dy,tz+.5),(tx+1.8,ty+dy,tz+5.8),.09)
    beam('Lookout guard rail',(tx-1.8,ty+dy,tz+6.85),(tx+1.8,ty+dy,tz+6.85),.06)
for side in [-1,1]:beam('Lookout ladder rail',(tx+2.0+side*.36,ty+4.0,tz),(tx+2.0+side*.36,ty,tz+6),.07)
for k in range(15):
    t=k/14;beam('Lookout ladder rung',(tx+1.64,ty+4*(1-t),tz+6*t),(tx+2.36,ty+4*(1-t),tz+6*t),.035)
# Low shelter by the river-facing lookout leaves the visual axis open.
for x,y in [(-187,-139),(-181,-139)]:beam('Lookout canopy post',(x,y,height(x,y)),(x,y,height(x,y)+3),.09)
mesh('Lookout awning',[(-188,-139,26),(-180,-139,26),(-180,-145,26.5),(-188,-145,26.5)],[(0,1,2,3)],canvas2)
ACTIVE=COLS['04_Imperial_camp']
tent(*IMPERIAL,16,14,True)
for x,y in [(-347,-262),(-332,-282),(-301,-285),(-284,-265),(-290,-244),(-345,-241)]:tent(x,y,7,8)
flag(-308,-241,10,True);flag(-328,-241,10,True)
for a,b,g in [((-373,-290),(-264,-290),None),((-373,-290),(-373,-229),None),((-373,-229),(-264,-229),(-281,-229)),((-264,-290),(-264,-229),None)]:palisade_segment(a,b,g)
gate(-281,-229)

ACTIVE=COLS['08_Distant_landmarks']
# Geographical cues; they do not assert new armies or successful rescues.
for x,y in [(430,-182),(443,-185),(451,-174)]:tent(x,y,5,6)
for x,y in [(176,263),(190,268),(200,257),(182,279)]:tent(x,y,6,7)
flag(179,254,7)

# A real branching canopy with individual folded leaves, not spherical clumps.
ACTIVE=COLS['06_Vegetation']
def tree_template(seed):
    rnd=random.Random(seed);vs=[];fs=[];mi=[]
    def add_branch(a,b,ra,rb):
        a,b=Vector(a),Vector(b);axis=(b-a).normalized();u=axis.cross(Vector((0,0,1)))
        if u.length<.01:u=Vector((1,0,0))
        u.normalize();v=axis.cross(u);off=len(vs);count=6
        for pos,r in [(a,ra),(b,rb)]:
            vs.extend([tuple(pos+r*(u*math.cos(k*math.tau/count)+v*math.sin(k*math.tau/count))) for k in range(count)])
        for k in range(count):fs.append((off+k,off+(k+1)%count,off+(k+1)%count+count,off+k+count));mi.append(0)
    def leaves(center,spread,count):
        center=Vector(center)
        for _ in range(count):
            p=center+Vector((rnd.gauss(0,spread),rnd.gauss(0,spread),rnd.gauss(0,spread*.6)))
            ang=rnd.random()*math.tau;tilt=rnd.uniform(-.6,.6);length=rnd.uniform(.13,.28);width=length*.45
            u=Vector((math.cos(ang),math.sin(ang),tilt));v=Vector((-math.sin(ang),math.cos(ang),0));off=len(vs)
            vs.extend([tuple(p-u*length),tuple(p-v*width),tuple(p+Vector((0,0,.035))),tuple(p+u*length),tuple(p+v*width)])
            for face in [(0,1,2),(1,3,2),(3,4,2),(4,0,2)]:fs.append(tuple(off+i for i in face));mi.append(1+rnd.randrange(4))
    top=Vector((rnd.uniform(-.35,.35),rnd.uniform(-.35,.35),7.5))
    add_branch((0,0,0),top,.24,.04)
    for j in range(13):
        az=j*2.4+rnd.random()*.5;z=2+j*.37;length=rnd.uniform(1.5,3.1)*(1-.026*j)
        a=Vector((0,0,z));b=a+Vector((math.cos(az)*length,math.sin(az)*length,rnd.uniform(.8,1.8)))
        add_branch(a,b,.09*(1-j*.04),.018)
        for k in range(6):
            t=.35+k*.12;start=a.lerp(b,t);aa=az+(1 if k%2 else -1)*rnd.uniform(.5,1.4)
            end=start+Vector((math.cos(aa)*rnd.uniform(.6,1.3),math.sin(aa)*rnd.uniform(.6,1.3),rnd.uniform(.2,.8)))
            add_branch(start,end,.023,.006);leaves(end,.38,rnd.randint(55,75))
    leaves(top,.5,120)
    o=mesh('Tree master '+str(seed),vs,fs)
    for m in [timber]+leafmats:o.data.materials.append(m)
    for p,idx in zip(o.data.polygons,mi):p.material_index=idx;p.use_smooth=True
    me=o.data;bpy.data.objects.remove(o,do_unlink=True);return me

print('Building branching tree library',flush=True)
masters=[tree_template(90+i) for i in range(7)]
def instance(name,me,loc,sc,rz=0):
    o=link(bpy.data.objects.new(name,me));o.location=loc;o.scale=sc;o.rotation_euler.z=rz;return o
tree_count=0
for i in range(18000):
    x=random.uniform(-760,900);y=random.uniform(-700,900);z=height(x,y)
    if southbank(x)-8<y<northbank(x)+10:continue
    if min(max(abs(x-CAMP[0])/68,abs(y-CAMP[1])/55),max(abs(x-IMPERIAL[0])/78,abs(y-IMPERIAL[1])/48))<1:continue
    if distance_to_route(x,y)<7:continue
    if -340<x<-225 and -280<y<-175:continue
    vx,vy=94,-102;vt=clamp(((x+139)*vx+(y+170)*vy)/(vx*vx+vy*vy))
    if math.hypot(x+139-vx*vt,y+170-vy*vt)<11:continue
    if min(math.dist((x,y),p) for p in [(183,266),(446,-179)])<26:continue
    patch=nval(x,y,.012)
    if patch<-.12 or z>205:continue
    # Keep the river view corridor open, with irregular wooded edges.
    if -201<x<-83 and -143<y<-37:continue
    sc=random.uniform(.75,1.55);instance('Woodland tree',random.choice(masters),(x,y,z-.05),(sc,sc,sc*random.uniform(.9,1.15)),random.random()*math.tau);tree_count+=1
for x,y,sc in [(-235,-149,1.3),(-228,-124,1.5),(-139,-193,1.05),(-133,-141,1.2),(-111,-89,1.3),(-91,-67,1.25),(-48,-198,1.4),(31,-224,1.2)]:
    instance('Foreground tree',random.choice(masters),(x,y,height(x,y)),(sc,sc,sc),random.random()*math.tau)

# Broken stone ledges and shingle have their own geometry at human scale.
def rock_template(seed):
    rnd=random.Random(seed);vs=[];fs=[];rings=6;seg=9
    for j in range(rings):
        th=math.pi*j/(rings-1)
        for i in range(seg):
            ph=i*math.tau/seg;rr=1+rnd.uniform(-.23,.23);vs.append((math.sin(th)*math.cos(ph)*rr,math.sin(th)*math.sin(ph)*rr,math.cos(th)*rr))
    for j in range(rings-1):
        for i in range(seg):a=j*seg+i;b=j*seg+(i+1)%seg;fs.append((a,b,b+seg,a+seg))
    o=mesh('Stone master',vs,fs,stone);me=o.data;bpy.data.objects.remove(o,do_unlink=True);return me
rocks=[rock_template(i) for i in range(5)]
ACTIVE=COLS['07_Props']
for i in range(1550):
    x=random.uniform(-420,570);y=random.uniform(-470,440)
    if southbank(x)-2<y<northbank(x)+2:continue
    if distance_to_route(x,y)<2.7:continue
    if max(abs(x-CAMP[0])/52,abs(y-CAMP[1])/43)<1:continue
    z=height(x,y);r=random.uniform(.15,.9)
    if z>40:r*=random.uniform(1,4)
    instance('Loose limestone',random.choice(rocks),(x,y,z),(r,r*.7,r*.45),random.random()*math.tau)
for i in range(450):
    x=random.uniform(-225,-145);y=random.uniform(-211,-135)
    if distance_to_route(x,y)<2:continue
    r=random.uniform(.025,.12);instance('Camp gravel',random.choice(rocks),(x,y,height(x,y)),(r,r*.7,r*.45),random.random()*math.tau)

ACTIVE=COLS['09_Cameras_lighting']
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=48
scene.cycles.use_denoising=True;scene.cycles.max_bounces=6;scene.cycles.diffuse_bounces=3;scene.cycles.glossy_bounces=3
scene.render.threads_mode='FIXED';scene.render.threads=12
scene.render.resolution_x=1920;scene.render.resolution_y=1080;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=.5
world=bpy.data.worlds.new('Soft neutral daylight');scene.world=world;world.use_nodes=True
bg=world.node_tree.nodes.get('Background');bg.inputs[1].default_value=.65
env=world.node_tree.nodes.new('ShaderNodeTexEnvironment');env.image=bpy.data.images.load(os.path.join(ROOT,'textures','kloofendal_48d_partly_cloudy_puresky_2k.hdr'),check_existing=True)
world.node_tree.links.new(env.outputs[0],bg.inputs[0])
sun_data=bpy.data.lights.new('Late afternoon sun','SUN');sun_data.energy=1.4;sun_data.angle=math.radians(6)
sun=link(bpy.data.objects.new('Late afternoon sun',sun_data));sun.rotation_euler=(math.radians(32),math.radians(-24),math.radians(-55))
# Ambient distance haze is a compositor mist pass; no blanket opaque volume.
world.mist_settings.start=600;world.mist_settings.depth=6500;world.mist_settings.falloff='LINEAR'
scene.view_layers[0].use_pass_mist=True
comp=bpy.data.node_groups.new('Distance atmosphere','CompositorNodeTree');scene.compositing_node_group=comp
comp.interface.new_socket(name='Image',in_out='OUTPUT',socket_type='NodeSocketColor')
ns=comp.nodes;ls=comp.links;rl=ns.new('CompositorNodeRLayers');mix=ns.new('ShaderNodeMixRGB');mix.blend_type='MIX'
fac=ns.new('ShaderNodeMath');fac.operation='MULTIPLY';fac.inputs[1].default_value=.25
ls.new(rl.outputs['Mist'],fac.inputs[0]);ls.new(fac.outputs[0],mix.inputs[0]);ls.new(rl.outputs['Image'],mix.inputs[1]);mix.inputs[2].default_value=(.48,.57,.62,1)
out=ns.new('NodeGroupOutput');ls.new(mix.outputs[0],out.inputs['Image'])

def camera(key,title,loc,target,lens=50):
    data=bpy.data.cameras.new(key);o=link(bpy.data.objects.new(key,data));o.location=loc
    o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler();data.lens=lens;data.clip_end=7000;data.clip_start=.1
    o['title']=title;return o
cameras={
 'camp':camera('camp','大本营',(-203,-180,24.72),(-172,-141,23.8),40),
 'river':camera('river','营门望江',(-169,-132,height(-169,-132)+1.72),(-112,15,3),50),
 'east':camera('east','东侧陆路',(-166,-170,24.72),(120,-165,32),50),
 'south':camera('south','山路岔口',(-102,-166,surface_height(-102,-166)+1.72),(-90,-208,surface_height(-90,-208)+.3),50),
 'imperial':camera('imperial','高处望御营',(-231,-189,tz+7.72),(-315,-254,33),50),
 'overview':camera('overview','调度总览',(170,-1240,1140),(18,20,12),48)
}
targets={'camp':(*CAMP,23.3),'imperial':(*IMPERIAL,36),'dock':(-116,southbank(-116)+3,1.8),
         'north':(-88,northbank(-88)-3,1.8),'fu':(451,-177,height(451,-177)+4),
         'huang':(185,260,height(185,260)+4),'cheng':(411,river_center(411)-8,2),
         'sha':(4,-391,height(4,-391)+1),'junction':(-102,-166,surface_height(-102,-166)+1)}
labels={'camp':'大本营','imperial':'刘备御营','dock':'南岸渡口','north':'北岸泊点','fu':'傅肜方向','huang':'黄权方向','cheng':'程畿方向','sha':'沙摩柯方向','junction':'山路岔口'}
worldroutes={key:[(x,y,surface_height(x,y)+.16) for x,y in dense(value)] for key,value in routes.items()}
for key in ['dock','north']:
    worldroutes[key]=[(x,y,max(1.25,z)) for x,y,z in worldroutes[key]]
worldroutes['dock'].append((-116,southbank(-116)+10,1.25))
waterstart=(-116,southbank(-116)+10,.5)
worldroutes['huang']=worldroutes['dock']+[waterstart,(-109,50,.5),(-96,116,.5),(-88,northbank(-88)-10,.5)]+worldroutes['north']
worldroutes['cheng']=worldroutes['dock']+[waterstart]+[(x,river_center(x)-8,.5) for x in range(-110,412,15)]+[targets['cheng']]
manifest={'version':'yiling-camp-v2-20261106','status':'draft-for-user-review',
          'historicalScope':'Game-authored assembly camp near Liu Bei imperial camp, south bank. All local terrain, distances and four-route positions are narrative staging.',
          'campIdentity':'刘备御营附近的集结营，玩家界面称大本营；用户2026-11-06确认。',
          'unit':'metres for model scale only; not historical travel distance','axes':{'x':'east','y':'north','z':'up'},
          'cameras':{},'landmarks':{},'routes':worldroutes,'geometry':{'treeInstances':tree_count}}
bpy.context.view_layer.update()
for key,cam in cameras.items():
    scene.camera=cam
    def proj(co):
        p=world_to_camera_view(scene,cam,Vector(co));return {'x':round(p.x,6),'y':round(1-p.y,6),'depth':round(p.z,3),'inFrame':p.z>0 and 0<p.x<1 and 0<p.y<1}
    manifest['cameras'][key]={'title':cam['title'],'image':key+'.png','location':list(cam.location),'lens':cam.data.lens,
       'points':{k:{**proj(v),'label':labels[k]} for k,v in targets.items()},
       'routes':{k:[proj(p) for p in values] for k,values in worldroutes.items()}}
for k,v in targets.items():manifest['landmarks'][k]={'world':v,'label':labels[k]}
scene.camera=cameras['camp']
scene['Status']='Draft; not approved by user'
scene['Historical scope']=manifest['historicalScope']
scene['Camp identity']=manifest['campIdentity']
manifest['routeLegs']={'fu':[{'mode':'land','path':'fu'}],'sha':[{'mode':'land','path':'sha'}],
 'huang':[{'mode':'land','path':'dock'},{'mode':'water','from':'dock','to':'north'},{'mode':'land','path':'north'}],
 'cheng':[{'mode':'land','path':'dock'},{'mode':'water','from':'dock','to':'cheng'}]}
json.dump(manifest,open(os.path.join(ROOT,'camera-layout.json'),'w',encoding='utf-8'),ensure_ascii=False,indent=2)
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'yiling-camp-v2.blend'))
print('BUILD_SAVED',round(time.time()-START,1),'seconds',len(bpy.data.objects),'objects',flush=True)
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
if '--preview' in args:
    scene.cycles.samples=12;scene.render.resolution_percentage=50
    for key in ['camp','river','overview','east','imperial','south']:
        scene.camera=cameras[key];scene.render.filepath=os.path.join(ROOT,key+'-preview.png');bpy.ops.render.render(write_still=True)
        print('PREVIEW_SAVED',key,round(time.time()-START,1),flush=True)
