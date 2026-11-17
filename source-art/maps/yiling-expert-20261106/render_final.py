import bpy, os, json, math
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
OUT=os.path.dirname(os.path.abspath(__file__))
bpy.ops.wm.open_mainfile(filepath=os.path.join(OUT,'yiling-battlefield.blend'))
s=bpy.context.scene;cam=s.camera
for o in bpy.data.objects:
 if o.name.startswith('Drifting smoke'):o.visible_shadow=False
soil=bpy.data.materials['Mountain heath and earth'];n=soil.node_tree.nodes;l=soil.node_tree.links
mix=next(o for o in n if o.type=='MIX_RGB');g=n.new('ShaderNodeNewGeometry');t=n.new('ShaderNodeTexNoise');t.inputs['Scale'].default_value=2;t.inputs['Detail'].default_value=6;l.new(g.outputs['Position'],t.inputs[0]);r=n.new('ShaderNodeValToRGB');r.color_ramp.elements[0].color=(.08,.105,.095,1);r.color_ramp.elements[1].color=(.37,.39,.35,1);l.new(t.outputs['Fac'],r.inputs[0]);l.new(r.outputs[0],mix.inputs[1])
s.view_settings.look='AgX - Medium High Contrast';s.view_settings.exposure=.35
s.render.resolution_percentage=100;s.cycles.samples=48;s.render.filepath=os.path.join(OUT,'yiling-battlefield.png')
bpy.context.view_layer.update()
meta=json.load(open(os.path.join(OUT,'map-overlay.json'),encoding='utf8'))
def p(x,y,z=.65):
 v=world_to_camera_view(s,cam,Vector((x,y,z)));return [round(v.x,6),round(1-v.y,6)]
meta['routes']['ferry']=[p(-11,-3),p(-11,1),p(-10,4),p(-10,7)]
meta['targets']['dock']['position']=p(-11,-3);meta['targets']['north']['position']=p(-10,7)
meta['production']={'blender':'5.2.2','render':'Cycles CPU 48 samples','labels_baked':False,'review':'visual inspection, pending user approval'}
json.dump(meta,open(os.path.join(OUT,'map-overlay.json'),'w',encoding='utf8'),ensure_ascii=False,indent=2)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'yiling-battlefield.blend'))
bpy.ops.render.render(write_still=True)
bpy.ops.object.camera_add(location=(37,-12,16));close=bpy.context.object;close.name='Cheng Ji river camera';close.data.lens=50;close.rotation_euler=(Vector((28,6,.8))-close.location).to_track_quat('-Z','Y').to_euler();s.camera=close
s.render.resolution_percentage=65;s.cycles.samples=16;s.render.filepath=os.path.join(OUT,'chengji-preview.png');bpy.ops.render.render(write_still=True)
s.camera=cam;s.render.resolution_percentage=100;s.cycles.samples=48;s.render.filepath=os.path.join(OUT,'yiling-battlefield.png');bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'yiling-battlefield.blend'))
