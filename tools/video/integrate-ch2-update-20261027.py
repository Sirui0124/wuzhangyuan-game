"""Prepare/apply the reviewed received films; retain sources, previous assets and saves."""
from pathlib import Path
import json,hashlib,subprocess,shutil,sys
from concurrent.futures import ThreadPoolExecutor
import av

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'outputs/ch2-video-update-20261027'
PUBLIC=ROOT/'GameStarter/web-demo/public'
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,d):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def run(args):subprocess.run([FF,'-v','error',*args],check=True)
def metadata(p):
    with av.open(str(p)) as c:
        v=c.streams.video[0]
        return dict(duration=float(v.duration*v.time_base),containerDuration=c.duration/1e6,width=v.width,height=v.height,fps=str(v.average_rate),frames=v.frames,videoCodec=v.codec_context.name)
def audiohash(p):
    raw=subprocess.run([FF,'-v','error','-i',str(p),'-vn','-f','s16le','pipe:1'],capture_output=True,check=True).stdout
    return hashlib.sha256(raw).hexdigest()
def stamp(t):
    ms=round(t*1000);return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02}.{ms%1000:03}'

# Text is copied from production originals, not from recognition output.
# Time windows use SHA-bound independent audio locators plus sentence boundaries.
CUES={
'03':[(3.58,4.55,'我去魏国'),(4.86,6.45,'求他们放我回来'),(7.14,9.16,'散布丞相要篡位的谣言'),(9.16,10.5,'逼朝廷召军')],
'C01':[(2.6,3.9,'好，我先不走'),(9.24,10.2,'就是这批'),(10.72,13.5,'纸上写的那天之前，粮已经备好了'),(13.9,15.55,'是李严扣着没发'),(20.56,22.3,'凭这个去领本队的材料'),(22.76,23.82,'别拿着乱闯')],
'C03':[(2.54,3.8,'先在地方收粮'),(4.34,6.6,'再把收来的粮送进仓里'),(9.52,11.3,'仓里按批交给粮队'),(11.74,13.55,'粮队点清以后签收'),(15.46,18.78,'纸上要求交多少，和真正收到多少'),(18.78,20.2,'要分开看'),(23.98,25.8,'我就从我们领粮的地方'),(26.08,27.7,'一步一步往前查')],
'C04':[(2.24,3.98,'苟安说粮早就备好了'),(4.48,5.55,'我先看看'),(5.94,8.75,'我们领粮那天，仓里到底交了多少'),(13.44,15.16,'这是仓里交粮的记录'),(15.62,17.5,'这是我们领粮时签的'),(18.84,20.95,'路上损耗另记在这一本'),(21.44,23.35,'别和领粮的账混在一起')],
'C05R':[(5.24,6.5,'对上了'),(6.82,9.18,'仓里交给我们多少，我们就领走了多少'),(11.18,14.65,'没交够的那一笔，领粮时就记在这里了'),(18.78,20.55,'路上的损耗是后来的事'),(21.02,22.12,'那就往前查'),(22.42,23.95,'看看仓里为什么没交够')],
'C07':[(.88,2.5,'这是地方收粮的记录'),(2.74,4.6,'村名和批次都在这里'),(10.74,11.95,'数目对得上'),(12.28,14.56,'地方收到的这些，都送进仓了'),(14.56,15.92,'没有在这一步少下来'),(15.92,17.55,'收来的都送到了'),(18.02,21.05,'那最初要求收多少，实际又收了多少？')],
'C08':[(2.98,5.3,'这边写的是原来要交多少'),(5.74,7.78,'旁边才是实际收到多少'),(11.36,12.45,'粮没收够'),(12.76,14.4,'差的还记着欠交'),(19,21.72,'前面的账也拿来，一起对一遍')],
'C09':[(4.14,5.14,'账都对上了'),(5.14,7.18,'这批粮从一开始就没收齐'),(7.26,9.7,'那原定的数目，后来改过吗？'),(12.22,13.72,'后来先停了催补'),(14.02,15.65,'但交粮的数目没改'),(16.14,17.65,'要交的还是那么多'),(17.9,19.25,'实际却没收齐'),(23.72,27.38,'那这笔差额，就不能只从运粮这一头找原因了'),(27.96,30.02,'苟安当时知道粮还没收齐吗？')],
'C09A':[(1.3,2.7,'原来要交这么多'),(3.1,4.6,'粮应该已经备好了'),(4.92,6.65,'我还是查谁扣着没给'),(10.04,11.44,'那是要求交的数'),(11.44,13.4,'不是已经收来的粮'),(13.76,15.4,'这一批根本没收齐'),(16.36,17.4,'没收齐'),(17.68,19.15,'为什么还按原数交？'),(21.1,24.24,'李严叫停了追加催征'),(24.68,26.35,'可交粮的数目没改'),(26.66,27.95,'还是原来那么多')],
'C09C':[(.42,1.78,'这批粮没收齐'),(1.92,3.3,'先把这件事记清'),(3.72,5.1,'别的还得接着查'),(7.66,8.18,'好'),(8.72,10.16,'前面核过的账也留着'),(10.16,11.88,'问人时一起拿出来'),(12.78,14.35,'那没收齐的这一笔'),(14.62,16.24,'后来怎么处理的？'),(17.64,19.55,'李严叫停了追加催征'),(20.02,22.02,'可交粮的数目没改'),(23.04,24.52,'要交的还是那么多'),(24.7,25.95,'收到的却不够')],
'C10':[(6.06,7.3,'这份缺粮报告'),(7.66,9.1,'村名、批次都对得上'),(9.1,11.7,'苟安亲笔签的，我当时就在场'),(13.54,15.06,'签字就是他指的那天'),(15.06,16.25,'还在挨杖之前？'),(18.78,19.3,'对'),(19.74,21.38,'送到和签字都是那天'),(21.54,22.78,'他那时还没挨杖'),(26.68,28.32,'当天的仓账也核过了'),(28.32,30.02,'那天后来仍没补齐')],
'C11':[(2.88,5.04,'你那天就签字确认粮没收齐'),(5.04,6.78,'当天也没补齐'),(7.82,10.12,'为什么还告诉我，粮早就备好了'),(10.12,11.7,'是李严扣着没发？'),(12.64,14.22,'你想让我留下'),(14.56,16.32,'也想让大军继续打'),(17.74,18.78,'我若说'),(19.12,21.16,'我就是想让它停下来'),(21.52,23.02,'你还会替我查吗？')],
'C12':[(2.3,4.3,'李丰劝你和李严停手'),(4.6,6.02,'你们到底商量了什么？'),(8.98,11.16,'让一个跟李家无关的人'),(11.52,13.56,'把缺粮的事报上去'),(14.14,15.88,'逼这一回退军'),(20.7,22.72,'李严肯担一部分责任'),(23.42,25.86,'我就装成被他推出来顶罪的人'),(27.46,29.74,'所以，你挑中了我')],
'C13':[(1.86,3.12,'你想查李严'),(3.22,4.94,'想让大军继续打'),(5.62,7.32,'我就顺着你的想法'),(7.32,8.72,'让你往下查'),(11.74,13.34,'那天在崖边救我'),(13.72,15.04,'你也算过这些？'),(16,17.74,'那时候你快掉下去了'),(18.24,20.36,'我只想先把人拉上来'),(22.12,25.16,'骗你，是后来的事')]
}

