import bpy, math, random, os, json, sys
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
random.seed(82)
OUT=os.path.dirname(os.path.abspath(__file__))
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def material(name,colors,scale=1,rough=.8,bump=.25):
 m=bpy.data.materials.new(name);m.use_nodes=True;n=m.node_tree.nodes;l=m.node_tree.links;p=n.get('Principled BSDF');p.inputs['Roughness'].default_value=rough
 g=n.new('ShaderNodeNewGeometry');t=n.new('ShaderNodeTexNoise');t.inputs['Scale'].default_value=scale;t.inputs['Detail'].default_value=5;t.inputs['Roughness'].default_value=.75;l.new(g.outputs['Position'],t.inputs['Vector'])
 r=n.new('ShaderNodeValToRGB');r.color_ramp.elements[0].color=(*colors[0],1);r.color_ramp.elements[1].color=(*colors[-1],1)
 if len(colors)>2:r.color_ramp.elements.new(.5).color=(*colors[1],1)
 l.new(t.outputs['Fac'],r.inputs[0]);l.new(r.outputs[0],p.inputs['Base Color']);b=n.new('ShaderNodeBump');b.inputs['Strength'].default_value=bump;b.inputs['Distance'].default_value=.12;l.new(t.outputs['Fac'],b.inputs['Height']);l.new(b.outputs[0],p.inputs['Normal']);return m
soil=material('Mountain heath and earth',[(.055,.085,.051),(.17,.21,.105),(.30,.28,.18)],1.3)
stone=material('Stratified grey rock',[(.075,.09,.085),(.22,.245,.215),(.40,.40,.34)],2.2,.92,.5)
roadmat=material('Worn dirt and gravel',[(.14,.115,.078),(.28,.25,.175),(.43,.39,.29)],4,.96,.4)
sand=material('Sand and river gravel',[(.22,.23,.18),(.38,.37,.28),(.57,.54,.42)],4,.95,.4)
wood=material('Weathered timber',[(.055,.035,.02),(.16,.095,.047),(.27,.19,.105)],8,.85,.4)
char=material('Charred timber',[(.009,.011,.009),(.035,.031,.025)],5)
cloth=material('Weathered flax canvas',[(.24,.235,.19),(.47,.46,.37),(.65,.63,.52)],7,.95,.18)
red=material('Dark vermilion cloth',[(.065,.012,.009),(.21,.035,.021)],7)
leaves=[material('Leaf variation '+str(i),[tuple(c*.55 for c in col),col,tuple(c*1.22 for c in col)],8,.9,.35) for i,col in enumerate([(.055,.14,.063),(.10,.185,.07),(.14,.215,.085),(.075,.17,.12),(.18,.22,.095)])]
river_mat=material('River moving water',[(.025,.085,.09),(.07,.18,.18),(.16,.28,.265)],1.8,.19,.12)
p=river_mat.node_tree.nodes.get('Principled BSDF');p.inputs['Metallic'].default_value=.15
def mesh(name,v,f,m):
 me=bpy.data.meshes.new(name);me.from_pydata(v,[],f);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o)
 if m:o.data.materials.append(m)
 return o
