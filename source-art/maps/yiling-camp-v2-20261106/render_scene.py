import bpy,os,sys,time,json
ROOT=os.path.dirname(os.path.abspath(__file__))
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
bpy.ops.wm.open_mainfile(filepath=os.path.join(ROOT,'yiling-camp-v2.blend'))
s=bpy.context.scene;s.render.resolution_percentage=100;s.cycles.samples=48;s.render.use_persistent_data=True
device='CPU'
try:
    prefs=bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type='ONEAPI'
    devices=prefs.get_devices_for_type('ONEAPI')
    gpu=[d for d in devices if d.type=='ONEAPI']
    if gpu:
        for d in devices:d.use=d.type=='ONEAPI'
        s.cycles.device='GPU';device='oneAPI '+', '.join(d.name for d in gpu)
except Exception as error:
    print('GPU discovery unavailable; rendering on CPU:',error,flush=True)
print('RENDER_DEVICE',device,flush=True)
keys=args or ['camp','river','east','south','imperial','overview']
logpath=os.path.join(ROOT,'render-log.json')
records=json.load(open(logpath,encoding='utf-8')) if os.path.exists(logpath) else []
for key in keys:
    start=time.time();s.camera=bpy.data.objects[key];s.render.filepath=os.path.join(ROOT,key+'.png')
    bpy.ops.render.render(write_still=True)
    records=[r for r in records if r['camera']!=key]
    records.append({'camera':key,'seconds':round(time.time()-start,2),'size':[1920,1080],'engine':'Cycles','device':device,'samples':48})
    json.dump(records,open(logpath,'w',encoding='utf-8'),indent=2)
    print('FINAL_SAVED',key,records[-1],flush=True)
