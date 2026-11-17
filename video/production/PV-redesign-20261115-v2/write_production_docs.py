from pathlib import Path
import json,html,hashlib
R=Path(__file__).resolve().parent;OLD=R.parent/'PV-H3-20261115-v1';ART=R.parent/'PV-opening-20261114'
def save(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2),'utf-8')
def ref(name):return R/'references'/name
units=[
 {'id':'H01','title':'江岸火线开场','duration':5,'adopt':4,'timeline':'00—04','refs':[ref('R01-山河火线-v2.png')],'why':'替换腰间铜印开篇，建立近岸、江面、火线、山体的空间层次。','beats':[('0—2','相机只向右小幅横移，左前景芦苇产生真实视差；火线和渡船位置保持。'),('2—5','沿江的远火显露更多一点，近岸小兵继续朝船走；马蹄只由后期提前引入。')],'prompt':'One continuous five-second live-action historical war film shot, full-frame 16:9. Use the single reference as composition and geography. Camera at riverbank human eye height, gently tracks right by less than one metre, creating subtle reed foreground parallax. The distant thin camp fireline flickers with real smoke moving in one wind direction. A few tiny soldiers continue walking toward the near ferry. River ripples and sparse reflections move naturally. Keep subdued neutral dusk, layered mountains, the restrained fire scale, real timber and cloth. No aerial drone move, no new explosions, no shot change. Only natural riverbank wind, quiet water and distant fire. No voice, no speech, no narration, no music, no text, no black bars.','speech':[]},
 {'id':'H02','title':'庞统脸与掌同时可读','duration':7,'adopt':6,'timeline':'09—15','refs':[ART/'references/existing/E12-庞统托印.png',ART/'references/existing/E14-掌心铜印25毫米.png'],'why':'旧片自动推成掌心特写，人物托付关系消失。','beats':[('0—1','中近景锁住脸和托印右掌，不推镜。'),('1—6.2','庞统只说允许的原句，眼睛看向第一视角我，右掌向前送少许。'),('6.2—7','收住话，掌仍稳托小印，留衔接余量。')],'prompt':'Seven-second live-action historical tent scene, full-frame 16:9. Reference 1 locks the Pang Tong actor, crown, dark blue robe, seated pose and phoenix screen; reference 2 only locks the small 25 mm square brown-gray bronze private seal, low perforated knob and short dark red cord. Hold a fixed normal-lens medium close shot: his complete face and extended right palm stay visible together throughout. He looks directly toward the listener at the camera. His right palm moves forward slightly but does not hand over yet. His lips speak the one permitted sentence once, naturally, then close. Do not push into a hand macro, do not enlarge the seal. Neutral soft motivated side light, worn tactile materials, no supernatural effects. Room air and slight cloth rustle only under the permitted dialogue. No other voice, no music, no captions, no black bars. The only permitted spoken words are: 此乃我的私印，请你持此，速救主公。','speech':[('庞统／画内／唯一口型承担者','此乃我的私印，请你持此，速救主公。')]},
 {'id':'H03','title':'冯习张南同场建立夹击','duration':9,'adopt':7,'timeline':'20—27','refs':[ART/'references/new/N01-冯习张南-救驾受阻-v1.png'],'why':'现片的前路、后门与人物朝向未形成统一地理；不自动重投旧G09。','beats':[('0—3.8','左冯习说原句；右张南闭口听，双马向画面右前方转。'),('3.8—6','相机在二人侧后同轴小移：前路右侧已有敌矛，二马收步。'),('6—9','木营门在左后同一纵深，后路来兵；两人短促对视，冯习向右前、张南向左后。')],'prompt':'Nine-second continuous live-action war scene in a smoky Three Kingdoms camp lane, full-frame 16:9. The single reference locks the two mounted commanders and costumes. Feng Xi stays left, Zhang Nan right. Begin medium wide so both faces and horses are readable. Only Feng Xi speaks the one permitted warning once; Zhang Nan listens with closed mouth. Both try turning their horses toward the road at screen right. Camera moves slightly to their left rear without crossing the travel axis: a small enemy spear line blocks the rightward road, while men emerge from the same established wooden gate at back left. Horses slow and halt, no collisions. The two commanders exchange one glance, then face the two threats in opposite directions. Keep one coherent camp, limited believable extras, no spectacular stunt, no invented signs, no duplicate actors. Normal speed, natural dusk and local firelight only. Natural horse hooves, leather, footsteps, distant indistinct battle effort; no intelligible extra shouting and no music. No text or black bars. The only permitted spoken words, by the left commander, are: 御营败了，速去救驾！','speech':[('冯习／画内左侧／唯一口型承担者；张南闭口','御营败了，速去救驾！')]},
 {'id':'H04','title':'傅肜听答进完整表演','duration':9,'adopt':7,'timeline':'27—34','refs':[ART/'references/new/N02-傅肜-断后拒降-v1.png'],'why':'不把一串导演控制或临终口号读进音轨；保留听、答、行动因果。','beats':[('0—1.5','镜外右前方吴将劝降；傅肜闭口，握刀不动。'),('1.5—2','半拍呼吸和抬眼。'),('2—6','傅肜说完整原句，不改字，不加话。'),('6—9','句尾之后握稳刀踏前一步，镜头不跟挥砍。')],'prompt':'Nine-second live-action historical war film shot, full-frame 16:9 without letterboxing. Single reference locks Fu Rong, worn armor, blade and narrow camp road. Static medium close shot with clear face and hand. First an enemy officer remains entirely offscreen front right and speaks the first permitted line; Fu Rong listens with closed mouth. After a short breath Fu Rong raises his eyes and speaks the second permitted line once, with restrained force. Only after finishing he grips the blade firmly and takes one grounded step forward. No swordfight, no heroic slow motion, no duplicated soldiers, no unmotivated camera push. Real cloth, fire and quiet distant footsteps; no music. Never speak any direction or speaker label. No text. Permitted offscreen words: 降了，免死！ Permitted visible actor words: 吴狗！何有汉将军降者！','speech':[('吴将／右前方画外；傅肜闭口','降了，免死！'),('傅肜／画内／唯一可见口型承担者','吴狗！何有汉将军降者！')]},
 {'id':'H05','title':'沙摩柯回望与中箭中断','duration':5,'adopt':3,'timeline':'34—37','refs':[ART/'references/new/N03-沙摩柯-孤骑回望-v1.png'],'why':'把长箭杆展示、手松、骨朵落地、坠马拆开；本镜只承担回望到动作中断。','beats':[('0—2','棕马朝右小步走，沙摩柯回头看左后空路，部众没有出现。'),('2—3','他转回前方，短箭啸来自画外，肩背猛然一顿、呼气被截断；烟尘擦过遮住命中点。'),('3—5','手开始失力、上身伏低，保持重力与马步；不拍完整坠地。')],'prompt':'Five-second normal-speed continuous live-action historical war shot, full-frame 16:9. Single reference locks Sha Moke, his rough dark armor, dark brown horse, two bows and heavy spiked mace. Side medium-wide view, horse walks slowly screen right. He looks back left toward an empty road for two seconds, then begins turning forward. A very brief offscreen arrow whistle and a dull armor impact abruptly interrupt him: shoulder jolts once, breath catches, upper body starts folding, grip loosens. A small naturally wind-driven veil of smoke crosses the impact area. Do not display a protruding arrow shaft, do not show a slow airborne projectile, no blood and no wound close-up. Do not animate a complete fall or a second attack. Camera stays on the same side of the path, horse and gear remain physically continuous. Only single-horse hooves, breath, wind, one short arrow whistle and one restrained impact. No words, no cries, no narration, no music, no text, no black bars.','speech':[]},
 {'id':'H06','title':'骨朵与空鞍的结果','duration':4,'adopt':3,'timeline':'37—40','refs':[ref('R02-人去马还行-v2.png')],'why':'结果镜从接地之后开始，避免不同任务硬拼同一次坠马。R02为结果构图候选，不假称H05精确末帧。','beats':[('0—1','骨朵和画边手臂已在地面，保持不动；不上演第二次落地。'),('1—4','空鞍棕马向右继续两三步，缰绳随真实步态轻拖，空路没有人追上。')],'prompt':'Four-second live-action historical film result shot, full-frame 16:9. The single reference is the exact starting composition: low camera by the same dry camp mountain track. The heavy spiked mace already rests on the earth. The fallen rider stays outside the bottom-left frame apart from his same limp hand, brown sleeve and armor edge, all motionless. His riderless dark brown horse continues a few steps toward screen right, saddle and two bows stable, reins trailing under gravity. Preserve the empty road behind and distant localized camp fire. Camera stays low and nearly still; smoke and horse movement provide all motion. No second fall, no resurrection, no extra person, no new arrow, no blood, no weapon moving by itself. Natural diminishing single-horse hoofbeats, gritty ground and wind only. No words, no moaning, no narration, no music, no text, no black bars.','speech':[]},
 {'id':'H07','title':'上方谷暴雨只压火','duration':5,'adopt':4,'timeline':'43—47','refs':[ART/'references/new/N08-上方谷-同一演员雨火-v1.png'],'why':'旧原片在暴雨中反而火势变强，违背本镜失去机会的变化方向。','beats':[('0—2','同一峡谷与近处人物稳定，暴雨冲刷谷底火区。'),('2—5','暴露火点逐渐收小、变暗，蒸汽只在遇水处出现；遮蔽处留少许余火。')],'prompt':'Five-second live-action historical mountain valley in heavy real rain, full-frame 16:9. Use single reference for the same Zhuge Liang actor, wet costume, near ledge and valley geometry. Wide view; camera very slowly eases back without changing the geography. Rain strikes the exposed burning timber far below. Exposed flames ONLY shrink and darken over time; a few sheltered embers persist. Physical water splashes and small steam occur only where water hits hot material. No new fire burst, no lava, no orange river, no lightning spectacle. Zhuge Liang stands grounded and silent, feather fan stays the same size. Heavy rain, wet cloth, water and faint dying fire only. No intelligible voice, no narration, no music, no text, no black bars.','speech':[]},
 {'id':'H08','title':'雨中仰望闭口','duration':4,'adopt':3,'timeline':'49—52','refs':[ART/'references/new/N08-上方谷-同一演员雨火-v1.png'],'why':'旧片无对白目标却张嘴，需要重新拍一次可读、闭口的视线动作。','beats':[('0—1','同一演员侧面中近景低眼看谷底，嘴唇闭合。'),('1—3','只抬眼望雨，羽扇垂低少许。'),('3—4','保持停顿，不摇头、不说台词。')],'prompt':'Four-second live-action historical rain scene, full-frame 16:9. Same Zhuge Liang actor, crown, soaked blue-gray robe and fan as the single reference, but use a natural-lens side medium close view on the same ledge. He begins looking down toward the valley, then raises only his eyes and chin slightly toward the rain once. Fan lowers a little. His lips remain fully closed for the entire shot, no mouthing. Natural rain weights the cloth and feathers. No other character, no new setting, no exaggerated crying. Close rain on fabric, water drops and a quiet breath only; no speech, no narration, no music, no captions, no black bars.','speech':[]},
 {'id':'H09','title':'马谡诸葛亮同场连续表演','duration':12,'adopt':10,'timeline':'59—69','refs':[ref('R03-马谡诸葛亮同场-v2.png')],'why':'用一条共享演员、光线和空间的母镜完成相视到掩面；取代错误反打与前景军官。','beats':[('0—4','左下马谡跪在原地看右上，右上诸葛亮看左下；二人嘴始终闭合。'),('4—7','相机仅在当前轴线同侧向右小移、稍近；保留马谡左边作为空间锚点。诸葛亮垂眼。'),('7—10','诸葛亮抬肘转腕，原尺寸宽羽扇从胸前移到眉眼和鼻梁前，真正遮住双眼；左手仍压木案。'),('10—12','短停，风吹衣料和远旗；不挥刀、不增求情台词。')],'prompt':'Twelve-second SINGLE continuous live-action historical camp scene, full-frame 16:9. Use the one master reference for BOTH exact actors, costumes, dusk light and geometry. Ma Su remains kneeling bound at bottom left, looking UP RIGHT at Zhuge Liang. Zhuge Liang stands on the low dais at upper right behind the same wooden table, looking DOWN LEFT at Ma Su. No armored man between them. Both mouths remain closed. First hold their shared eyeline for four seconds. Then camera moves only slightly right and closer on the SAME side of their axis, keeping some of Ma Su at left as a spatial anchor. Zhuge Liang slowly lowers his eyes once. After a short hesitation his right elbow lifts and wrist rotates the SAME broad natural feather fan toward his face until it physically covers his eyes and nose bridge; left hand stays on the table. Fan retains its starting dimensions, feather count, handle and grip throughout; no growth or morphing. Hold briefly. No cut, no reverse angle, no horizontal flip, no rain, no execution action, no extra tears or sobbing. Natural camp wind, distant cloth flags, subtle breathing and feather/sleeve rustle only. No words, no narration, no music, no text, no black bars.','speech':[]},
]