def cube_mesh():return [(-.5,-.5,-.5),(.5,-.5,-.5),(.5,.5,-.5),(-.5,.5,-.5),(-.5,-.5,.5),(.5,-.5,.5),(.5,.5,.5),(-.5,.5,.5)],[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
V,F=cube_mesh();cube_cache={}
def box(n,loc,scale,m,rot=0):
 if m.name not in cube_cache:
  me=bpy.data.meshes.new('Shared timber');me.from_pydata(V,[],F);me.materials.append(m);cube_cache[m.name]=me
 o=bpy.data.objects.new(n,cube_cache[m.name]);bpy.context.collection.objects.link(o);o.location=loc;o.scale=scale;o.rotation_euler.z=rot;return o
def beam(n,a,b,r,m):
 d=Vector(b)-Vector(a);o=box(n,(Vector(a)+Vector(b))/2,(r,r,d.length),m);o.rotation_euler=d.to_track_quat('Z','Y').to_euler();return o
def channel(x):return 4+2.8*math.sin(x*.058)+.7*math.sin(x*.13)
def terrain(x,y):
 d=abs(y-channel(x));s=max(0,min(1,(d-4.2)/3.5));h=.45
 for cx,cy,a,sx,sy in [(-42,25,14,90,50),(-20,29,18,115,55),(5,32,21,110,60),(31,28,17,90,50),(49,21,13,90,55),(-44,-22,10,100,55),(8,-31,12,125,45),(37,-27,15,100,55)]:h+=a*math.exp(-((x-cx)**2/sx+(y-cy)**2/sy))
 ridge=.42*math.sin(x*.63+y*.27)+.27*math.sin(x*1.11-y*.7)+.13*math.sin(x*2.7+y*1.5)
 return -.38+s*max(.85,h+ridge*max(1,h*.2))
NX=501;NY=361;v=[];f=[]
for j in range(NY):
 y=-60+j*145/(NY-1)
 for i in range(NX):
  x=-105+i*210/(NX-1);v.append((x,y,terrain(x,y)))
for j in range(NY-1):
 for i in range(NX-1):
  a=j*NX+i;f.append((a,a+1,a+NX+1,a+NX))
land=mesh('Continuous mountainous terrain',v,f,soil);land.data.materials.append(stone)
for poly in land.data.polygons:
 poly.use_smooth=True
 poly.material_index=0
n=soil.node_tree.nodes;l=soil.node_tree.links;p=n.get('Principled BSDF');old=p.inputs['Base Color'].links[0].from_socket
g=n.new('ShaderNodeNewGeometry');sep=n.new('ShaderNodeSeparateXYZ');l.new(g.outputs['Normal'],sep.inputs[0]);r=n.new('ShaderNodeMapRange');r.inputs['From Min'].default_value=.55;r.inputs['From Max'].default_value=.96;l.new(sep.outputs['Z'],r.inputs['Value']);mix=n.new('ShaderNodeMixRGB');mix.inputs[1].default_value=(.23,.255,.235,1);l.new(r.outputs[0],mix.inputs[0]);l.new(old,mix.inputs[2]);l.new(mix.outputs[0],p.inputs['Base Color'])
box('Continuous river',(0,5,-.21),(220,155,.12),river_mat)
routes={'fu':[(-35,-6),(-26,-9),(-16,-10),(-3,-10),(12,-11),(28,-12)],'sha':[(-26,-9),(-23,-15),(-16,-19),(-7,-20)],'dock':[(-35,-6),(-28,-4),(-19,-2),(-11,-3)],'huang':[(-10,7),(-5,15),(6,16),(17,16)]}
targets={'camp':(-35,-6),'fu':(28,-12),'sha':(-7,-20),'huang':(17,16),'cheng':(27,channel(27)),'dock':(-11,-3),'north':(-10,7)}
def pathdist(x,y):
 best=999
 for pts in routes.values():
  for a,b in zip(pts,pts[1:]):
   dx=b[0]-a[0];dy=b[1]-a[1];t=max(0,min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));best=min(best,math.hypot(x-a[0]-dx*t,y-a[1]-dy*t))
 return best
def strip(name,pts,w,m,offset=.045):
 vs=[]
 for k,(x,y) in enumerate(pts):
  a=pts[max(0,k-1)];b=pts[min(len(pts)-1,k+1)];dx=b[0]-a[0];dy=b[1]-a[1];l=max(.01,math.hypot(dx,dy))
  for sign in [-1,1]:
   xx=x-dy/l*w*sign;yy=y+dx/l*w*sign;vs.append((xx,yy,terrain(xx,yy)+offset))
 fs=[(i,i+1,i+3,i+2) for i in range(0,len(vs)-2,2)];return mesh(name,vs,fs,m)
for name,pts in routes.items():
 dense=[]
 for a,b in zip(pts,pts[1:]):
  for k in range(25):
   t=k/25;dense.append((a[0]*(1-t)+b[0]*t,a[1]*(1-t)+b[1]*t))
 dense.append(pts[-1]);strip('Unpaved route '+name,dense,.58,roadmat)
 for side in [-1,1]:strip('Cart wheel rut',[(x,y+side*.22) for x,y in dense],.035,wood,.051)
