from pathlib import Path
import json,sys,copy
OUT=Path(__file__).parent;ROOT=OUT.parents[1]
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,x):p.write_text(json.dumps(x,ensure_ascii=False,indent=2),encoding='utf-8')

if __name__=='__main__' and sys.argv[1]=='reference':
    sys.path.insert(0,'C:/Users/zhousirui/Documents/ChatGPT/平行世界/tools');import image_api as api
    folder=OUT/'references/old-scroll-oblique-back';folder.mkdir(exist_ok=True)
    guard=folder/'dispatch-guard.json'
    if guard.exists():raise RuntimeError('Image dispatch already attempted; inspect outcome, never blind repeat')
    central=read(ROOT/'references/manifest.json')['byId']['收件案头']['path']
    prompt='Historical live-action film still, 16:9, Han-era military tent, the same rough wooden desk and soft daylight from the left as the reference. A very low oblique close view at the near edge of the desk. Only two adult hands in coarse grey-brown linen sleeves are visible, holding the two ends of an aged rolled paper sheet just above the wood. The paper is angled upward toward its reader outside the top of the frame, so the camera sees only the plain softly backlit reverse of the sheet and its worn edge. The inked front faces away from the camera. Several closed old scrolls sit softly out of focus behind it. Natural muted brown-grey textures and photographic skin. The entire image contains only hands, sleeves, paper and the desk, no face or body. The paper reverse is plain fibrous paper with no writing, symbols or numbers. No text on screen, no collage, no modern objects.'
    (folder/'prompt.txt').write_text(prompt,encoding='utf-8');save(guard,dict(state='dispatching',model='gpt-image-2',size='2048x1152',reason='V42 visual false-evidence repair, one reference'))
    result=api.generate_once(api.build_request(prompt,size='2048x1152',references=[central]),folder)
    save(guard,dict(state='succeeded',path=result['local_path'],sha256=result['sha256']))
    print(json.dumps(dict(path=result['local_path'],sha256=result['sha256']),ensure_ascii=False))
