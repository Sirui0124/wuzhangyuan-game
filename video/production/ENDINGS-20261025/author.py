"""Authoring only: write reviewable ending prompts and local request templates."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parents[2]
specs = [
    dict(id='C1END-EXEC', key='execution', ending='weiyan-execution', name='军令落下',
         source='GameStarter/web-demo/src/chapters/chapter-one/session.ts:346；views/navigation.ts:19',
         entry='当前轮魏延处斩回应已读完，进入weiyan-execution；不得用于教学次日问责。',
         core='魏延已经下令，两名军士把灰褐布衣的我带离，镜头留在空出的营道。死亡由既有结局明确，画面不增加军法依据。',
         shots=[('魏延闭口站定，目光停在右侧被押者身上。两名军士分别站到灰褐衣男子两侧。男子始终背向摄影机。','沿首帧的客观侧面中远景，缓慢横移半米；魏延不拔刀、不挥刀。'),
                ('两名军士各扶一侧上臂，带男子沿土路走向画面右侧暗处。三人同向连续走三步，魏延留在原位。','摄影机固定，不追进黑暗；男子不回头，脸不露出，动作连续。'),
                ('三人走出画面，空出的土路只剩脚印和低火光。镜头停留，最后一秒缓慢淡黑。','低机位缓推空处；不拍执行、不拍血、不拍尸体，不新增灯是否熄灭的判断。')],
         sounds='衣甲摩擦、踏土脚步由近到远、远处风声和火盆轻响；结尾脚步淡出。'),
    dict(id='C1END-TENT', key='tent', ending='tent-execution', name='帐后有刀',
         source='GameStarter/web-demo/src/chapters/chapter-one/tent-visit.ts',
         entry='玩家选择继续绕至帐后并被巡营军士发现之后；退出偷听不播放。',
         core='越过帐后绳索的视线被巡营火把照断，人被带离，帐布仍不透明，始终听不清帐内秘密。',
         shots=[('巡营军士从转角走近半步，把火把照向灰褐布衣男子。男子背影立刻停住，手没有碰帐布。','以首帧第三人称中远景缓推；保持帐绳在前景，火把不擦帐布。'),
                ('第二名军士从火把后走到男子身侧，第一名仍举火照路。男子顺着示意转身半侧背走向营道外，面部仍被角度遮住。','沿帐后土路平行侧移；不穿过绳索，不出现帐内人物。'),
                ('三人沿画面右侧走远，暖光离开帐布，帐后重新只剩夜风；最后一秒淡黑。','停在帐绳、旧布与空土路，建立无人留下的结局。没有额外搜出情报或物件。')],
         sounds='风吹帐布、火把燃烧、三人的踏土脚步和甲片轻碰；没有可辨帐内说话声。'),
    dict(id='C1END-RADIO', key='radio', ending='radio-relay', name='匣中有军令',
         source='GameStarter/web-demo/src/chapters/chapter-one/supply-endings.ts',
         entry='军报、回令原流程完成；radio-relay方案和两端初次试通已确认。',
         core='在已完成初次试通的前提下，魏延拿着小匣走远两步，又回望仍站帐前的姜维。声音跨越距离带来的惊讶只用动作表达。',
         shots=[('保持首帧两名将军身份，魏延把手中的哑黑对讲机轻转半圈查看，再抬眼看向四米外的姜维。姜维手中始终握着另一只同型号设备。','客观双人中景缓推，魏延在右前，姜维在左后，设备恰好两只。'),
                ('魏延沿营道离开两步，停下，回头望姜维。姜维没有跟走，轻抬自己手中的对讲机作确认。两人全程闭口。','镜头随魏延平移，让姜维留在纵深；不切第一人称，不制造第三只设备。'),
                ('魏延低头再看一眼小匣，眉间稍松，嘴角极轻地动一下但不说话，随后把设备稳稳收在身前，转向营道。','切魏延半身近景保留同一脸与甲；结尾留一秒稳定，不加胜利画面。')],
         sounds='土路脚步、衣甲摩擦、轻风和设备一次短促电流底噪；没有可辨对白或军令，不能用声音发出新的命令。'),
    dict(id='C1END-LIGHT', key='light', ending='light-signal', name='此灯不借天命',
         source='GameStarter/web-demo/src/chapters/chapter-one/supply-endings.ts',
         entry='军报回令已交清，帐外灯号约定及视线验证已完成，仅表现一次测试回看。',
         core='沿可见营道试一下手电，远处魏延抬手表示看见，近处姜维点头；电光只作约定信号的辅助。',
         shots=[('承接首帧，魏延从姜维身旁向画面右侧的营道连续走三步，离开约三米，再转身面向测试点。姜维留在原地，灰褐袖右手握稳关闭的手电。','客观营道广角缓慢向右平移，跟清魏延走到测试位置的真实过程，光轴远离闭合中军帐。'),
                ('手电只亮起一次，低亮度白色散射光照向营道接收点一秒后熄灭；远处魏延抬起空着的手，示意已经看见。','保持同一空间的长焦压缩，人物位置不互换；无激光柱，无夸张浓雾光束。'),
                ('近处姜维看一眼已经关闭的手电，轻轻点头。玩家把手电放低到画面下缘。远处魏延放下手。','切姜维和灰褐衣袖局部近景；不显示主灯被手电替代，不展示任何军队因此冲锋。')],
         sounds='手电开关两次轻响、夜风、衣甲轻碰与远处火盆；无无线电、无新增口令。'),
    dict(id='C1END-ITEM', key='item', ending='item-plan', name='另有办法',
         source='GameStarter/web-demo/src/chapters/chapter-one/supply-endings.ts',
         entry='实际持有的物品及用法已获接受，军报回令完成；具体物品由本轮存档决定。',
         core='我把本轮物品收好，魏延为执行让出路。只表现准备和约定，没有把尚未试行的办法拍成已奏效。',
         shots=[('保持首帧两位将军与案头，灰褐袖双手合拢到已经扎紧的小布包两侧，不拆开、不变出物品。两位将军闭口。','客观案侧中景缓推到手部；布包始终不透明，无法辨认内物。'),
                ('双手把同一布包稳稳拿离木案，带至画面下缘。魏延看向营道，向侧面让半步，姜维留在帐外。','沿提起动作抬镜到魏延，避开玩家正脸、肩背与布包内部。'),
                ('镜头越过空下的案角望向营道，魏延向前一步后站定等待。帐帘仍闭合，天光渐明。','缓慢平移建立可以出发的路；不出现实验成功、药物治愈、凭空军粮或获胜士卒。')],
         sounds='布料擦动、木案轻响、脚步和清晨微风；不新增物品工作声。'),
]
for s in specs:
    s['duration'] = 12
    s['reference'] = str(ROOT/'references'/s['key']/'image-01.png')
    s['status'] = 'reference-generating'
    lines = ['尺寸：16:9','模型：MiniMax-H3（OpenAI Next）','声音：有声音（环境与动作声，无对白）','时长：12秒','','## 参考图','',f"1. 图片1｜{s['name']}构图首帧｜用途：锁定本片实际角色身份、衣甲、道具数量、站位及光照。",f"   本地路径：`{s['reference']}`",'   API角色：first_frame；只上传这张生成且经自查的首帧。身份源图及生图绑定保留在references/对应request.json，不混入视频首帧模式。','','## 视频生成 Prompt','',f"{s['core']} 全片为连续12秒的完整结局短片，第三人称客观摄影，低饱和历史电影实拍，保留自然肤色、灰阶层次和旧衣甲材质。无字幕、水印、旁白、标志、拼贴、分屏。"]
    api = [f"16:9，12秒，历史电影实拍，低饱和灰青土褐，自然肤色，局部暖火光。严格保持输入首帧的人物身份、衣服和道具。{s['core']} 不生成字幕、水印、文字、片名、拼贴或分屏。"]
    for i,(action,camera) in enumerate(s['shots']):
        start,end=i*4,(i+1)*4
        relation = '图片1作为真实首帧，锁定本镜人物与空间、道具和光照；人物起始位置以图中实际位置为准，随后只做本镜明确写出的动作。' if i==0 else '图片1继续锁定本镜同一人物的脸、年龄、发型、衣甲及空间方位，道具状态严格继承前镜；仅改变本镜所述景别，不重置为首帧。'
        lines += [f'### 分镜{i+1}｜{start}-{end}秒','',f'参考图关系：{relation}','',f'画面与动作：{action}','',f'摄影与切点：{camera}','','对白：无对白、无旁白、无额外人声；所有可见人物闭口。','']
        api.append(f'{start}—{end}秒：{action} {camera}')
    limits='脸型、年龄、发型、衣服、设备数量和空间不改变。玩家仅使用既有灰褐袖、局部或遮脸背影，不生成未确定的玩家脸。不是交互选择画面，不新增证据、军令、裁处或成功事件。'
    sound=f"声音要求：全片无BGM、无背景音乐、无配乐、无吟唱。仅保留同步现场声：{s['sounds']} 无对白、无旁白，不朗读画面描述。"
    lines += ['### 全片约束','',f'连续性与限制：{limits}','','拍摄手法参考：参考《影》的灰阶环境与自然肤色分离、以有限光源显出布料和金属材质，应用于三镜的环境与人物照明；来源为已核验的[ASC摄影访谈](https://theasc.com/article/dual-nature-shadow/)。本片的景别、走位和切点为本项目设计，不声称复刻影片镜头。','',sound]
    api += [limits,sound]
    (ROOT/'prompts'/f"{s['id']}-{s['name']}.md").write_text('\n'.join(lines)+'\n',encoding='utf-8')
    (ROOT/'prompts'/f"{s['id']}.api.txt").write_text('\n'.join(api),encoding='utf-8')
    s['prompt'] = str(ROOT/'prompts'/f"{s['id']}-{s['name']}.md")
    s['apiPrompt'] = str(ROOT/'prompts'/f"{s['id']}.api.txt")
(ROOT/'plan.json').write_text(json.dumps(specs,ensure_ascii=False,indent=2),encoding='utf-8')
print('Authored',len(specs),'complete 12-second ending prompts; no API calls.')