for side in [-1,1]:strip('Pebbled bank',[(x/3,channel(x/3)+side*4.65) for x in range(-240,241)],.48,sand,.045)
# Shared irregular rocks and intricate crown clusters, instanced without operators.
def ellipsoid_data(seed):
 rnd=random.Random(seed);vs=[];faces=[];rings=7;segments=11
 for j in range(rings):
  th=math.pi*j/(rings-1)
  for i in range(segments):
   ph=2*math.pi*i/segments;r=1+rnd.uniform(-.16,.16);vs.append((r*math.sin(th)*math.cos(ph),r*math.sin(th)*math.sin(ph),r*math.cos(th)))
 for j in range(rings-1):
  for i in range(segments):a=j*segments+i;b=j*segments+(i+1)%segments;faces.append((a,b,b+segments,a+segments))
 return vs,faces
rockmesh=[]
for i in range(5):
 vv,ff=ellipsoid_data(i);o=mesh('Rock template',vv,ff,stone);rockmesh.append(o.data);bpy.data.objects.remove(o,do_unlink=True)
def inst(name,me,loc,sc,rz=0):
 o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);o.location=loc;o.scale=sc;o.rotation_euler.z=rz;return o
tree_mesh=[]
for variant in range(6):
 vv=[];ff=[];mi=[];rnd=random.Random(100+variant)
 for k in range(22):
  ang=k*2.4;rad=rnd.uniform(.15,.72);cx=math.cos(ang)*rad;cy=math.sin(ang)*rad;cz=1.3+rnd.uniform(-.25,.65);size=rnd.uniform(.28,.53);pv,pf=ellipsoid_data(k+variant*31);off=len(vv);vv.extend([(cx+x*size,cy+y*size,cz+z*size*.8) for x,y,z in pv]);ff.extend([tuple(q+off for q in fa) for fa in pf]);mi.extend([k%5]*len(pf))
 o=mesh('Shared broadleaf canopy',vv,ff,None)
 for m in leaves:o.data.materials.append(m)
 for k,poly in enumerate(o.data.polygons):poly.material_index=mi[k];poly.use_smooth=True
 tree_mesh.append(o.data);bpy.data.objects.remove(o,do_unlink=True)
# Forest distribution follows ridges and forest patches instead of uniform dots.
for i in range(6800):
 x=random.uniform(-72,72);y=random.uniform(-40,48);z=terrain(x,y)
 if math.hypot(x-39,y+4)<7 or abs(y-channel(x))<6 or pathdist(x,y)<2.6 or min(math.hypot(x-a,y-b) for a,b in targets.values())<5.2:continue
 cluster=math.sin(x*.19+y*.11)+math.sin(y*.28-x*.09)
 if cluster<-.15 or z>15:continue
 sc=random.uniform(.65,1.35);inst('Forest canopy',random.choice(tree_mesh),(x,y,z),(sc,sc,sc*random.uniform(.85,1.2)),random.random()*6.28);box('Tree trunk',(x,y,z+.65*sc),(.11*sc,.13*sc,1.3*sc),wood)
for i in range(850):
 x=random.uniform(-65,65);y=random.uniform(-36,38);z=terrain(x,y)
 if abs(y-channel(x))<4.5 or pathdist(x,y)<.7:continue
 if z>4 or abs(y-channel(x))<6:
  r=random.uniform(.12,1.2);inst('Eroded stone',random.choice(rockmesh),(x,y,z),(r,r*.7,r*.6),random.random()*6)
# Camps: tents have sagged cloth, wooden ridge poles, open entries, rope stakes.
def tent(x,y,s=1,burn=False):
 z=terrain(x,y);vs=[];fs=[]
 for j in range(9):
  yy=y-s+j*s/4
  for i in range(13):
   xx=x-s+i*s/6;zz=z+.13+s*(1-abs((xx-x)/s))+.055*math.sin(i*1.5+j*.8);vs.append((xx,yy,zz))
 for j in range(8):
  for i in range(12):a=j*13+i;fs.append((a,a+1,a+14,a+13))
 mesh('Canvas tent roof',vs,fs,char if burn else cloth)
 for yy in [y-s,y+s]:beam('Tent ridge support',(x,yy,z),(x,yy,z+s),.07,wood)
 beam('Tent ridge pole',(x,y-s,z+s),(x,y+s,z+s),.06,wood)
 for dx in [-1,1]:
  for dy in [-1,1]:beam('Tent rope',(x+dx*s,y+dy*s,z+.15),(x+dx*s*1.25,y+dy*s*1.2,z),.022,wood)