for unit in units:
 unit['prompt'] += ' Sound contract: absolutely no background music or score, including music generated inside the source clip. Preserve scene ambience, synchronized physical sound and appropriate natural human breathing or exertion. Spoken dialogue is limited to the explicitly permitted lines in this request. Do not read control instructions, labels or unrelated narration.'
folder=R/'H3待审请求';folder.mkdir(exist_ok=True)
manifest=[]
for u in units:
 d=folder/u['id'];d.mkdir(exist_ok=True)
 for p in u['refs']:assert p.exists(),p
 (d/'prompt.txt').write_text(u['prompt']+'\n','utf-8')
 save(d/'references.json',[str(p) for p in u['refs']])
 sp='无。禁止对白、旁白、额外可辨人声。' if not u['speech'] else '\n\n'.join(f'{who}：**“{line}”**' for who,line in u['speech'])
 refs='\n\n'.join(f'{i+1}. `{p}`' for i,p in enumerate(u['refs']))
 beats='\n'.join(f'| {t}秒 | {b} |' for t,b in u['beats'])
 doc=f'''# {u['id']} {u['title']} · v2 待review

模型：MiniMax-H3  
分辨率：768P  
画幅：16:9满幅  
请求总时长：{u['duration']}秒

采用位置：新版PV {u['timeline']}秒，拟采用{u['adopt']}秒；实际剪点须在生成、完整播放、声音检查之后确定。当前**未提交、无新任务ID**。本文件是待审制作文档，不能因为脚本存在就视为获准提交。

## 修改理由

{u['why']}

## 参考图上传顺序

{refs}

输入均为reference_image，不宣称严格首尾帧。除H02的道具补充图外，其余每条仅一张起始候选；续镜若重新制作，先核对上一镜实际采用状态，不盲加冲突参考。

## 唯一允许发声的原句

{sp}

角色标签、时段、参数与导演说明绝不能发声。需要独立TTS时，text字段只含上述原句，不含引号和角色名。环境音必须保留并与动作匹配；不添加BGM。

## 分镜与动作

| 请求内时间 | 起始、动作与可见结果 |
| --- | --- |
{beats}

## 可提交Prompt候选（正文单独保存在prompt.txt）

```text
{u['prompt']}
```

## 拍摄与连续性参考

自然正常透视、真实皮肤和旧布甲材质，光源服从当前场景；不添加上下黑边、全局黄滤镜、说明文字或CG炫光。镜头只执行本条可见动作，不把“大片感”当作随意加人、加火和甩镜的理由。多人、动物、手与道具按接触和重力逐项核对，不能用裁切掩盖空间错误。

## 提交与检查

沿用用户指定`D:/AI视频/VJ-1106/api-tools/docs/MiniMax-H3-API视频生成SOP-20261114-v1.md`与其DPAPI入口。通过本版后：上传并下载校验参考字节；预览请求比对Prompt、顺序、秒数；一次POST立即保存ID，之后只恢复同ID查询。原G09无ID不重投。新条目未知结果也不自动重投。

检查独立记录：API完成、完整解码、实际像素帧率、完整动作播放、声音是否出现异常读稿、跨镜空间与用户审核。生成成功不能代替通过。保留原生带声MP4，不自动用`-an`去音；原始混合音轨另存，对异常人声先处理并再次听审。

声音要求（v2.1）：最终全片不要BGM，包括原生生成片混入的配乐。保留环境底声、动作同期声、符合动作的人物呼吸与喘息；对白只说“唯一允许发声的原句”，无对白不等于无人类呼吸。禁止角色标签、导演控制、无关旁白与乱码朗读。分别核验正确人物声音、环境／动作声和是否混入配乐，不以全轨静音或删除全部人声代替修正。最终按实际声音逐句核对，不把本文直接当转录或字幕。
'''
 (d/(u['id']+'-'+u['title']+'-v2.md')).write_text(doc,'utf-8')
 manifest.append({**{k:v for k,v in u.items() if k not in ('prompt','refs')},'references':[str(p) for p in u['refs']],'directory':str(d),'prompt_sha256':hashlib.sha256((d/'prompt.txt').read_bytes()).hexdigest(),'status':'待review','submitted':False})
save(R/'h3-remake-manifest.json',{'units':manifest,'requested_seconds':sum(u['duration'] for u in units),'new_submissions':0,'old_unknown_G09':'not retried','status':'待review'})
script=R/'开篇PV-整体优化导演稿-v2.md'
txt=script.read_text('utf-8')
txt=txt.replace('H3画面任务统一只请求环境和动作声音，不让模型照控制文字自由念白。最终台词另录后匹配确实能承载的画面，口型不符则重拍，不挪到另一个角色嘴上。','H01、H05—H09只请求环境和动作声音；H02—H04分别列明唯一允许发声的原句，其余控制不得发声。独立后期台词也必须匹配确实能承载的画面，口型不符则重拍，不挪到另一个角色嘴上。')
script.write_text(txt,'utf-8')
print(json.dumps({'draft_requests':len(units),'requested_seconds':sum(u['duration'] for u in units),'submitted':0},ensure_ascii=False))
