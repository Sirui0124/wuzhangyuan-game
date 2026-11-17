from pathlib import Path
import json, shutil, hashlib, subprocess
ROOT=Path(__file__).resolve().parents[3]; OUT=Path(__file__).parent
CORE=ROOT/'source-art/core'; CORE.mkdir(parents=True,exist_ok=True)
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,d):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8')
refs={};records=[]
def ref(key,path,use,frame=None):
    src=ROOT/path; dest=CORE/(key+('.png' if frame is not None else src.suffix))
    if frame is None:shutil.copy2(src,dest)
    else:subprocess.run([FF,'-v','error','-y','-ss',str(frame),'-i',str(src),'-frames:v','1',str(dest)],check=True)
    refs[key]={'path':dest.resolve().as_posix(),'use':use}
    records.append(dict(id=key,**refs[key],source=src.resolve().as_posix(),frame=frame,sha256=hashlib.sha256(dest.read_bytes()).hexdigest(),approval='沿用现片/现用源图身份；本轮整理不新增审核通过'))
old='video/production/CH01-full-video-20261023/参考图/'
ref('甲',old+'甲.png','只锁甲的中年宽脸、黑布包髻、短须与旧铁札甲，不复制背景及画风')
ref('乙',old+'乙.png','只锁乙的年轻长脸、软巾、深灰交领布衣，不复制背景及画风')
ref('斥候',old+'斥候.png','只锁年轻斥候脸、束发、窄头带与褐色札甲')
ref('姜维','video/current/C1T18-report-20261024-417c6cc9.mp4','从现片8.25秒提取，锁年轻姜维脸、高束发、蓝灰衣袍和麻白领；不复制左侧魏延及此图站位',8.25)
ref('魏延','video/current/C1T05-player-voice-freeze-20261023.mp4','从现片19.7秒提取，锁魏延中年宽脸、黑巾、短浓须、暗朱衣和细片札甲；不复制前景手矛',19.7)
ref('诸葛亮','video/current/PR01-A-20261024-57daca70.mp4','从现片5.9秒提取，锁诸葛亮消瘦长脸、披发、灰黑长须、黑袍白襟',5.9)
ref('中军帐',old+'主帐.png','只锁中军大帐、闭帘、门侧火盆、右侧告示、土路及木栏的空间；时段按分镜')
ref('将军帐',old+'将军帐.png','姜维自己的小帐、右侧灯架与木栏；不能当中军帐，不默认姜维在这里')
ref('传报处',old+'传报处.png','传报棚、桌案及通道；与中军帐和将军帐分开')
ref('玩家衣袖',old+'手矛.png','只锁我之灰褐平纹麻布袖、右手与单根细木矛；不锁构图，不要求持续持矛入镜')
ink=ROOT/'video/production/PR01-ink-realism-20261022'
for key,pattern,use in [
 ('夜营','**/*R01-night-camp-route.png','夜营大空间、外圈停马点、营道与远处主帐；不复制图中人脸'),
 ('灯阵','**/*R02-lamp-array.png','落地主灯、周围灯阵和侧通道；图中人脸不作为身份'),
 ('铜灯','**/*R00-original-lamp-tail.png','只锁三足双环铜灯器型、地面比例和灭后细烟；不强制首帧'),
 ('帐门','**/*R04-weiyan-curtain.png','主帐门框、厚帘、守卒与随从空间；人物身份由单独人物图控制')]:
    ref(key,next(ink.glob(pattern)).relative_to(ROOT),use)
