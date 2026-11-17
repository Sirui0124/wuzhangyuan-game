from pathlib import Path
import importlib.util,json,os,subprocess,shutil,concurrent.futures,urllib.request,hashlib,sys
from PIL import Image
R=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('api',r'D:/ArchivedProjects/平行世界/tools/video_api.py');api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
original_load=api.load_secret
def load(name):
 if name!='openai-next-key.dpapi':return original_load(name)
 path=Path(os.environ['LOCALAPPDATA'])/'OpenAINext/credit-media-key.dpapi'
 script="$s=(Get-Content -LiteralPath $env:H3_CREDENTIAL_FILE -Raw).Trim() | ConvertTo-SecureString; [Console]::Out.Write(([System.Net.NetworkCredential]::new('api',$s)).Password)"
 p=subprocess.run([shutil.which('pwsh') or 'powershell','-NoProfile','-Command',script],env={**os.environ,'H3_CREDENTIAL_FILE':str(path)},capture_output=True,timeout=20)
 if p.returncode:raise RuntimeError('Local credential decrypt failed')
 return p.stdout.decode('utf-8-sig').strip()
api.load_secret=load
plan=json.loads((R.parent/'PV-regrets-style-20261117/当前补拍与剪辑清单.json').read_text('utf-8'))
def work(u):
 d=R/u['id'];d.mkdir(exist_ok=True);state=d/'state.json'
 try:
  if state.exists():
   s=json.loads(state.read_text('utf-8'))
   if not s.get('task_id'):return dict(id=u['id'],status=s['status'])
   s=api.poll_task(state,interval=25)
  else:
   jpg=d/'reference.jpg'
   with Image.open(u['reference_paths'][0]) as im:im.convert('RGB').save(jpg,quality=95,subsampling=0)
   record=api.upload_reference(jpg);api.verify_image_url(record['url'],hashlib.sha256(jpg.read_bytes()).hexdigest())
   api.atomic_json(d/'reference.json',record)
   body=dict(model='MiniMax-H3',content=[dict(type='text',text=u['prompt']),dict(type='image_url',image_url={'url':record['url']},role='reference_image')],resolution='768P',duration=u['duration'],ratio='16:9')
   api.atomic_json(d/'request.json',body);(d/'prompt.txt').write_text(u['prompt'],'utf-8')
   print(u['id']+' preflight passed; submitting once',flush=True)
   s=api.submit_request(d/'request.json',state)
  if s.get('status')=='succeeded' and not (d/'source.mp4').exists():
   with urllib.request.urlopen(s['result_url'],timeout=90) as res,(d/'source.part.mp4').open('wb') as f:shutil.copyfileobj(res,f)
   (d/'source.part.mp4').replace(d/'source.mp4')
  return dict(id=u['id'],status=s['status'])
 except Exception as e:return dict(id=u['id'],error=type(e).__name__,message=str(e)[:250])
if __name__=='__main__':
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as ex:
  for result in ex.map(work,plan['units']):print(json.dumps(result,ensure_ascii=False),flush=True)
