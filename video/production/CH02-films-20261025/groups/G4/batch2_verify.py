from batch2_audio import *
import av,math
from PIL import Image,ImageDraw
out=W/'verification';out.mkdir(exist_ok=True)
records=[]
for c in read(W/'candidates.json')['clips']:
 p=Path(c['file']);assert sha(p)==c['technical']['sha256'];frames=0;first=None;last=None;step=[];prev=None;dur=None;black=[];samples=[]
 with av.open(str(p)) as cont:
  containerDuration=cont.duration/1e6;v=cont.streams.video[0];v.thread_type='AUTO'
  for n,f in enumerate(cont.decode(v)):
   frames+=1;t=float(f.pts*f.time_base);dur=float(f.duration*f.time_base) if f.duration else 1/24
   if first is None:first=t
   if prev is not None:step.append(t-prev)
   prev=t;last=t
   y=np.frombuffer(f.planes[0],dtype=np.uint8).reshape(f.height,f.planes[0].line_size)[:,:f.width][::16,::16]
   if y.mean()<18 and y.std()<2:black.append(n)
   if n%12==0:samples.append((n,f.to_image().resize((256,144))))
   if n==0:f.to_image().save(out/(c['id']+'-first.png'))
  f.to_image().save(out/(c['id']+'-last.png'))
  if (frames-1)%12:samples.append((frames-1,f.to_image().resize((256,144))))
 board=Image.new('RGB',(1280,166*math.ceil(len(samples)/5)),'#202020');d=ImageDraw.Draw(board)
 for i,(n,im) in enumerate(samples):
  x=i%5*256;y=i//5*166;board.paste(im,(x,y));d.text((x+4,y+146),f'{c["id"]} {n/24:.3f}s',fill='white')
 board.save(out/(c['id']+'-timeline.jpg'))
 assert all(abs(s-1/24)<1e-6 for s in step) and containerDuration-last-dur<1/24+1e-6 and not black
 r=dict(id=c['id'],file=str(p),sha256=sha(p),actualDecodedFrames=frames,firstPts=first,lastPts=last,videoEnd=last+dur,containerDuration=containerDuration,containerTail=max(0,containerDuration-last-dur),actualUniform24fps=True,fullBlackSuspects=black,allFramesDecoded=True,firstFrame=str(out/(c['id']+'-first.png')),lastFrame=str(out/(c['id']+'-last.png')),timeline=str(out/(c['id']+'-timeline.jpg')),scope='技术与逐0.5秒视觉时序；不代替听审')
 if c['id']=='V27':
  def vhash(file):
   h=hashlib.sha256()
   with av.open(str(file)) as cont:
    for packet in cont.demux(video=0):
     if packet.size:h.update(bytes(packet))
   return h.hexdigest()
  old=next(x for x in read(W/'baseline-delivery.json')['clips'] if x['id']=='V27');r['videoPacketsUnchanged']=vhash(p)==vhash(old['file']);assert r['videoPacketsUnchanged']
  raw=subprocess.run([FF,'-v','error','-i',str(p),'-af','atrim=start=0:end=1.3','-f','f32le','-ar','16000','-ac','1','pipe:1'],capture_output=True,check=True).stdout
  a=np.frombuffer(raw,dtype=np.float32);r['openingFirst1p3SecondsPeak']=float(np.max(np.abs(a)));assert r['openingFirst1p3SecondsPeak']<1e-5
 records.append(r);print(c['id'],frames,round(containerDuration,3),flush=True)
save(W/'track-and-picture-verification.json',dict(createdAt=now(),clips=records,newAPIRequests=0,newTTSRequests=0))