paths=['GameStarter/web-demo/public/cinematics.json','GameStarter/web-demo/public/video/media-manifest.json','content/chapters/grain/chapter-two.films.json','video/subtitles/catalog.json']
before=OUT/'before'
if not (OUT/'baseline.json').exists():
    baseline={}
    for p in paths:
        src=ROOT/p;dst=before/p;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dst);baseline[p]=sha(src)
    write(OUT/'baseline.json',baseline)
baseline=read(OUT/'baseline.json')
config=read(before/paths[0]);media=read(before/paths[1]);story=read(before/paths[2])
original={c['id']:c.copy() for c in config['chapterTwo']}
converted={}
def convert(key):
    row=read(OUT/(key+'-review.json'));src=Path(row['source']);assert sha(src)==row['sha256']
    dst=ROOT/'video/current'/f'CH2-{key}-received-20261027-{row["sha256"][:8]}.mp4'
    if not dst.exists():run(['-i',str(src),'-map','0:v:0','-map','0:a:0','-c:v','libx264','-threads','2','-preset','medium','-crf','18','-pix_fmt','yuv420p','-c:a','copy','-movflags','+faststart',str(dst)])
    run(['-i',str(dst),'-f','null','-'])
    meta=metadata(dst);assert meta['frames']==row['frames'];assert audiohash(dst)==audiohash(src)
    result=dict(key=key,path=str(dst),sha256=sha(dst),source=str(src),sourceSha256=row['sha256'],audioUnchanged=True,**meta)
    print(json.dumps(dict(converted=key,frames=meta['frames'],audioUnchanged=True)),flush=True)
    return key,result
with ThreadPoolExecutor(max_workers=2) as pool:
    for key,data in pool.map(convert,CUES):converted[key]=data

