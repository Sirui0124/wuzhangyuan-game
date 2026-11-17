import os
BASE=os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(BASE,'build_map.py'),encoding='utf-8-sig').read().split('bpy.ops.wm.save_as_mainfile')[0])
def texture(m,colors,scale,bumpstrength=.2):
 n=m.node_tree.nodes;l=m.node_tree.links;p=n.get('Principled BSDF');tex=n.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=scale;tex.inputs['Detail'].default_value=5;tex.inputs['Roughness'].default_value=.72
 ramp=n.new('ShaderNodeValToRGB');ramp.color_ramp.elements.remove(ramp.color_ramp.elements[1])
 for i,c in enumerate(colors):
  e=ramp.color_ramp.elements[0] if i==0 else ramp.color_ramp.elements.new(i/(len(colors)-1));e.position=i/(len(colors)-1);e.color=(*c,1)
 l.new(tex.outputs['Fac'],ramp.inputs[0]);l.new(ramp.outputs[0],p.inputs['Base Color']);b=n.new('ShaderNodeBump');b.inputs['Strength'].default_value=bumpstrength;b.inputs['Distance'].default_value=.12;l.new(tex.outputs['Fac'],b.inputs['Height']);l.new(b.outputs[0],p.inputs['Normal'])
texture(earth,[(.07,.11,.065),(.19,.245,.12),(.34,.33,.22),(.49,.48,.37)],1.7,.46)
texture(road,[(.22,.18,.115),(.44,.39,.27),(.56,.51,.38)],8,.25)
texture(water,[(.025,.095,.12),(.065,.21,.24),(.19,.32,.32)],3,.17)
water.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.19
sand=mat('Pale shingle shore',(.45,.43,.33));texture(sand,[(.25,.27,.22),(.46,.45,.36),(.66,.62,.49)],12,.5)
rock=mat('Layered grey limestone',(.31,.33,.29));texture(rock,[(.16,.19,.17),(.35,.38,.33),(.54,.53,.44)],3,.6)
foliages=[mat('Canopy '+str(i),c) for i,c in enumerate([(.08,.18,.095),(.15,.245,.11),(.19,.28,.13),(.12,.22,.15),(.26,.29,.14)])]
for m in foliages:texture(m,[(.035,.08,.04),tuple(m.diffuse_color[:3]),(.29,.36,.17)],5,.35)
landmarks=[(-23,-3),(-21,-4.5),(-23,-5),(-25,-4),(17,-7),(18,-8.5),(8,10),(10,10),(-4,-13),(-8,0),(-7,6)]
for ob in list(bpy.data.objects):
 if ob.name.startswith('Woodland canopy'):
  bpy.data.objects.remove(ob,do_unlink=True)
def sphere(n,loc,sc,m,sub=1):
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub,radius=1,location=loc);o=bpy.context.object;o.name=n;o.scale=sc;o.data.materials.append(m)
 for f in o.data.polygons:f.use_smooth=True
 return o
random.seed(32)
for i in range(260):
 x=random.uniform(-35,35);y=random.uniform(-25,23)
 if math.hypot(x+8,y)<4 or abs(y-river(x))<3.4 or distance_path(x,y)<1.35 or min(math.hypot(x-a,y-b) for a,b in landmarks)<2:continue
 z=height(x,y);r=random.uniform(.32,.68);h=random.uniform(.65,1.25)
 bpy.ops.mesh.primitive_cone_add(vertices=7,radius1=.095,radius2=.055,depth=h,location=(x,y,z+h*.5));bpy.context.object.data.materials.append(wood)
 m=random.choice(foliages)
 for k in range(5):
  angle=k*2.4;rr=r*random.uniform(.45,.85);sphere('Branch crown',(x+math.cos(angle)*r*.5,y+math.sin(angle)*r*.5,z+h+(k%2)*.25),(rr,rr,rr*.95),m,1)
for side in [-1,1]:
 pts=[(-33+i*.33,river(-33+i*.33)+side*2.5) for i in range(201)];line(pts,.22,sand,'Continuous gravel bank')
for i in range(100):
 x=random.uniform(-32,32);y=river(x)+random.choice([-1,1])*random.uniform(2.55,3.15);r=random.uniform(.055,.22);sphere('River shingle',(x,y,height(x,y)+r*.3),(r,r*.65,r*.5),rock)
for i in range(65):
 x=random.uniform(-29,29);y=random.uniform(-19,19)
 if abs(y-river(x))<4 or distance_path(x,y)<1.1 or min(math.hypot(x-a,y-b) for a,b in landmarks)<1.7:continue
 r=random.uniform(.25,.8);sphere('Outcrop',(x,y,height(x,y)+r*.2),(r,r*.7,r*.8),rock)
# Extend the same terrain beyond the original mesh so the horizon has no rectangular edge.
vs=[];fs=[];N=80
for j in range(N):
 for i in range(N):
  x=-85+i*170/(N-1);y=15+j*68/(N-1);z=height(x,y)-.15;vs.append((x,y,z))
for j in range(N-1):
 for i in range(N-1):
  a=j*N+i;fs.append((a,a+1,a+N+1,a+N))
me=bpy.data.meshes.new('Distant terrain');me.from_pydata(vs,[],fs);ob=bpy.data.objects.new('Distant ridges',me);bpy.context.collection.objects.link(ob);ob.data.materials.append(earth)
for p in me.polygons:p.use_smooth=True
# Delicate palisade at the rear of the departure camp, away from paths.
for k in range(20):
 x=-26+k*.3;y=-6.3;z=height(x,y);bpy.ops.mesh.primitive_cone_add(vertices=6,radius1=.075,radius2=.025,depth=.65,location=(x,y,z+.32));bpy.context.object.data.materials.append(wood)
for ob in bpy.data.objects:
 if ob.type=='LIGHT':ob.data.energy=3.2;ob.data.angle=.22
world.node_tree.nodes['Background'].inputs[1].default_value=.65
cam.location=(0,-58,55);cam.rotation_euler=(Vector((0,1.5,.3))-cam.location).to_track_quat('-Z','Y').to_euler()
s.cycles.samples=32;s.render.filepath=os.path.join(OUT,'yiling-terrain-beauty-v2.png')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'yiling-terrain-beauty-v2.blend'));bpy.ops.render.render(write_still=True)




