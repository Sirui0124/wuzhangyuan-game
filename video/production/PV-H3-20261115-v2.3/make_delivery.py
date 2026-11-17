from pathlib import Path
import json,html,subprocess
R=Path(__file__).resolve().parent;P=R.parent/'PV-H3-20261115-v2.2'
FF=r'D:/AI视频/VJ-1106/motion-runtime/node_modules/ffmpeg-static/ffmpeg.exe'
T=json.loads((R/'edit-timeline.json').read_text('utf-8'));shots=T['shots'];film='逆转五丈原-PV-v2.3-完整成片.mp4'
def tc(t):return f'{int(t)//60:02d}:{int(t)%60:02d}'
thumbs=R/'review-thumbs';thumbs.mkdir(exist_ok=True);cards=[];rows=['| 时间 | 内容 |','| --- | --- |']
for s in shots:
 p=thumbs/(s['id']+'.jpg')
 subprocess.run([FF,'-v','error','-y','-ss',str(s['timeline_in']+s['duration']*.5),'-i',str(R/film),'-frames:v','1','-vf','scale=384:216',str(p)],check=True)
 cards.append(f'<button class="shot" data-time="{s["timeline_in"]}"><img loading="lazy" src="review-thumbs/{s["id"]}.jpg" alt="{html.escape(s["title_name"])}"><span>{tc(s["timeline_in"])} · {html.escape(s["title_name"])}</span></button>')
 rows.append(f'| {tc(s["timeline_in"])}—{tc(s["timeline_out"])} | {s["title_name"]} |')
old=(P/'成片审阅-v2.2.html').read_text('utf-8')
page=old.split('<div class="grid">')[0]+'<div class="grid">'+''.join(cards)+'</div><details>'+old.split('</div><details>',1)[1]
page=page.replace('v2.2','v2.3').replace('91.375秒',str(T['duration'])+'秒').replace('修订导演稿-v2.3.md','修订记录-v2.3.md').replace('修订导演稿</a>','本轮修订记录</a>').replace('庞统整段提速；败营从火烧连营开始；谷火在雨中熄灭；马谡与诸葛亮恢复短镜头衔接；结尾重新拍摄伸手、抓牢和受力。','本轮修订：雨水浸过余炭；马谡补回呼吸与衣料声；诸葛亮采用连续举扇动作；救人收束后，呼吸延续至片名渐显。')
(R/'成片审阅-v2.3.html').write_text(page,'utf-8')
doc=f'''# 《逆转五丈原》PV v2.3 交付记录

2026-11-15。完整成片{T['duration']}秒，1280×720，24fps，{round(T['duration']*24)}帧，AAC48kHz立体声。无BGM，本版待用户观看审核。旧版与原始请求保留。

## 四处修订

本轮用户指出v2.2的52秒灭火假、1分03秒没有声音、1分08秒两段衔接不上、1分27秒片尾奇怪；随后明确“补回人物呼吸、衣料和环境音，保持无对白”。

- 原R02火苗突然消失的镜头撤掉。新镜头用“雨中余炭→诸葛亮反应→湿黑炭”衔接；R04RR中间0.75—2秒火苗抬升与夸大水花弃用，采用开头0.75秒与2—4.5秒，正放，以连续雨声连接。没有把模型错误当成完整连续灭火动作交付。
- 补拍M03马谡近景，人物呼吸从跪地中景先进入，再续到近景。保持无对白，补回衣料与营地环境声。
- 撤掉M02近景到G21中景的跳接。诸葛亮采用同一条低头、举扇、遮面的连续动作，动作声音同步保留。
- 片尾压缩握手后的等待，以受力动作收束；呼吸越过画面切点，片名在短暂黑场后渐显，最后渐隐。

庞统约1.3倍速和先见连营的败营结构沿用v2.2。本轮只修正点名问题及必要衔接，未宣称此前整片均已获用户通过。

## 制作与声音

新增动态画面按用户指定的MiniMax-H3 SOP执行，模型MiniMax-H3，768P；原片通常1344×768，最终裁为1280×720。screenwriting-master用于动作与镜头关系检查。新雨景参考图由内置imagegen生成并复制到references目录，生成文字另存image-reference-prompt.txt；每条H3提示词保存在对应镜头prompt.txt。没有用静态参考图填充成片剧情。

M03原声的音乐筛查分数较高，没有直接采用整条音乐声床。使用MDX估计后取人声残差、保留呼吸，再配无旋律营地环境声。G21原声含错误念白，去除后保留衣料和羽扇动作声。详情见sound/provenance.json。

雨声沿用已保存的公有领域[Rain.ogg](https://commons.wikimedia.org/wiki/File:Rain.ogg)，作者ジダネ，PD-self。声音按本轮实际动作重新匹配，无新增BGM。

## 服务异常与授权

R04返回HTTP520、R04R返回HTTP522，均无任务ID，保留为未知结果，不能排除已创建和计费。用户两次分别授权重提一次，对应R04R与R04RR；没有自动重投未知请求。M03查询失败仅沿原ID恢复。当前状态见task-registry.json，授权原文见authorization-R04R.json及authorization-R04RR.json。

## 检查边界

final-technical.json记录最终帧数、画音时长、编码与完整解码；sound-levels.json记录逐段电平。原片与成片抽帧用于动作和衔接检查。ASR只定位语言，AST只筛查音乐风险，不冒充人工逐句听审、精确口型认证或用户已通过。browser-verification.json记录网页完整1倍速静音技术播放、定位和移动布局的实际结果。

## 剪辑时间

'''+ '\n'.join(rows)+'\n'
(R/'交付说明-v2.3.md').write_text(doc,'utf-8')
(R/'check_review.mjs').write_text((P/'check_review.mjs').read_text('utf-8-sig').replace('v2.2','v2.3'),'utf-8')
print('Review page and delivery record prepared.')
