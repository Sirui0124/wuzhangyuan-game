from pathlib import Path
import json, shutil, hashlib, re
out=Path(r'C:/Users/zhousirui/Documents/ChatGPT/逆转五丈原/video/production/CH01-opening-dream-20261103')
src=Path(r'C:/Users/zhousirui/.codex/generated_images/01a18b78-9a89-7ef3-ae12-ec7d4d7703b3/exec-91b77129-a8be-4275-a2d9-16e346edc422.png')
oldname='11-回忆她在桌对面-v2-清纯白月光.png'
newname='11-回忆她在桌对面-v3-长发清瘦自然纹路.png'
new=out/'references'/newname
shutil.copy2(src,new)
doc=out/'02-深夜工位与三段遗憾回忆-18秒.md'
before=doc.read_text(encoding='utf-8')
shutil.copy2(doc,out/'audit/02-before-woman-v3.md.txt')
oldrole='锁她清秀柔和的五官、干净眉眼、自然淡妆与清纯白月光气质，保留米色开衫、蓝灰上衣、桌对面构图和自然侧光；不生成眉侧脏印、斑块或杂发阴影，表情随台词轻微变化，不作浓妆或夸张美颜。'
newrole='锁她清瘦的脸颊与轮廓、胸前长发、干净眉眼、眼角细纹和浅笑纹，保留清纯白月光气质、自然皮肤纹理与个人辨识度；米色开衫、蓝灰上衣、桌对面构图和自然侧光保持一致。细纹是自然表情纹，不是脏印、划痕或过度老化；不浓妆、不磨皮，表情随台词轻微变化。'
def revise(text):
    return text.replace(oldname,newname).replace(oldname[:-4],newname[:-4]).replace(oldrole,newrole).replace('图片6锁她清秀柔和的身份、干净眉眼、米色开衫、桌对面位置和自然窗光；','图片6锁她清瘦长发的身份、干净眉眼、自然眼角细纹与浅笑纹、米色开衫、桌对面位置和自然窗光；')
after=revise(before)
assert re.findall(r'唯一允许发声的原句：([^\n]+)',before)==re.findall(r'唯一允许发声的原句：([^\n]+)',after)
for path in re.findall(r'本地路径：`([^`]+)`',after): assert Path(path).is_file()
assert oldname not in after
doc.write_text(after,encoding='utf-8')
gen=out/'audit/prepare_documents.py'
gen.write_text(revise(gen.read_text(encoding='utf-8')),encoding='utf-8')
paths=out/'audit/generated-paths.json'
data=json.loads(paths.read_text(encoding='utf-8')); data['memory_woman']=str(src)
paths.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
rp=out/'audit/production-record.json'
record=json.loads(rp.read_text(encoding='utf-8'))
for item in record['references']:
    if item['key']=='woman':
        previous=item.copy()
        item.update(path=str(new),source=str(src),sha256=hashlib.sha256(new.read_bytes()).hexdigest(),version='v3',status='待review')
record.setdefault('reference_revisions',[]).append(dict(key='woman',version='v3',user_request='再瘦一些、长发，脸上有自然纹路，更有特点',previous=previous,current=str(new),user_approved=False))
rp.write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
report=dict(ok=True,new_reference=str(new),upload_position=6,dialogue_unchanged=True,all_image_paths_exist=True,old_versions_preserved=True,video_generated=False,user_approved=False)
(out/'audit/woman-v3-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