def flag(x,y,s=1):
 z=terrain(x,y);beam('Military standard',(x,y,z),(x,y,z+3*s),.075*s,wood)
 vs=[];fs=[]
 for j in range(6):
  for i in range(9):vs.append((x+i*.15*s,y+.12*s*math.sin(i*.9+j*.4),z+(2.1+j*.15)*s))
 for j in range(5):
  for i in range(8):a=j*9+i;fs.append((a,a+1,a+10,a+9))
 mesh('Weathered vermilion standard',vs,fs,red)
def camp(cx,cy,rows,cols,burn=False):
 for j in range(rows):
  for i in range(cols):tent(cx+(i-(cols-1)/2)*2.8,cy+j*2.8,.95,burn)
 for x in [cx-cols*1.6,cx+cols*1.6]:
  for k in range(rows*8):
   y=cy-1.7+k*.36;z=terrain(x,y);box('Palisade stake',(x,y,z+.65),(.16,.18,1.3),char if burn else wood)
  beam('Palisade rail',(x,cy-1.7,terrain(x,cy)+.7),(x,cy+rows*2.8,terrain(x,cy+rows*2.8)+.7),.12,wood)
 flag(cx-cols*1.6,cy-1.7,1.2);flag(cx+cols*1.6,cy-1.7,1.2)
camp(-37,-9,3,3);camp(30,-15,2,3);camp(18,18,2,3);tent(-7,-22,1.2);flag(-9,-22)
camp(39,-6,2,3,True)
# Piers are laid in planks, extend from land into the river and stand on piles.
def pier(x,y,sign):
 for k in range(22):box('Landing plank',(x,y+sign*k*.16,.65),(2.9,.145,.12),wood)
 for dx in [-1.25,1.25]:
  for k in [1,9,19]:box('Landing timber pile',(x+dx,y+sign*k*.16,-.1),(.18,.18,1.5),wood)
pier(-11,-3,1);pier(-10,7,-1)
def boat(x,y,s=1,angle=0):
 def tr(a,b,c):return (x+s*(a*math.cos(angle)-b*math.sin(angle)),y+s*(a*math.sin(angle)+b*math.cos(angle)),c*s)
 vs=[]
 for z,w in [(-.1,.35),(.2,.8),(.52,.88)]:
  for a,b in [(-2.3,0),(-1.5,-w),(1.5,-w),(2.3,0),(1.5,w),(-1.5,w)]:vs.append(tr(a,b,z))
 fs=[]
 for j in range(2):
  for i in range(6):a=j*6+i;b=j*6+(i+1)%6;fs.append((a,b,b+6,a+6))
 fs.append(tuple(range(12,18)));mesh('River transport hull',vs,fs,wood)
 for k in range(17):
  a=-1.6+k*.2;beam('Deck plank',tr(a,-.68,.55),tr(a,.68,.55),.08*s,wood)
 for a in [-.6,.7]:
  for b in [-.55,.55]:beam('Cabin support',tr(a,b,.55),tr(a,b,1.3),.065*s,wood)
 roof=[tr(-.85,-.7,1.25),tr(.95,-.7,1.25),tr(.95,0,1.55),tr(-.85,0,1.55),tr(-.85,.7,1.25),tr(.95,.7,1.25)]
 mesh('Woven cabin canopy',roof,[(0,1,2,3),(3,2,5,4)],cloth)
 beam('Boat mast',tr(-1,0,.6),tr(-1,0,3),.07*s,wood);beam('Furled sail spar',tr(-1,-.8,2.6),tr(-1,.8,2.6),.1*s,cloth)
 for a in [-1.3,.9,1.4]:
  for side in [-1,1]:beam('Working oar',tr(a,.5*side,.65),tr(a-.8,1.65*side,.05),.045*s,wood)
 for side in [-1,1]:beam('Gunwale',tr(-1.6,.8*side,.58),tr(1.6,.8*side,.58),.08*s,wood)
boat(-11,3,.8);boat(-6,5,.7,.1);boat(26,channel(26),1.2,-.1);boat(32,channel(32)+1.0,1.05,.15)
# Sparse grass beside routes, supply crates and carts in the departure camp.
gv=[];gf=[]
for k in range(7):
 a=k*2.4;off=len(gv);xx=math.cos(a)*.13;yy=math.sin(a)*.13;gv.extend([(xx-.025,yy,0),(xx+.025,yy,0),(xx+.08,yy+.03,.35+random.random()*.2)]);gf.append((off,off+1,off+2))
