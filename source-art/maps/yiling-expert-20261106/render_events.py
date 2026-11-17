import bpy, os, json
from mathutils import Vector
OUT=os.path.dirname(os.path.abspath(__file__))
bpy.ops.wm.open_mainfile(filepath=os.path.join(OUT,'yiling-battlefield.blend'))
s=bpy.context.scene;mapcam=s.camera;s.render.resolution_percentage=100;s.cycles.samples=32
shots=[('chengji',(37,-12,16),(28,6,.8)),('futong',(30,-25,38),(29,-13,1)),('huangquan',(18,5,36),(18,19,1)),('shamoke',(-7,-32,35),(-7,-20,1))]
for name,loc,target in shots:
 if name=='chengji' and os.path.exists(os.path.join(OUT,'chengji-event.png')):continue
 bpy.ops.object.camera_add(location=loc);cam=bpy.context.object;cam.name=name+' event camera';cam.data.lens=50;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();s.camera=cam;s.render.filepath=os.path.join(OUT,name+'-event.png');bpy.ops.render.render(write_still=True)
s.camera=mapcam;s.cycles.samples=48;s.render.filepath=os.path.join(OUT,'yiling-battlefield.png');bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'yiling-battlefield.blend'))


