import bpy,os,json,sys
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
ROOT=os.path.dirname(os.path.abspath(__file__))
bpy.ops.wm.open_mainfile(filepath=os.path.join(ROOT,'yiling-camp-v2.blend'))
s=bpy.context.scene;ground=bpy.data.objects['Playable valley and terrace'];cam=bpy.data.objects['south']
def ground_z(x,y):
    hit,point,normal,face=ground.ray_cast(Vector((x,y,800)),Vector((0,0,-1)))
    assert hit;return point.z
cam.location=(-102,-166,ground_z(-102,-166)+1.72)
target=Vector((-90,-208,ground_z(-90,-208)+.3));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
cam['title']='山路岔口';s.camera=cam;bpy.context.view_layer.update()
if '--save' in sys.argv:
    data=json.load(open(os.path.join(ROOT,'camera-layout.json'),encoding='utf-8'))
    data['landmarks']['junction']['world']=[-102,-166,ground_z(-102,-166)+1]
    def project(co):
        p=world_to_camera_view(s,cam,Vector(co));return {'x':round(p.x,6),'y':round(1-p.y,6),'depth':round(p.z,3),'inFrame':p.z>0 and 0<p.x<1 and 0<p.y<1}
    data['cameras']['south']={'title':cam['title'],'image':'south.png','location':list(cam.location),'lens':cam.data.lens,
        'points':{k:{**project(v['world']),'label':v['label']} for k,v in data['landmarks'].items()},
        'routes':{k:[project(p) for p in values] for k,values in data['routes'].items()}}
    for camera_key,camera_data in data['cameras'].items():
        p=world_to_camera_view(s,bpy.data.objects[camera_key],Vector(data['landmarks']['junction']['world']))
        camera_data['points']['junction']={'x':round(p.x,6),'y':round(1-p.y,6),'depth':round(p.z,3),'inFrame':p.z>0 and 0<p.x<1 and 0<p.y<1,'label':'山路岔口'}
    json.dump(data,open(os.path.join(ROOT,'camera-layout.json'),'w',encoding='utf-8'),ensure_ascii=False,indent=2)
    s.camera=bpy.data.objects['camp'];bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'yiling-camp-v2.blend'))
else:
    s.render.resolution_percentage=50;s.cycles.samples=12;s.render.filepath=os.path.join(ROOT,'south-refined-preview.png');bpy.ops.render.render(write_still=True)