modern='video/production/PR01-direction-20261023/references/'
for key,name,use in [('工位','M01-office.png','同一现代夜间工位、代码显示器、台灯、水杯和鼠标'),('手机','M02-phone.png','横屏黑框手机、同一成年男子双手和深灰袖口；屏内只放熄灯画面'),('同学','M03-classmate.png','同学演示AI的真实聚会空间；演示者不是玩家本人'),('离职','M04-boxes.png','第一视角抱纸箱离开工位的现代空间与双手；不拍玩家脸')]:ref(key,modern+name,use)
save(CORE/'assets.json',{'version':'20261025','assets':records,'runtimeManifest':'GameStarter/web-demo/visual-assets.json','note':'本目录是视频制作唯一核心参考入口；运行时资源仍按原manifest，未机械替换'})
script={x['id']:x for x in read(ROOT/'content/chapters/wuzhang/chapter-one.script.json')['rows']}
STYLE='写实电影摄影，16:9，无黑边。墨灰、麻白、少量暗朱，保留自然肤色和可辨暗部。真实旧木、麻布、哑光铁甲，禁止塑料皮肤、HDR亮边、蓝橙通染、水墨贴图。人物动作正常速度，有起步、承重与落脚；不慢动作，不速度渐变，不转圈展示。主灯铜盆低矮落地、双环耳短足，不变成桌上烛台。'
POV='摄影机就是我的眼睛，我在镜外说话；不拍我的脸、肩背和倒影。普通对话不露手矛，避免前景长矛遮挡。我的所有句子由同一约30岁中音男声画外发出；NPC听时闭口，仅轮到原句才开口。甲中年干涩中低音，乙年轻清晰中音，姜维年轻沉稳男声，魏延略沙哑低男声。声音描述只是约束，不能宣称已锁声纹。'
FILM='拍摄手法参考：《影》（ASC摄影访谈 https://theasc.com/article/dual-nature-shadow/），取低饱和材质、有限暖色与有动机的机位变化，应用于本条人物和灯火镜；《1917》（ASC摄影访谈 https://theasc.com/article/lives-under-siege-the-goldfinch-and-1917/），取随动作安排机位与行进距离，应用于本条步行/动作镜。具体切点是本项目设计，不声称复刻原片。'
clips=[]
def shot(a,b,keys,action,camera,ids=(),speech=''):
    return dict(start=a,end=b,refs=keys,action=action,camera=camera,rows=list(ids),speech=speech)
def clip(id,name,sec,keys,shots,extra='',group='chapterDialogue'):
    assert shots[0]['start']==0 and shots[-1]['end']==sec
    assert all(x['end']==y['start'] for x,y in zip(shots,shots[1:]))
    c=dict(id=id,name=name,duration=sec,refs=keys,shots=shots,rows=[r for s in shots for r in s['rows']],group=group,extra=extra)
    docs=[f'尺寸：16:9\n模型：MiniMax-H3\n声音：有声音\n时长：{sec}秒\n\n## 参考图（按以下顺序上传）\n']
    for i,k in enumerate(keys,1):docs.append(f'### 图片{i}｜{k}\n本地路径：`{refs[k]["path"]}`\n用途：{refs[k]["use"]}\n')
    docs+=['## 视频生成 Prompt\n',STYLE+'\n',POV+'\n' if group=='chapterDialogue' else '古代段可为第三人称；现代段严格第一视角。镜头边缘保留约4%构图余量，供768P结果居中微裁成16:9。\n',extra+'\n']
    for n,s in enumerate(shots,1):
        docs.append(f'### 分镜{n}｜{s["start"]}-{s["end"]}秒\n')
        docs.append('参考图关系：'+'；'.join(f'图片{keys.index(k)+1}（{k}）负责{refs[k]["use"]}' for k in s['refs'])+'。\n')
        docs.append('画面与动作：'+s['action']+'\n摄影与切点：'+s['camera']+'\n对白：\n')
        for rid in s['rows']:
            r=script[rid]; speaker=r['speaker']
            if speaker=='演出':docs.append(f'- {rid}为演出，只执行动作，不念导演说明：{r["text"]}\n');continue
            if speaker.startswith('我'):rule='我的画外声，受话人是对面NPC；所有可见人物闭口倾听。' if '心声' not in speaker else '我的内心画外声；NPC听不到，不作回应。'
            elif speaker=='旁白':rule='画外旁白，所有可见人物不做说话口型。'
            else:rule=f'受话人是摄影机位置的我；只由{speaker}做口型，其他人闭口。'
            docs.append(f'- 原编号{rid}｜{speaker}。{rule}逐字原句：“{r["text"]}”\n')
        docs.append(s['speech']+'\n' if s['speech'] else ('无其他对白，不新增人声。\n' if s['rows'] else '无对白、无旁白。\n'))
    docs+=['### 全片约束\n连续性约束：同一人脸、衣甲、左右方向和地点关系不变；有选择或行动确认时由游戏决定，视频不画按钮、不替玩家选择、不提前发放线索。无字幕、水印、logo、黑场标题。只表演指定台词，不添加口头语。\n',FILM+'\n','声音要求：全片无BGM、无背景音乐、无配乐；仅保留指定对白/心声/旁白及与画面同步的风、帐布、马蹄、脚步、甲片、衣料、火苗和现代工位声音，按实际分镜选择。无额外群众语言、喊杀、吟唱、音乐鼓点或重击。非说话角色不抢话。句末留自然落音，禁止吞字。\n']
    fn=id+'-'+name+'.md';(OUT/fn).write_text('\n'.join(docs),encoding='utf-8');c['document']=str((OUT/fn).resolve())
    prompt='\n'.join(docs[docs.index('## 视频生成 Prompt\n')+1:])
    # Explicit role and concrete order are repeated in API text, independently of human document headings.
    prompt='\n'.join(f'<Picture {i}> = {k}：{refs[k]["use"]}' for i,k in enumerate(keys,1))+'\n'+prompt
    payload={'model':'MiniMax-H3','duration':sec,'resolution':'768P','ratio':'16:9','content':[{'type':'text','text':prompt}]+[{'type':'image_url','image_url':{'local_path':refs[k]['path']},'role':'reference_image'} for k in keys]}
    save(OUT/'requests'/(id+'.local.json'),payload);clips.append(c)