def merge():
    a,b=converted['C12'],converted['C13'];dst=ROOT/'video/current'/f'CH2-C12-C13-received-20261027-{a["sourceSha256"][:8]}-{b["sourceSha256"][:8]}.mp4'
    listing=OUT/'concat-C12-C13.txt'
    listing.write_text(''.join("file '"+Path(x['path']).as_posix()+"'\n" for x in (a,b)),encoding='utf-8')
    if not dst.exists():run(['-f','concat','-safe','0','-i',str(listing),'-c','copy','-movflags','+faststart',str(dst)])
    run(['-i',str(dst),'-f','null','-']);meta=metadata(dst);assert meta['frames']==a['frames']+b['frames']
    # Concatenation keeps the compressed AAC packets; verify their payload hashes.
    def packets(path):
        with av.open(path) as c:return [hashlib.sha256(bytes(p)).hexdigest() for p in c.demux(audio=0) if p.size]
    assert packets(str(dst))==packets(a['path'])+packets(b['path'])
    return dict(path=str(dst),sha256=sha(dst),sources=[a,b],audioPacketsUnchanged=True,**meta)
merged=merge()

# C06 is held. Retain only the original V18 warehouse part; new C07/C08 replace its later parts.
src=ROOT/'video/current'/Path(original['CH2-V18']['src']).name
prefix=ROOT/'video/current'/f'CH2-V18-warehouse-retained-20261027-{sha(src)[:8]}.mp4'
if not prefix.exists():run(['-i',str(src),'-t','8.5','-map','0:v:0','-map','0:a:0','-c:v','libx264','-threads','2','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags','+faststart',str(prefix)])
run(['-i',str(prefix),'-f','null','-'])
retained=dict(path=str(prefix),sha256=sha(prefix),source=str(src),sourceSha256=sha(src),sourceRange=[0,8.5],**metadata(prefix))

selection={'CH2-V12':'C01','CH2-V14':'C03','CH2-V15':'C04','CH2-C05R':'C05R','CH2-C07':'C07','CH2-C08':'C08','CH2-V19B':'C09','CH2-V19A':'C09A','CH2-V19C':'C09C','CH2-V20':'C10','CH2-V21a':'C11','CH2-V25-02':'03'}
changes=[]
def bind(cid,data,cues,title=None):
    url='/video/current/'+Path(data['path']).name
    sub='/video/subtitles/'+Path(data['path']).stem+'.vtt'
    text='WEBVTT\n\n'+''.join(f'{i+1}\n{stamp(a)} --> {stamp(b)}\n{t}\n\n' for i,(a,b,t) in enumerate(cues))
    staged_sub=OUT/'staged/GameStarter/web-demo/public'/sub.lstrip('/')
    staged_sub.parent.mkdir(parents=True,exist_ok=True)
    staged_sub.write_text(text,encoding='utf-8',newline='\n')
    clip=next((c for c in config['chapterTwo'] if c['id']==cid),None)
    old=dict(clip) if clip else None
    if clip is None:
        clip=dict(id=cid,title=title or cid);config['chapterTwo'].append(clip)
    clip.update(src=url,subtitles=sub)
    if title:clip['title']=title
    entry=dict(file='current/'+Path(data['path']).name,url=url,source='../../video/current/'+Path(data['path']).name,
               **{k:data[k] for k in ['duration','containerDuration','width','height','fps','frames','videoCodec','sha256']},
               bytes=Path(data['path']).stat().st_size,status='integrated-awaiting-human-review',fullDecodePassed=True,
               originalSources=data.get('sources',[{k:data[k] for k in ['source','sourceSha256'] if k in data}]),
               humanListeningReview=False,userApproved=False)
    if data.get('audioUnchanged'):entry['audioUnchanged']=True
    if data.get('audioPacketsUnchanged'):entry['audioPacketsUnchanged']=True
    if data.get('sourceRange'):entry['sourceRange']=data['sourceRange']
    media['clips'].append(entry)
    changes.append(dict(id=cid,previous=old,current=dict(clip),media=entry,cues=cues))
for cid,key in selection.items():bind(cid,converted[key],CUES[key],{'CH2-C05R':'问过损耗后回来继续查','CH2-C07':'地方收来的有没有少送','CH2-C08':'要交的和收到的','CH2-V25-02':'赴魏散谣设想'}.get(cid))
offset=converted['C12']['containerDuration']
bind('CH2-V21b',merged,CUES['C12']+[(a+offset,b+offset,t) for a,b,t in CUES['C13']],'第二封信后的安排与救命真相')
bind('CH2-V18',retained,[(.43,2.95,'苟安说粮早已备好。我得看看'),(2.95,4.93,'入仓的粮后来发到哪儿了')],'仓中核对（保留原版片段）')
urls={c['src'] for clips in config.values() for c in clips}
media['clips']=[m for m in media['clips'] if m['url'] in urls]
assert len({m['url'] for m in media['clips']})==len(media['clips'])
media['version']+=1
nodes={n['id']:n for n in story['nodes']}
def video(nid,cid,next,title,rows):
    n=dict(id=nid,kind='video',speaker='',text=title,clip=cid,sourceRows=rows,clues=[],next=next)
    story['nodes'].append(n);nodes[nid]=n;return n
