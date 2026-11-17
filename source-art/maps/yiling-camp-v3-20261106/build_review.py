import json,os,shutil
from PIL import Image
ROOT=os.path.dirname(os.path.abspath(__file__));BASE=os.path.join(os.path.dirname(ROOT),'yiling-camp-v2-20261106')
data=json.load(open(os.path.join(ROOT,'camera-layout.json'),encoding='utf-8'))
os.makedirs(os.path.join(ROOT,'comparison-v2'),exist_ok=True)
for key,cam in data['cameras'].items():
    cam['image']='art/'+key+'.png'
    with Image.open(os.path.join(ROOT,cam['image'])) as im:cam['imageSize']=list(im.size)
    dest=os.path.join(ROOT,'comparison-v2',key+'.png')
    if not os.path.exists(dest):shutil.copy2(os.path.join(BASE,key+'.png'),dest)
data['renderPipeline']='Original Blender composition -> built-in imagegen visual refinement. Pixels are not a native 3D render.'
data['projectionMethod']='Original normalized Blender anchor positions, visually checked on refined images; not pixel-identical geometry.'
data['userArtApproval']=False
json.dump(data,open(os.path.join(ROOT,'art-layout.json'),'w',encoding='utf-8'),ensure_ascii=False,indent=2)
overview=data['cameras']['overview']
legacy={'imageSize':overview['imageSize'],'image':'art/overview.png','points':{k:{'x':p['x'],'y':p['y'],'label':p['label']} for k,p in overview['points'].items() if k!='junction'},'routes':{k:[{'x':p['x'],'y':p['y']} for p in overview['routes'][k]] for k in ['fu','sha','huang','cheng']}}
json.dump(legacy,open(os.path.join(ROOT,'legacy-map-layout.json'),'w',encoding='utf-8'),ensure_ascii=False,indent=2)
template=open(os.path.join(ROOT,'review-template.html'),encoding='utf-8').read()
open(os.path.join(ROOT,'review.html'),'w',encoding='utf-8').write(template.replace('__DATA__',json.dumps(data,ensure_ascii=False).replace('</','<\\/')))
print('Built scene viewer with six views and original-version comparison.')