clip('OP01','灯与急报',15,['夜营','灯阵','诸葛亮','魏延','铜灯','帐门'],[
 shot(0,1.2,['铜灯'],'极近景：火引刚触灯芯，火苗倏地立起；只点亮一次。','85mm微距固定，火焰由暗到明形成第一秒视觉钩子。'),
 shot(1.2,3.6,['夜营'],'三骑正在全速接近外营，泥水随蹄溅起，远处旗列后有更多同向骑兵纵深。','35mm低位短侧跟，马掠前景接切；不用航拍建立景等候。'),
 shot(3.6,5.7,['灯阵','诸葛亮','铜灯'],'帐内斜侧中景：诸葛亮站在灯阵侧后，右手剑尖垂下；童子已收火引，从侧通道退开。','轻微向下揭示落地主灯与侧后人物同框，暗部有层次；蹄声隔帘闷入。'),
 shot(5.7,8.6,['夜营','魏延'],'外圈传报棚，传令兵刚落脚对魏延报告。魏延看向他，听完即转向营道。','50mm两人关系中景，转身动作接下一镜。',speech='唯一说话者传令兵，对魏延说：“将军，军情紧急！”魏延全句闭口，面色沉着。'),
 shot(8.6,11.2,['魏延','夜营'],'魏延带两甲士快步穿过营道，暗朱衣随步幅起伏；这里尚未抵帐。','35mm侧后跟两步，帐柱掠过遮挡作为距离省略切点，运动左向右。'),
 shot(11.2,15,['帐门','魏延'],'魏延从距帐四步处走到闭帘前，只到达一次；守卒刚转头，他右手已触帘沿，末帧帘仍闭。','45mm斜前机位后移两步即停，让魏延自然逼近，末尾触帘动作切出。')],
 '本条用一盏灯与军情运动交叉组织紧张感，动作节拍由1.2秒短镜到持续步行，结尾不等候。只有一次点灯、一次接报、一次抵帐；魏延不骑马、不推人、不暴怒。',group='opening')
clip('OP02','掀帘与灭灯',6,['帐门','魏延','灯阵','诸葛亮','铜灯'],[
 shot(0,1,['帐门','魏延'],'右手已经触帘，立刻拉开半幅，魏延跨入，不重拍抵帐。','紧近景动作接切；帘开始分开即切帐内同向动作。'),
 shot(1,3,['灯阵','魏延','诸葛亮','铜灯'],'帐内低位：前景本命灯仍亮、远处入口同框。帘开，布沿鼓入，火苗顺风压弯即灭；其他灯只晃。','32mm固定关系镜，明确开帘导致灭灯；禁止切后才看到灯灭。',speech='魏延面对诸葛亮只说一次“丞相。”仅魏延口型，诸葛亮闭口。'),
 shot(3,4.1,['诸葛亮'],'诸葛亮目光落向低位灭灯，吸气停半拍，握剑指节松开。','85mm侧面近景，克制反应一拍，不悲号倒地。'),
 shot(4.1,6,['铜灯'],'同一低矮铜盆已灭，细烟升起，最后0.5秒构图稳定。','固定低位物件特写，急步声骤远，烟成为现代手机接点。')],
 '灯灭是唯一一次不可逆结果；不反复亮灭、不换灯型，不加神力。尾部构图只见铜灯和细烟，为OP03手机内同一灭灯影像预留接点。',group='opening')
