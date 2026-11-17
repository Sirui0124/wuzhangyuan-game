import bpy, math, os
p=os.path.dirname(os.path.abspath(__file__))
bpy.ops.wm.open_mainfile(filepath=os.path.join(p,'yiling-terrain-beauty-v2.blend'))
o=bpy.data.objects['Distant ridges']
for v in o.data.vertices:
 x,y,z=v.co
 d=abs(y-(2.6+1.15*math.sin(x*.15))); shore=max(0,min(1,(d-2.2)/2))
 peaks=sum(a*math.exp(-((x-cx)**2/sx+(y-cy)**2/sy)) for cx,cy,a,sx,sy in [(-17,15,6,55,20),(0,16,7,44,23),(17,15,8,38,22),(20,-13,6,32,28),(7,-17,4,55,16),(-20,-13,3,35,20)])
 v.co.z=-.25+shore*(.65+peaks+.22*math.sin(x*.9)*math.sin(y*.7)+.12*math.sin(x*2+y))-.15
for ob in list(bpy.data.objects):
 if (ob.name.startswith('Branch crown') or ob.name.startswith('Cone')) and math.hypot(ob.location.x+8,ob.location.y)<4: bpy.data.objects.remove(ob,do_unlink=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(p,'yiling-terrain-beauty-v2.blend'))
bpy.ops.render.render(write_still=True)