go=mesh('Grass clump template',gv,gf,leaves[2]);gm=go.data;bpy.data.objects.remove(go,do_unlink=True)
for i in range(2200):
 x=random.uniform(-50,50);y=random.uniform(-30,24)
 if abs(y-channel(x))>6 and terrain(x,y)<4 and .75<pathdist(x,y)<4:inst('Grass verge',gm,(x,y,terrain(x,y)),(1,1,1),random.random()*6)
for i in range(12):
 x=-41+random.random()*4;y=-7+random.random()*5;box('Supply chest',(x,y,terrain(x,y)+.25),(.7,.5,.5),wood)
# Smoke made from volumetric billows, only over burned camp, clear of routes.
smoke=bpy.data.materials.new('Thin grey smoke');smoke.use_nodes=True;n=smoke.node_tree.nodes;n.clear();out=n.new('ShaderNodeOutputMaterial');vol=n.new('ShaderNodeVolumePrincipled');vol.inputs['Color'].default_value=(.22,.235,.23,1);vol.inputs['Density'].default_value=.035;smoke.node_tree.links.new(vol.outputs['Volume'],out.inputs['Volume'])
fire=bpy.data.materials.new('Dark red embers');fire.use_nodes=True;p=fire.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(.22,.013,.002,1);p.inputs['Emission Color'].default_value=(1,.055,.003,1);p.inputs['Emission Strength'].default_value=2
for j in range(3):
 x=36+j*2.4;y=-4+j*.8;z=terrain(x,y)
 for k in range(5):
  o=inst('Drifting smoke',rockmesh[k%5],(x+k*.42,y+.2*k,z+1+k*1.2),(.6+k*.23,.55+k*.2,.8+k*.18));o.data=o.data.copy();o.data.materials.clear();o.data.materials.append(smoke)
 for k in range(4):
  o=inst('Local ember flame',rockmesh[k%5],(x+random.uniform(-.7,.7),y+random.uniform(-.5,.5),z+.4),(.13,.16,.55));o.data=o.data.copy();o.data.materials.clear();o.data.materials.append(fire)
world=bpy.context.scene.world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.58,.68,.78,1);world.node_tree.nodes['Background'].inputs[1].default_value=.38
bpy.ops.object.light_add(type='SUN',location=(-30,-20,60));sun=bpy.context.object;sun.rotation_euler=(.48,-.55,-.45);sun.data.energy=2.3;sun.data.angle=.12
bpy.ops.object.camera_add(location=(3,-110,112));cam=bpy.context.object;cam.name='Map camera';cam.data.lens=50;cam.rotation_euler=(Vector((0,2,0))-cam.location).to_track_quat('-Z','Y').to_euler()
scene=bpy.context.scene;scene.camera=cam;scene.render.engine='CYCLES';scene.cycles.use_denoising=True;scene.cycles.samples=12;scene.render.resolution_x=1920;scene.render.resolution_y=1080;scene.render.resolution_percentage=60;scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX';scene.render.filepath=os.path.join(OUT,'battlefield-preview.png')
bpy.context.view_layer.update()
def project(x,y,z=None):
 p=world_to_camera_view(scene,cam,Vector((x,y,terrain(x,y)+.25 if z is None else z)));return [round(p.x,6),round(1-p.y,6)]
meta={'status':'draft-for-review','image':'yiling-battlefield.png','size':[1920,1080],'coordinates':'normalized top-left origin','historical_accuracy':'narrative-compressed terrain, not historical reconstruction','targets':{k:{'world':[x,y],'position':project(x,y,.8 if k=='cheng' else None)} for k,(x,y) in targets.items()},'routes':{k:[project(x,y) for x,y in pts] for k,pts in routes.items()}}
meta['routes']['ferry']=[project(-11,-1,.3),project(-11,3,.3),project(-10,8,.3),project(-10,12,.3)];meta['routes']['cheng_water']=[project(-11,2,.3),project(0,channel(0),.3),project(14,channel(14),.3),project(27,channel(27),.3)]
open(os.path.join(OUT,'map-overlay.json'),'w',encoding='utf8').write(json.dumps(meta,ensure_ascii=False,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'yiling-battlefield.blend'));bpy.ops.render.render(write_still=True)

