from pathlib import Path
import json, shutil, hashlib, re

out=Path(r'C:/Users/zhousirui/Documents/ChatGPT/逆转五丈原/video/production/CH01-opening-dream-20261103')
changes={
 'phone':dict(old='07-第一视角持机与工位.png',new='07-普通办公室持机-v2-20261104.png',source=Path(r'C:/Users/zhousirui/.codex/generated_images/01a18b78-9a89-7ef3-ae12-ec7d4d7703b3/exec-cc4ee0ba-642c-404f-936f-cda58f12339e.png')),
 'desk':dict(old='08-落桌手机与停下来的手.png',new='08-普通办公室停手-v2-20261104.png',source=Path(r'C:/Users/zhousirui/.codex/generated_images/01a18b78-9a89-7ef3-ae12-ec7d4d7703b3/exec-d300bcdc-0b9c-419c-b2f2-e65ec3cfac6f.png')),
}
scene='当下场景改为普通小公司的深夜办公室：浅灰窄桌与旧灰布隔板，普通显示器在左侧斜放，键盘居前，鼠标与磨损鼠标垫在右，手机落点在鼠标右侧、水杯前方。左后角留一盒没吃完的晚饭，右侧相邻空椅背搭着黑色外套，包放在椅边。只保留当前一组普通顶灯与屏幕自然溢光，夜窗外是普通楼房少量亮窗。物件有使用痕迹但不脏乱，不再出现精致咖啡、装饰台灯、绿植或高楼夜景；不为了表现落魄额外堆满杂物。桌面、手和手机保留正常光学细节，显示器文字因观看角度与景深不需可读；不把代码大屏拍成视觉中心，不用方块模糊补丁。'
phone_role='锁第一视角双手、深灰针织袖、黑框横屏手机及普通小办公室：左侧斜放显示器、灰桌隔板、左后角晚饭盒、相邻空椅外套与普通顶灯；手机屏内仍是同一已灭主灯。'
desk_role='锁手机在鼠标右侧、水杯前方的落点、停手姿势和普通小办公室布局；晚饭盒留在左后角、外套留在相邻椅背，所有物件与持机图对应，供本条末尾和第3条开头共用。'
for info in changes.values(): shutil.copy2(info['source'],out/'references'/info['new'])

def revise(t):
    for info in changes.values():
        t=t.replace(info['old'],info['new']).replace(info['old'][:-4],info['new'][:-4])
    t=t.replace('锁第一视角的双手、深灰针织袖、黑框横屏手机、夜间工位布局和灯光；手机内是同一已灭主灯。',phone_role)
    t=t.replace('锁手机放在鼠标右侧、水杯前方，双手回键盘后的当下状态；供本条末尾与第3条开头共用。',desk_role)
    t=t.replace('本条现代段的起始构图、夜间工位、双手、深灰针织袖与手机落点；与第2条结尾是同一状态。','本条现代段的起始构图、普通小公司深夜办公室、灰桌与隔板、左后角晚饭盒、邻椅外套、停下的双手、深灰针织袖与手机落点；与第2条结尾是同一状态。')
    t=t.replace('当前在同一深夜工位，现代手机横屏；','当前在同一普通小办公室的深夜工位，现代手机横屏；'+scene)
    t=t.replace('现代段是同一空办公室，手机始终在鼠标右侧，','现代段是同一普通小公司的空办公室，'+scene+'手机始终在鼠标右侧，')
    t=t.replace('手停在键盘前，手机仍在鼠标右侧，没有被拿起。三段回忆的人声已经全部结束。','手停在键盘前，手机仍在鼠标右侧，没有被拿起。眼前仍是没吃完的晚饭和空下来的工位，视线只短暂低落，不额外加长发呆镜头。三段回忆的人声已经全部结束。')
    t=t.replace('我略低头看一眼桌上的手机，屏内仍是已灭灯影像；','视线从桌角没吃完的晚饭落到手机，屏内仍是已灭灯影像；')
    t=t.replace('最后回工位不残留她的尾句或重复的回忆人声；','普通顶灯仅有极轻的室内底噪，不增加戏剧化电流啸叫。最后回工位不残留她的尾句或重复的回忆人声；')
    return t

