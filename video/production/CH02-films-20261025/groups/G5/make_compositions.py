from pathlib import Path
import sys,json,concurrent.futures
OUT=Path(__file__).parent;ROOT=OUT.parents[1]
sys.path.insert(0,'C:/Users/zhousirui/Documents/ChatGPT/平行世界/tools')
import image_api as api
manifest=json.loads((ROOT/'references/manifest.json').read_text(encoding='utf-8'))['byId']
STYLE='16:9横幅，三国蜀汉五丈原历史电影实拍定帧，自然肤色，可读暗部，低饱和墨灰山青土褐麻白。正常40–50mm透视，镜头是观看者眼睛，不出现观看者脸、肩背或倒影，不是第三人称越肩。无可读文字、无字幕、水印、黑边、现代物件、水墨纹理、塑料皮肤、全局蓝橙。中央身份图只锁同一人脸、发型、胡须和服装；空间图只锁空间，不复制背景路人。只输出一张正常摄影画面，禁止拼图分屏。'
jobs=[
dict(id='gouan-tent-desk',refs=['苟安','伤帐'],prompt='图片1严格锁同一个苟安的脸、黑巾、短须、灰麻衣，不美化换脸。图片2严格锁同一伤帐右侧绳编木榻、卷布、旧甲与暗红悬布、左后陶碗小凳。苟安从第一帧就坐在木榻边低案后，面向镜头位置闭口倾听，中近景眼线略低；身体略侧以避开背伤，无新增绷带，无盔甲。低案下沿仅有一张尚未写字的麻纸、一支置于笔搁的笔、一只砚，无手伸向观看者。夜间帐内小灯在左，暖光只照脸与纸，帐口深蓝灰，暗部清楚。不要站起、不要铺纸、不要拿笔、不要伸手，本图锁开拍前安静倾听状态。'),
dict(id='liyan-study-desk',refs=['李严','书房'],prompt='图片1严格锁同一个李严的脸、年龄、整齐胡须、黑冠暗褐袍，非诸葛亮。图片2只锁左侧木窗、右后简牍架、粗木案、窗外日景。李严从第一帧就在对面低案后席坐，正面朝向送信人镜头，闭口中性，手自然在案旁，案上右侧一张展开但留白的麻纸，左侧另一卷未打开旧纸，一支毛笔。正常人眼中近景，脸、双手、案头都有清楚空间，不出现高背椅，不是宫殿，不生成可读文字。左侧柔和日光，正常日间，无夜灯光。'),
dict(id='clerk-receiving-desk',refs=['收件军吏','收件案头'],prompt='图片1严格锁同一个收件军吏的脸、短髭、黑软冠、深灰袍米白内领。图片2锁同一收件木案、帐口、后简牍架、左侧自然柔光。军吏从第一帧就在低案后正对我席坐，闭口等候收件，中近景看得见脸和低案前边缘；案上纸牍少量留白，不放已经盖好章的收据，不提前宣布收齐。我不出镜。面部克制，无怒目，无甲，无新增主角。'),
dict(id='gouan-empty-cart-road',refs=['苟安','粮仓'],prompt='图片1严格锁同一苟安的脸、短须、黑巾与灰麻衣，此时是被免队长后的普通粮兵，没有军官标识和甲；不新增绷带。图片2只取军营旧木粗麻、土褐麻白与阴天光，不继承粮仓建筑。场景是向南的缓坡土路，镜头是我站在一辆完全空的双轮旧木粮车后两步，后横木在前方画面下部；苟安在空车左侧，半侧脸可辨，手在车侧扶木，不看我、不说话；远处少量蜀军背向南行，不复制队列，不出现现代轮胎。车轮、轮轴、横木结构可信，地上浅车辙清楚；无需我的手或武器入镜。')]
def work(j):
    folder=OUT/'references'/j['id'];folder.mkdir(parents=True,exist_ok=True)
    prompt=STYLE+'\n'+j['prompt'];(folder/'prompt.txt').write_text(prompt,encoding='utf-8')
    if (folder/'generation.json').exists():return dict(id=j['id'],status='existing; no repeat')
    body=api.build_request(prompt,size='2048x1152',references=[manifest[k]['path'] for k in j['refs']])
    result=api.generate_once(body,folder)
    return dict(id=j['id'],status='generated-pending-review',path=result['local_path'],sha256=result['sha256'])
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    for f in concurrent.futures.as_completed([pool.submit(work,j) for j in jobs]):
        try:print(json.dumps(f.result(),ensure_ascii=False),flush=True)
        except Exception as e:print(json.dumps(dict(status='error-no-retry',error=str(e)),ensure_ascii=False),flush=True)
