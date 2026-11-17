from pathlib import Path
import sys,json,concurrent.futures,hashlib,time
ROOT=Path(__file__).resolve().parents[4];OUT=Path(__file__).resolve().parents[1];REF=OUT/'references'
sys.path.insert(0,'C:/Users/zhousirui/Documents/ChatGPT/平行世界/tools')
import image_api as api
S=REF/'source-frames';CORE=ROOT/'source-art/core'
style='16:9横幅写实历史电影定帧，三国蜀汉军营，低饱和墨灰、山青、麻白与土褐，保留自然肤色、微暖日光和暗部材质。真实粗麻、旧木、暗铁。不要绘画、水墨纹理、CG皮肤、HDR锐边、全局蓝橙、现代物品、字幕、分屏、拼图、标注、可读文字、水印。只输出一张正常摄影画面。'
jobs=[]
def job(id,text,refs,use):jobs.append(dict(id=id,prompt=style+'\n'+text,refs=[str(p.resolve()) for p in refs],use=use))
job('苟安','图1只锁同一个苟安脸、头巾、胡须、发髻与灰麻衣。把当前半趴姿势改成放松、闭嘴的胸像身份参考，中性表情；保留四十岁上下、微疲惫，不美化换脸，不新增绷带、血伤、盔甲或新配饰。简单暗米灰帐布背景，柔和侧光。人物只有一名，无手或武器挡脸。',[S/'gouan-talk.png'],'锁现片苟安脸、黑巾发髻短须与灰麻衣；姿态/伤势按剧情')
job('伤帐','图1锁空间和苟安衣服。拍同一伤帐空间的正常第一视角空景：右侧绳编木榻、榻头卷布、榻后悬旧甲和暗红布，左后小木凳和陶碗，帐布旧米白、木支柱位置明确。没有人物，没有血污，无文字。日间漫射天光，阴影可读。镜头眼高略低符合床边站立俯视，50mm自然透视。',[S/'gouan-tent.png'],'伤帐床、衣甲悬挂、灯与门方向；无人空间基准')
job('粮仓','图1锁现有军营粮棚风格，只取建筑而不取人物。第一人称人眼高度看向本批粮交接的开敞粮棚与木案，左侧少量封口麻袋和明显空出的木架位，中间可通行地面，右侧案头用于查账。不要堆成足额满仓，不表示盗粮。自然阴天，无人无文字。',[S/'granary.png'],'粮棚/案头/通道空间，少量麻袋不作为粮数证据')
job('查粮案头','从图1继承旧木、麻袋、营地天光质感，近距离第一人称向下看同一仓中案头。桌上三束细木牍和一卷平整麻纸、细绳、木筹，全部纸面木牍留白没有文字印章。左右依次摆放，留足后期叠加账页空间。无手无人，器物正常比例，非俯视地图无人机镜头。',[S/'granary.png'],'查账近景、并排核对留白；精确记录后期叠加')
job('粮队管事','参考图只借军营材质与摄影风格，不复制照片中人的脸。新角色粮队管事，约45岁中国男性，略宽方脸、两颊风霜、细短胡须，深褐布巾包髻，灰褐粗麻交领衣、旧皮腰带，没有将军铠甲。一名单人胸像，闭口中性表情，背后虚化粮棚，无道具遮脸。',[S/'granary.png'],'粮队管事固定身份；白天夜间共用')
job('仓吏','参考图只借摄影材质。新角色仓吏，约50岁中国男性，窄长脸、细眉、瘦鼻、短而稀的山羊胡，黑色软布帽，深灰旧布交领衣；双肩放松，闭嘴中性表情，单人胸像，无眼镜，无甲，无手持笔。不要复制图中年轻运粮兵脸。',[S/'granary.png'],'仓吏固定身份，查账许可及结论')
job('前线接收人','参考图只借摄影质感。新角色前线接收粮吏，约35岁中国男性，瘦长方脸、短发髻、窄黑布头带，无胡须，灰褐布衣上穿小片旧皮护肩，简朴军人。一个人胸像、闭嘴、不持武器，眼神平实，不同于图中人脸。',[S/'granary.png'],'前线接收人固定身份')
job('地方经手人','参考图只借摄影质感。新角色地方经手人，约55岁中国男性，圆脸、眼角细纹、微灰短胡须、旧褐布帽，浅土色麻衣深灰领，平民文书人员而非官将。一个人胸像，嘴闭合，平实中性，旧木墙虚背景，无眼镜。',[S/'granary.png'],'地方经手人固定身份')
job('仓中经手人','参考图只借摄影质感。新角色仓中经手人，约30岁中国男性，圆润偏长脸、较厚眉、无须、灰布包髻，褪色青灰粗麻交领衣，无铠甲。一个人胸像、闭嘴、认真平实，粮仓虚背景。不要复制其他角色脸。',[S/'granary.png'],'仓中经手人固定身份，受杖前签认见证')
job('收件军吏','参考图只借军营摄影风格，不复制人物。新角色收件军吏，约45岁中国男性，颧骨稍高、方下颌、整齐短髭、黑软冠，深灰麻布交领外袍、内领米白。中性克制，单人胸像闭嘴，不威吓，不穿将军金甲。后景简单帐布与案架虚化。',[CORE/'乙.png'],'收件军吏统一身份；V26/29/36/38/39等')
job('李严','参考图仅借历史摄影和布料质感，绝不复制参考中角色的脸。创建蜀汉李严统一身份：五十多岁中国男性，略丰厚方脸，深眼窝，眉间浅纹，灰黑短鬓，修整齐的半长胡须，黑色文官冠、暗褐色质朴交领官袍、米白内领，无龙纹。一个人闭口平静胸像，不戴甲、不拿扇、不复制诸葛亮或魏延。木窗柔和侧光，白天；身份图不决定正式镜头时段。',[CORE/'乙.png'],'新建李严统一身份，夜访/日间读信同脸同冠')
job('书房','借图1历史电影材质，建立蜀汉普通高级军吏的书房，无人。第一人称站在木案前朝对面坐位看，左侧木窗、右后简牍架、粗木案、未点燃的小陶油灯，竹木牍和留白麻纸少量整齐摆放。不是宫殿，无珠帘金饰，无文字。白昼天光从左侧，供夜镜把窗外转暗且只点案灯，布局不改。',[S/'granary.png'],'李严书房固定空间，昼夜由分镜控制')
job('访村','图1锁老妇人的脸、灰布包头、蓝灰补丁衣及村庄环境，但不要复制左侧男性和背后围观人。第一视角桌前，我看到同一老妇人把少量粮谷装入自己面前小布袋，她闭嘴低头，手自然，不夸张痛哭。木屋、土院、少量麻袋，粮少而不神化苦难。不要满仓满车，不新增征粮暴力，不加文字。',[S/'village.png'],'同一老妇人及村庄，手与少量粮的观察镜')
job('收件案头','图1只锁军营旧木与布料质感。第一人称站在收件木案前，案后无人，后方帐布与一处简牍架，左侧开口透入自然柔光。桌上留白纸卷、木牍、细绳和一个普通小印盒，摆放清楚供递交、接过、核验和登记动作。无可读文字、不生成盖好章的收据、不提前演已收件。',[S/'granary.png'],'收件军吏案头空间；不预置已完成的事件')
job('信使','图1只借军营历史摄影风格，不复制人物。新角色传信兵，约25岁中国男性，窄脸、无须、低束发髻配褐色布头带、灰褐粗麻衣、小皮护肩与布腰带。单人闭嘴胸像，神态平实，简单营地虚背景；不要现代邮包、马具或武器挡脸。',[S/'granary.png'],'传信兵统一身份')
api.atomic_json(REF/'jobs.json',jobs)
def work(j):
 d=REF/'generated'/j['id'];d.mkdir(parents=True,exist_ok=True);(d/'prompt.txt').write_text(j['prompt'],encoding='utf-8')
 try:
  if (d/'result.json').exists():r=json.loads((d/'result.json').read_text(encoding='utf-8'))
  elif (d/'response.json').exists():r=api.resume(d)
  elif (d/'generation.json').exists():return {'id':j['id'],'status':'unknown_existing_no_retry'}
  else:
   body=api.build_request(j['prompt'],size='2048x1152',references=j['refs']);r=api.generate_once(body,d)
  row=dict(id=j['id'],path=r['local_path'],sha256=r['sha256'],use=j['use'],status='generated_pending_visual_review')
 except Exception as e:row=dict(id=j['id'],status='error',error=str(e))
 api.atomic_json(REF/'results'/f"{j['id']}.json",row);print(json.dumps(row,ensure_ascii=False),flush=True);return row
if __name__=='__main__':
 selected=set(sys.argv[1:]);todo=[j for j in jobs if not selected or j['id'] in selected]
 with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:results=list(pool.map(work,todo))
 api.atomic_json(REF/'generation-summary.json',results)