clip('OP03','手机与错过',12,['工位','手机','铜灯','同学'],[
 shot(0,2.4,['手机','工位','铜灯'],'开头全屏是熄灯铜盆，镜头短退揭示横屏手机边框和同一双手；拇指点暂停，烟停，屏内灯始终熄灭。','50mm短后移完成古今揭示，手机不变形；铜灯影像只在屏内。',speech='我的青年男声画外低说：“就差这一下。”所有出镜旁人均闭口。'),
 shot(2.4,6.2,['工位'],'手机放到桌上，右手转到键盘连续删除重打；代码显示器冷光在手背，城市灯点压在远处。','手指落桌接键盘动作近景，切一次挤满普通通勤者的车窗倒影；不拍我的脸。',speech='同一男声内心画外：“写了五年代码，天天都在改。”'),
 shot(6.2,10.4,['同学'],'第一视角看同学站在大屏旁展示AI，画面真有图像逐步生成；我桌边手指短暂停住。','中景隔前景酒杯形成距离，只向演示者短推一小段；同学不口型念我的心声。',speech='同一男声内心画外：“同学赶上了AI，我还想着再等等。”'),
 shot(10.4,12,['工位'],'硬切工位，浏览器机会列表与旧聊天日期飞快掠过，鼠标悬停却没有点下。','屏幕局部到停住的手，短切收住，不生成具体行情数字或可读虚构标题。')],
 '全条严格第一视角，现代衣袖深灰；不出现我的脸或反射。用动作传达犹豫，不靠慢镜抒情。手机暂停画面不可复燃。台词近处轻声、自然速度，不做旁白演讲。',group='opening')
clip('OP04','离开与许愿',12,['工位','手机','铜灯','离职'],[
 shot(0,3.2,['工位'],'第一视角，旧窗口的资产图标和年代页面仅一闪即过，目光落回停住的手。','屏幕冷光匹配切纸箱边角，具体收益数字不可辨。',speech='承接上条同一男声心声：“英伟达，比特币……也是这么错过的。”'),
 shot(3.2,6.8,['离职'],'第一视角抱纸箱走出已熄灯的一排工位，两步有真实重心，门禁轻响。','35mm随身体行走，箱角自然晃动；门框遮挡硬切同一旧工位回忆。',speech='同一男声内心画外：“代码能回退，日子怎么就不行呢。”'),
 shot(6.8,12,['工位','手机','铜灯'],'回到同一夜间工位，横屏手机仍显示已灭灯；右手拿起，屏幕冷白反光渐占满视线，末尾过曝极短一瞬接现有醒来守营。','手指拿机动作近景，眼线沿手机抬起；最后1秒光线匹配下一段，禁止出现我的脸。',speech='同一男声近处低语：“要是……能时光倒流就好了。”')],
 '回忆由硬切交代，不把公司走廊变形为军营；返回的是同一工位同一手机熄灯暂停帧，不按播放、不倒带、不复燃；结尾光变只作入SC03的转场。',group='opening')

clip('G09A','问甲禁令',15,['甲','中军帐'],[
 shot(0,7.6,['甲','中军帐'],'中军帐外，甲守着闭帘，看向我；先听完我提问再答口谕，态度平实。','50mm第一视角中近景，问句时甲嘴自然闭合，答话时才开口。',['D01','D02']),
 shot(7.6,15,['甲','中军帐'],'我追问误军情，甲略侧目营道，回看我简短答复。','65mm切近半级；身体只有自然呼吸，末尾落音。',['D03','D04'])])
