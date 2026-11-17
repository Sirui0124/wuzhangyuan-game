from pathlib import Path
import json, shutil, hashlib, re

out=Path(r'C:/Users/zhousirui/Documents/ChatGPT/逆转五丈原/video/production/CH01-opening-dream-20261103')
src=Path(r'C:/Users/zhousirui/.codex/generated_images/01a18b78-9a89-7ef3-ae12-ec7d4d7703b3/exec-defe61fc-d431-4104-8ba3-cf876b9b1542.png')
old=out/'references/11-回忆她在桌对面.png'
new=out/'references/11-回忆她在桌对面-v2-清纯白月光.png'
doc=out/'02-深夜工位与三段遗憾回忆-18秒.md'
before=doc.read_text(encoding='utf-8')
shutil.copy2(doc,out/'audit/02-before-woman-v2.md.txt')
shutil.copy2(src,new)
role='锁她清秀柔和的五官、干净眉眼、自然淡妆与清纯白月光气质，保留米色开衫、蓝灰上衣、桌对面构图和自然侧光；不生成眉侧脏印、斑块或杂发阴影，表情随台词轻微变化，不作浓妆或夸张美颜。'
oldrole='锁她的脸、发型、米色开衫与蓝灰上衣、桌对面构图与自然侧光；表情随台词小幅变化，不强制复制静止表情。'
text=before.replace(old.as_posix(),new.as_posix()).replace('图片6｜11-回忆她在桌对面','图片6｜11-回忆她在桌对面-v2-清纯白月光').replace(oldrole,role)
text=text.replace('图片6锁她的身份、米色开衫、桌对面位置和自然窗光；','图片6锁她清秀柔和的身份、干净眉眼、米色开衫、桌对面位置和自然窗光；')
assert re.findall(r'唯一允许发声的原句：([^\n]+)',before)==re.findall(r'唯一允许发声的原句：([^\n]+)',text)
assert old.as_posix() not in text
doc.write_text(text,encoding='utf-8')
# Keep the preparation source reproducible without regenerating or touching the other two documents.
generator=out/'audit/prepare_documents.py'
g=generator.read_text(encoding='utf-8').replace("'11-回忆她在桌对面.png'","'11-回忆她在桌对面-v2-清纯白月光.png'").replace(oldrole,role)
g=g.replace('图片6锁她的身份、米色开衫、桌对面位置和自然窗光；','图片6锁她清秀柔和的身份、干净眉眼、米色开衫、桌对面位置和自然窗光；')
generator.write_text(g,encoding='utf-8')
paths=out/'audit/generated-paths.json'
pd=json.loads(paths.read_text(encoding='utf-8')); pd['memory_woman']=str(src)
paths.write_text(json.dumps(pd,ensure_ascii=False,indent=2),encoding='utf-8')
recordpath=out/'audit/production-record.json'
record=json.loads(recordpath.read_text(encoding='utf-8'))
for item in record['references']:
    if item['key']=='woman':
        previous=item.copy()
        item.update(path=str(new),source=str(src),sha256=hashlib.sha256(new.read_bytes()).hexdigest(),version='v2',status='待review')
record.setdefault('reference_revisions',[]).append(dict(key='woman',version='v2',user_request='更清纯、白月光感，去掉眉毛左侧像脏印的痕迹',previous=previous,current=str(new),user_approved=False))
recordpath.write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
for path in re.findall(r'本地路径：`([^`]+)`',text): assert Path(path).is_file()
assert text.count('### 图片6｜')==1
assert text.rfind('声音要求：')>text.rfind('拍摄手法参考：')
assert old.is_file() and new.is_file()
report=dict(ok=True,new_reference=str(new),document=str(doc),old_reference_preserved=str(old),reference_upload_position=6,dialogue_unchanged=True,all_document_image_paths_exist=True,video_generated=False,user_approved=False)
(out/'audit/woman-v2-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2))
