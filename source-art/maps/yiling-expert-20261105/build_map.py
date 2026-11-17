import bpy, math, random, os
from mathutils import Vector
random.seed(51)
OUT=os.path.dirname(os.path.abspath(__file__))
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
def mat(n,c,rough=0.8):
 m=bpy.data.materials.new(n); m.diffuse_color=(*c,1); m.use_nodes=True; p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=rough;return m
earth=mat('Weathered stone and soil',(.24,.265,.235));grass=mat('Forest canopy',(.075,.145,.095));wood=mat('Weathered timber',(.19,.115,.067));cloth=mat('Linen tents',(.48,.45,.36));road=mat('Exposed earth tracks',(.36,.315,.245));water=mat('River',(.075,.20,.235),.24)
nodes=earth.node_tree.nodes;links=earth.node_tree.links;p=nodes.get('Principled BSDF');noise=nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=2.8;noise.inputs['Detail'].default_value=5;bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.32;bump.inputs['Distance'].default_value=.18;links.new(noise.outputs['Fac'],bump.inputs['Height']);links.new(bump.outputs[0],p.inputs['Normal'])
def river(x):return 2.6+1.15*math.sin(x*.15)
def height(x,y):
 d=abs(y-river(x)); shore=max(0,min(1,(d-2.2)/2))
 peaks=sum(a*math.exp(-((x-cx)**2/sx+(y-cy)**2/sy)) for cx,cy,a,sx,sy in [(-17,15,6,55,20),(0,16,7,44,23),(17,15,8,38,22),(20,-13,6,32,28),(7,-17,4,55,16),(-20,-13,3,35,20)])
 return -.25+shore*(.65+peaks+.22*math.sin(x*.9)*math.sin(y*.7)+.12*math.sin(x*2+y))
verts=[];faces=[];nx=201;ny=151
for j in range(ny):
 y=-22+j*44/(ny-1)
 for i in range(nx):
  x=-33+i*66/(nx-1);verts.append((x,y,height(x,y)))
for j in range(ny-1):
 for i in range(nx-1):
  a=j*nx+i;faces.append((a,a+1,a+nx+1,a+nx))
me=bpy.data.meshes.new('Terrain');me.from_pydata(verts,[],faces);me.update();ob=bpy.data.objects.new('Continuous sculpted terrain',me);bpy.context.collection.objects.link(ob);ob.data.materials.append(earth)
for f in me.polygons:f.use_smooth=True
def cube(n,loc,scale,m):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=n;o.scale=scale;o.data.materials.append(m);return o
cube('River water', (0,3,-.1),(70,19,.12),water)
paths=[[(-22,-3),(-13,-5),(-3,-6),(8,-6),(17,-7)],[(-13,-5),(-9,-10),(-4,-13)],[(-22,-3),(-15,-1),(-8,0)],[(-7,7),(-2,10),(8,10)]]
def line(points,width,m,name):
 vs=[]
 for a,b in zip(points,points[1:]):
  dist=math.dist(a,b);count=max(2,int(dist*5));dx=b[0]-a[0];dy=b[1]-a[1];l=math.hypot(dx,dy)
  for k in range(count):
   t=k/(count-1);x=a[0]+dx*t;y=a[1]+dy*t
   for s in [-1,1]:
    xx=x-dy/l*width*s; yy=y+dx/l*width*s;vs.append((xx,yy,height(xx,yy)+.035))
 fs=[(i,i+1,i+3,i+2) for i in range(0,len(vs)-2,2)];me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);o.data.materials.append(m)
for pth in paths:line(pth,.27,road,'Passable route')
def distance_path(x,y):
 best=100
 for path in paths:
  for a,b in zip(path,path[1:]):
   dx=b[0]-a[0];dy=b[1]-a[1];t=max(0,min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));best=min(best,math.hypot(x-a[0]-dx*t,y-a[1]-dy*t))
 return best
for i in range(570):
 x=random.uniform(-28,28);y=random.uniform(-18,18)
 if abs(y-river(x))<3.8 or distance_path(x,y)<1.0 or (x<-18 and -6<y<0):continue
 z=height(x,y);r=random.uniform(.35,.72)
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=(x,y,z+r*.9));o=bpy.context.object;o.name='Woodland canopy';o.scale=(r,r,r*1.5);o.data.materials.append(grass)
 for poly in o.data.polygons:poly.use_smooth=True
def tent(x,y,s=1):
 z=height(x,y);v=[(x-s,y-s*.7,z),(x+s,y-s*.7,z),(x,y-s*.7,z+s),(x-s,y+s*.7,z),(x+s,y+s*.7,z),(x,y+s*.7,z+s)];me=bpy.data.meshes.new('Tent');me.from_pydata(v,[],[(0,1,2),(3,5,4),(0,2,5,3),(1,4,5,2)]);o=bpy.data.objects.new('Linen field tent',me);bpy.context.collection.objects.link(o);o.data.materials.append(cloth)
for x,y in [(-23,-3),(-21,-4.5),(-23,-5),(-25,-4),(17,-7),(18,-8.5),(8,10),(10,10),(-4,-13)]:tent(x,y,.65)
for x,y in [(-8,0),(-7,6)]:
 cube('Wooden landing',(x,y,max(.16,height(x,y)+.12)),(2.7,1,.23),wood)
 for xx in [x-1,x,x+1]:cube('Landing post',(xx,y,.15),(.13,.13,1.1),wood)
for x,y in [(-8,1.2),(-5,2),(13,river(13)),(15,river(15)+.6)]:
 bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=6,location=(x,y,.12));o=bpy.context.object;o.name='Small wooden boat';o.scale=(1.1,.32,.22);o.data.materials.append(wood)
fire=mat('Low red embers',(.22,.035,.008));p=fire.node_tree.nodes.get('Principled BSDF');p.inputs['Emission Color'].default_value=(.7,.035,.003,1);p.inputs['Emission Strength'].default_value=1.6
for x,y in [(18,-9),(20,-8),(17,-10)]:
 z=height(x,y);bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.24,location=(x,y,z+.2));bpy.context.object.data.materials.append(fire)
world=bpy.context.scene.world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.45,.52,.6,1);world.node_tree.nodes['Background'].inputs[1].default_value=.45
bpy.ops.object.light_add(type='SUN',location=(0,0,20));bpy.context.object.rotation_euler=(.5,-.4,-.5);bpy.context.object.data.energy=2.2;bpy.context.object.data.angle=.15
bpy.ops.object.camera_add(location=(0,-62,61));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,0))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.lens=50;bpy.context.scene.camera=cam
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=24;s.cycles.use_denoising=True;s.render.resolution_x=1920;s.render.resolution_y=1080;s.render.resolution_percentage=100;s.render.image_settings.file_format='PNG';s.render.filepath=os.path.join(OUT,'yiling-terrain-study.png');s.view_settings.view_transform='AgX'
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'yiling-terrain-study.blend'));bpy.ops.render.render(write_still=True)