docs=[out/'02-深夜工位与三段遗憾回忆-18秒.md',out/'03-闭眼睡去与梦回五丈原-14秒.md']
checks=[]
for doc in docs:
    before=doc.read_text(encoding='utf-8')
    shutil.copy2(doc,out/'audit'/(doc.stem+'-before-workstation-v2.md.txt'))
    after=revise(before)
    assert re.findall(r'唯一允许发声的原句：([^\n]+)',before)==re.findall(r'唯一允许发声的原句：([^\n]+)',after)
    assert re.findall(r'### 分镜\d+｜[^\n]+',before)==re.findall(r'### 分镜\d+｜[^\n]+',after)
    for p in re.findall(r'本地路径：`([^`]+)`',after): assert Path(p).is_file()
    assert all(info['old'] not in after for info in changes.values())
    assert after.rfind('声音要求：')>after.rfind('拍摄手法参考：')
    doc.write_text(after,encoding='utf-8')
    checks.append(dict(document=str(doc),dialogue_unchanged=True,duration_unchanged=True,all_reference_paths_exist=True))

pathsfile=out/'audit/generated-paths.json'; paths=json.loads(pathsfile.read_text(encoding='utf-8'))
for key,info in changes.items(): paths['workstation_'+key+'_v2']=str(info['source'])
pathsfile.write_text(json.dumps(paths,ensure_ascii=False,indent=2),encoding='utf-8')
gp=out/'audit/prepare_documents.py'
g=revise(gp.read_text(encoding='utf-8'))
g=g.replace("'07-普通办公室持机-v2-20261104.png', ROOT / 'video/production/CH01-continuity-20261028/opening-20261029/references/01-持机与灭灯画面.png'","'07-普通办公室持机-v2-20261104.png', Path(GEN['workstation_phone_v2'])")
g=g.replace("'08-普通办公室停手-v2-20261104.png', ROOT / 'video/production/CH01-continuity-20261028/opening-20261029/references/02-深夜工位停下来的手.png'","'08-普通办公室停手-v2-20261104.png', Path(GEN['workstation_desk_v2'])")
g=g.replace("generated=key in ['ritual','bitcoin','ai','woman','sunset']","generated=key in ['ritual','bitcoin','ai','woman','sunset','phone','desk']")
g=g.replace('new_generated_reference_count=5','new_generated_reference_count=7')
gp.write_text(g,encoding='utf-8')

rp=out/'audit/production-record.json'; record=json.loads(rp.read_text(encoding='utf-8'))
for item in record['references']:
    if item['key'] in changes:
        key=item['key']; info=changes[key]; previous=item.copy(); dest=out/'references'/info['new']
        item.update(path=str(dest),source=str(info['source']),sha256=hashlib.sha256(dest.read_bytes()).hexdigest(),version='v2',generated=True,status='待review')
        record.setdefault('reference_revisions',[]).append(dict(key=key,version='v2',date='2026-11-04',user_request='工位图片质量差、场景缺少共鸣；改为普通办公室与日常使用细节',previous=previous,current=str(dest),user_approved=False))
record['new_generated_reference_count']=7
record.setdefault('scene_revisions',[]).append(dict(date='2026-11-04',scene=scene,scope='OP-DREAM-02与03的当下工位段及两张参考图，台词和时长不变',video_generated=False,game_binding_changed=False))
rp.write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
report=dict(ok=True,new_references=[str(out/'references'/v['new']) for v in changes.values()],checks=checks,old_images_preserved=True,woman_v8_preserved='11-回忆她在桌对面-v8-自然窗光真实肤质.png' in docs[0].read_text(encoding='utf-8'),video_generated=False)
(out/'audit/workstation-v2-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2))