nodes['CH2-LY04-D04']['next']='V18-C07'
video('V18-C07','CH2-C07','CH2-LY04-D05','地方实收与入仓核对',['CH2-LY04-W01','CH2-LY04-D05'])
nodes['CH2-LY04-D05']['next']='V18-C08'
video('V18-C08','CH2-C08','CH2-LY04-D06','应交与实收分栏',['CH2-LY04-C01','CH2-LY04-D06'])
nodes['V18']['sourceRows']=['CH2-LY04-T01','CH2-LY04-D04']
nodes['V18']['text']='仓中核对（保留原版片段）'
nodes['UI-EARLY']['options'][0]['next']='V17-R'
video('V17-R','CH2-C05R','V18','问过损耗后回来继续查',['CH2-LY04-F02'])
# C09 review3 omits the named dispatch fact. Restore the original handler's actual
# fixed line only on that branch; A/C already say it in their films. Do not invent a document.
nodes['V19B']['next']='CH2-LY04-C04'
dispatch=dict(id='CH2-LY04-C04',kind='line',speaker='地方经手人',text='李严叫停了追加催征，可原来的交付要求没有随之改下去。',material=False,sourceRows=['CH2-LY04-C04'],sources=['CH2-LY04-C04'],next='V20',clues=[])
story['nodes'].append(dispatch);nodes[dispatch['id']]=dispatch
nodes['V20']['sourceRows']=[x for x in nodes['V20']['sourceRows'] if x!='CH2-LY04-C04']
# A former still becomes a film at the same stable ID; no new clue is granted here.
p=nodes['CH2-LY09-P02'];p.update(kind='video',speaker='',text='赴魏散谣设想',clip='CH2-V25-02')
for k in ['placeholder','image','material']:p.pop(k,None)
# Keep evidence truthful to the revised recorded lines; do not credit unspoken inner monologue.
nodes['V12']['sourceRows']=[x for x in nodes['V12']['sourceRows'] if x!='CH2-LY03-025']
for clue in nodes['V12']['clues']:
    clue['sources']=[s for s in clue['sources'] if s['node']!='CH2-LY03-025']
    for s in clue['sources']:
        if s['node']=='CH2-LY03-023':s['text']='就是这批。纸上写的那天之前，粮已经备好了，是李严扣着没发。'
        if s['node']=='CH2-LY03-024':s['text']='凭这个去领本队的材料，别拿着乱闯。'
clue=nodes['V21b']['clues'][0]
clue['sources']=[s for s in clue['sources'] if s['node'] not in ['CH2-LY07-013','CH2-LY07-024']]
edits={'CH2-LY07-010':'李丰劝你和李严停手。你们到底商量了什么？','CH2-LY07-011':'让一个跟李家无关的人，把缺粮的事报上去，逼这一回退军。','CH2-LY07-012':'李严肯担一部分责任，我就装成被他推出来顶罪的人。','CH2-LY07-014':'你想查李严，想让大军继续打。我就顺着你的想法，让你往下查。','CH2-LY07-016':'那天在崖边救我，你也算过这些？','CH2-LY07-017':'那时候你快掉下去了，我只想先把人拉上来。'}
for s in clue['sources']:
    if s['node'] in edits:s['text']=edits[s['node']]
nodes['V21b']['sourceRows']=[s['node'] for s in clue['sources']]
held=[dict(id=k,reason=reason,sourceSha256=read(OUT/(k+'-review.json'))['sha256']) for k,reason in [
    ('C02','4.52–6.36秒：玩家说领记录，粮队管事同步张嘴；保留CH2-V13。'),
    ('C05C','26.64–27.60秒：玩家说那就再往前查，右侧NPC同步张嘴；保留CH2-V16C和V17。'),
    ('C06','21.64–25.86秒：玩家追问地方收粮，右侧NPC同步张嘴；保留原V18的仓中部分，其后接新版C07、C08。')]]
write(OUT/'replacement.json',dict(adoptedSources=list(CUES),adoptedSourceCount=len(CUES),held=held,changes=changes,originalStoryVersion=story['version'],storyVersionUnchanged=True,sourceFilesUntouched=True,humanListeningReview=False,userApproved=False))
for p,data in zip(paths[:3],[config,media,story]):write(OUT/'staged'/p,data)
if '--apply' in sys.argv:
    for p in paths:assert sha(ROOT/p)==baseline[p],f'Concurrent change: {p}'
    for change in changes:
        sub=change['current']['subtitles'].lstrip('/')
        shutil.copy2(OUT/'staged/GameStarter/web-demo/public'/sub,PUBLIC/sub)
    for p in paths[:3]:shutil.copy2(OUT/'staged'/p,ROOT/p)
    print('Applied received video update; run subtitles:sync before build.',flush=True)
else:print('Prepared only. Run with --apply after reviewing staged changes.',flush=True)
