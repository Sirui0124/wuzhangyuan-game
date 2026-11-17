import bpy,os,sys,time,json
ROOT=os.path.dirname(os.path.abspath(__file__))
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
preview='--preview' in args;keys=[a for a in args if not a.startswith('--')] or ['camp','river','east','south','imperial','overview']
bpy.ops.wm.open_mainfile(filepath=os.path.join(ROOT,'yiling-camp-v3.blend'))
s=bpy.context.scene;s.render.resolution_percentage=60 if preview else 100;s.cycles.samples=16 if preview else 96;s.render.use_persistent_data=True
device='CPU'
try:
    prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='ONEAPI';devices=prefs.get_devices_for_type('ONEAPI')
    if any(d.type=='ONEAPI' for d in devices):
        for d in devices:d.use=d.type=='ONEAPI'
        s.cycles.device='GPU';device='oneAPI '+', '.join(d.name for d in devices if d.type=='ONEAPI')
except Exception as e:print('Using CPU',e,flush=True)
print('RENDER_DEVICE',device,flush=True)
log=os.path.join(ROOT,'preview-log.json' if preview else 'render-log.json');records=json.load(open(log)) if os.path.exists(log) else []
for key in keys:
    start=time.time();s.camera=bpy.data.objects[key];s.render.filepath=os.path.join(ROOT,key+('-preview' if preview else '')+'.png')
    bpy.ops.render.render(write_still=True)
    records=[r for r in records if r['camera']!=key]
    records.append({'camera':key,'seconds':round(time.time()-start,2),'size':[int(1920*s.render.resolution_percentage/100),int(1080*s.render.resolution_percentage/100)],'samples':s.cycles.samples,'device':device})
    json.dump(records,open(log,'w'),indent=2);print('SAVED',records[-1],flush=True)