clip('G09B','甲说明两重责任',10,['甲','中军帐'],[
 shot(0,10,['甲','中军帐'],'甲仍在同一守位，先轻指营道，再收手；把急报和禁令两件事说完整，最后说明自己不能处置军情。','与G09A同眼线65mm中近景，台词后留0.7秒自然余量。',['D05','D06'])])
clip('G10Q','向乙问当值',4,['乙','将军帐'],[
 shot(0,4,['乙','将军帐'],'第一视角在姜维自己的将军帐前看向乙，乙听见我询问，停下手中文书，闭口抬眼。','50mm稳中景，乙在我说完整句期间始终无说话口型，末尾准备答话但不发声。',['D07'])])
clip('G14Q','请求亲兵通传',6,['甲','将军帐'],[
 shot(0,6,['甲','将军帐'],'将军帐前，亲兵在我对面；我完整说请求，他闭嘴听，听完才转眼望向中军帐方向。','50mm第一视角中近景，整段亲兵不张嘴；不演成亲兵替我请求。',['J03'])])
clip('G15A','姜维接受接报',15,['姜维','中军帐'],[
 shot(0,6.2,['姜维','中军帐'],'中军帐外，姜维刚从低咳声方向转回，目光稳住，确认禁令和当值职责。','65mm第一视角胸像，自然肤色和侧光，台词驱动微小表情。',['J09','J09A']),
 shot(6.2,15,['姜维','中军帐'],'姜维手指向帐外空地，明确让魏延来报及自己判断、承担责任，不开门。','50mm略放宽给示意动作，然后稳住；不怒瞪、不反复点头。',['J10','J10A'])])
clip('G15B','姜维等候与亲兵同行',11,['姜维','甲','中军帐'],[
 shot(0,7.7,['姜维','中军帐'],'我问是否现在便去；姜维先闭口听，再回答自己就在原地等，答完留在原位。','第一视角65mm中近景，同前条眼线与服装。',['J10B','J11']),
 shot(7.7,11,['甲','姜维','中军帐'],'亲兵从右侧往我身旁迈半步，说完愿随行；姜维在后景留守。','转视线向亲兵，保持姜维仍在后景，没说话的人闭嘴。',['J13'])])
clip('G20','天亮前收束',10,['中军帐','玩家衣袖'],[
 shot(0,3.5,['中军帐'],'夜色残余，闭帘里传来一声弱咳，帐外我停住片刻。','固定第一视角中景，帘始终闭合。',['B-03']),
 shot(3.5,10,['中军帐','玩家衣袖'],'时间硬切微明天光，第一视角低头，灰褐麻布袖右手慢慢放松单根细木矛，矛仍握着。','50mm从帐前微光轻落到手，真实手指关节，不松成掉矛。',['B-04'])])
# A source-conditioned fixed variant must not invent the uncollected gate clue.
variant=script['A-42']['text'].replace('营门未破。','')
clip('G06B1','未询问营门时转呈',10,['甲','中军帐'],[
 shot(0,10,['甲','中军帐'],'甲在中军帐外听我转呈，整段闭口，不点头承诺已经处理。','稳定第一视角50mm关系中景。',speech=f'我的同一画外男声对甲逐字说：“{variant}”随后“{script["A-43"]["text"]}”；甲不代说，不增“营门未破”。')],extra='仅首轮选择坚持禁令、没有T02时使用；这仍是固定分支，不是任意个性化发言。')
clip('G06B2','守门者只能递话',7,['甲','中军帐'],[
 shot(0,7,['甲','中军帐'],'甲表明只能递话，不能作主；我回答后视线转回值守方向。','50mm第一视角中景，甲说完闭嘴听我的答句，末尾只开始转视线。',['A-44','A-45'])])
save(OUT/'production.json',{'date':'2026-10-25','authorization':'用户本轮明确要求重新设计并生成、补齐第一关固定演出','model':'MiniMax-H3','clips':clips,'assets':records,'reviewState':'待review','voiceNote':'动态AI接受句和玩家输入保持实时TTS；无预置冒充'})
print(json.dumps({'clips':len(clips),'seconds':sum(c['duration'] for c in clips),'assets':len(records),'ids':[c['id'] for c in clips]},ensure_ascii=False))
